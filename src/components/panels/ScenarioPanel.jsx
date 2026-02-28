/**
 * @fileoverview Scenario comparison panel with save/delete and metrics table.
 */

import React, { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { formatINR } from "../../utils";

/** Metrics rows configuration for scenario comparison. */
const METRICS_ROWS = [
  { key: "netPnL", label: "Net P&L", format: formatINR, higherBetter: true },
  {
    key: "grossPnL",
    label: "Gross P&L",
    format: formatINR,
    higherBetter: true,
  },
  {
    key: "totalCharges",
    label: "Total Charges",
    format: (v) => formatINR(v, 0),
    higherBetter: false,
  },
  {
    key: "chargeDragPct",
    label: "Charge Drag %",
    format: (v) => `${v.toFixed(1)}%`,
    higherBetter: false,
  },
  {
    key: "maxDrawdownPct",
    label: "Max Drawdown %",
    format: (v) => `${v.toFixed(1)}%`,
    higherBetter: true,
  },
  {
    key: "profitFactor",
    label: "Profit Factor",
    format: (v) => (!isFinite(v) ? "∞" : v.toFixed(2)),
    higherBetter: true,
  },
  {
    key: "expectancy",
    label: "Expectancy ₹",
    format: formatINR,
    higherBetter: true,
  },
  {
    key: "breakEvenWR",
    label: "Break-Even WR",
    format: (v) => `${v.toFixed(1)}%`,
    higherBetter: false,
  },
  {
    key: "healthScore",
    label: "Health Score",
    format: (v) => `${v}/100`,
    higherBetter: true,
  },
];

/**
 * Scenario comparison panel with save/delete and side-by-side metrics table.
 *
 * @param {Object} props
 * @param {!Array<Object>} props.scenarios Saved scenarios array.
 * @param {Function} props.onSave Handler to save a new scenario.
 * @param {Function} props.onDelete Handler to delete a scenario by ID.
 * @param {Object|null} props.metrics Current metrics (null if unavailable).
 * @returns {React.ReactElement}
 */
const ScenarioPanel = ({ scenarios, onSave, onDelete, metrics }) => {
  const [nameInput, setNameInput] = useState("");
  const canSave = scenarios.length < 5 && metrics;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-200 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-orange-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M3 3v18h18" />
            <path d="M7 16l4-8 4 4 4-6" />
          </svg>
          Scenario Comparison
        </h3>
        <span className="text-xs text-gray-500">
          {scenarios.length}/5 saved
        </span>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder='Scenario name (e.g., "NIFTY 45% WR 2R")'
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500"
          aria-label="Scenario name"
        />
        <button
          onClick={() => {
            if (canSave && nameInput.trim()) {
              onSave(nameInput.trim());
              setNameInput("");
            }
          }}
          disabled={!canSave || !nameInput.trim()}
          className="bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5"
          aria-label="Save scenario"
        >
          <Save size={13} /> Save
        </button>
      </div>

      {scenarios.length === 0 ? (
        <div className="text-center text-gray-600 py-8 text-sm">
          No scenarios saved yet. Run a simulation and save it to compare.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-gray-500 font-semibold py-2 pr-4">
                  Metric
                </th>
                {scenarios.map((s) => (
                  <th
                    key={s.id}
                    className="text-center text-gray-300 font-semibold py-2 px-2 min-w-[120px]"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className="truncate max-w-[90px]">{s.name}</span>
                      <button
                        onClick={() => onDelete(s.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                        aria-label={`Delete scenario ${s.name}`}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div className="text-gray-600 font-normal">
                      {s.inputs.assetClass?.replace(/_/g, " ")}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS_ROWS.map((row) => {
                const vals = scenarios.map((s) => s.metrics[row.key]);
                const best = row.higherBetter
                  ? Math.max(...vals)
                  : Math.min(...vals);
                const worst = row.higherBetter
                  ? Math.min(...vals)
                  : Math.max(...vals);
                return (
                  <tr key={row.key} className="border-b border-gray-800/50">
                    <td className="text-gray-500 py-2 pr-4">{row.label}</td>
                    {vals.map((v, i) => (
                      <td
                        key={i}
                        className={`text-center py-2 px-2 font-mono font-semibold ${
                          v === best
                            ? "text-green-400"
                            : v === worst
                              ? "text-red-400"
                              : "text-gray-300"
                        }`}
                      >
                        {row.format(v)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

ScenarioPanel.displayName = "ScenarioPanel";

export default ScenarioPanel;
