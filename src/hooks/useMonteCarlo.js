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
    const workerRef = useRef(null);

    // Initial parameter change cleanup
    useEffect(() => {
        setMcResults(null);
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }
        setIsMCRunning(false);
    }, [winRate, rrRatio, riskPerTrade, numTrades, chargesPerTrade, capital, riskMode, riskPercent, leverage, dpCharge, isBlocked]);

    // Cleanup on unmount (Fixes Bug #4)
    useEffect(() => {
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, []);

    // F-022 / Bug #1: Chunked Monte Carlo to avoid UI freeze on mobile now moved to Web Worker
    const handleRunMC = useCallback(() => {
        if (isBlocked) return;

        if (workerRef.current) {
            workerRef.current.terminate();
        }

        setIsMCRunning(true);

        const worker = new Worker(new URL('../workers/mc.worker.js', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        worker.onmessage = (e) => {
            const { type, results, error } = e.data;
            if (type === 'SUCCESS') {
                setMcResults(results);
            } else {
                console.error("Monte Carlo Worker Error:", error);
            }
            setIsMCRunning(false);
            if (workerRef.current === worker) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };

        worker.onerror = (e) => {
            console.error("Worker error:", e);
            setIsMCRunning(false);
            if (workerRef.current === worker) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };

        worker.postMessage({
            params: {
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
            simCount: 500
        });

    }, [
        winRate, rrRatio, riskPerTrade, numTrades,
        chargesPerTrade, capital, riskMode, riskPercent, leverage, dpCharge, isBlocked
    ]);

    return { mcResults, isMCRunning, handleRunMC };
};
