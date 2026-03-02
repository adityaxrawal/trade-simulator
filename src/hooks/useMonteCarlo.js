/**
 * @fileoverview Custom hook for Monte Carlo simulation state and execution.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
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
 * @param {boolean} params.isBlocked Whether simulation is blocked.
 * @returns {Object} MC results, running state, and run handler.
 */
export const useMonteCarlo = ({
    winRate, rrRatio, riskPerTrade, numTrades,
    chargesPerTrade, capital, riskMode, riskPercent,
    leverage, dpCharge, isBlocked
}) => {
    const [mcResults, setMcResults] = useState(null);
    const [isMCRunning, setIsMCRunning] = useState(false);
    const abortControllerRef = useRef(null);

    useEffect(() => {
        setMcResults(null);
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsMCRunning(false);
    }, [winRate, rrRatio, riskPerTrade, numTrades, chargesPerTrade, capital, riskMode, riskPercent, leverage, dpCharge, isBlocked]);

    // F-022: Chunked Monte Carlo to avoid UI freeze on mobile
    const handleRunMC = useCallback(async () => {
        if (isBlocked) return;

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setIsMCRunning(true);

        // Let the UI paint the running state before heavy work starts
        await new Promise(r => setTimeout(r, 10));

        try {
            const results = await runMonteCarlo(
                {
                    winRate: winRate / 100,
                    rrRatio,
                    riskPerTrade,
                    numTrades: Math.min(Number(numTrades), 10000), // Cap trades to prevent out of memory
                    chargesPerTrade,
                    initialCapital: capital,
                    riskMode,
                    riskPercent,
                    leverage: Number(leverage),
                    dpCharge: Number(dpCharge),
                },
                500,
                abortController.signal
            );
            if (!abortController.signal.aborted) {
                setMcResults(results);
            }
        } catch (e) {
            if (e.name !== "AbortError") {
                console.error("Monte Carlo Error:", e);
            }
        } finally {
            if (abortControllerRef.current === abortController) {
                setIsMCRunning(false);
            }
        }
    }, [
        winRate, rrRatio, riskPerTrade, numTrades,
        chargesPerTrade, capital, riskMode, riskPercent, leverage, dpCharge, isBlocked
    ]);

    return { mcResults, isMCRunning, handleRunMC };
};
