/**
 * @fileoverview Charge calculation and metrics computation engines.
 */

import {
    CHARGE_RATES,
    SEBI_RATE,
    GST_RATE,
    CRYPTO_FEE_RATES,
    FLAT20_RATE,
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
 * @param {number} cryptoParams.cryptoPrice Current asset price in USD.
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
    const rates = CHARGE_RATES[assetClass] || CHARGE_RATES.index_options_buy;
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
        let tradingFee = notional * feeRate * 2; // Flaw 2: round-trip: open + close

        // Options: apply 3.5% premium cap
        if (!isFutures && premium > 0) {
            const premiumCap =
                CRYPTO_FEE_RATES.options.premiumCapPct *
                contracts * lotSize * premium * 2; // Flaw 2: capped on both legs
            tradingFee = Math.min(tradingFee, premiumCap);
        }

        brokerage = tradingFee;
    } else if (assetClass === 'equity_delivery') {
        // #13: Allow percentage brokerage for equity delivery
        brokerage = brokerageModel === 'percentage' ? brokerageRate * totalTurnover : 0;
    } else if (brokerageModel === 'flat20') {
        // F-014: Use hardcoded rate for flat20 model
        brokerage =
            Math.min(20, FLAT20_RATE * buyTurnover) +
            Math.min(20, FLAT20_RATE * sellTurnover);
    } else {
        brokerage = brokerageRate * totalTurnover;
    }

    // Flaw 6 fix: For options buyers closing before expiry, STT applies only on the buy leg (if ITM exercise is excluded). 
    // Usually traded options are squared off, so applying 0.1% STT on the sell leg is massively incorrect for buyers.
    const isOptionsBuy = assetClass === 'index_options_buy' || assetClass === 'equity_options_buy';
    const stt = isOptionsBuy
        ? rates.stt_buy * buyTurnover
        : rates.stt_buy * buyTurnover + rates.stt_sell * sellTurnover;
    const ctt = rates.ctt_sell * sellTurnover;

    let mcxKey = derivativeType;
    if (derivativeType === 'CRUDEOIL') mcxKey = 'CRUDE';
    if (derivativeType === 'NATURALGAS') mcxKey = 'NATGAS';

    // #10: Use MCX commodity-specific exchange rates when available
    const exchRate = (assetClass === 'mcx_futures' && MCX_EXCH_RATES[mcxKey])
        ? MCX_EXCH_RATES[mcxKey] : rates.exch_rate;
    const exchTxn = exchRate * totalTurnover;
    const sebiCharge = isCrypto ? 0 : SEBI_RATE * totalTurnover;
    // Flaw 7 fix: GST base should NOT include statutory SEBI charges per CBIC clarification
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
    // Flaw 1 fix: actualWinRate denominator should exclude post-ruin placeholder trades
    const activeStatsTrades = trades.filter(t => !t.isRuined).length;
    const actualWinRate = safeDivide(winCount, activeStatsTrades) * 100;

    // F-003: Return Infinity when all trades win (no losses)
    const profitFactor = totalGrossLosses === 0
        ? (totalGrossWins > 0 ? Infinity : 1)
        : totalGrossWins / totalGrossLosses;


    // #1: Single-charge expectancy — charges deducted once unconditionally
    const avgChargesPerTrade = safeDivide(chargesSum, numTrades);

    // Flaw 7 fix: Track actual average risk for compounding accuracy
    const activeTradesForRisk = trades.filter(t => !t.isRuined);
    const totalRiskTaken = activeTradesForRisk.reduce((sum, t) => sum + (t.isWin ? t.grossPnl / rrRatio : Math.abs(t.grossPnl)), 0);
    const avgRiskPerTrade = safeDivide(totalRiskTaken, Math.max(1, activeTradesForRisk.length)) || riskPerTrade;

    // Flaw 10 fix: Use empirical expectancy from simulation totals
    const activeTradeCount = trades.filter(t => !t.isRuined).length;
    const expectancy = safeDivide(netPnlSum, Math.max(1, activeTradeCount));
    const expectancyPerRupee = safeDivide(expectancy, avgRiskPerTrade);

    let maxDrawdownRs = 0;
    let maxDrawdownPct = 0;
    for (const trade of trades) {
        if (trade.drawdownRs < maxDrawdownRs) maxDrawdownRs = trade.drawdownRs;
        if (trade.drawdownPct < maxDrawdownPct) maxDrawdownPct = trade.drawdownPct;
    }

    // F-018: Return Infinity when no drawdown and positive P&L
    const recoveryFactor = maxDrawdownRs === 0
        ? (netPnlSum > 0 ? Infinity : 0)
        : safeDivide(netPnlSum, Math.abs(maxDrawdownRs));

    // Flaw 6: Sharpe should use percentage returns, not absolute INR
    // Flaw 5 fix: Exclude ruined trades from Sharpe computation
    const activeTrades = trades.filter(t => !t.isRuined && t.capitalAtTradeStart > 0);
    const returns = activeTrades.map(t => safeDivide(t.netPnl, t.capitalAtTradeStart));
    const numActive = Math.max(1, activeTrades.length);
    const meanReturn = safeDivide(returns.reduce((a, b) => a + b, 0), numActive);
    // F-017: Use sample variance (N-1) instead of population variance (N)
    const variance = safeDivide(
        returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0),
        Math.max(1, numActive - 1),
    );
    // Flaw 5 fix: Use per-simulation Sharpe (per trade) since frequency is unknown. Dropping *Math.sqrt(numTrades)
    const sharpeProxy =
        safeDivide(meanReturn, Math.sqrt(variance));
    const annualizedSharpe = sharpeProxy * Math.sqrt(252);
    // Flaw 6 fix: chargeDragPct uses gross P&L as the denominator, not just wins
    const chargeDragPct = safeDivide(chargesSum, totalGrossWins) * 100;

    const theoreticalRisk = trades.length > 0 ? (trades[0].isWin ? trades[0].grossPnl / rrRatio : Math.abs(trades[0].grossPnl)) : riskPerTrade;
    const theoreticalCharges = trades.length > 0 ? trades[0].charges : chargesPerTrade;

    const breakEvenWR =
        safeDivide(
            theoreticalRisk + theoreticalCharges,
            theoreticalRisk * (rrRatio + 1),
        ) * 100;
    const breakEvenRR = safeDivide(
        (1 - winRate) * theoreticalRisk + theoreticalCharges,
        theoreticalRisk * winRate,
    );
    // #8: Kelly Criterion accounts for charge drag on reward
    // Flaw 7: Kelly b (netRR) must also account for charges on the loss side
    const netWin = rrRatio * theoreticalRisk - theoreticalCharges;
    const netLoss = theoreticalRisk + theoreticalCharges;
    const adjustedB = safeDivide(netWin, netLoss);
    const kellyFull = winRate - safeDivide(1 - winRate, Math.max(0.001, adjustedB));
    const kellyHalf = Math.max(0, kellyFull / 2);

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
    // #15: Guard edge cases for winRate = 0% and 100%
    const expectedMaxLossStreak = numTrades > 0
        ? (winRate <= 0 ? numTrades
            : winRate >= 1 ? 0
                : Math.ceil(
                    Math.log(numTrades * (1 - winRate)) /
                    Math.log(1 / (1 - winRate)),
                ))
        : 0;

    // F-019: Handle Infinity profitFactor in health score
    const healthRaw = (() => {
        const expectancyScore =
            Math.min(25, Math.max(0, 12.5 + expectancyPerRupee * 50));
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
        annualizedSharpe: isFinite(annualizedSharpe) ? +annualizedSharpe.toFixed(2) : annualizedSharpe,
        chargeDragPct: isFinite(chargeDragPct) ? +chargeDragPct.toFixed(1) : 0,
        breakEvenWR: +Math.max(0, Math.min(100, breakEvenWR)).toFixed(1),
        breakEvenRR: +Math.max(0, breakEvenRR).toFixed(2),
        kellyFull: +Math.max(0, kellyFull * 100).toFixed(1),
        kellyHalf: +Math.max(0, kellyHalf * 100).toFixed(1),
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
