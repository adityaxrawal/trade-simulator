/**
 * @fileoverview Charges breakdown table showing per-trade and total charges.
 */

import React from "react";
import { DollarSign } from "lucide-react";
import { ASSET_CLASSES, USD_TO_INR } from "../../constants";
import { formatINR, formatCrypto, safeDivide } from "../../utils";

/** Charge row configuration. */
const CHARGE_ROWS = [
  { key: "brokerage", label: "Brokerage", note: "₹20 flat × 2 orders" },
  { key: "stt", label: "STT", note: "Sell turnover only" },
  { key: "ctt", label: "CTT", note: "MCX non-agri only" },
  { key: "exchTxn", label: "Exchange Txn", note: "" },
  { key: "sebiCharge", label: "SEBI Charges", note: "₹10/crore turnover" },
  { key: "gst", label: "GST 18%", note: "On brok + exch txn" },
  { key: "stampDuty", label: "Stamp Duty", note: "Buy side only" },
  { key: "dpCharge", label: "DP Charges", note: "Delivery only" },
];

/**
 * Renders a detailed charges breakdown table.
 *
 * @param {Object} props
 * @param {Object} props.chargesObj Charge breakdown from calculateCharges.
 * @param {number} props.chargesPerTrade Total charges per trade.
 * @param {number} props.numTrades Number of trades.
 * @param {boolean} props.isCrypto Whether current asset is crypto.
 * @param {string} props.assetClass Current asset class key.
 * @param {Object} props.metrics Computed metrics.
 * @param {Object} props.simData Simulation data.
 * @returns {React.ReactElement}
 */
const ChargesBreakdownTable = React.memo(
  ({
    chargesObj,
    chargesPerTrade,
    numTrades,
    isCrypto,
    assetClass,
    metrics,
    simData,
  }) => {
    const exchangeNote = `${ASSET_CLASSES[assetClass]?.exchange} rate`;

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
          <DollarSign size={15} className="text-yellow-400" />
          Charges Breakdown
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left py-2 pr-4 font-semibold">Type</th>
                <th className="text-right py-2 px-3 font-semibold">
                  Per Trade
                </th>
                <th className="text-right py-2 px-3 font-semibold">
                  Total (×{numTrades})
                </th>
                <th className="text-right py-2 px-3 font-semibold">
                  % of Gross
                </th>
                <th className="text-left py-2 pl-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {CHARGE_ROWS.map((row) => {
                const perTrade = chargesObj[row.key] || 0;
                if (perTrade === 0) return null;
                const total = perTrade * numTrades;
                const pct =
                  simData?.totalGrossWins > 0
                    ? safeDivide(total, simData.totalGrossWins) * 100
                    : total > 0
                      ? Infinity
                      : 0;
                let note = row.key === "exchTxn" ? exchangeNote : row.note;
                if (row.key === "brokerage" && isCrypto)
                  note = "Percentage of notional";
                return (
                  <tr
                    key={row.key}
                    className="border-b border-gray-800/40 hover:bg-gray-800/30"
                  >
                    <td className="py-2 pr-4 text-gray-300">{row.label}</td>
                    <td className="text-right px-3 font-mono text-gray-200">
                      {isCrypto
                        ? formatCrypto(perTrade)
                        : formatINR(perTrade, 2)}
                    </td>
                    <td className="text-right px-3 font-mono text-yellow-400">
                      {isCrypto ? formatCrypto(total, 0) : formatINR(total)}
                    </td>
                    <td
                      className={`text-right px-3 font-mono ${pct > 20 ? "text-red-400" : "text-gray-400"}`}
                    >
                      {isFinite(pct) ? `${pct.toFixed(1)}%` : "--"}
                    </td>
                    <td className="pl-3 text-gray-600">{note}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-gray-700 font-bold">
                <td className="py-2 pr-4 text-gray-200">TOTAL</td>
                <td className="text-right px-3 font-mono text-orange-400">
                  {isCrypto
                    ? formatCrypto(chargesPerTrade)
                    : formatINR(chargesPerTrade, 2)}
                </td>
                <td className="text-right px-3 font-mono text-orange-400">
                  {isCrypto
                    ? formatCrypto(metrics.totalCharges / USD_TO_INR, 0)
                    : formatINR(metrics.totalCharges)}
                </td>
                <td
                  className={`text-right px-3 font-mono ${metrics.chargeDragPct > 30 ? "text-red-400" : "text-yellow-400"}`}
                >
                  {isFinite(metrics.chargeDragPct)
                    ? `${metrics.chargeDragPct.toFixed(1)}%`
                    : "N/A"}
                </td>
                <td className="pl-3 text-gray-600">of gross profit</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  },
);

ChargesBreakdownTable.displayName = "ChargesBreakdownTable";

export default ChargesBreakdownTable;
