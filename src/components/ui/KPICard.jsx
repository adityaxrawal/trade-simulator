/**
 * @fileoverview KPI card component with hover tooltip support.
 */

import React, { useState } from "react";

/**
 * Displays a single key performance indicator with label, value, and sub-text.
 * F-033: Added hover tooltip.
 *
 * @param {Object} props
 * @param {string} props.label KPI label text.
 * @param {string|number} props.value Primary display value.
 * @param {string} [props.subText] Secondary text below the value.
 * @param {string} [props.tooltip] Tooltip text shown on hover.
 * @param {boolean} [props.isPositive] Green color indicator.
 * @param {boolean} [props.isNegative] Red color indicator.
 * @param {boolean} [props.isWarning] Yellow color indicator.
 * @param {React.ComponentType} [props.icon] Lucide icon component.
 * @returns {React.ReactElement}
 */
const KPICard = React.memo(
  ({
    label,
    value,
    subText,
    tooltip,
    isPositive,
    isNegative,
    isWarning,
    icon: Icon,
  }) => {
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);

    const valueColor = isPositive
      ? "text-green-400"
      : isNegative
        ? "text-red-400"
        : isWarning
          ? "text-yellow-400"
          : "text-gray-100";

    return (
      <div
        className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-all duration-200 relative"
        onMouseEnter={() => tooltip && setIsTooltipVisible(true)}
        onMouseLeave={() => setIsTooltipVisible(false)}
        role="group"
        aria-label={`${label}: ${value}`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {label}
          </span>
          {Icon && (
            <Icon size={14} className="text-gray-600" aria-hidden="true" />
          )}
        </div>
        <div className={`text-xl font-bold font-mono ${valueColor}`}>
          {value}
        </div>
        {subText && <div className="text-xs text-gray-500 mt-1">{subText}</div>}
        {isTooltipVisible && tooltip && (
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-gray-300 max-w-xs whitespace-normal shadow-xl pointer-events-none">
            {tooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 border-r border-b border-gray-600 transform rotate-45 -mt-1" />
          </div>
        )}
      </div>
    );
  },
);

KPICard.displayName = "KPICard";

export default KPICard;
