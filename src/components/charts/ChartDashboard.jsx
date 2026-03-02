/**
 * @fileoverview Chart dashboard with tabbed navigation for all chart types.
 */

import React, { useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Brush,
  ResponsiveContainer,
} from "recharts";
import ChartTooltip from "./ChartTooltip";
import { formatINR, formatNum, formatUSD, formatCrypto } from "../../utils";
import { RR_VALUES, WR_VALUES } from "../../constants";

/** Chart tab configuration. */
const CHART_TABS = [
  ["equity", "📈 Equity Curve"],
  ["drawdown", "📉 Drawdown"],
  ["distribution", "📊 P&L Distribution"],
  ["gross_net", "🔀 Gross vs Net"],
  ["charges_pie", "🥧 Charges Mix"],
  ["heatmap", "🌡️ WR×RR Heatmap"],
  ["streak", "🔁 Streaks"],
];

/**
 * Returns a heat color (green for positive, red for negative expectancy).
 * @param {number} expectancy The expectancy value.
 * @param {number} maxAbs Maximum absolute expectancy for normalization.
 * @returns {string} RGBA color string.
 */
const getHeatColor = (expectancy, maxAbs) => {
  if (expectancy > 0) {
    const intensity = Math.min(1, expectancy / maxAbs);
    return `rgba(34,197,94,${0.2 + intensity * 0.8})`;
  }
  const intensity = Math.min(1, Math.abs(expectancy) / maxAbs);
  return `rgba(239,68,68,${0.2 + intensity * 0.8})`;
};

/**
 * Tabbed dashboard containing all chart visualizations.
 *
 * @param {Object} props
 * @param {Object} props.chartData All chart data arrays from useChartData.
 * @param {Object} props.metrics Computed metrics.
 * @param {number} props.capital Initial capital.
 * @param {number} props.winRate Win rate (0–100).
 * @param {number} props.rrRatio Risk-to-reward ratio.
 * @param {number} props.chargesPerTrade Charges per trade.
 * @returns {React.ReactElement}
 */
const ChartDashboard = ({
  chartData,
  metrics,
  capital,
  winRate,
  rrRatio,
  chargesPerTrade,
  isCrypto,
  usdToInr = 87,
}) => {
  const [activeTab, setActiveTab] = useState("equity");
  const {
    equityData,
    drawdownData,
    distributionData,
    blockData,
    chargesPieData,
    streakData,
    heatmapData,
    heatMaxAbs,
  } = chartData;

  const currentHeatmapCoords = React.useMemo(() => {
    if (!heatmapData || !heatmapData.length) return { ri: -1, ci: -1 };

    const getClosestIndex = (arr, val) => {
      let minDiff = Infinity;
      let closestIdx = -1;
      for (let i = 0; i < arr.length; i++) {
        const diff = Math.abs(arr[i] - val);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      return closestIdx;
    };
    const ri = getClosestIndex(WR_VALUES, winRate);
    const ci = getClosestIndex(RR_VALUES, rrRatio);
    return { ri, ci };
  }, [heatmapData, winRate, rrRatio, activeTab]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Tab Bar */}
      <div className="flex overflow-x-auto border-b border-gray-800 px-4">
        {CHART_TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === id
                ? "text-orange-400 border-b-2 border-orange-500"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart Content */}
      <div className="p-4">
        {/* Equity Curve */}
        {activeTab === "equity" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-200">
                Capital Curve — Gross vs Net
              </h3>
              <div className="flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-green-400 inline-block" />
                  Gross
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-orange-400 inline-block" />
                  Net
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart
                data={equityData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="trade"
                  stroke="#4b5563"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  stroke="#4b5563"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  content={
                    <ChartTooltip isCrypto={isCrypto} usdToInr={usdToInr} />
                  }
                />
                <ReferenceLine
                  y={capital}
                  stroke="#374151"
                  strokeDasharray="4 4"
                  label={{ value: "Initial", fill: "#6b7280", fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="grossCapital"
                  stroke="#22c55e"
                  strokeWidth={1.5}
                  dot={false}
                  name="Gross Capital"
                />
                <Line
                  type="monotone"
                  dataKey="netCapital"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                  name="Net Capital"
                />
                <Brush
                  dataKey="trade"
                  height={20}
                  stroke="#374151"
                  fill="#111827"
                  travellerWidth={6}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Drawdown */}
        {activeTab === "drawdown" && (
          <div>
            <h3 className="text-sm font-semibold text-gray-200 mb-3">
              Drawdown from Peak Capital
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={drawdownData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="trade"
                  stroke="#4b5563"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  stroke="#4b5563"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      isCrypto={isCrypto}
                      usdToInr={usdToInr}
                      formatter={(v, name) =>
                        name === "Drawdown %"
                          ? `${v.toFixed(2)}%`
                          : isCrypto
                            ? formatCrypto(v / usdToInr, 0, false, usdToInr)
                            : formatINR(v)
                      }
                    />
                  }
                />
                <ReferenceLine y={0} stroke="#374151" />
                <Area
                  type="monotone"
                  dataKey="drawdownPct"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  fill="url(#ddGrad)"
                  name="Drawdown %"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-3 flex gap-6 text-xs text-gray-500">
              <span>
                Max DD:{" "}
                <strong className="text-red-400">
                  {metrics.maxDrawdownPct.toFixed(2)}%
                </strong>
              </span>
              <span>
                Max DD (₹):{" "}
                <strong className="text-red-400">
                  {formatINR(metrics.maxDrawdownRs)}
                </strong>
              </span>
            </div>
          </div>
        )}

        {/* Distribution */}
        {activeTab === "distribution" && (
          <div>
            <h3 className="text-sm font-semibold text-gray-200 mb-3">
              Net P&L Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={distributionData}
                margin={{ top: 5, right: 20, left: 10, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="range"
                  stroke="#4b5563"
                  tick={{ fontSize: 9, angle: -45, textAnchor: "end" }}
                />
                <YAxis stroke="#4b5563" tick={{ fontSize: 11 }} />
                <Tooltip
                  content={
                    <ChartTooltip prefix="Bucket: " formatter={(v) => v} />
                  }
                />
                <Bar dataKey="count" name="Trades" radius={[2, 2, 0, 0]}>
                  {distributionData.map((e, i) => (
                    <Cell key={i} fill={e.isPositive ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Gross vs Net */}
        {activeTab === "gross_net" && (
          <div>
            <h3 className="text-sm font-semibold text-gray-200 mb-3">
              Gross vs Net P&L by Block
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={blockData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="block"
                  stroke="#4b5563"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  stroke="#4b5563"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `₹${formatNum(v)}`}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      prefix="Block #"
                      isCrypto={isCrypto}
                      usdToInr={usdToInr}
                    />
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="grossPnl"
                  name="Gross P&L"
                  fill="#3b82f6"
                  radius={[2, 2, 0, 0]}
                >
                  {blockData.map((e, i) => (
                    <Cell
                      key={i}
                      fill={e.grossPnl >= 0 ? "#3b82f6" : "#6b7280"}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="netPnl"
                  name="Net P&L"
                  fill="#22c55e"
                  radius={[2, 2, 0, 0]}
                >
                  {blockData.map((e, i) => (
                    <Cell
                      key={i}
                      fill={e.netPnl >= 0 ? "#22c55e" : "#ef4444"}
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="charges"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  name="Charges"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Charges Pie */}
        {activeTab === "charges_pie" && (
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-semibold text-gray-200 mb-3 self-start">
              Charge Composition Per Trade
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chargesPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius="40%"
                  outerRadius="70%"
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {chargesPieData.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [
                    isCrypto ? formatUSD(v) : formatINR(v, 2),
                    "",
                  ]}
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    fontSize: 11,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center mt-2">
              <div className="text-2xl font-bold font-mono text-orange-400">
                {isCrypto
                  ? formatUSD(chargesPerTrade / usdToInr)
                  : formatINR(chargesPerTrade, 2)}
              </div>
              <div className="text-xs text-gray-500">Total per round-trip</div>
            </div>
          </div>
        )}

        {/* Heatmap */}
        {activeTab === "heatmap" && (
          <div>
            <h3 className="text-sm font-semibold text-gray-200 mb-1">
              Win Rate × RR Expectancy Heatmap
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Green = profitable, Red = losing. Gold border = current settings.
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-gray-600 text-right pr-3 pb-2 font-medium">
                      WR\RR
                    </th>
                    {RR_VALUES.map((rr) => (
                      <th
                        key={rr}
                        className="text-center px-2 pb-2 text-gray-500 font-medium"
                      >
                        {rr}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.map((row, ri) => (
                    <tr key={ri}>
                      <td className="text-right pr-3 py-1 text-gray-500 font-medium">
                        {WR_VALUES[ri]}%
                      </td>
                      {row.map((cell, ci) => {
                        const isCurrent =
                          ri === currentHeatmapCoords.ri &&
                          ci === currentHeatmapCoords.ci;
                        return (
                          <td
                            key={ci}
                            style={{
                              backgroundColor: getHeatColor(
                                cell.expectancy,
                                heatMaxAbs,
                              ),
                            }}
                            className={`text-center px-3 py-2 font-mono font-semibold rounded-sm ${
                              isCurrent
                                ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-950"
                                : ""
                            } ${cell.isPositive ? "text-green-100" : "text-red-100"}`}
                            title={`WR ${cell.wr}% | RR ${cell.rr} | ${isCrypto ? formatCrypto(cell.expectancy / usdToInr, 2, false, usdToInr) : formatINR(cell.expectancy)}`}
                          >
                            {isCrypto
                              ? formatUSD(cell.expectancy / usdToInr)
                              : `₹${formatNum(cell.expectancy)}`}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Streaks */}
        {activeTab === "streak" && (
          <div>
            <h3 className="text-sm font-semibold text-gray-200 mb-3">
              Win & Loss Streak Distribution
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={streakData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="length"
                  stroke="#4b5563"
                  tick={{ fontSize: 11 }}
                />
                <YAxis stroke="#4b5563" tick={{ fontSize: 11 }} />
                <Tooltip
                  content={
                    <ChartTooltip prefix="Streak: " formatter={(v) => v} />
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="wins"
                  name="Win Streaks"
                  fill="#22c55e"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="losses"
                  name="Loss Streaks"
                  fill="#ef4444"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-6 mt-3 text-xs text-gray-500">
              <span>
                Max win:{" "}
                <strong className="text-green-400">
                  {metrics.maxWinStreak}
                </strong>
              </span>
              <span>
                Max loss:{" "}
                <strong className="text-red-400">
                  {metrics.maxLossStreak}
                </strong>
              </span>
              <span>
                Expected max loss:{" "}
                <strong className="text-gray-300">
                  {metrics.expectedMaxLossStreak}
                </strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

ChartDashboard.displayName = "ChartDashboard";

export default ChartDashboard;
