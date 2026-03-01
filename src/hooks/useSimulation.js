/**
 * @fileoverview Custom hook encapsulating all simulation state and computations.
 * Extracts state management and memoized calculations from TradingSimulator.
 */

import { useState, useMemo, useCallback } from 'react';
import { DERIVATIVE_TYPES, CRYPTO_ASSET_CONFIG, USD_TO_INR } from '../constants';
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
    const [assetClass, setAssetClass] = useState('index_options_buy');
    const [derivativeType, setDerivativeType] = useState('NIFTY');
    const [lotSize, setLotSize] = useState(75);
    const [numTrades, setNumTrades] = useState(100);
    const [winRate, setWinRate] = useState(45);
    const [rrRatio, setRrRatio] = useState(2);
    const [riskMode, setRiskMode] = useState('fixed');
    /** Flaw 1 note: `riskPerTrade` represents the absolute stop-loss amount, NOT margin. Leverage does not affect simulated P&L. */
    const [riskPerTrade, setRiskPerTrade] = useState(2000);
    const [riskPercent, setRiskPercent] = useState(1);
    const [brokerageModel, setBrokerageModel] = useState('flat20');
    const [brokerageRate, setBrokerageRate] = useState(0.0003);
    // #2/#3: Entry price for accurate turnover estimation
    const [entryPrice, setEntryPrice] = useState(0);
    // Flaw 8 fix: Add seedOffset state to allow re-rolling the main simulation
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

    const isCrypto =
        assetClass === 'crypto_futures' || assetClass === 'crypto_options';

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

    // #2/#3/#4: Asset-class-aware turnover estimation using entryPrice
    const estimatedTurnover = useMemo(() => {
        if (isCrypto) {
            // #4: Use currentCryptoConfig.lotSize, not component lotSize
            const cryptoLot = currentCryptoConfig?.lotSize || lotSize;
            const notional = Number(cryptoQty) * Number(cryptoLot) * Number(cryptoPrice);
            return { buy: notional, sell: notional };
        }
        // #2/#3: Use actual entry price for turnover when available
        if (Number(entryPrice) > 0) {
            const turnover = Number(entryPrice) * Number(lotSize);
            return { buy: turnover, sell: turnover };
        }
        // #7 Fix: Use sensible default typical prices based on derivative type instead of arbitrary formulas
        let typicalPrice = 100; // conservative default fallback
        if (derivativeType === 'NIFTY') {
            typicalPrice = assetClass.includes('options') ? 150 : 22000;
        } else if (derivativeType === 'BANKNIFTY') {
            typicalPrice = assetClass.includes('options') ? 350 : 49000;
        } else if (derivativeType === 'FINNIFTY') {
            typicalPrice = assetClass.includes('options') ? 120 : 21000;
        } else if (derivativeType === 'MIDCPNIFTY') {
            typicalPrice = assetClass.includes('options') ? 80 : 10000;
        } else if (derivativeType === 'SENSEX') {
            typicalPrice = assetClass.includes('options') ? 400 : 75000;
        } else if (derivativeType === 'BANKEX') {
            typicalPrice = assetClass.includes('options') ? 500 : 54000;
        } else if (assetClass.includes('mcx_')) {
            typicalPrice = derivativeType === 'CRUDEOIL' ? 6500 :
                derivativeType === 'NATURALGAS' ? 250 :
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
                        // #5: Use currentCryptoConfig.lotSize for crypto
                        lotSize: Number(currentCryptoConfig?.lotSize || lotSize),
                        premium: Number(cryptoPremium),
                        btcPrice: Number(cryptoPrice),
                    }
                    : {},
                // #10: Pass derivativeType for MCX commodity-specific rates
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
        if (isMissing(numTrades)) errors.push({ id: 'req_trades', type: 'error', message: '⛔ Please enter Trade Count', blockSim: true });
        if (isMissing(winRate)) errors.push({ id: 'req_wr', type: 'error', message: '⛔ Please enter Win Rate', blockSim: true });
        if (isMissing(rrRatio)) errors.push({ id: 'req_rr', type: 'error', message: '⛔ Please enter RR Ratio', blockSim: true });

        if (riskMode === 'fixed' && isMissing(riskPerTrade)) errors.push({ id: 'req_rpt', type: 'error', message: '⛔ Please enter Risk Per Trade', blockSim: true });
        if (riskMode === 'compounding' && isMissing(riskPercent)) errors.push({ id: 'req_rpct', type: 'error', message: '⛔ Please enter Risk %', blockSim: true });

        if (isCrypto) {
            if (isMissing(cryptoPrice)) errors.push({ id: 'req_cp', type: 'error', message: '⛔ Please enter Crypto Price', blockSim: true });
            if (isMissing(cryptoQty)) errors.push({ id: 'req_cq', type: 'error', message: '⛔ Please enter Crypto Qty', blockSim: true });
            if (assetClass === 'crypto_options' && isMissing(cryptoPremium)) errors.push({ id: 'req_cprem', type: 'error', message: '⛔ Please enter Option Premium', blockSim: true });
        } else if (brokerageModel === 'percentage' && isMissing(brokerageRate)) {
            errors.push({ id: 'req_br', type: 'error', message: '⛔ Please enter Brokerage Rate', blockSim: true });
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
        if (nLotSize <= 0) {
            errors.push({
                id: 'lot_zero', type: 'error',
                message: '⛔ Lot size must be greater than 0', blockSim: true,
            });
        }

        // Flaw 10: Validate riskPerTrade > 0 and Charges <= Risk
        const currentRisk = riskMode === 'fixed' ? nRiskPerTrade : nCapital * (nRiskPercent / 100);

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
        // Flaw 5: Warn if non-crypto asset uses a 0 entry price fallback
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

    // ── Core Simulation ──
    const simData = useMemo(() => {
        if (isBlocked) return null;
        return runSimulation({
            initialCapital: Number(capital),
            numTrades: Math.min(Number(numTrades), 10000),
            winRate: Number(winRate) / 100,
            rrRatio: Number(rrRatio),
            riskMode,
            riskPerTrade: Number(riskPerTrade),
            riskPercent: Number(riskPercent),
            chargesPerTrade: Number(chargesPerTradeForSim),
            dpCharge: isCrypto ? 0 : Number(chargesObj.dpCharge),
            seedOffset,
            leverage: isCrypto ? Number(leverage) : 1, // Flaw 1 fix
        });
    }, [
        capital, numTrades, winRate, rrRatio, riskMode,
        riskPerTrade, riskPercent, chargesPerTradeForSim, chargesObj.dpCharge, isBlocked, isCrypto,
        estimatedTurnover.buy, seedOffset, leverage,
    ]);

    const metrics = useMemo(() => {
        if (!simData) return null;
        return computeMetrics(
            simData, Number(chargesPerTradeForSim), Number(winRate) / 100, Number(rrRatio), Number(riskPerTrade),
        );
    }, [simData, chargesPerTradeForSim, winRate, rrRatio, riskPerTrade]);

    const allWarnings = useMemo(() => {
        const warnings = [...validationErrors];
        if (metrics?.ruinAtTrade) {
            warnings.push({
                id: `ruin_${metrics.ruinAtTrade}`, type: 'error',
                message: `💀 RUIN: Capital depleted at trade #${metrics.ruinAtTrade}`,
                blockSim: false,
            });
        }
        if (metrics && metrics.chargeDragPct > 50) {
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
    }, [validationErrors, metrics, riskMode]);

    // ── Handlers ──
    const handleAssetClassChange = useCallback((assetClassKey) => {
        setAssetClass(assetClassKey);
        const options = DERIVATIVE_TYPES[assetClassKey] || [];
        if (options.length) {
            setDerivativeType(options[0].value);
            setLotSize(options[0].lotSize);
            // Auto-set crypto defaults from per-asset config
            const isCryptoClass =
                assetClassKey === 'crypto_futures' ||
                assetClassKey === 'crypto_options';
            if (isCryptoClass) {
                const config = CRYPTO_ASSET_CONFIG[options[0].value];
                if (config) {
                    setCryptoPrice(config.defaultPrice);
                    setLeverage(1);
                }
            }
        }
    }, []);

    const handleSaveScenario = useCallback(
        (name) => {
            if (scenarios.length >= 5 || !metrics) return;
            setScenarios((prev) => [
                ...prev,
                {
                    id: Date.now().toString(),
                    name,
                    inputs: {
                        assetClass, derivativeType, capital, numTrades,
                        winRate, rrRatio, riskMode, riskPerTrade,
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
                },
            ]);
        },
        [
            scenarios, metrics, assetClass, derivativeType,
            capital, numTrades, winRate, rrRatio, riskMode, riskPerTrade,
        ],
    );

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
        scenarios, setScenarios,
        // Derived
        derivativeOptions, isCrypto,
        currentCryptoConfig, assetQty, marginRequired,
        chargesObj, chargesPerTrade, chargesPerTradeForSim,
        validationErrors, isBlocked,
        simData, metrics, allWarnings,
        healthColor,
        // Handlers
        handleAssetClassChange,
        handleSaveScenario,
    };
};
