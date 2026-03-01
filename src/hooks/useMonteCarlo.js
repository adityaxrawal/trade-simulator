/**
 * @fileoverview Custom hook for Monte Carlo simulation state and execution.
 */

import { useState, useCallback, useEffect } from 'react';
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
    chargesPerTrade, capital, riskMode, riskPercent,
    leverage, dpCharge
}) => {
    const [mcResults, setMcResults] = useState(null);
    const [isMCRunning, setIsMCRunning] = useState(false);

    useEffect(() => {
        setMcResults(null);
    }, [winRate, rrRatio, riskPerTrade, numTrades, chargesPerTrade, capital, riskMode, riskPercent, leverage, dpCharge]);

    // F-022: Chunked Monte Carlo to avoid UI freeze on mobile
    const handleRunMC = useCallback(async () => {
        setIsMCRunning(true);

        // Let the UI paint the running state before heavy work starts
        await new Promise(r => setTimeout(r, 10));

        try {
            const results = await runMonteCarlo(
                {
                    winRate: winRate / 100,
                    rrRatio,
                    riskPerTrade,
                    numTrades, // removed capping at 500
                    chargesPerTrade,
                    initialCapital: capital,
                    riskMode,
                    riskPercent,
                    leverage: Number(leverage),
                    dpCharge: Number(dpCharge),
                },
                500,
            );
            setMcResults(results);
        } finally {
            setIsMCRunning(false);
        }
    }, [
        winRate, rrRatio, riskPerTrade, numTrades,
        chargesPerTrade, capital, riskMode, riskPercent, leverage, dpCharge
    ]);

    return { mcResults, isMCRunning, handleRunMC };
};
