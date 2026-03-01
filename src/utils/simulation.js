/**
 * @fileoverview Core simulation and Monte Carlo engines.
 */

import { COMPOUNDING_CAP } from '../constants';
import { safeDivide } from './format';

/**
 * Runs a single deterministic trading simulation using a seeded PRNG.
 *
 * @param {Object} params Simulation parameters.
 * @param {number} params.initialCapital Starting capital.
 * @param {number} params.numTrades Number of trades to simulate.
 * @param {number} params.winRate Win probability (0–1).
 * @param {number} params.rrRatio Risk-to-reward ratio.
 * @param {string} params.riskMode Either "fixed" or "compounding".
 * @param {number} params.riskPerTrade Fixed risk amount per trade.
 * @param {number} params.riskPercent Percentage of capital to risk (compounding mode).
 * @param {number} params.chargesPerTrade Charges deducted per trade (used in fixed mode).
 * @param {number} params.leverage Leverage multiplier to apply to the notional and position size.
 * @returns {Object} Simulation results including trades array and summary stats.
 */
export const runSimulation = (params) => {
    const {
        initialCapital, numTrades, winRate, rrRatio,
        riskMode, riskPerTrade, riskPercent, chargesPerTrade,
        dpCharge = 0, seedOffset = 0, leverage = 1
    } = params;

    // Fixed seed so that tweaking parameters like RR ratio or Win Rate
    // results in predictable and smooth P&L changes without altering the random sequence.
    let rng = Math.imul(seedOffset, 2654435761) ^ 0x5f3759df;

    // Mulberry32 PRNG for better statistical properties than LCG
    const random = () => {
        let t = rng += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const trades = [];
    let capital = initialCapital;
    let peakCapital = initialCapital;
    let grossCapital = initialCapital;
    let ruinAtTrade = null;
    let totalGrossWins = 0;
    let totalGrossLosses = 0;
    let grossPnlSum = 0;
    let netPnlSum = 0;
    let chargesSum = 0;
    let winCount = 0;
    let overflowWarning = false;

    // Compute compounding initial risk base outside the loop
    const initialCompoundingRisk = initialCapital * (riskPercent / 100) * leverage;

    for (let i = 1; i <= numTrades; i++) {
        if (capital <= 0) {
            if (!ruinAtTrade) ruinAtTrade = i;
            trades.push({
                trade: i, isWin: false, grossPnl: 0, netPnl: 0,
                charges: 0, capital: 0, capitalAtTradeStart: 0, grossCapital,
                drawdownRs: -peakCapital, drawdownPct: -100, isRuined: true,
            });
            continue;
        }

        const capitalAtTradeStart = capital;
        // True probabilistic Bernoulli distribution draw per trade
        const isWin = random() < winRate;

        // Scale risk heavily by leverage
        let isRiskReduced = false;
        const requiredFixedRisk = riskPerTrade;
        const proposedRisk = riskMode === 'compounding'
            ? capital * (riskPercent / 100) * leverage
            : requiredFixedRisk;

        const effectiveRisk = Math.min(proposedRisk, capital);
        if (effectiveRisk < proposedRisk) {
            isRiskReduced = true;
        }

        const grossPnl = isWin ? effectiveRisk * rrRatio : -effectiveRisk;

        let currentCharges;
        if (riskMode === 'compounding') {
            // Use proper initialCompoundingRisk to scale
            const scaleFactor = initialCompoundingRisk > 0 ? safeDivide(effectiveRisk, initialCompoundingRisk) : 0;
            const scalableCharges = chargesPerTrade - dpCharge;
            currentCharges = scalableCharges * scaleFactor + dpCharge;
        } else {
            currentCharges = chargesPerTrade;
        }

        const netPnl = grossPnl - currentCharges;

        const capitalBeforeTrade = capital;
        capital = Math.max(0, capital + netPnl);
        let actualNetPnl = capital - capitalBeforeTrade;
        let actualGrossPnl = grossPnl;

        if (capital > COMPOUNDING_CAP) {
            const overflow = capital - COMPOUNDING_CAP;
            capital = COMPOUNDING_CAP;
            actualNetPnl -= overflow;
            // The overflow represents unrealized/discarded gains, not actual charges.
            actualGrossPnl -= overflow;
            overflowWarning = true;
        }

        // Recalculate actual charges structurally AFTER cap limits
        let actualCharges = actualGrossPnl - actualNetPnl;

        grossCapital = Math.max(0, grossCapital + actualGrossPnl);
        peakCapital = Math.max(peakCapital, capital);
        const drawdownRs = capital - peakCapital;
        const drawdownPct = safeDivide(drawdownRs, peakCapital) * 100;

        grossPnlSum += actualGrossPnl;
        netPnlSum += actualNetPnl;
        chargesSum += actualCharges;

        if (isWin) {
            winCount++;
            totalGrossWins += actualGrossPnl;
        } else {
            totalGrossLosses += Math.abs(actualGrossPnl);
        }

        trades.push({
            trade: i,
            isWin,
            grossPnl: +actualGrossPnl.toFixed(2),
            netPnl: +actualNetPnl.toFixed(2),
            charges: +actualCharges.toFixed(2),
            capital: +capital.toFixed(2),
            capitalAtTradeStart: +capitalAtTradeStart.toFixed(2),
            grossCapital: +grossCapital.toFixed(2),
            drawdownRs: +drawdownRs.toFixed(2),
            drawdownPct: +drawdownPct.toFixed(2),
            isRuined: false,
            isRiskReduced,
        });
    }

    return {
        trades,
        initialCapital,
        finalCapital: capital,
        finalGrossCapital: grossCapital,
        grossPnlSum: +grossPnlSum.toFixed(2),
        netPnlSum: +netPnlSum.toFixed(2),
        chargesSum: +chargesSum.toFixed(2),
        winCount,
        // Exclude post-ruin zero-trades from loss count
        lossCount: trades.filter(t => !t.isWin && !t.isRuined).length,
        totalGrossWins: +totalGrossWins.toFixed(2),
        totalGrossLosses: +totalGrossLosses.toFixed(2),
        ruinAtTrade,
        overflowWarning,
    };
};

/**
 * Runs a Monte Carlo simulation with multiple random paths.
 * Uses a seeded PRNG for reproducibility.
 *
 * @param {Object} params Simulation parameters (same as runSimulation).
 * @param {number} simCount Number of simulation paths (default: 500).
 * @returns {Object} Results including percentile bands, ruin/target probabilities.
 */
export const runMonteCarlo = async (params, simCount = 500, abortSignal = null) => {
    const {
        winRate, rrRatio, riskPerTrade, numTrades,
        chargesPerTrade, initialCapital, riskMode, riskPercent,
        dpCharge = 0, leverage = 1
    } = params;

    // Fixed base seed for Monte Carlo to ensure reproducible results
    // and smooth transitions when tweaking strategy parameters.
    const baseSeed = 0x8a5b3c2d;
    const paramHash = (Math.round(winRate * 10000) << 16) ^ (Math.round(rrRatio * 100) << 8) ^ numTrades;

    const initialCompoundingRisk = initialCapital * (riskPercent / 100) * leverage;

    const results = [];
    for (let sim = 0; sim < simCount; sim++) {
        if (sim % 50 === 0 && sim > 0) {
            if (abortSignal?.aborted) throw new Error("AbortError");
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        // Each simulation path gets a unique seed derived from baseSeed + sim index + paramHash
        // F-025: Stronger seed mixing (Murmur3 finalizer) to break correlation across nearby parameter spaces
        let rng = Math.imul(sim ^ paramHash, 2654435761) ^ baseSeed;
        rng = Math.imul(rng ^ (rng >>> 16), 2246822507);
        rng = Math.imul(rng ^ (rng >>> 13), 3266489909);

        // Mulberry32 PRNG
        const seededRandom = () => {
            let t = rng += 0x6D2B79F5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };

        let capital = initialCapital;
        const curve = [capital];
        for (let i = 0; i < numTrades; i++) {
            if (capital <= 0) {
                curve.push(0);
                continue;
            }
            const isWin = seededRandom() < winRate;

            const requiredFixedRisk = riskPerTrade;
            const proposedRisk = riskMode === 'compounding'
                ? capital * (riskPercent / 100) * leverage
                : requiredFixedRisk;

            const risk = Math.min(proposedRisk, capital);
            const grossPnl = isWin ? risk * rrRatio : -risk;

            // Scale charges correctly
            let currentCharges;
            if (riskMode === 'compounding') {
                const scaleFactor = initialCompoundingRisk > 0 ? safeDivide(risk, initialCompoundingRisk) : 0;
                const scalableCharges = chargesPerTrade - dpCharge;
                currentCharges = scalableCharges * scaleFactor + dpCharge;
            } else {
                currentCharges = chargesPerTrade;
            }

            // Cap the grossPnl and capital correctly
            const capitalBeforeTrade = capital;
            capital = Math.max(0, capital + grossPnl - currentCharges);
            const actualNetPnl = capital - capitalBeforeTrade;

            // Apply compounding cap in Monte Carlo too
            if (capital > COMPOUNDING_CAP) capital = COMPOUNDING_CAP;
            curve.push(+capital.toFixed(0));
        }
        results.push({ curve, final: capital });
    }

    const bands = [];
    const step = Math.max(1, Math.floor(numTrades / 100));
    const samplePoints = new Set();
    for (let t = 0; t <= numTrades; t += step) {
        samplePoints.add(t);
    }
    // Ensure final trade point is included
    samplePoints.add(numTrades);

    const sortedSamplePoints = Array.from(samplePoints).sort((a, b) => a - b);

    for (const t of sortedSamplePoints) {
        const vals = results
            .map((r) => r.curve[Math.min(t, r.curve.length - 1)])
            .sort((a, b) => a - b);
        const n = vals.length;
        bands.push({
            trade: t,
            p10: vals[Math.floor((n - 1) * 0.10)] || 0,
            p25: vals[Math.floor((n - 1) * 0.25)] || 0,
            p50: vals[Math.floor((n - 1) * 0.50)] || 0,
            p75: vals[Math.floor((n - 1) * 0.75)] || 0,
            p90: vals[Math.floor((n - 1) * 0.90)] || 0,
        });
    }

    const ruinCount = results.filter((r) => r.final <= 0).length;
    const target2xCount = results.filter(
        (r) => r.curve.some((c) => c >= initialCapital * 2),
    ).length;

    return {
        bands,
        ruinPct: +((ruinCount / simCount) * 100).toFixed(1),
        target2xPct: +((target2xCount / simCount) * 100).toFixed(1),
        finalCapitals: results.map((r) => r.final).sort((a, b) => a - b),
    };
};
