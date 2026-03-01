/**
 * @fileoverview Custom hook encapsulating all simulation state and computations.
 * Extracts state management and memoized calculations from TradingSimulator.
 */

import { useState, useMemo, useCallback } from 'react';
import { DERIVATIVE_TYPES, CRYPTO_ASSET_CONFIG, USD_TO_INR } from '../constants';
import { useDebounce } from './useDebounce';
import {
    formatINR,
    calculateCharges,
    runSimulation,
    computeMetrics,
} from '../utils';

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
    // Entry price for accurate turnover estimation
    const [entryPrice, setEntryPrice] = useState(0);
    // seedOffset state to allow re-rolling the main simulation
    const [seedOffset, setSeedOffset] = useState(0);

    // ── Crypto-specific State ──
    const [isMaker, setIsMaker] = useState(true);
    const [isScalperActive, setIsScalperActive] = useState(false);
    const [cryptoQty, setCryptoQty] = useState(1000);
    const [cryptoPrice, setCryptoPrice] = useState(100000);
    const [cryptoPremium, setCryptoPremium] = useState(300);
    const [leverage, setLeverage] = useState(1);

    // ── UI State ──
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
    const [scenarios, setScenarios] = useState([]);

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

    // Asset-class-aware turnover estimation using entryPrice
    const estimatedTurnover = useMemo(() => {
        if (isCrypto) {
            const cryptoLot = currentCryptoConfig?.lotSize || lotSize;
            const notional = Number(cryptoQty) * Number(cryptoLot) * Number(cryptoPrice);
            return { buy: notional, sell: notional };
        }
        // Use actual entry price for turnover when available
        if (Number(entryPrice) > 0) {
            const turnover = Number(entryPrice) * Number(lotSize);
            return { buy: turnover, sell: turnover };
        }
        // Use sensible default typical prices based on derivative type instead of arbitrary formulas
        let typicalPrice = 100; // conservative default fallback
        if (derivativeType === 'NIFTY') {
            typicalPrice = assetClass.includes('options') ? 150 : 22000;
        } else if (derivativeType === 'BANKNIFTY') {
            typicalPrice = assetClass.includes('options') ? 350 : 49000;
        } else if (derivativeType === 'FINNIFTY') {
            typicalPrice = assetClass.includes('options') ? 120 : 21000;
        } else if (derivativeType === 'MIDCPNIFTY') {
            typicalPrice = assetClass.includes('options') ? 80 : 10000;
        } else if (assetClass.includes('mcx_')) {
            typicalPrice = derivativeType === 'CRUDE' ? 6500 :
                derivativeType === 'NATGAS' ? 250 :
                    derivativeType === 'GOLD' ? 70000 :
                        derivativeType === 'SILVER' ? 85000 : 1000;
        } else if (assetClass.includes('equity_')) {
            typicalPrice = 1500; // generic stock price
        }

        const turnover = typicalPrice * Number(lotSize);
        return { buy: turnover, sell: turnover };
    }, [assetClass, lotSize, isCrypto, cryptoQty, cryptoPrice, currentCryptoConfig, entryPrice, derivativeType]);

    const chargesObj = useMemo(
        () =>
            calculateCharges(
                assetClass,
                estimatedTurnover.buy,
                estimatedTurnover.sell,
                brokerageModel,
                brokerageRate,
                isCrypto
                    ? {
                        isMaker,
                        isScalperActive,
                        contracts: Number(cryptoQty),
                        lotSize: Number(currentCryptoConfig?.lotSize || lotSize),
                        premium: Number(cryptoPremium),
                        btcPrice: Number(cryptoPrice),
                    }
                    : {},
                derivativeType,
            ),
        [
            assetClass, estimatedTurnover, brokerageModel, brokerageRate,
            isCrypto, isMaker, isScalperActive, cryptoQty, lotSize,
            cryptoPremium, cryptoPrice, currentCryptoConfig, derivativeType,
        ],
    );
    const chargesPerTrade = chargesObj.total;
    const chargesPerTradeForSim = isCrypto ? chargesObj.total * USD_TO_INR : chargesObj.total;

    // ── Validation ──
    const validationErrors = useMemo(() => {
        const errors = [];

        // 1. Mandatory Input Checks
        const isMissing = (val) => val === '' || val === undefined || isNaN(Number(val));

        if (isMissing(capital)) errors.push({ id: 'req_cap', type: 'error', message: '⛔ Please enter Initial Capital', blockSim: true });
        if (isMissing(lotSize) && !isCrypto) errors.push({ id: 'req_lot', type: 'error', message: '⛔ Please enter Lot Size', blockSim: true });
        if (isMissing(numTrades) || Number(numTrades) <= 0) errors.push({ id: 'req_trades', type: 'error', message: '⛔ Please enter Trade Count (> 0)', blockSim: true });
        if (isMissing(winRate) || Number(winRate) < 0 || Number(winRate) > 100) errors.push({ id: 'req_wr', type: 'error', message: '⛔ Please enter Win Rate (0-100)', blockSim: true });
        if (isMissing(rrRatio)) errors.push({ id: 'req_rr', type: 'error', message: '⛔ Please enter RR Ratio', blockSim: true });

        if (riskMode === 'fixed' && isMissing(riskPerTrade)) errors.push({ id: 'req_rpt', type: 'error', message: '⛔ Please enter Risk Per Trade', blockSim: true });
        if (riskMode === 'compounding' && (isMissing(riskPercent) || Number(riskPercent) <= 0 || Number(riskPercent) > 100)) errors.push({ id: 'req_rpct', type: 'error', message: '⛔ Please enter Risk % (0-100)', blockSim: true });

        if (isCrypto) {
            if (isMissing(cryptoPrice)) errors.push({ id: 'req_cp', type: 'error', message: '⛔ Please enter Crypto Price', blockSim: true });
            if (isMissing(cryptoQty)) errors.push({ id: 'req_cq', type: 'error', message: '⛔ Please enter Crypto Qty', blockSim: true });
            if (assetClass === 'crypto_options' && isMissing(cryptoPremium)) errors.push({ id: 'req_cprem', type: 'error', message: '⛔ Please enter Option Premium', blockSim: true });
        } else if (brokerageModel === 'percentage' && isMissing(brokerageRate)) {
            errors.push({ id: 'req_br', type: 'error', message: '⛔ Please enter Brokerage Rate', blockSim: true });
        }

        if (assetClass === 'index_options' || assetClass === 'equity_options' || assetClass === 'mcx_options') {
            errors.push({
                id: 'opt_itm', type: 'info',
                message: 'ℹ️ STT models sell-to-close only. Options exercised In-The-Money (ITM) at expiry attract 0.125% STT on settlement value.',
                blockSim: false,
            });
        }

        // If mandatory fields are missing, block immediately to avoid NaN/0 errors below
        if (errors.some(e => e.blockSim)) return errors;

        const nCapital = Number(capital);
        const nLotSize = Number(lotSize);
        const nWinRate = Number(winRate);
        const nRrRatio = Number(rrRatio);
        const nRiskPerTrade = Number(riskPerTrade);
        const nRiskPercent = Number(riskPercent);
        const nCryptoQty = Number(cryptoQty);
        const nEntryPrice = Number(entryPrice);

        if (nRrRatio <= 0) {
            errors.push({
                id: 'rr_zero', type: 'error',
                message: '⛔ RR Ratio must be greater than 0', blockSim: true,
            });
        }
        if (nCapital < 1000) {
            errors.push({
                id: 'low_cap_abs', type: 'error',
                message: '⛔ Minimum capital is ₹1,000', blockSim: true,
            });
        }
        if (!isCrypto && nLotSize <= 0) {
            errors.push({
                id: 'lot_zero', type: 'error',
                message: '⛔ Lot size must be greater than 0', blockSim: true,
            });
        }

        // Validate riskPerTrade > 0 and Charges <= Risk
        const currentRisk = riskMode === 'fixed' ? nRiskPerTrade : nCapital * (nRiskPercent / 100) * (isCrypto ? leverage : 1);

        if (currentRisk <= 0) {
            errors.push({
                id: 'risk_zero', type: 'error',
                message: '⛔ Risk per trade must be greater than ₹0',
                blockSim: true,
            });
        } else if (chargesPerTradeForSim >= currentRisk) {
            let maxLotsMsg = '';
            if (isCrypto && nCryptoQty > 0) {
                const chargesPerLot = chargesPerTradeForSim / nCryptoQty;
                if (chargesPerLot > 0) {
                    const maxLots = Math.floor((currentRisk - 0.01) / chargesPerLot);
                    maxLotsMsg = ` Max qty for this risk is ${Math.max(0, maxLots)} lot(s).`;
                }
            }

            errors.push({
                id: 'risk_too_low', type: 'error',
                message: `⛔ Risk (₹${formatINR(currentRisk, 2)}) is lower than est. charges (₹${formatINR(chargesPerTradeForSim, 2)}).${maxLotsMsg}`,
                blockSim: true,
            });
        }

        // Validation: Margin required must not exceed capital
        if (isCrypto && marginRequired > 0) {
            const requiredMarginINR = marginRequired * USD_TO_INR;
            if (requiredMarginINR > nCapital) {
                const marginPerLotINR = requiredMarginINR / nCryptoQty;
                const maxLots = Math.floor(nCapital / marginPerLotINR);
                errors.push({
                    id: 'margin_exceeds_capital', type: 'error',
                    message: `⛔ Margin required (₹${formatINR(requiredMarginINR, 2)}) exceeds capital. Max qty you can trade is ${maxLots} lot(s).`,
                    blockSim: true,
                });
            }
        }
        if (nWinRate === 100) {
            errors.push({
                id: 'wr_100', type: 'info',
                message: 'ℹ️ 100% win rate is theoretical — use for upper-bound analysis only',
                blockSim: false,
            });
        }
        if (nWinRate === 0) {
            errors.push({
                id: 'wr_zero', type: 'warning',
                message: '⚠️ Win rate is 0% — all trades will be losses', blockSim: false,
            });
        }
        if (nCapital < chargesPerTradeForSim * 20) {
            errors.push({
                id: 'low_cap_rel', type: 'warning',
                message: `⚠️ Capital may be too low for charge drag. Recommended minimum: ${formatINR(chargesPerTradeForSim * 50)}`,
                blockSim: false,
            });
        }
        // Warn if non-crypto asset uses a 0 entry price fallback
        if (!isCrypto && nEntryPrice === 0) {
            errors.push({
                id: 'entry_zero', type: 'warning',
                message: '⚠️ Entry price is ₹0. Charge estimates may be highly inaccurate. Set entry price for accurate results.',
                blockSim: false,
            });
        }
        return errors;
    }, [rrRatio, capital, lotSize, winRate, chargesPerTradeForSim, chargesPerTrade, riskPerTrade, riskPercent, riskMode, isCrypto, entryPrice, cryptoPrice, cryptoQty, cryptoPremium, brokerageModel, brokerageRate, assetClass, marginRequired, numTrades]);

    const isBlocked = validationErrors.some((e) => e.blockSim);

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

    // ── Core Simulation ──
    const simData = useMemo(() => {
        if (debouncedSimParams.isBlocked) return null;
        return runSimulation({
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
    }, [debouncedSimParams]);

    const metrics = useMemo(() => {
        if (!simData) return null;
        return computeMetrics(
            simData, Number(debouncedSimParams.chargesPerTradeForSim), Number(debouncedSimParams.winRate) / 100, Number(debouncedSimParams.rrRatio), Number(debouncedSimParams.initialRisk),
        );
    }, [simData, debouncedSimParams]);

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
                    setLeverage(1);
                    setCryptoQty(1000); // Fixed Bug 13
                }
            }
        }
    }, []);

    const handleSaveScenario = useCallback(
        (name) => {
            if (!metrics) return;
            const newScenario = {
                id: crypto.randomUUID(),
                name,
                inputs: {
                    assetClass, derivativeType, capital, numTrades,
                    winRate, rrRatio, riskMode, riskPerTrade, riskPercent,
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
        ],
    );

    const handleDeleteScenario = useCallback((id) => {
        setScenarios((s) => s.filter((x) => x.id !== id));
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
        // UI state
        isPanelCollapsed, setIsPanelCollapsed,
        scenarios,
        // Derived
        derivativeOptions, isCrypto,
        currentCryptoConfig, assetQty, marginRequired,
        chargesObj, chargesPerTrade, chargesPerTradeForSim,
        validationErrors, isBlocked,
        simData, metrics, allWarnings,
        healthColor, initialRisk,
        // Handlers
        handleAssetClassChange,
        handleSaveScenario,
        handleDeleteScenario,
    };
};
