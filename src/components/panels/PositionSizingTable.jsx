/**
 * @fileoverview Position sizing table with lot recommendations.
 */

import React, { useState } from "react";
import { Calculator } from "lucide-react";
import PropTypes from "prop-types";
import { formatINR } from "../../utils";

/**
 * Renders position sizing recommendations based on Kelly criterion.
 * F-032: Position Sizing Table.
 *
 * @param {Object} props
 * @param {Object} props.metrics Computed metrics (kellyHalf needed).
 * @param {number} props.capital Initial capital.
 * @param {number} props.lotSize Current lot size.
 * @param {string} props.riskMode Risk mode ("fixed" or "compounding").
 * @param {number} props.riskPerTrade Fixed risk per trade.
 * @param {number} props.riskPercent Risk percentage (compounding).
 * @returns {React.ReactElement}
 */
const PositionSizingTable = React.memo(
  ({
    metrics,
    capital,
    lotSize,
    riskMode,
    riskPerTrade,
    riskPercent,
    isCrypto,
    cryptoPrice,
    derivativeType,
    usdToInr = 87,
  }) => {
    const [stopLossPoints, setStopLossPoints] = useState(() => {
      if (isCrypto)
        return cryptoPrice ? Math.max(0.0001, cryptoPrice * 0.01) : 100;
      if (derivativeType === "USDINR") return 0.1;
      if (lotSize >= 1000) return 1;
      return 10;
    });

    React.useEffect(() => {
      if (isCrypto && cryptoPrice) {
        setStopLossPoints(
          Math.max(0.0001, Number((cryptoPrice * 0.01).toPrecision(2))),
        );
      } else if (derivativeType === "USDINR" || lotSize === 1000) {
        setStopLossPoints(0.1);
      } else {
        setStopLossPoints(10);
      }
    }, [derivativeType, isCrypto, lotSize, cryptoPrice]);

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Calculator size={15} className="text-orange-400" />
            Position Sizing — Lot Recommendations
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 whitespace-nowrap">
              Stop Loss (pts):
            </label>
            <input
              type="number"
              min="0.01"
              step="any"
              value={stopLossPoints}
              onChange={(e) => setStopLossPoints(Number(e.target.value))}
              className="w-20 bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1 rounded focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>
        <p className="text-xs text-gray-600 mb-3">
          Based on Kelly criterion and risk per trade. Capital levels in
          multiples of current.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left py-2 pr-4 font-semibold">Capital</th>
                <th className="text-center py-2 px-3 font-semibold">
                  Risk/Trade
                </th>
                <th className="text-center py-2 px-3 font-semibold">
                  Max Lots
                </th>
                <th className="text-center py-2 px-3 font-semibold">
                  Kelly Half Lots
                </th>
                <th className="text-center py-2 px-3 font-semibold">
                  Conservative
                </th>
              </tr>
            </thead>
            <tbody>
              {[0.5, 1, 2, 5, 10].map((mult) => {
                const cap = capital * mult;
                const risk =
                  riskMode === "fixed"
                    ? riskPerTrade
                    : cap * (riskPercent / 100);
                const conversionRate = isCrypto ? usdToInr || 1 : 1;
                const kellyPct = Math.max(0, +metrics.kellyHalf) / 100;
                const kellyRisk = cap * kellyPct;
                const maxLots =
                  lotSize > 0 && stopLossPoints > 0
                    ? Math.floor(
                        risk / (lotSize * stopLossPoints * conversionRate),
                      )
                    : 0;
                const kellyLots =
                  lotSize > 0 && kellyPct > 0 && stopLossPoints > 0
                    ? Math.floor(
                        kellyRisk / (lotSize * stopLossPoints * conversionRate),
                      )
                    : 0;
                const conservativeLots =
                  maxLots > 0 ? Math.max(1, Math.floor(maxLots * 0.5)) : 0;
                return (
                  <tr
                    key={mult}
                    className={`border-b border-gray-800/40 ${mult === 1 ? "bg-orange-950/20" : ""}`}
                  >
                    <td
                      className={`py-2 pr-4 font-mono ${mult === 1 ? "text-orange-400 font-bold" : "text-gray-300"}`}
                    >
                      {formatINR(cap)} {mult === 1 && "◀"}
                    </td>
                    <td className="text-center px-3 font-mono text-gray-200">
                      {formatINR(risk)}
                    </td>
                    <td className="text-center px-3 font-mono text-gray-200">
                      {maxLots}
                    </td>
                    <td
                      className={`text-center px-3 font-mono ${metrics.kellyHalf === -1 ? "text-red-400" : "text-green-400"}`}
                    >
                      {metrics.kellyHalf === -1 ? "N/A" : kellyLots}
                    </td>
                    <td className="text-center px-3 font-mono text-blue-400">
                      {conservativeLots}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-gray-600 mt-2">
          Lot size: {lotSize} | SL points: {stopLossPoints || 0} | Kelly Half:{" "}
          {metrics.kellyHalf === -1
            ? "N/A (Negative Edge)"
            : `${metrics.kellyHalf}%`}{" "}
          | Conservative = ½ of max
        </div>
      </div>
    );
  },
);

PositionSizingTable.displayName = "PositionSizingTable";

PositionSizingTable.propTypes = {
  metrics: PropTypes.shape({
    kellyHalf: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }).isRequired,
  capital: PropTypes.number.isRequired,
  lotSize: PropTypes.number.isRequired,
  riskMode: PropTypes.oneOf(["fixed", "compounding"]).isRequired,
  riskPerTrade: PropTypes.number.isRequired,
  riskPercent: PropTypes.number.isRequired,
  isCrypto: PropTypes.bool.isRequired,
  cryptoPrice: PropTypes.number,
  derivativeType: PropTypes.string,
  usdToInr: PropTypes.number,
};

export default PositionSizingTable;
