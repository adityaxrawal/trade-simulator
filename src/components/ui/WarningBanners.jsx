/**
 * @fileoverview Warning banners component with auto-reset dismissed warnings.
 */

import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";

/**
 * Displays dismissable warning/error/info banners.
 * F-020: Auto-reset dismissed warnings when warning IDs change.
 *
 * @param {Object} props
 * @param {!Array<{id: string, type: string, message: string}>} props.warnings
 * @returns {React.ReactElement|null}
 */
const WarningBanners = React.memo(({ warnings }) => {
  const [dismissed, setDismissed] = useState([]);
  const prevWarningIdsRef = useRef(warnings.map((w) => w.id));

  // F-020: Reset dismissed state when warning IDs change
  useEffect(() => {
    const currentIds = warnings
      .map((w) => w.id)
      .sort()
      .join(",");
    const prevIds = [...prevWarningIdsRef.current].sort().join(",");
    if (currentIds !== prevIds) {
      setDismissed((prev) => {
        const activeIds = new Set(warnings.map((w) => w.id));
        return prev.filter((id) => activeIds.has(id));
      });
      prevWarningIdsRef.current = warnings.map((w) => w.id);
    }
  }, [warnings]);

  const visible = warnings.filter((w) => !dismissed.includes(w.id));
  if (!visible.length) return null;

  return (
    <div
      className="space-y-2 mb-4"
      role="alert"
      aria-live="polite"
      aria-label="Warnings"
    >
      {visible.map((w) => {
        const isError = w.type === "error";
        const isWarn = w.type === "warning";
        return (
          <div
            key={w.id}
            className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm border ${
              isError
                ? "bg-red-950/50 border-red-800 text-red-300"
                : isWarn
                  ? "bg-yellow-950/50 border-yellow-800 text-yellow-300"
                  : "bg-blue-950/50 border-blue-800 text-blue-300"
            }`}
          >
            {isError ? (
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            ) : isWarn ? (
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
            ) : (
              <Info size={15} className="flex-shrink-0 mt-0.5" />
            )}
            <span className="flex-1">{w.message}</span>
            <button
              onClick={() => setDismissed((d) => [...d, w.id])}
              className="text-gray-500 hover:text-gray-300 flex-shrink-0"
              aria-label={`Dismiss ${w.type}`}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
});

WarningBanners.displayName = "WarningBanners";

export default WarningBanners;
