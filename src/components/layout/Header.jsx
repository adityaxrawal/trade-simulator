/**
 * @fileoverview Application header with strategy health score badge.
 */

import React from "react";
import { Activity, Award } from "lucide-react";

/**
 * Header component displaying the app title and strategy health score.
 * @param {Object} props
 * @param {Object|null} props.metrics Computed simulation metrics.
 * @param {string} props.healthColor Tailwind color class for health score.
 * @returns {React.ReactElement}
 */
const Header = React.memo(({ metrics, healthColor }) => (
  <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
    <div className="max-w-screen-xl mx-auto flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Activity size={22} className="text-orange-400" />
        <div>
          <h1 className="text-lg font-bold text-gray-50">
            Indian Market Trading Simulator
          </h1>
          <p className="text-xs text-gray-500">
            NSE · BSE · MCX · NCDEX | Full charge engine + Monte Carlo
          </p>
        </div>
      </div>
      {metrics && (
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2">
          <Award size={16} className={healthColor} />
          <span className="text-xs text-gray-500 font-medium">
            Strategy Health
          </span>
          <span className={`text-xl font-bold font-mono ${healthColor}`}>
            {metrics.healthScore}
          </span>
          <span className={`text-sm font-bold ${healthColor}`}>
            {metrics.healthGrade}
          </span>
        </div>
      )}
    </div>
  </header>
));

Header.displayName = "Header";

export default Header;
