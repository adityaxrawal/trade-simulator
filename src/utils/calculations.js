/**
 * @fileoverview Charge calculation and metrics computation engines.
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
        // Zerodha charges ₹0 brokerage for equity delivery on flat plans
        if (brokerageModel === 'percentage') {
            const buyBrokerage = buyTurnover > 0 ? Math.min(20, brokerageRate * buyTurnover) : 0;
            const sellBrokerage = sellTurnover > 0 ? Math.min(20, brokerageRate * sellTurnover) : 0;
            brokerage = buyBrokerage + sellBrokerage;
        } else {
            brokerage = 0;
        }
    } else if (brokerageModel === 'flat20') {
        const buyBrokerage = buyTurnover > 0 ? Math.min(20, ZERODHA_PERCENTAGE_RATE * buyTurnover) : 0;
        const sellBrokerage = sellTurnover > 0 ? Math.min(20, ZERODHA_PERCENTAGE_RATE * sellTurnover) : 0;
        brokerage = buyBrokerage + sellBrokerage;
    } else {
        brokerage = brokerageRate * totalTurnover;
    }

    const stt = rates.stt_buy * buyTurnover + rates.stt_sell * sellTurnover;
    const ctt = rates.ctt_sell * sellTurnover;

    const mcxKey = derivativeType;

    // Use MCX commodity-specific exchange rates when available
    const exchRate = (assetClass === 'mcx_futures' && MCX_EXCH_RATES[mcxKey])
        ? MCX_EXCH_RATES[mcxKey] : rates.exch_rate;
    const exchTxn = exchRate * totalTurnover;
    const sebiCharge = isCrypto ? 0 : SEBI_RATE * totalTurnover;
    // GST base includes brokerage and exchange transaction charges, but excludes statutory SEBI charges
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
 * Computes comprehensive trading performance metrics from simulation results.
 *
 * @param {Object} simData Simulation output from runSimulation.
 * @param {number} chargesPerTrade Charges per trade.
 * @param {number} winRate Win rate as a decimal (0–1).
 * @param {number} rrRatio Risk-to-reward ratio.
 * @param {number} riskPerTrade Risk per trade in currency units.
 * @returns {Object|null} Computed metrics or null if simData is null.
 */
export const computeMetrics = (
    simData,
    chargesPerTrade,
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
    // actualWinRate denominator should exclude post-ruin placeholder trades
    const activeStatsTrades = trades.filter(t => !t.isRuined).length;
    const actualWinRate = safeDivide(winCount, activeStatsTrades) * 100;

    // Return Infinity when all trades win (no losses)
    const profitFactor = totalGrossLosses === 0
        ? (totalGrossWins > 0 ? Infinity : 1)
        : totalGrossWins / totalGrossLosses;


    // Single-charge expectancy — charges deducted once unconditionally
    const avgChargesPerTrade = safeDivide(chargesSum, numTrades);

    // Track actual average risk for compounding accuracy
    const activeTradesForRisk = trades.filter(t => !t.isRuined);
    const totalRiskTaken = activeTradesForRisk.reduce((sum, t) => sum + (t.isWin ? t.grossPnl / rrRatio : Math.abs(t.grossPnl)), 0);
    const avgRiskPerTrade = safeDivide(totalRiskTaken, Math.max(1, activeTradesForRisk.length)) || riskPerTrade;

    // Use empirical expectancy from active trades
    const activeTrades = trades.filter(t => !t.isRuined);
    const activeTradeCount = activeTrades.length;
    const activeNetPnlSum = activeTrades.reduce((sum, t) => sum + t.netPnl, 0);
    const expectancy = safeDivide(activeNetPnlSum, Math.max(1, activeTradeCount));
    const expectancyPerRupee = safeDivide(expectancy, avgRiskPerTrade);

    let maxDrawdownRs = 0;
    let maxDrawdownPct = 0;
    for (const trade of trades) {
        if (trade.drawdownRs < maxDrawdownRs) maxDrawdownRs = trade.drawdownRs;
        if (trade.drawdownPct < maxDrawdownPct) maxDrawdownPct = trade.drawdownPct;
    }

    // Return Infinity when no drawdown and positive P&L
    const recoveryFactor = maxDrawdownRs === 0
        ? (netPnlSum > 0 ? Infinity : 0)
        : safeDivide(netPnlSum, Math.abs(maxDrawdownRs));

    // Sharpe should use risk-adjusted returns (R-multiples)
    // so fixed-risk vs compounding isn't distorted by capital size
    const rMultiples = activeTrades.map(t => safeDivide(t.netPnl, avgRiskPerTrade));
    const numActive = Math.max(1, activeTrades.length);
    const meanRMultiple = safeDivide(rMultiples.reduce((sum, r) => sum + r, 0), numActive);
    // Use sample variance (N-1)
    const variance = safeDivide(
        rMultiples.reduce((sum, r) => sum + Math.pow(r - meanRMultiple, 2), 0),
        Math.max(1, numActive - 1)
    );
    // Use per-simulation Sharpe (per trade) since frequency is unknown.
    const sharpeProxy = variance === 0 && meanRMultiple > 0
        ? Infinity
        : safeDivide(meanRMultiple, Math.sqrt(variance));
    // chargeDragPct uses gross P&L as the denominator, not just wins
    const grossPnlSumForDrag = totalGrossWins - totalGrossLosses;
    const chargeDragPct = grossPnlSumForDrag <= 0
        ? Infinity // Return Infinity so formatting can show it as invalid
        : safeDivide(chargesSum, grossPnlSumForDrag) * 100;

    // Use analytical average risk for break-even calculations in compounding mode
    const theoreticalRisk = avgRiskPerTrade;
    const theoreticalCharges = avgChargesPerTrade;

    const breakEvenWR =
        safeDivide(
            theoreticalRisk + theoreticalCharges,
            theoreticalRisk * (rrRatio + 1),
        ) * 100;
    const breakEvenRR = safeDivide(
        (1 - winRate) * theoreticalRisk + theoreticalCharges,
        theoreticalRisk * winRate,
    );
    // Kelly b (netRR) must also account for charges on the loss side
    const netWin = rrRatio * theoreticalRisk - theoreticalCharges;
    const netLoss = theoreticalRisk + theoreticalCharges;
    const adjustedB = safeDivide(netWin, netLoss);
    // Sentinel value -1 returned when negative edge
    const kellyFull = adjustedB <= 0 ? -1 : winRate - safeDivide(1 - winRate, adjustedB);
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
    // Guard edge cases for winRate = 0% and 100%
    const expectedMaxLossStreak = activeTradeCount > 0
        ? (winRate <= 0 ? activeTradeCount
            : winRate >= 1 ? 0
                : Math.ceil(
                    Math.log(activeTradeCount * (1 - winRate)) /
                    Math.log(1 / (1 - winRate)),
                ))
        : 0;

    // Handle Infinity profitFactor in health score
    const healthRaw = (() => {
        const expectancyScore =
            expectancyPerRupee <= 0 ? 0 : Math.min(25, 12.5 + expectancyPerRupee * 50);
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
        const chargeScore =
            chargeDragPct < 10
                ? 25
                : chargeDragPct < 20
                    ? 18
                    : chargeDragPct < 30
                        ? 12
                        : chargeDragPct < 50
                            ? 6
                            : 0;
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
        avgRiskPerTrade: +theoreticalRisk.toFixed(2),
        avgChargesPerTrade: +theoreticalCharges.toFixed(2),
        totalCharges: +chargesSum.toFixed(2),
        finalCapital: +finalCapital.toFixed(2),
        actualWinRate: +actualWinRate.toFixed(1),
        profitFactor: isFinite(profitFactor) ? +profitFactor.toFixed(2) : profitFactor,
        expectancy: +expectancy.toFixed(2),
        expectancyPerRupee: +expectancyPerRupee.toFixed(4),
        maxDrawdownRs: +maxDrawdownRs.toFixed(2),
        maxDrawdownPct: +maxDrawdownPct.toFixed(2),
        recoveryFactor: isFinite(recoveryFactor) ? +recoveryFactor.toFixed(2) : recoveryFactor,
        sharpeProxy: isFinite(sharpeProxy) ? +sharpeProxy.toFixed(2) : sharpeProxy,
        chargeDragPct: isFinite(chargeDragPct) ? +chargeDragPct.toFixed(1) : Infinity,
        breakEvenWR: +Math.max(0, Math.min(100, breakEvenWR)).toFixed(1),
        breakEvenRR: +Math.max(0, breakEvenRR).toFixed(2),
        kellyFull: kellyFull === -1 ? -1 : +(kellyFull * 100).toFixed(1),
        kellyHalf: kellyHalf === -1 ? -1 : +(kellyHalf * 100).toFixed(1),
        maxWinStreak,
        maxLossStreak,
        expectedMaxLossStreak,
        healthScore: healthRaw,
        healthGrade,
        healthLabel,
        ruinAtTrade,
        overflowWarning,
    };
};
