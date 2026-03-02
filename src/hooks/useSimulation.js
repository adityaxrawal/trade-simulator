/**
 * @fileoverview Custom hook encapsulating all simulation state and computations.
 * Extracts state management and memoized calculations from TradingSimulator.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { DERIVATIVE_TYPES, CRYPTO_ASSET_CONFIG, USD_TO_INR } from '../constants';
import { useDebounce } from './useDebounce';
import { runSimulation, computeMetrics } from '../utils';

// Import extracted hooks
import { useValidation } from './useValidation';
import { useCharges } from './useCharges';
import { useScenarios } from './useScenarios';

/**
 * Manages all simulation state, derived values, validation, and handlers.
 * @returns {Object} All state values, setters, computed data, and handlers.
 */
export const useSimulation = () => {
    // ── Input State ──
    const [capital, setCapital] = useState(200000);
    const [assetClass, setAssetClass] = useState('index_options');
    const [derivativeType, setDerivativeType] = useState('NIFTY');
    const [lotSize, setLotSize] = useState(75);
    const [numTrades, setNumTrades] = useState(100);
    const [winRate, setWinRate] = useState(45);
    const [rrRatio, setRrRatio] = useState(2);
    const [riskMode, setRiskMode] = useState('fixed');
    const [riskPerTrade, setRiskPerTrade] = useState(2000);
    const [riskPercent, setRiskPercent] = useState(1);
    const [brokerageModel, setBrokerageModel] = useState('flat20');
    const [brokerageRate, setBrokerageRate] = useState(0.0003);
    const [entryPrice, setEntryPrice] = useState(0);
    const [seedOffset, setSeedOffset] = useState(0);

    // ── Crypto-specific State ──
    const [isMaker, setIsMaker] = useState(true);
    const [isScalperActive, setIsScalperActive] = useState(false);
    const [cryptoQty, setCryptoQty] = useState(1000);
    const [cryptoPrice, setCryptoPrice] = useState(100000);
    const [cryptoPremium, setCryptoPremium] = useState(300);
    const [leverage, setLeverage] = useState(1);

    const [usdToInr, setUsdToInr] = useState(USD_TO_INR);

    // ── UI State ──
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
        brokerageRate, isMaker, isScalperActive, usdToInr
    });

    const { validationErrors, isBlocked } = useValidation({
        rrRatio, capital, lotSize, winRate, chargesPerTradeForSim, riskPerTrade,
        riskPercent, riskMode, isCrypto, entryPrice, cryptoPrice, cryptoQty,
        cryptoPremium, brokerageModel, brokerageRate, assetClass, marginRequired,
        numTrades, leverage, usdToInr
    });

    const initialRisk = useMemo(() =>
        riskMode === 'compounding'
            ? Number(capital) * (Number(riskPercent) / 100) * (isCrypto ? Number(leverage) : 1)
            : Number(riskPerTrade)
        , [riskMode, capital, riskPercent, isCrypto, leverage, riskPerTrade]);

    // Debounce the entire parameter object before simulation
    const simParams = useMemo(() => ({
        capital, numTrades, winRate, rrRatio, riskMode, riskPerTrade, riskPercent,
        chargesPerTradeForSim, dpCharge: chargesObj.dpCharge, seedOffset, leverage, isBlocked, isCrypto, initialRisk
    }), [capital, numTrades, winRate, rrRatio, riskMode, riskPerTrade, riskPercent, chargesPerTradeForSim, chargesObj.dpCharge, seedOffset, leverage, isBlocked, isCrypto, initialRisk]);

    const debouncedSimParams = useDebounce(simParams, 300);

    // ── Core Simulation (Chunked/Async) ──
    const [simData, setSimData] = useState(null);
    const [isSimulating, setIsSimulating] = useState(false);

    useEffect(() => {
        if (debouncedSimParams.isBlocked) {
            setSimData(null);
            return;
        }

        let isCancelled = false;
        setIsSimulating(true);

        const runAsync = async () => {
            // Yield to event loop to let UI paint loading state/prevent freezes
            await new Promise(r => setTimeout(r, 0));
            if (isCancelled) return;

            try {
                const result = runSimulation({
                    initialCapital: Number(debouncedSimParams.capital),
                    numTrades: Math.min(Number(debouncedSimParams.numTrades), 10000),
                    winRate: Number(debouncedSimParams.winRate) / 100,
                    rrRatio: Number(debouncedSimParams.rrRatio),
                    riskMode: debouncedSimParams.riskMode,
                    riskPerTrade: Number(debouncedSimParams.riskPerTrade),
                    riskPercent: Number(debouncedSimParams.riskPercent),
                    chargesPerTrade: Number(debouncedSimParams.chargesPerTradeForSim),
                    dpCharge: debouncedSimParams.isCrypto ? 0 : Number(debouncedSimParams.dpCharge),
                    seedOffset: debouncedSimParams.seedOffset,
                    leverage: debouncedSimParams.isCrypto ? Number(debouncedSimParams.leverage) : 1,
                });

                if (!isCancelled) {
                    setSimData(result);
                }
            } catch (e) {
                console.error("Simulation error:", e);
            } finally {
                if (!isCancelled) {
                    setIsSimulating(false);
                }
            }
        };

        runAsync();

        return () => { isCancelled = true; };
    }, [debouncedSimParams]);

    const metrics = useMemo(() => {
        if (!simData) return null;
        return computeMetrics(
            simData, Number(debouncedSimParams.chargesPerTradeForSim), Number(debouncedSimParams.winRate) / 100, Number(debouncedSimParams.rrRatio), Number(debouncedSimParams.initialRisk),
        );
    }, [simData, debouncedSimParams]);

    const { scenarios, handleSaveScenario, handleDeleteScenario } = useScenarios(
        metrics, assetClass, derivativeType, capital, numTrades, winRate, rrRatio,
        riskMode, riskPerTrade, riskPercent, leverage, cryptoPrice, cryptoQty,
        isMaker, isScalperActive, cryptoPremium, entryPrice
    );

    const allWarnings = useMemo(() => {
        const warnings = [...validationErrors];
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
        if (metrics && isFinite(metrics.chargeDragPct) && metrics.chargeDragPct > 50) {
            warnings.push({
                id: `drag_high_${metrics.chargeDragPct.toFixed(0)}`, type: 'warning',
                message: `⚠️ Charge drag is ${metrics.chargeDragPct.toFixed(1)}% of gross profits — strategy not viable`,
                blockSim: false,
            });
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
    }, [validationErrors, metrics, riskMode, simData]);

    // ── Handlers ──
    const handleAssetClassChange = useCallback((assetClassKey) => {
        setAssetClass(assetClassKey);
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
                    setLeverage(prev => Math.max(1, prev)); // keep user's existing leverage
                    const recommendedQty = Math.max(1, Math.round(10000 / (config.defaultPrice * config.lotSize)));
                    setCryptoQty(recommendedQty);
                }
            }
        }
    }, []);

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
        simData, metrics, allWarnings,
        healthColor, initialRisk, isSimulating,
        // Handlers
        handleAssetClassChange,
        handleSaveScenario,
        handleDeleteScenario,
    };
};
