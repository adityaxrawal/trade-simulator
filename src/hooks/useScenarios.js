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
                if (!saved) return [];
                const parsed = JSON.parse(saved);
                if (!Array.isArray(parsed)) return [];
                // F-026: Schema validation
                return parsed.filter(s =>
                    s && typeof s === 'object' &&
                    typeof s.id === 'string' &&
                    typeof s.name === 'string' &&
                    s.inputs && typeof s.inputs === 'object' &&
                    s.metrics && typeof s.metrics === 'object' &&
                    typeof s.inputs.capital === 'number' && // Bug 4.3: Validate nested types
                    typeof s.inputs.winRate === 'number' &&
                    typeof s.inputs.rrRatio === 'number' &&
                    typeof s.inputs.riskPerTrade === 'number'
                );
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

    useEffect(() => {
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
            if (!metrics) return { success: false, error: 'No metrics available.' };
            if (scenarios.length >= 5) {
                return { success: false, error: 'Maximum limit of 5 scenarios reached. Please delete an old scenario to save a new one.' };
            }

            // XSS Prevention (Bug #9): Sanitize scenario name
            const sanitizedName = name.replace(/[^\w\s\-().,'&]/g, '').trim() || 'Unnamed Scenario';

            const newScenario = {
                id: crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2),
                name: sanitizedName,
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

            // Bug 8.3: Storage quota catch logic. Only set React state if `localStorage` successfully takes it.
            try {
                if (typeof window !== 'undefined' && window.localStorage) {
                    const newScenarios = [...scenarios, newScenario];
                    // Check size estimated payload
                    const payload = JSON.stringify(newScenarios);
                    if (payload.length > 4000000) throw new Error("Storage Quota Size Limit Reached");

                    window.localStorage.setItem('savedScenarios', payload);
                    setScenarios(newScenarios);
                    setStorageError(false);
                    return { success: true };
                }
            } catch (e) {
                console.warn("Storage quota exceeded", e);
                setStorageError(true);
                return { success: false, error: 'Storage quota exceeded. Please delete old scenarios.' };
            }

            // Fallback if localStorage was entirely absent (safari private mode etc)
            setScenarios((prev) => [...prev, newScenario]);
            return { success: true };
        },
        [
            scenarios.length, metrics, assetClass, derivativeType,
            capital, numTrades, winRate, rrRatio, riskMode, riskPerTrade, riskPercent,
            leverage, cryptoPrice, cryptoQty, isMaker, isScalperActive, cryptoPremium, entryPrice, usdToInr
        ],
    );

    const handleDeleteScenario = useCallback((id) => {
        setScenarios((s) => s.filter((x) => x.id !== id));
    }, []);

    return { scenarios, handleSaveScenario, handleDeleteScenario, storageError };
};
