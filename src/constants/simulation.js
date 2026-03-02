/**
 * @fileoverview Simulation-related constants used across the application.
 */

/** Risk-to-reward ratio values for heatmap columns. */
export const RR_VALUES = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];

/** Win rate values (%) for heatmap rows. */
export const WR_VALUES = [30, 35, 40, 45, 50, 55, 60, 65, 70];

/** USD to INR conversion rate for crypto display. */
export const USD_TO_INR = 87;

/** F-009: Compounding overflow cap at ₹100 Crore. */
export const COMPOUNDING_CAP = 1e9;

/** F-014: Flat20 uses hardcoded 0.03% (Zerodha standard). */
export const ZERODHA_PERCENTAGE_RATE = 0.0003;
