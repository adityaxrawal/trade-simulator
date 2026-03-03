/**
 * @fileoverview Monte Carlo simulation panel with fan chart and statistics.
 */

import React from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Zap, RefreshCw } from "lucide-react";
import ChartTooltip from "../charts/ChartTooltip";
import { formatINR, formatUSD } from "../../utils";

/**
 * Monte Carlo simulation panel with results display and percentile fan chart.
 *
 * @param {Object} props
 * @param {Object|null} props.mcResults Monte Carlo results from useMonteCarlo.
 * @param {boolean} props.isMCRunning Whether MC simulation is in progress.
 * @param {Function} props.handleRunMC Handler to start MC simulation.
 * @param {boolean} props.isBlocked Whether simulation is blocked by errors.
 * @param {number} props.capital Initial capital.
 * @returns {React.ReactElement}
 */
const MonteCarloPanel = React.memo(
  ({
    mcResults,
    isMCRunning,
    handleRunMC,
    isBlocked,
    capital,
    isCrypto,
    usdToInr = 87,
  }) => (
    <div className="bg-gray-900 border border-orange-900/30 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Zap size={15} className="text-orange-400" />
            Monte Carlo Simulation (500 paths)
          </h3>
          <p className="text-xs text-gray-600 mt-0.5">
            Randomly reshuffles win/loss probabilities 500 times
          </p>
        </div>
        <button
          onClick={handleRunMC}
          disabled={isMCRunning || isBlocked}
          className="bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors flex items-center gap-2"
        >
          {isMCRunning ? (
            <>
              <RefreshCw size={14} className="animate-spin" /> Running...
            </>
          ) : (
            <>
              <Zap size={14} /> Run Monte Carlo
            </>
          )}
        </button>
      </div>

      {mcResults ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-red-950/40 border border-red-800/50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">Ruin Probability</div>
              <div
                className={`text-2xl font-bold font-mono ${
                  mcResults.ruinPct > 20
                    ? "text-red-400"
                    : mcResults.ruinPct > 5
                      ? "text-yellow-400"
                      : "text-green-400"
                }`}
              >
                {mcResults.ruinPct}%
              </div>
            </div>
            <div className="bg-green-950/40 border border-green-800/50 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">Reach 2× Capital</div>
              <div
                className={`text-2xl font-bold font-mono ${
                  mcResults.target2xPct > 50
                    ? "text-green-400"
                    : "text-yellow-400"
                }`}
              >
                {mcResults.target2xPct}%
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">P10 Final</div>
              <div className="text-lg font-bold font-mono text-gray-200">
                {isCrypto
                  ? formatUSD(
                      mcResults.finalCapitals[
                        Math.floor((mcResults.finalCapitals.length - 1) * 0.1)
                      ] / usdToInr,
                    )
                  : formatINR(
                      mcResults.finalCapitals[
                        Math.floor((mcResults.finalCapitals.length - 1) * 0.1)
                      ],
                    )}
              </div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">P90 Final</div>
              <div className="text-lg font-bold font-mono text-gray-200">
                {isCrypto
                  ? formatUSD(
                      mcResults.finalCapitals[
                        Math.floor((mcResults.finalCapitals.length - 1) * 0.9)
                      ] / usdToInr,
                    )
                  : formatINR(
                      mcResults.finalCapitals[
                        Math.floor((mcResults.finalCapitals.length - 1) * 0.9)
                      ],
                    )}
              </div>
            </div>
          </div>

          <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
            Percentile Fan Chart
          </h4>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart
              data={mcResults.bands}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="mcBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="trade" stroke="#4b5563" tick={{ fontSize: 11 }} />
              <YAxis
                stroke="#4b5563"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  isCrypto
                    ? formatUSD(v / usdToInr, 0)
                    : `₹${(v / 1000).toFixed(0)}k`
                }
              />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine
                y={capital}
                stroke="#374151"
                strokeDasharray="4 4"
              />
              <Area
                type="monotone"
                dataKey={["p10", "p90"]}
                stroke="none"
                fill="url(#mcBand)"
                name="P10 - P90"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="p10"
                stroke="#1d4ed8"
                strokeWidth={1}
                dot={false}
                name="P10"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="p50"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={false}
                name="P50 Median"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="p25"
                stroke="#93c5fd"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                name="P25"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="p75"
                stroke="#93c5fd"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                name="P75"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      ) : (
        <div className="text-center py-10 text-gray-600 text-sm">
          Click &quot;Run Monte Carlo&quot; to simulate 500 random paths
        </div>
      )}
    </div>
  ),
);

MonteCarloPanel.displayName = "MonteCarloPanel";

export default MonteCarloPanel;
