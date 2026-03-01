/**
 * @fileoverview Custom chart tooltip component for Recharts visualizations.
 */

import React from "react";
import { formatINR } from "../../utils";

/**
 * Custom tooltip shown on chart hover.
 *
 * @param {Object} props Recharts tooltip props.
 * @param {boolean} props.active Whether tooltip is visible.
 * @param {Array} props.payload Data entries to display.
 * @param {string|number} props.label X-axis label value.
 * @param {string} [props.prefix] Label prefix text (default: "Trade #").
 * @returns {React.ReactElement|null}
 */
const ChartTooltip = React.memo(
  ({ active, payload, label, prefix = "Trade #", formatter }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-2xl text-xs min-w-[160px]">
        <div className="text-gray-400 font-semibold mb-2 border-b border-gray-700 pb-1">
          {prefix}
          {label}
        </div>
        {payload.map((entry, i) => {
          const formattedValue = formatter
            ? formatter(entry.value, entry.name, entry, i)
            : typeof entry.value === "number"
              ? formatINR(entry.value)
              : entry.value;
          return (
            <div key={i} className="flex justify-between gap-3 mb-0.5">
              <span style={{ color: entry.color }} className="font-medium">
                {entry.name}
              </span>
              <span className="text-gray-100 font-mono">{formattedValue}</span>
            </div>
          );
        })}
      </div>
    );
  },
);

ChartTooltip.displayName = "ChartTooltip";

export default ChartTooltip;
