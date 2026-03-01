/**
 * @fileoverview Chart data transformation functions for Recharts visualizations.
 */

import { formatNum } from './format';
import { WR_VALUES, RR_VALUES } from '../constants';

/**
 * Builds win/loss streak distribution data.
 * @param {!Array<Object>} trades Array of trade objects with isWin property.
 * @returns {!Array<{length: number, wins: number, losses: number}>}
 */
export const buildStreakData = (trades) => {
    const winStreakMap = {};
    const lossStreakMap = {};
    let curWin = 0;
    let curLoss = 0;

    for (const trade of trades) {
        if (trade.isWin) {
            if (curLoss > 0) {
                lossStreakMap[curLoss] = (lossStreakMap[curLoss] || 0) + 1;
            }
            curLoss = 0;
            curWin++;
        } else {
            if (curWin > 0) {
                winStreakMap[curWin] = (winStreakMap[curWin] || 0) + 1;
            }
            curWin = 0;
            curLoss++;
        }
    }
    if (curWin > 0) winStreakMap[curWin] = (winStreakMap[curWin] || 0) + 1;
    if (curLoss > 0) lossStreakMap[curLoss] = (lossStreakMap[curLoss] || 0) + 1;

    const maxLen = Math.max(
        ...Object.keys(winStreakMap).map(Number),
        ...Object.keys(lossStreakMap).map(Number),
        0,
    );
    return Array.from({ length: maxLen }, (_, i) => ({
        length: i + 1,
        wins: winStreakMap[i + 1] || 0,
        losses: lossStreakMap[i + 1] || 0,
    }));
};

/**
 * Builds P&L distribution histogram data.
 * @param {!Array<Object>} trades Array of trade objects with netPnl and isRuined.
 * @returns {!Array<{range: string, rangeStart: number, count: number, isPositive: boolean}>}
 */
export const buildDistributionData = (trades) => {
    const pnls = trades.filter((t) => !t.isRuined).map((t) => t.netPnl);
    if (pnls.length === 0) return [];

    const min = Math.min(...pnls);
    const max = Math.max(...pnls);

    if (min === max) {
        return [{
            range: `₹${formatNum(min)}`,
            rangeStart: min,
            count: pnls.length,
            isPositive: min >= 0,
        }];
    }

    const bucketCount = 20;
    const bucketSize = (max - min) / bucketCount || 1;

    const isSmallRange = max - min < 1000;
    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
        range: `₹${isSmallRange ? (min + i * bucketSize).toFixed(1) : formatNum(min + i * bucketSize)}`,
        rangeStart: min + i * bucketSize,
        count: 0,
        isPositive: (min + i * bucketSize) >= 0,
    }));

    for (const pnl of pnls) {
        const idx = Math.min(
            bucketCount - 1,
            Math.floor((pnl - min) / bucketSize),
        );
        buckets[idx].count++;
    }
    return buckets;
};

/**
 * Builds charge composition data for pie chart.
 * @param {Object} chargeObj Charge breakdown object from calculateCharges.
 * @returns {!Array<{name: string, value: number, color: string}>}
 */
export const buildChargesData = (chargeObj) => [
    { name: 'Brokerage', value: chargeObj.brokerage, color: '#3b82f6' },
    { name: chargeObj.ctt > 0 ? 'CTT' : 'STT', value: chargeObj.stt + chargeObj.ctt, color: '#ef4444' },
    { name: 'Exch Txn', value: chargeObj.exchTxn, color: '#f59e0b' },
    { name: 'SEBI', value: chargeObj.sebiCharge, color: '#8b5cf6' },
    { name: 'GST', value: chargeObj.gst, color: '#22c55e' },
    { name: 'Stamp Duty', value: chargeObj.stampDuty, color: '#06b6d4' },
    { name: 'DP Charges', value: chargeObj.dpCharge, color: '#f97316' },
].filter((d) => d.value > 0);

/**
 * Builds block-aggregated P&L data for bar chart.
 * @param {!Array<Object>} trades Array of trade objects.
 * @param {number} blockSize Number of trades per block (default: 10).
 * @returns {!Array<{block: number, grossPnl: number, netPnl: number, charges: number}>}
 */
export const buildBlockData = (trades, blockSize = 10) => {
    const blocks = [];
    for (let i = 0; i < trades.length; i += blockSize) {
        const block = trades.slice(i, i + blockSize);
        blocks.push({
            block: Math.floor(i / blockSize) + 1,
            grossPnl: +block.reduce((s, t) => s + t.grossPnl, 0).toFixed(0),
            netPnl: +block.reduce((s, t) => s + t.netPnl, 0).toFixed(0),
            charges: +block.reduce((s, t) => s + t.charges, 0).toFixed(0),
        });
    }
    return blocks;
};

/**
 * Builds win-rate × RR-ratio expectancy heatmap data.
 * @param {number} chargesPerTrade Charges per trade.
 * @param {number} riskPerTrade Risk per trade.
 * @returns {!Array<!Array<{wr: string, rr: string, expectancy: number, isPositive: boolean}>>}
 */
export const buildHeatmapData = (chargesPerTrade, riskPerTrade) => {
    return WR_VALUES.map((wrVal) => {
        const wr = wrVal / 100;
        return RR_VALUES.map((rr) => {
            // #1: Single-charge expectancy — consistent with computeMetrics
            const exp =
                wr * rr * riskPerTrade - (1 - wr) * riskPerTrade - chargesPerTrade;
            return {
                wr: (wr * 100).toFixed(0),
                rr: rr.toFixed(1),
                expectancy: +exp.toFixed(0),
                isPositive: exp > 0,
            };
        });
    });
};
