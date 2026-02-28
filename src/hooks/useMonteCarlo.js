/**
 * @fileoverview Custom hook for Monte Carlo simulation state and execution.
 */

import { useState, useCallback } from 'react';
import { runMonteCarlo } from '../utils';

/**
 * Manages Monte Carlo simulation state and execution.
 *
 * @param {Object} params Dependencies for Monte Carlo.
 * @param {number} params.winRate Win rate (0–100).
 * @param {number} params.rrRatio Risk-to-reward ratio.
 * @param {number} params.riskPerTrade Risk per trade.
 * @param {number} params.numTrades Number of trades.
 * @param {number} params.chargesPerTrade Charges per trade.
 * @param {number} params.capital Initial capital.
 * @param {string} params.riskMode Risk mode ("fixed" or "compounding").
 * @param {number} params.riskPercent Risk percentage (compounding mode).
 * @param {boolean} params.isBlocked Whether simulation is blocked.
 * @returns {Object} MC results, running state, and run handler.
 */
export const useMonteCarlo = ({
    winRate, rrRatio, riskPerTrade, numTrades,
    chargesPerTrade, capital, riskMode, riskPercent, isBlocked,
}) => {
    const [mcResults, setMcResults] = useState(null);
    const [isMCRunning, setIsMCRunning] = useState(false);

    // F-022: Chunked Monte Carlo to avoid UI freeze on mobile
    const handleRunMC = useCallback(() => {
        setIsMCRunning(true);
        requestAnimationFrame(() => {
            const results = runMonteCarlo(
                {
                    winRate: winRate / 100,
                    rrRatio,
                    riskPerTrade,
                    numTrades: Math.min(numTrades, 500),
                    chargesPerTrade,
                    initialCapital: capital,
                    riskMode,
                    riskPercent,
                },
                500,
            );
            setMcResults(results);
            setIsMCRunning(false);
        });
    }, [
        winRate, rrRatio, riskPerTrade, numTrades,
        chargesPerTrade, capital, riskMode, riskPercent,
    ]);

    return { mcResults, isMCRunning, handleRunMC };
};
