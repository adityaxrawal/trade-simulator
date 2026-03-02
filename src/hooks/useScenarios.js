import { useState, useCallback, useEffect } from 'react';

export const useScenarios = (
    metrics, assetClass, derivativeType, capital, numTrades, winRate, rrRatio,
    riskMode, riskPerTrade, riskPercent, leverage, cryptoPrice, cryptoQty,
    isMaker, isScalperActive, cryptoPremium, entryPrice
) => {
    const [scenarios, setScenarios] = useState(() => {
        try {
            const saved = window.localStorage.getItem('savedScenarios');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem('savedScenarios', JSON.stringify(scenarios));
        } catch (e) {
            console.error("Local storage save error", e);
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
                    leverage, cryptoPrice, cryptoQty, isMaker, isScalperActive, cryptoPremium, entryPrice
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
                if (prev.length >= 5) return prev;
                return [...prev, newScenario];
            });
        },
        [
            metrics, assetClass, derivativeType,
            capital, numTrades, winRate, rrRatio, riskMode, riskPerTrade, riskPercent,
            leverage, cryptoPrice, cryptoQty, isMaker, isScalperActive, cryptoPremium, entryPrice
        ],
    );

    const handleDeleteScenario = useCallback((id) => {
        setScenarios((s) => s.filter((x) => x.id !== id));
    }, []);

    return { scenarios, handleSaveScenario, handleDeleteScenario };
};
