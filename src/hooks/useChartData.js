/**
 * @fileoverview Custom hook for memoized chart data transformations.
 */

import { useMemo } from 'react';
import {
    buildStreakData,
    buildDistributionData,
    buildChargesData,
    buildBlockData,
    buildHeatmapData,
} from '../utils';

/**
 * Memoizes all chart data derived from simulation results.
 *
 * @param {Object} params Chart data dependencies.
 * @param {Object|null} params.simData Simulation results.
 * @param {number} params.capital Initial capital.
 * @param {number} params.numTrades Number of trades.
 * @param {Object} params.chargesObj Charge breakdown object.
 * @param {number} params.chargesPerTrade Total charges per trade.
 * @param {number} params.riskPerTrade Risk per trade.
 * @returns {Object} All chart data arrays and heatmap max absolute value.
 */
export const useChartData = ({
    simData, metrics, capital, numTrades, chargesObj, chargesPerTrade, riskPerTrade, isCrypto, usdToInr,
}) => {
    const equityData = useMemo(() => {
        if (!simData) return [];
        return [
            { trade: 0, netCapital: simData.initialCapital, grossCapital: simData.initialCapital },
            ...simData.trades.map((t) => ({
                trade: t.trade,
                netCapital: t.capital,
                grossCapital: t.grossCapital,
            })),
        ];
    }, [simData]);

    const drawdownData = useMemo(
        () =>
            simData
                ? simData.trades.map((t) => ({
                    trade: t.trade,
                    drawdownPct: t.drawdownPct,
                    drawdownRs: t.drawdownRs,
                }))
                : [],
        [simData],
    );

    const distributionData = useMemo(
        () => (simData ? buildDistributionData(simData.trades, isCrypto, usdToInr) : []),
        [simData, isCrypto, usdToInr],
    );

    const blockData = useMemo(
        () =>
            simData
                ? buildBlockData(
                    simData.trades,
                    Math.max(1, Math.floor(numTrades / 20)),
                )
                : [],
        [simData, numTrades],
    );

    const chargesPieData = useMemo(
        () => buildChargesData(chargesObj),
        [chargesObj],
    );

    const streakData = useMemo(
        () => (simData ? buildStreakData(simData.trades) : []),
        [simData],
    );

    const heatmapData = useMemo(() => {
        const cVal = metrics?.avgChargesPerTrade ?? chargesPerTrade;
        const rVal = metrics?.avgRiskPerTrade ?? riskPerTrade;
        return buildHeatmapData(cVal, rVal);
    }, [chargesPerTrade, riskPerTrade, metrics?.avgChargesPerTrade, metrics?.avgRiskPerTrade]);

    const heatMaxAbs = useMemo(() => {
        let maxVal = 0;
        for (const row of heatmapData) {
            for (const cell of row) {
                maxVal = Math.max(maxVal, Math.abs(cell.expectancy));
            }
        }
        return maxVal || 1;
    }, [heatmapData]);

    return {
        equityData,
        drawdownData,
        distributionData,
        blockData,
        chargesPieData,
        streakData,
        heatmapData,
        heatMaxAbs,
    };
};
