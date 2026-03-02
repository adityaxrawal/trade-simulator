import { useState, useCallback, useEffect, useRef } from 'react';

export const useScenarios = (params) => {
    const {
        metrics, assetClass, derivativeType, capital, numTrades, winRate, rrRatio,
        riskMode, riskPerTrade, riskPercent, leverage, cryptoPrice, cryptoQty,
        isMaker, isScalperActive, cryptoPremium, entryPrice, usdToInr
    } = params;

    const [storageError, setStorageError] = useState(false);

    const [scenarios, setScenarios] = useState(() => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const saved = window.localStorage.getItem('savedScenarios');
                return saved ? JSON.parse(saved) : [];
            }
        } catch (e) {
            console.warn("localStorage not available", e);
        }
        return [];
    });

    useEffect(() => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                // Just checking access
                window.localStorage.getItem('savedScenarios');
                setStorageError(false);
            }
        } catch (e) {
            setStorageError(true);
        }
    }, []);

    const isFirstMount = useRef(true);
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('savedScenarios', JSON.stringify(scenarios));
                setStorageError(false);
            }
        } catch (e) {
            console.warn("Local storage save error", e);
            setStorageError(true);
        }
    }, [scenarios]);

    const handleSaveScenario = useCallback(
        (name) => {
            if (!metrics) return;
            const newScenario = {
                id: crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2),
                name,
                inputs: {
                    assetClass, derivativeType, capital, numTrades,
                    winRate, rrRatio, riskMode, riskPerTrade, riskPercent,
                    leverage, cryptoPrice, cryptoQty, isMaker, isScalperActive, cryptoPremium, entryPrice, usdToInr
                },
                metrics: {
                    netPnL: metrics.netPnL,
                    grossPnL: metrics.grossPnL,
                    totalCharges: metrics.totalCharges,
                    chargeDragPct: metrics.chargeDragPct,
                    maxDrawdownPct: metrics.maxDrawdownPct,
                    profitFactor: metrics.profitFactor,
                    expectancy: metrics.expectancy,
                    breakEvenWR: metrics.breakEvenWR,
                    healthScore: metrics.healthScore,
                    healthGrade: metrics.healthGrade,
                },
            };
            setScenarios((prev) => {
                if (prev.length >= 5) {
                    alert("Maximum 5 scenarios allowed. Please delete one before saving a new scenario.");
                    return prev;
                }
                return [...prev, newScenario];
            });
        },
        [
            metrics, assetClass, derivativeType,
            capital, numTrades, winRate, rrRatio, riskMode, riskPerTrade, riskPercent,
            leverage, cryptoPrice, cryptoQty, isMaker, isScalperActive, cryptoPremium, entryPrice, usdToInr
        ],
    );

    const handleDeleteScenario = useCallback((id) => {
        setScenarios((s) => s.filter((x) => x.id !== id));
    }, []);

    return { scenarios, handleSaveScenario, handleDeleteScenario, storageError };
};
