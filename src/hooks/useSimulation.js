/**
 * @fileoverview Custom hook encapsulating all simulation state and computations.
 * Extracts state management and memoized calculations from TradingSimulator.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { DERIVATIVE_TYPES, CRYPTO_ASSET_CONFIG, USD_TO_INR, DEBOUNCE_DELAY_MS } from '../constants';
import { useDebounce } from './useDebounce';
import { computeMetrics } from '../utils';

// Import extracted hooks
import { useValidation } from './useValidation';
import { useCharges } from './useCharges';
import { useScenarios } from './useScenarios';

/**
 * Hook to safely handle numeric inputs, preventing NaN propagation 
 * and allowing empty strings to pass through without breaking math downstream.
 */
const useSafeNumeric = (initial, min = -Infinity, max = Infinity) => {
    const [val, setVal] = useState(initial);
    const setSafe = useCallback((v) => {
        const processVal = (valToProcess, prev) => {
            const strVal = String(valToProcess);
            if (strVal === '' || strVal === '-') return strVal;
            if (strVal.endsWith('.')) {
                if (strVal.indexOf('.') === strVal.lastIndexOf('.')) return strVal;
                return prev;
            }
            const n = Number(strVal);
            if (isNaN(n)) return prev;
            if (n < min || n > max) return String(Math.max(min, Math.min(max, n)));
            return strVal;
        };

        if (typeof v === 'function') {
            setVal(prev => processVal(v(prev), prev));
        } else {
            setVal(prev => processVal(v, prev));
        }
    }, [min, max]);
    return [val, setSafe];
};

/**
 * Manages all simulation state, derived values, validation, and handlers.
 * @returns {Object} All state values, setters, computed data, and handlers.
 */
export const useSimulation = () => {
    // ── Input State ──
    const [capital, setCapital] = useSafeNumeric(200000, 0);
    const [assetClass, setAssetClass] = useState('index_options');
    const [derivativeType, setDerivativeType] = useState('NIFTY');
    const [lotSize, setLotSize] = useSafeNumeric(75, 1);
    const [numTrades, setNumTrades] = useSafeNumeric(100, 1, 10000);
    const [winRate, setWinRate] = useSafeNumeric(45, 0, 100);
    const [rrRatio, setRrRatio] = useSafeNumeric(2, 0);
    const [riskMode, setRiskMode] = useState('fixed');
    const [riskPerTrade, setRiskPerTrade] = useSafeNumeric(2000, 0);
    const [riskPercent, setRiskPercent] = useSafeNumeric(1, 0, 100);
    const [brokerageModel, setBrokerageModel] = useState('flat20');
    const [brokerageRate, setBrokerageRate] = useSafeNumeric(0.03, 0); // stored as percentage 0.03%
    const [entryPrice, setEntryPrice] = useSafeNumeric(0, 0);
    const [seedOffset, setSeedOffset] = useState(() => Math.floor(Math.random() * 1000000));
    const [isRerollingState, setIsRerollingState] = useState(false);

    // ── Crypto-specific State ──
    const [isMaker, setIsMaker] = useState(true);
    const [isScalperActive, setIsScalperActive] = useState(false);
    const [cryptoQty, setCryptoQty] = useSafeNumeric(1000, 0);
    const [cryptoPrice, setCryptoPrice] = useSafeNumeric(100000, 0);
    const [cryptoPremium, setCryptoPremium] = useSafeNumeric(300, 0);
    const [leverage, setLeverage] = useSafeNumeric(1, 1);

    const [usdToInr, setUsdToInr] = useSafeNumeric(USD_TO_INR, 0);

    // ── UI State ──
    const [leverageClamped, setLeverageClamped] = useState(false);

    useEffect(() => {
        if (leverageClamped) {
            const t = setTimeout(() => setLeverageClamped(false), 5000);
            return () => clearTimeout(t);
        }
    }, [leverageClamped]);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

    // ── Derived Constants ──
    const derivativeOptions = useMemo(
        () => DERIVATIVE_TYPES[assetClass] || [],
        [assetClass],
    );

    const isCrypto = useMemo(() =>
        assetClass === 'crypto_futures' || assetClass === 'crypto_options',
        [assetClass]);

    /** Current crypto asset configuration (lot size, leverage, symbol, etc.). */
    const currentCryptoConfig = useMemo(() => {
        if (!isCrypto) return null;
        return CRYPTO_ASSET_CONFIG[derivativeType] || CRYPTO_ASSET_CONFIG.BTCUSD;
    }, [isCrypto, derivativeType]);

    /** Quantity in underlying asset units (e.g., 5 lots × 0.001 = 0.005 BTC). */
    const assetQty = useMemo(() => {
        if (!currentCryptoConfig) return 0;
        return +(Number(cryptoQty) * currentCryptoConfig.lotSize).toFixed(8);
    }, [cryptoQty, currentCryptoConfig]);

    /** Margin required based on leverage. */
    const marginRequired = useMemo(() => {
        if (!currentCryptoConfig) return 0;
        const notional = Number(cryptoQty) * currentCryptoConfig.lotSize * Number(cryptoPrice);
        return +(notional / Math.max(1, Number(leverage))).toFixed(2);
    }, [cryptoQty, currentCryptoConfig, cryptoPrice, leverage]);

    // ── Extracted Hooks ──
    const { estimatedTurnover, chargesObj, chargesPerTrade, chargesPerTradeForSim } = useCharges({
        assetClass, derivativeType, lotSize, isCrypto, cryptoQty, cryptoPrice,
        cryptoPremium, currentCryptoConfig, entryPrice, brokerageModel,
        brokerageRate: Number(brokerageRate) / 100, isMaker, isScalperActive, usdToInr
    });

    const parsedLeverage = isCrypto ? Number(leverage) : 1;

    const initialRisk = useMemo(() =>
        riskMode === 'compounding'
            ? Number(capital) * (Number(riskPercent) / 100)
            : Number(riskPerTrade)
        , [riskMode, capital, riskPercent, riskPerTrade]);

    const { validationErrors, isBlocked } = useValidation({
        rrRatio, capital, lotSize, winRate, chargesPerTradeForSim, riskPerTrade,
        riskPercent, riskMode, isCrypto, entryPrice, cryptoPrice, cryptoQty,
        cryptoPremium, brokerageModel, brokerageRate: Number(brokerageRate) / 100, assetClass, marginRequired,
        numTrades, leverage, usdToInr, initialRisk
    });

    // Debounce the entire parameter object before simulation
    const effectiveLeverage = isCrypto ? Number(leverage) : 1;
    const simParamsToDebounce = useMemo(() => ({
        assetClass, derivativeType, numTrades, winRate, rrRatio,
        riskMode, riskPerTrade, riskPercent, chargesPerTradeForSim,
        capital, leverage: effectiveLeverage,
        dpCharge: isCrypto ? 0 : chargesObj.dpCharge, seedOffset,
        isBlocked, isCrypto
    }), [
        assetClass, derivativeType, numTrades, winRate, rrRatio,
        riskMode, riskPerTrade, riskPercent, chargesPerTradeForSim,
        capital, effectiveLeverage, isCrypto, chargesObj.dpCharge,
        seedOffset, isBlocked
    ]);

    const debouncedSimParams = useDebounce(simParamsToDebounce, DEBOUNCE_DELAY_MS);

    // ── Core Simulation (Chunked/Async via Web Worker) ──
    const [simData, setSimData] = useState(null);
    const [isSimulating, setIsSimulating] = useState(false);
    const [simError, setSimError] = useState(null); // Bug 8.1 

    const workerRef = useRef(null);
    const simJobIdRef = useRef(0);

    useEffect(() => {
        workerRef.current = new Worker(new URL('../workers/sim.worker.js', import.meta.url), { type: 'module' });
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        let isMounted = true; // Bug 6.2 fix

        if (debouncedSimParams.isBlocked) {
            setSimData(null);
            setIsSimulating(false);
            setIsRerollingState(false);
            setSimError(null);
            return;
        }

        setIsSimulating(true);
        setSimError(null);

        simJobIdRef.current += 1;
        const currentJobId = simJobIdRef.current;

        if (workerRef.current) {
            workerRef.current.onmessage = (e) => {
                if (!isMounted) return;
                const { type, result, error, jobId } = e.data;
                if (jobId !== simJobIdRef.current) return;

                if (type === 'SUCCESS') {
                    setSimData(result);
                } else {
                    console.error("Simulation Worker Error:", error);
                    setSimError(error);
                    setSimData(null);
                }
                setIsSimulating(false);
                setIsRerollingState(false);
            };

            workerRef.current.onerror = (e) => {
                if (!isMounted) return;
                console.error("Simulation Worker Error:", e.message);
                setSimError(e.message);
                setSimData(null);
                setIsSimulating(false);
                setIsRerollingState(false);
            };

            workerRef.current.postMessage({
                jobId: currentJobId,
                params: {
                    initialCapital: Number(debouncedSimParams.capital),
                    numTrades: Math.min(Number(debouncedSimParams.numTrades), 10000),
                    winRate: Number(debouncedSimParams.winRate) / 100,
                    rrRatio: Number(debouncedSimParams.rrRatio),
                    riskMode: debouncedSimParams.riskMode,
                    riskPerTrade: Number(debouncedSimParams.riskPerTrade),
                    riskPercent: Number(debouncedSimParams.riskPercent),
                    chargesPerTrade: Number(debouncedSimParams.chargesPerTradeForSim),
                    dpCharge: Number(debouncedSimParams.dpCharge),
                    seedOffset: debouncedSimParams.seedOffset,
                    leverage: debouncedSimParams.leverage, // pre-computed effectiveLeverage
                    yieldEvery: 0, // Disable internal thread yielding
                }
            });
        }

        return () => {
            isMounted = false;
        };
    }, [debouncedSimParams]);

    const metrics = useMemo(() => {
        if (!simData) return null;

        const dRiskMode = debouncedSimParams.riskMode;
        const dCapital = Number(debouncedSimParams.capital);
        const dRiskPercent = Number(debouncedSimParams.riskPercent);
        const dLeverage = debouncedSimParams.isCrypto ? Number(debouncedSimParams.leverage) : 1;
        const dRiskPerTrade = Number(debouncedSimParams.riskPerTrade);

        const debouncedInitialRisk = dRiskMode === 'compounding'
            ? dCapital * (dRiskPercent / 100)
            : dRiskPerTrade;

        return computeMetrics(
            simData,
            Number(debouncedSimParams.winRate) / 100,
            Number(debouncedSimParams.rrRatio),
            debouncedInitialRisk,
        );
    }, [
        simData,
        debouncedSimParams.winRate,
        debouncedSimParams.rrRatio,
        debouncedSimParams.riskMode,
        debouncedSimParams.capital,
        debouncedSimParams.riskPercent,
        debouncedSimParams.leverage,
        debouncedSimParams.isCrypto,
        debouncedSimParams.riskPerTrade
    ]);

    const { scenarios, handleSaveScenario, handleDeleteScenario, storageError } = useScenarios({
        metrics, assetClass, derivativeType, capital, numTrades, winRate, rrRatio,
        riskMode, riskPerTrade, riskPercent, leverage, cryptoPrice, cryptoQty,
        isMaker, isScalperActive, cryptoPremium, entryPrice, usdToInr
    });

    const allWarnings = useMemo(() => {
        const warnings = [...validationErrors];
        if (leverageClamped) {
            warnings.push({
                id: 'leverage_clamped', type: 'info',
                message: 'ℹ️ Leverage was automatically reduced to the maximum allowed 200x for the selected asset',
                blockSim: false,
            });
        }
        if (simError) {
            warnings.push({
                id: 'sim_error', type: 'error',
                message: `❌ Simulation Error: ${simError}`,
                blockSim: false,
            });
        }
        if (storageError) {
            warnings.push({
                id: 'storage_error', type: 'error',
                message: '❌ Local Storage unavailable: Scenarios will not be saved between sessions.',
                blockSim: false,
            });
        }
        if (metrics?.ruinAtTrade) {
            warnings.push({
                id: `ruin_${metrics.ruinAtTrade}`, type: 'error',
                message: `💀 RUIN: Capital depleted at trade #${metrics.ruinAtTrade}`,
                blockSim: false,
            });
        }
        if (simData?.trades?.some((t) => t.isRiskReduced)) {
            warnings.push({
                id: 'risk_reduced', type: 'warning',
                message: `⚠️ Capital fell below required risk in one or more trades; risk size was automatically reduced`,
                blockSim: false,
            });
        }
        if (metrics) {
            if (!isFinite(metrics.chargeDragPct)) {
                warnings.push({
                    id: 'drag_high_inf', type: 'warning',
                    message: '⚠️ Charge drag is infinite — gross P&L is ≤ 0, but charges were paid',
                    blockSim: false,
                });
            } else if (metrics.chargeDragPct > 50) {
                warnings.push({
                    id: `drag_high_${metrics.chargeDragPct.toFixed(0)}`, type: 'warning',
                    message: `⚠️ Charge drag is ${metrics.chargeDragPct.toFixed(1)}% of gross profits — strategy not viable`,
                    blockSim: false,
                });
            }
        }
        if (metrics && metrics.expectancy < 0 && riskMode === 'compounding') {
            warnings.push({
                id: 'neg_exp_comp', type: 'warning',
                message: '⚠️ Negative expectancy in compounding mode — losses will accelerate',
                blockSim: false,
            });
        }
        if (metrics?.overflowWarning) {
            warnings.push({
                id: 'overflow', type: 'info',
                message: 'ℹ️ Capital reached ₹100Cr compounding cap — further growth is capped',
                blockSim: false,
            });
        }
        return warnings;
    }, [validationErrors, metrics, riskMode, simData, storageError, leverageClamped]);

    const isRerolling = isSimulating && isRerollingState;

    // ── Handlers ──
    const handleReroll = useCallback(() => {
        setIsRerollingState(true);
        setSeedOffset(o => o + 1);
    }, []);

    const handleAssetClassChange = useCallback((assetClassKey) => {
        setAssetClass(assetClassKey);
        setRiskPerTrade(2000);
        setRiskPercent(1);
        setSeedOffset(() => Math.floor(Math.random() * 1000000));
        const options = DERIVATIVE_TYPES[assetClassKey] || [];
        if (options.length) {
            setDerivativeType(options[0].value);
            setLotSize(options[0].lotSize);
            setEntryPrice(0);
            // Auto-set crypto defaults from per-asset config
            const isCryptoClass =
                assetClassKey === 'crypto_futures' ||
                assetClassKey === 'crypto_options';
            if (isCryptoClass) {
                const config = CRYPTO_ASSET_CONFIG[options[0].value];
                if (config) {
                    setCryptoPrice(config.defaultPrice);
                    setLeverage(prev => {
                        const maxL = config.maxLeverage || 200;
                        if (prev > maxL) {
                            setLeverageClamped(true);
                        }
                        return Math.max(1, Math.min(prev, maxL));
                    });
                    const safeDivisor = (config.defaultPrice * config.lotSize) || 1;
                    const recommendedQty = Math.max(1, Math.round(10000 / safeDivisor));
                    setCryptoQty(recommendedQty);
                }
            } else {
                setLeverage(1);
                setIsScalperActive(false);
                setIsMaker(true);
                setCryptoQty(1000);
                setCryptoPrice(100000);
                setCryptoPremium(300);
            }
        }
    }, [setRiskPerTrade, setRiskPercent, setDerivativeType, setLotSize, setEntryPrice, setCryptoPrice, setLeverage, setCryptoQty, setIsScalperActive, setIsMaker, setCryptoPremium]);

    const healthColor = metrics
        ? metrics.healthScore >= 65
            ? 'text-green-400'
            : metrics.healthScore >= 50
                ? 'text-yellow-400'
                : 'text-red-400'
        : 'text-gray-500';

    return {
        // Input state + setters
        capital, setCapital,
        assetClass, setAssetClass,
        derivativeType, setDerivativeType,
        lotSize, setLotSize,
        numTrades, setNumTrades,
        winRate, setWinRate,
        rrRatio, setRrRatio,
        riskMode, setRiskMode,
        riskPerTrade, setRiskPerTrade,
        riskPercent, setRiskPercent,
        brokerageModel, setBrokerageModel,
        brokerageRate, setBrokerageRate,
        entryPrice, setEntryPrice,
        seedOffset, setSeedOffset,
        // Crypto state + setters
        isMaker, setIsMaker,
        isScalperActive, setIsScalperActive,
        cryptoQty, setCryptoQty,
        cryptoPrice, setCryptoPrice,
        leverage, setLeverage,
        cryptoPremium, setCryptoPremium,
        usdToInr, setUsdToInr,
        // UI state
        isPanelCollapsed, setIsPanelCollapsed,
        scenarios,
        // Derived
        derivativeOptions, isCrypto,
        currentCryptoConfig, assetQty, marginRequired,
        chargesObj, chargesPerTrade, chargesPerTradeForSim,
        validationErrors, isBlocked,
        simData, simError, metrics, allWarnings,
        healthColor, initialRisk, isSimulating, isRerolling: isRerolling,
        // Handlers
        handleAssetClassChange,
        handleReroll,
        handleSaveScenario,
        handleDeleteScenario,
    };
};
