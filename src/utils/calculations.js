/**
 * @fileoverview Charge calculation and metrics computation engines.
 * 
 * Includes the COMPOUNDING_CAP rule which acts as a hard limit on the max possible
 * capital a strategy can theoretically reach to avoid infinite floating point math
 * and create realistic expectations. (Currently at ₹100Cr)
 */

import {
    CHARGE_RATES,
    SEBI_RATE,
    GST_RATE,
    CRYPTO_FEE_RATES,
    ZERODHA_PERCENTAGE_RATE,
    MCX_EXCH_RATES,
} from '../constants';
import { safeDivide } from './format';

/**
 * Common utility to calculate the actual charges to deduct when capital is low.
 * Ensures consistent ruin simulation behavior across both single run and Monte Carlo engines.
 * 
 * @param {number} capitalBeforeTrade The available capital before this trade
 * @param {number} intendedNetPnl The net profit/loss if full charges were paid
 * @param {number} grossPnl The gross profit/loss of the trade
 * @param {number} currentCharges The theoretical charges required
 * @returns {number} The actual charges that can be extracted from the trader
 */
export const calculateActualCharges = (capitalBeforeTrade, intendedNetPnl, grossPnl, currentCharges) => {
    let actualCharges = currentCharges;
    if (capitalBeforeTrade + intendedNetPnl < 0) {
        actualCharges = Math.max(0, Math.min(currentCharges, capitalBeforeTrade + grossPnl));
    }
    return actualCharges;
};

/**
 * Calculates all applicable charges for a single round-trip trade.
 * Supports Indian market instruments (NSE/BSE/MCX/NCDEX) and crypto (Delta Exchange).
 *
 * @param {string} assetClass The asset class key from ASSET_CLASSES.
 * @param {number} buyTurnover Buy-side turnover value.
 * @param {number} sellTurnover Sell-side turnover value.
 * @param {string} brokerageModel Either "flat20" or "percentage".
 * @param {number} brokerageRate Percentage rate when using percentage model.
 * @param {Object} cryptoParams Crypto-specific parameters.
 * @param {boolean} cryptoParams.isMaker Whether the order is a maker order.
 * @param {boolean} cryptoParams.isScalperActive Whether scalper offer is active.
 * @param {number} cryptoParams.contracts Number of contracts.
 * @param {number} cryptoParams.lotSize Lot size per contract.
 * @param {number} cryptoParams.premium Option premium (crypto options only).
 * @param {string} derivativeType The derivative instrument key (for MCX commodity rates).
 * @param {number} cryptoParams.btcPrice Current asset price in USD.
 * @returns {Object} Breakdown of all charges and total.
 */
export const calculateCharges = (
    assetClass,
    buyTurnover,
    sellTurnover,
    brokerageModel = 'flat20',
    brokerageRate = 0.0003,
    cryptoParams = {},
    derivativeType = '',
) => {
    if (!CHARGE_RATES[assetClass]) {
        console.warn(`[calculateCharges] Unknown assetClass "${assetClass}" explicitly requested. Falling back to index_options.`);
    }
    const rates = CHARGE_RATES[assetClass] || CHARGE_RATES.index_options;
    const totalTurnover = buyTurnover + sellTurnover;
    const isCrypto =
        assetClass === 'crypto_futures' || assetClass === 'crypto_options';

    let brokerage;
    if (isCrypto) {
        const {
            isMaker = true,
            isScalperActive = false,
            contracts = 0,
            lotSize = 0.001,
            premium = 0,
            btcPrice: cryptoPrice = 0,
        } = cryptoParams;
        const isFutures = assetClass === 'crypto_futures';
        const tier = isFutures
            ? CRYPTO_FEE_RATES.futures
            : CRYPTO_FEE_RATES.options;

        let feeRate;
        if (isScalperActive) {
            feeRate = isMaker ? tier.scalper_maker : tier.scalper_taker;
        } else {
            feeRate = isMaker ? tier.maker : tier.taker;
        }

        const notional = contracts * lotSize * cryptoPrice;
        let tradingFee = notional * feeRate * 2; // round-trip: open + close

        // Options: apply 3.5% premium cap
        if (!isFutures && premium > 0) {
            const premiumCap =
                CRYPTO_FEE_RATES.options.premiumCapPct *
                contracts * lotSize * premium * 2; // capped on both legs
            tradingFee = Math.min(tradingFee, premiumCap);
        }

        brokerage = tradingFee;
    } else if (assetClass === 'equity_delivery') {
        if (brokerageModel === 'percentage') {
            const buyBrokerage = buyTurnover > 0 ? Math.min(20, brokerageRate * buyTurnover) : 0;
            const sellBrokerage = sellTurnover > 0 ? Math.min(20, brokerageRate * sellTurnover) : 0;
            brokerage = buyBrokerage + sellBrokerage;
        } else {
            // Flat 20 brokers typically charge ₹20 per order for delivery
            const buyBrokerage = buyTurnover > 0 ? 20 : 0;
            const sellBrokerage = sellTurnover > 0 ? 20 : 0;
            brokerage = buyBrokerage + sellBrokerage;
        }
    } else if (brokerageModel === 'flat20') {
        if (assetClass === 'equity_intraday') {
            // Intraday brokerage is min(0.03%, ₹20) per order, not per side
            const buyBrokerage = buyTurnover > 0 ? Math.min(20, 0.0003 * buyTurnover) : 0;
            const sellBrokerage = sellTurnover > 0 ? Math.min(20, 0.0003 * sellTurnover) : 0;
            brokerage = buyBrokerage + sellBrokerage;
        } else {
            // Options, Futures, Commodity, Currency are strictly Flat 20
            const buyBrokerage = buyTurnover > 0 ? 20 : 0;
            const sellBrokerage = sellTurnover > 0 ? 20 : 0;
            brokerage = buyBrokerage + sellBrokerage;
        }
    } else {
        // percentage mode
        brokerage = brokerageRate * totalTurnover;
    }

    const stt = rates.stt_buy * buyTurnover + rates.stt_sell * sellTurnover;
    const ctt = rates.ctt_sell * sellTurnover;

    const mcxKey = derivativeType;

    // Use MCX commodity-specific exchange rates when available
    const exchRate = (assetClass.startsWith('mcx_') && MCX_EXCH_RATES[mcxKey])
        ? MCX_EXCH_RATES[mcxKey] : rates.exch_rate;
    const exchTxn = exchRate * totalTurnover;
    const sebiCharge = isCrypto ? 0 : SEBI_RATE * totalTurnover;
    // GST base includes brokerage and exchange transaction charges, but excludes statutory SEBI charges and Stamp Duty.
    // DP charge is deposited separately and shouldn't be taxed here (or natively includes GST)
    const gst = isCrypto
        ? CRYPTO_FEE_RATES.gst * brokerage
        : GST_RATE * (brokerage + exchTxn);
    const stampDuty = rates.stamp_buy * buyTurnover;
    const dpCharge = rates.dp_charge;
    const total =
        brokerage + stt + ctt + exchTxn + sebiCharge + gst + stampDuty + dpCharge;

    return {
        brokerage: +brokerage.toFixed(2),
        stt: +stt.toFixed(2),
        ctt: +ctt.toFixed(2),
        exchTxn: +exchTxn.toFixed(2),
        sebiCharge: +sebiCharge.toFixed(2),
        gst: +gst.toFixed(2),
        stampDuty: +stampDuty.toFixed(2),
        dpCharge: +dpCharge.toFixed(2),
        total: +total.toFixed(2),
    };
};

/**
 * @typedef {Object} MetricsResult
 * @property {number} netPnL Total net profit or loss
 * @property {number} grossPnL Total gross profit or loss
 * @property {number} avgRiskPerTrade Average theoretical risk taken per trade
 * @property {number} avgChargesPerTrade Average theoretical charges per trade
 * @property {number} totalCharges Total charges paid
 * @property {number} finalCapital Ending capital amount
 * @property {number} actualWinRate Realized win rate excluding placeholder trades
 * @property {number} profitFactor Gross wins divided by gross losses
 * @property {number} expectancy Average net P&L per trade
 * @property {number} expectancyPerRupee Expected return per 1 unit of risk
 * @property {number} maxDrawdownRs Maximum drawdown in Rupee amount
 * @property {number} maxDrawdownPct Maximum drawdown in Percentage
 * @property {number} recoveryFactor Net P&L divided by Max Drawdown Absolute
 * @property {number} perTradeSharpe Theoretical per-trade Sharpe ratio
 * @property {number} chargeDragPct What percent of gross profits went into charges
 * @property {number} breakEvenWR Win rate required to break even
 * @property {number} breakEvenRR RR required to break even
 * @property {number} kellyFull Kelly fraction (full)
 * @property {number} kellyHalf Kelly fraction (half)
 * @property {number} maxWinStreak Longest consecutive wins
 * @property {number} maxLossStreak Longest consecutive losses
 * @property {number} medianMaxLossStreak Statistical median expected longest loss streak
 * @property {number} healthScore Overall strategy health score (0-100 scale). Max 100 is achieved when expectancy is high, profit factor >= 2.0, max drawdown < 10%, and charge drag < 10%.
 * @property {string} healthGrade Grade classification (A-F based on healthScore)
 * @property {string} healthLabel Human readable classification based on healthScore
 * @property {number|null} ruinAtTrade Trade index where capital hit zero.
 * @property {boolean} overflowWarning Whether the compound capital cap was reached.
 */

/**
 * Computes comprehensive trading performance metrics from simulation results.
 *
 * @param {Object} simData Simulation output from runSimulation.
 * @param {number} winRate Win rate as a decimal (0–1).
 * @param {number} rrRatio Risk-to-reward ratio.
 * @param {number} riskPerTrade Risk per trade in currency units.
 * @returns {MetricsResult|null} Computed metrics or null if simData is null.
 */
export const computeMetrics = (
    simData,
    winRate,
    rrRatio,
    riskPerTrade,
) => {
    if (!simData) return null;

    const {
        trades, grossPnlSum, netPnlSum, chargesSum,
        winCount, totalGrossWins, totalGrossLosses,
        initialCapital, finalCapital, ruinAtTrade, overflowWarning,
    } = simData;
    const numTrades = trades.length;
    // activeTrades excludes post-ruin placeholder trades
    const activeTrades = trades.filter(t => !t.isRuined);
    const activeTradeCount = activeTrades.length;

    const actualWinRate = safeDivide(winCount, activeTradeCount) * 100;

    // Return Infinity when all trades win (no losses)
    const profitFactor = totalGrossLosses === 0
        ? (totalGrossWins > 0 ? Infinity : 0)
        : totalGrossWins / totalGrossLosses;

    // Single-charge expectancy — charges deducted once unconditionally
    const avgChargesPerTrade = safeDivide(chargesSum, activeTradeCount);

    // Track actual average risk for compounding accuracy
    const totalRiskTaken = activeTrades.reduce((sum, t) => sum + (t.isWin ? t.grossPnl / rrRatio : Math.abs(t.grossPnl)), 0);
    const avgRiskPerTrade = safeDivide(totalRiskTaken, Math.max(1, activeTradeCount)) || riskPerTrade;

    // Use empirical expectancy from active trades
    const activeNetPnlSum = activeTrades.reduce((sum, t) => sum + t.netPnl, 0);
    const expectancy = safeDivide(activeNetPnlSum, Math.max(1, activeTradeCount));
    const expectancyPerRupee = safeDivide(expectancy, avgRiskPerTrade);

    let maxDrawdownRs = 0;
    let maxDrawdownPct = 0;
    for (const trade of trades) {
        if (trade.drawdownRs < maxDrawdownRs) maxDrawdownRs = trade.drawdownRs;
        if (trade.drawdownPct < maxDrawdownPct) maxDrawdownPct = trade.drawdownPct;
    }

    // Store as positive absolute values to avoid conceptual mismatch
    maxDrawdownRs = Math.abs(maxDrawdownRs);
    maxDrawdownPct = Math.abs(maxDrawdownPct);

    // Return Infinity when no drawdown and positive P&L.
    // Note: If netPnlSum < 0, recoveryFactor < 0 indicating deficit instead of absolute ratio.
    const recoveryFactor = maxDrawdownRs === 0
        ? (netPnlSum > 0 ? Infinity : 0)
        : safeDivide(netPnlSum, maxDrawdownRs);

    // Sharpe should use risk-adjusted returns (R-multiples)
    // so fixed-risk vs compounding isn't distorted by capital size
    const returns = activeTrades.map(t => {
        const riskTaken = t.isWin ? safeDivide(t.grossPnl, rrRatio) : Math.abs(t.grossPnl);
        return safeDivide(t.netPnl, riskTaken || riskPerTrade);
    });
    const numActive = Math.max(1, activeTrades.length);
    const meanReturn = safeDivide(returns.reduce((sum, r) => sum + r, 0), numActive);
    // Use sample variance (N-1)
    const variance = safeDivide(
        returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0),
        Math.max(1, numActive - 1)
    );
    // Use per-simulation Sharpe (per trade) since frequency is unknown. Risk Free assumed 0.
    // Standard Sharpe uses returns (dimensionless) instead of absolute ₹ amounts
    const stdDevReturn = Math.sqrt(variance);
    const perTradeSharpe = stdDevReturn === 0
        ? (meanReturn > 0 ? Infinity : (meanReturn < 0 ? -Infinity : 0))
        : safeDivide(meanReturn, stdDevReturn);

    // chargeDragPct uses total gross wins as the denominator (industry standard)
    const chargeDragPct = totalGrossWins <= 0
        ? Infinity // Return Infinity so formatting can show it as invalid
        : safeDivide(chargesSum, totalGrossWins) * 100;

    // Use empirical average risk for break-even calculations
    // Break-even mathematically depends on W/L respective charges disparity due to turnover offsets
    let sumChargesWin = 0;
    let sumChargesLoss = 0;
    activeTrades.forEach((t) => {
        if (t.isWin) sumChargesWin += t.actualCharges;
        else sumChargesLoss += t.actualCharges;
    });
    const avgChargesWin = safeDivide(sumChargesWin, Math.max(1, winCount));
    const avgChargesLoss = safeDivide(sumChargesLoss, Math.max(1, activeTradeCount - winCount));

    // Use riskPerTrade (initial risk) for forward-looking analytical break-evens to prevent drift from compounding scale
    const theoreticalRisk = riskPerTrade;
    const breakEvenWR =
        safeDivide(
            theoreticalRisk + avgChargesPerTrade,
            theoreticalRisk * (rrRatio + 1)
        ) * 100;

    const breakEvenRR = theoreticalRisk === 0
        ? Infinity
        : safeDivide(
            (1 - winRate) * theoreticalRisk + avgChargesPerTrade,
            theoreticalRisk * winRate,
        );

    // Kelly f* = p - q/b_adjusted where b_adjusted is net odds
    const netWin = rrRatio * theoreticalRisk - avgChargesWin;
    const netLoss = theoreticalRisk + avgChargesLoss;
    const b_adjusted = netLoss > 0 ? netWin / netLoss : 0;

    // Sentinel value -1 returned when negative edge. Clamp max to 1.0 (100%).
    let kellyFull = b_adjusted <= 0 ? -1 : winRate - safeDivide(1 - winRate, b_adjusted);
    if (kellyFull < 0) kellyFull = -1;
    if (kellyFull > 1) kellyFull = 1;
    const kellyHalf = kellyFull > 0 ? kellyFull / 2 : (kellyFull === -1 ? -1 : 0);

    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let curWin = 0;
    let curLoss = 0;
    for (const trade of trades) {
        if (trade.isRuined) break;
        if (trade.isWin) {
            curWin++;
            curLoss = 0;
            maxWinStreak = Math.max(maxWinStreak, curWin);
        } else {
            curLoss++;
            curWin = 0;
            maxLossStreak = Math.max(maxLossStreak, curLoss);
        }
    }
    // Expected Max Loss Streak via logarithmic sequence (Bernoulli trails approximation)
    const expectedMaxLossStreak = activeTradeCount > 0
        ? (winRate <= 0 ? activeTradeCount
            : winRate >= 1 ? 0
                : Math.max(0, Math.ceil(
                    Math.log(activeTradeCount) /
                    Math.log(1 / (1 - winRate)),
                )))
        : 0;

    // Handle Infinity profitFactor in health score
    const healthRaw = (() => {
        const expectancyScore =
            !isFinite(expectancyPerRupee) || expectancyPerRupee <= 0 ? 0 : Math.min(25, expectancyPerRupee * 100);
        const profitFactorScore = !isFinite(profitFactor)
            ? 25
            : profitFactor >= 2
                ? 25
                : profitFactor >= 1.5
                    ? 18
                    : profitFactor >= 1
                        ? (profitFactor - 1) * 20
                        : 0;
        const ddAbs = Math.abs(maxDrawdownPct);
        const drawdownScore =
            ddAbs < 10 ? 25 : ddAbs < 20 ? 20 : ddAbs < 30 ? 12 : ddAbs < 50 ? 6 : 0;
        const chargeScore = !isFinite(chargeDragPct) ? 0 : (
            chargeDragPct < 10
                ? 25
                : chargeDragPct < 20
                    ? 18
                    : chargeDragPct < 30
                        ? 12
                        : chargeDragPct < 50
                            ? 6
                            : 0
        );
        return Math.round(
            expectancyScore + profitFactorScore + drawdownScore + chargeScore,
        );
    })();

    const healthGrade =
        healthRaw >= 80 ? 'A'
            : healthRaw >= 65 ? 'B'
                : healthRaw >= 50 ? 'C'
                    : healthRaw >= 35 ? 'D'
                        : 'F';
    const healthLabel =
        healthRaw >= 80 ? 'Excellent'
            : healthRaw >= 65 ? 'Good'
                : healthRaw >= 50 ? 'Average'
                    : healthRaw >= 35 ? 'Poor'
                        : 'Critical';

    return {
        netPnL: +netPnlSum.toFixed(2),
        grossPnL: +grossPnlSum.toFixed(2),
        avgRiskPerTrade: +avgRiskPerTrade.toFixed(2),
        avgChargesPerTrade: +avgChargesPerTrade.toFixed(2),
        totalCharges: +chargesSum.toFixed(2),
        finalCapital: +finalCapital.toFixed(2),
        actualWinRate: +actualWinRate.toFixed(1),
        profitFactor: isFinite(profitFactor) ? +profitFactor.toFixed(2) : profitFactor,
        expectancy: +expectancy.toFixed(2),
        expectancyPerRupee: +expectancyPerRupee.toFixed(4),
        maxDrawdownRs: +maxDrawdownRs.toFixed(2),
        maxDrawdownPct: +maxDrawdownPct.toFixed(2),
        recoveryFactor: isFinite(recoveryFactor) ? +recoveryFactor.toFixed(2) : recoveryFactor,
        perTradeSharpe: isFinite(perTradeSharpe) ? +perTradeSharpe.toFixed(2) : perTradeSharpe,
        chargeDragPct: isFinite(chargeDragPct) ? +chargeDragPct.toFixed(1) : Infinity,
        breakEvenWR: +Math.max(0, Math.min(100, breakEvenWR)).toFixed(1),
        breakEvenRR: +Math.max(0, breakEvenRR).toFixed(2),
        kellyFull: kellyFull === -1 ? -1 : +(kellyFull * 100).toFixed(1),
        kellyHalf: kellyHalf === -1 ? -1 : +(kellyHalf * 100).toFixed(1),
        maxWinStreak,
        maxLossStreak,
        medianMaxLossStreak: expectedMaxLossStreak, // Preserved key for UI compatibility
        healthScore: healthRaw,
        healthGrade,
        healthLabel,
        ruinAtTrade,
        overflowWarning,
    };
};
