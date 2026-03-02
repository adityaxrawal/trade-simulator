/**
 * @fileoverview Formatting utility functions for currency and number display.
 */

import { USD_TO_INR } from '../constants';

/**
 * Formats a number as Indian Rupees (₹) with locale-aware grouping.
 * @param {number} n The amount to format.
 * @param {number} decimals Number of decimal places (default: 0).
 * @returns {string} Formatted INR string, e.g. "₹1,23,456".
 */
export const formatINR = (n, decimals = 0) => {
    if (!isFinite(n) || isNaN(n)) return '₹--';
    const prefix = n < 0 ? '-₹' : '₹';
    return prefix + Math.abs(n).toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

/**
 * Formats a number with compact suffixes (k, L).
 * @param {number} n The number to format.
 * @returns {string} Compact representation, e.g. "1.5L" or "23.4k".
 */
export const formatNum = (n) => {
    const abs = Math.abs(n);
    if (abs >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
    if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
    return n.toFixed(0);
};

/**
 * Formats a number as US Dollars ($).
 * @param {number} n The amount to format.
 * @param {number} decimals Number of decimal places (default: 2).
 * @returns {string} Formatted USD string, e.g. "$1,234.56".
 */
export const formatUSD = (n, decimals = 2) => {
    if (!isFinite(n) || isNaN(n)) return '$--';
    const prefix = n < 0 ? '-$' : '$';
    return prefix + Math.abs(n).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

/**
 * Formats a USD amount with INR equivalent in parentheses.
 * @param {number} usd The USD amount.
 * @param {number} decimals Number of decimal places (default: 2).
 * @returns {string} Dual-currency string, e.g. "$100.00 (₹8,700)".
 */
export const formatCrypto = (usd, decimals = 2, compact = false, userUsdToInr = USD_TO_INR) => {
    if (compact) return formatUSD(usd, decimals);
    const inr = usd * userUsdToInr;
    return `${formatUSD(usd, decimals)} (${formatINR(inr, 0)})`;
};

/**
 * Safe division that returns 0 when the divisor is 0 or non-finite.
 * @param {number} a Numerator.
 * @param {number} b Denominator.
 * @returns {number} Result of a/b, or 0 if b is 0 or non-finite.
 */
export const safeDivide = (a, b) => (b === 0 || !isFinite(b) ? 0 : a / b);
