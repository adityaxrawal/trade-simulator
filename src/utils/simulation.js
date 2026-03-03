/**
 * @fileoverview Core simulation and Monte Carlo engines.
 */

import { COMPOUNDING_CAP } from '../constants';
import { safeDivide } from './format';
import { calculateActualCharges } from './calculations';

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
export const runSimulation = async (params) => {
    const {
        initialCapital, numTrades, winRate, rrRatio,
        riskMode, riskPerTrade, riskPercent, chargesPerTrade,
        dpCharge = 0, seedOffset = 0, leverage = 1, yieldEvery = 500
    } = params;

    // Fixed seed so that tweaking parameters like RR ratio or Win Rate
    // results in predictable and smooth P&L changes without altering the random sequence.
    let rng = (Math.imul(seedOffset, 2654435761) ^ 0x85ebca6b) >>> 0;
    rng = Math.imul(rng ^ (rng >>> 13), 0xc2b2ae35) >>> 0;
    rng = Math.imul(rng ^ (rng >>> 16), 0x85ebca6b) >>> 0;

    // Mulberry32 PRNG for better statistical properties than LCG
    const random = () => {
        let t = rng += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    // Warm up the PRNG
    for (let i = 0; i < 15; i++) random();

    const trades = [];
    let capital = initialCapital;
    let peakCapital = initialCapital;
    let grossCapital = initialCapital;
    let ruinAtTrade = null;
    let totalGrossWins = 0;
    let totalGrossLosses = 0;
    let grossPnlSum = 0, grossPnlComp = 0;
    let netPnlSum = 0, netPnlComp = 0;
    let chargesSum = 0, chargesComp = 0;
    let winCount = 0;
    let lossCount = 0;
    let overflowWarning = false;

    const initialCompoundRisk = riskMode === 'compounding'
        ? initialCapital * (riskPercent / 100)
        : riskPerTrade;

    for (let i = 1; i <= numTrades; i++) {
        // Yield to the event loop periodically to prevent UI freezing
        if (yieldEvery && i % yieldEvery === 0) {
            await new Promise(r => setTimeout(r, 0));
        }
        // True probabilistic Bernoulli distribution draw per trade (moved above ruin check for RNG isolation)
        const isWin = random() < winRate;

        if (capital <= 0) {
            if (!ruinAtTrade) ruinAtTrade = i;
            const drawdownRsOnRuin = 0 - peakCapital;
            const drawdownPctOnRuin = peakCapital > 0 ? safeDivide(drawdownRsOnRuin, peakCapital) * 100 : -100;
            trades.push({
                trade: i, isWin: false, grossPnl: 0, netPnl: 0,
                charges: 0, capital: 0, capitalAtTradeStart: 0, grossCapital,
                drawdownRs: drawdownRsOnRuin, drawdownPct: drawdownPctOnRuin, isRuined: true,
            });
            continue;
        }

        const capitalAtTradeStart = capital;

        // Scale risk heavily by leverage
        let isRiskReduced = false;
        const requiredFixedRisk = riskPerTrade;
        const proposedRisk = riskMode === 'compounding'
            ? capital * (riskPercent / 100)
            : requiredFixedRisk;

        const leveragedRisk = proposedRisk * leverage;
        const effectiveRisk = Math.min(leveragedRisk, capital * leverage);
        if (effectiveRisk < leveragedRisk * 0.99) {
            isRiskReduced = true;
        }

        const grossPnl = isWin ? effectiveRisk * rrRatio : -effectiveRisk;

        let currentCharges;
        if (riskMode === 'compounding') {
            // Scale dynamically by effective nominal risk, proportional to initially intended full nominal risk
            const scaleFactor = initialCompoundRisk > 0 ? safeDivide(effectiveRisk, initialCompoundRisk) : 0;
            const scalableCharges = chargesPerTrade - dpCharge;
            currentCharges = scalableCharges * scaleFactor + dpCharge;
        } else {
            currentCharges = chargesPerTrade;
        }

        const netPnl = grossPnl - currentCharges;

        const capitalBeforeTrade = capital;
        const intendedNetPnl = grossPnl - currentCharges;

        let actualNetPnl = Math.max(-capitalBeforeTrade, intendedNetPnl);
        let actualCharges = calculateActualCharges(capitalBeforeTrade, intendedNetPnl, grossPnl, currentCharges);
        let actualGrossPnl = actualNetPnl + actualCharges;

        capital = capitalBeforeTrade + actualNetPnl;
        capital = Math.max(0, capital); // Bug 3.2: Prevent sub-zero capital
        if (capital > COMPOUNDING_CAP) {
            capital = COMPOUNDING_CAP;
            overflowWarning = true;
        }

        grossCapital = grossCapital + actualGrossPnl;
        if (grossCapital > COMPOUNDING_CAP) {
            grossCapital = COMPOUNDING_CAP;
        }

        peakCapital = Math.max(peakCapital, capital);
        const drawdownRs = capital - peakCapital;
        const drawdownPct = safeDivide(drawdownRs, peakCapital) * 100;

        const yGross = actualGrossPnl - grossPnlComp;
        const tGross = grossPnlSum + yGross;
        grossPnlComp = (tGross - grossPnlSum) - yGross;
        grossPnlSum = tGross;

        const yNet = actualNetPnl - netPnlComp;
        const tNet = netPnlSum + yNet;
        netPnlComp = (tNet - netPnlSum) - yNet;
        netPnlSum = tNet;

        const yCharges = actualCharges - chargesComp;
        const tCharges = chargesSum + yCharges;
        chargesComp = (tCharges - chargesSum) - yCharges;
        chargesSum = tCharges;

        if (isWin) {
            winCount++;
            totalGrossWins += actualGrossPnl;
        } else {
            lossCount++;
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
        lossCount,
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
    // F-025: Stronger seed mixing (DJB2/Fnv1a style finalizer) to break correlation across nearby parameter spaces
    const paramString = `${winRate}-${rrRatio}-${numTrades}-${initialCapital}-${chargesPerTrade}-${riskPercent}-${leverage}-${dpCharge}-${riskPerTrade}-${riskMode}`;
    let paramHash = 0x811c9dc5;
    for (let i = 0; i < paramString.length; i++) {
        paramHash ^= paramString.charCodeAt(i);
        paramHash = Math.imul(paramHash, 0x01000193);
    }

    const initialCompoundRisk = riskMode === 'compounding'
        ? initialCapital * (riskPercent / 100)
        : riskPerTrade;

    const results = [];
    for (let sim = 0; sim < simCount; sim++) {
        if (sim % 50 === 0 && sim > 0) {
            if (abortSignal?.aborted) throw Object.assign(new Error("AbortError"), { name: "AbortError" });
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        // Each simulation path gets a unique seed derived from paramHash
        let rng = (Math.imul(sim ^ paramHash, 2654435761) ^ 0x8a5b3c2d) >>> 0;
        rng = (Math.imul(rng ^ (rng >>> 16), 2246822507)) >>> 0;
        rng = (Math.imul(rng ^ (rng >>> 13), 3266489909)) >>> 0;

        // Mulberry32 PRNG
        const seededRandom = () => {
            let t = rng += 0x6D2B79F5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        // Warm up the PRNG
        for (let i = 0; i < 15; i++) seededRandom();

        let capital = initialCapital;
        let reached2x = false;
        const curve = [capital];
        for (let i = 0; i < numTrades; i++) {
            if (capital <= 0) {
                curve.push(0);
                continue;
            }
            const isWin = seededRandom() < winRate;

            const requiredFixedRisk = riskPerTrade;
            const proposedRisk = riskMode === 'compounding'
                ? capital * (riskPercent / 100)
                : requiredFixedRisk;

            const leveragedRisk = proposedRisk * leverage;
            const risk = Math.min(leveragedRisk, capital * leverage);
            const grossPnl = isWin ? risk * rrRatio : -risk;

            // Scale charges correctly
            let currentCharges;
            if (riskMode === 'compounding') {
                const scaleFactor = initialCompoundRisk > 0 ? safeDivide(risk, initialCompoundRisk) : 0;
                const scalableCharges = chargesPerTrade - dpCharge;
                currentCharges = scalableCharges * scaleFactor + dpCharge;
            } else {
                currentCharges = chargesPerTrade;
            }

            // Cap the grossPnl and capital correctly
            const capitalBeforeTrade = capital;
            const intendedNetPnl = grossPnl - currentCharges;
            let actualCharges = calculateActualCharges(capitalBeforeTrade, intendedNetPnl, grossPnl, currentCharges);
            capital = capitalBeforeTrade + grossPnl - actualCharges;
            if (capital > COMPOUNDING_CAP) capital = COMPOUNDING_CAP;
            capital = Math.max(0, capital);

            if (capital >= initialCapital * 2) {
                reached2x = true;
            }

            curve.push(+capital.toFixed(0));
        }
        results.push({ curve, final: capital, reached2x });
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
        // Evaluate the exact array index (handle decimal or off-by-one safely)
        const tIndex = Math.min(Math.floor(t), numTrades);
        const vals = results
            .map((r) => r.curve[Math.min(tIndex, r.curve.length - 1)])
            .sort((a, b) => a - b);
        const n = vals.length;
        bands.push({
            trade: t,
            p10: vals[Math.floor((n - 1) * 0.10)] ?? 0,
            p25: vals[Math.floor((n - 1) * 0.25)] ?? 0,
            p50: vals[Math.floor((n - 1) * 0.50)] ?? 0,
            p75: vals[Math.floor((n - 1) * 0.75)] ?? 0,
            p90: vals[Math.floor((n - 1) * 0.90)] ?? 0,
        });
    }

    const ruinCount = results.filter((r) => r.final <= 0).length;
    const target2xCount = results.filter(
        (r) => r.reached2x,
    ).length;

    return {
        bands,
        ruinPct: +((ruinCount / simCount) * 100).toFixed(1),
        target2xPct: +((target2xCount / simCount) * 100).toFixed(1),
        finalCapitals: results.map((r) => r.final).sort((a, b) => a - b),
    };
};
