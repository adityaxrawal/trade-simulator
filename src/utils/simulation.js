/**
 * @fileoverview Core simulation and Monte Carlo engines.
 */

import { COMPOUNDING_CAP } from '../constants';
import { safeDivide } from './format';
import { calculateCharges, calculateActualCharges } from './calculations';

/**
 * Resolves the mathematical outcome of a single simulated trade.
 * Note: When compounding cap is reached, capital is artificially clipped to the cap.
 * Subsequent losses will reduce capital below the cap, resuming normal compounding,
 * which creates a plateau-and-re-entry dynamic.
 */
export const calculateTradeResult = (capital, isWin, params, initialCompoundRisk = 0) => {
    const { rrRatio, riskMode, riskPercent, riskPerTrade, chargesPerTrade, dpCharge = 0, leverage = 1 } = params;

    const proposedRisk = riskMode === 'compounding'
        ? capital * (riskPercent / 100)
        : riskPerTrade;

    const effectiveRisk = Math.min(proposedRisk, capital * leverage);
    const isRiskReduced = effectiveRisk < proposedRisk * 0.99;

    const grossPnl = isWin ? effectiveRisk * rrRatio : -effectiveRisk;

    const currentCharges = chargesPerTrade;

    const capitalBeforeTrade = capital;
    const intendedNetPnl = grossPnl - currentCharges;

    let actualNetPnl = Math.max(-capitalBeforeTrade, intendedNetPnl);
    let actualCharges = calculateActualCharges(capitalBeforeTrade, intendedNetPnl, grossPnl, currentCharges);
    let actualGrossPnl = actualNetPnl + actualCharges;

    let nextCapital = capitalBeforeTrade + actualNetPnl;
    nextCapital = Math.max(0, nextCapital);

    let overflowWarning = false;
    if (nextCapital > COMPOUNDING_CAP) {
        nextCapital = COMPOUNDING_CAP;
        overflowWarning = true;
    }

    return {
        grossPnl,
        actualGrossPnl,
        actualNetPnl,
        actualCharges,
        nextCapital,
        isRiskReduced,
        overflowWarning
    };
};

/**
 * Runs a single deterministic trading simulation using a seeded PRNG.
 *
 * @param {Object} params Simulation parameters.
 */
export const runSimulation = async (params) => {
    let {
        initialCapital, numTrades, winRate, rrRatio,
        riskMode, riskPerTrade, riskPercent, chargesPerTrade,
        dpCharge = 0, seedOffset = 0, leverage = 1
    } = params;

    // Hard bound trades for DOS protection
    numTrades = Math.min(numTrades, 10000);

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
    let totalGrossWins = 0, grossWinsComp = 0;
    let totalGrossLosses = 0, grossLossesComp = 0;
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
        // True probabilistic Bernoulli distribution draw per trade
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

        const res = calculateTradeResult(capital, isWin, params, initialCompoundRisk);

        capital = res.nextCapital;
        if (res.overflowWarning) overflowWarning = true;

        const { actualGrossPnl, actualNetPnl, actualCharges, isRiskReduced } = res;

        grossCapital = grossCapital + actualGrossPnl;
        if (grossCapital > COMPOUNDING_CAP) {
            grossCapital = COMPOUNDING_CAP;
        }

        peakCapital = Math.max(peakCapital, capital);
        const drawdownRs = capital - peakCapital;
        const drawdownPct = safeDivide(drawdownRs, peakCapital) * 100;

        const yNet = actualNetPnl - netPnlComp;
        const tNet = netPnlSum + yNet;
        netPnlComp = (tNet - netPnlSum) - yNet;
        netPnlSum = tNet;

        const yCharges = actualCharges - chargesComp;
        const tCharges = chargesSum + yCharges;
        chargesComp = (tCharges - chargesSum) - yCharges;
        chargesSum = tCharges;

        // Independently accumulate grossPnl using Kahan summation
        const yGross = actualGrossPnl - grossPnlComp;
        const tGross = grossPnlSum + yGross;
        grossPnlComp = (tGross - grossPnlSum) - yGross;
        grossPnlSum = tGross;

        if (isWin) {
            winCount++;
            const yW = actualGrossPnl - grossWinsComp;
            const tW = totalGrossWins + yW;
            grossWinsComp = (tW - totalGrossWins) - yW;
            totalGrossWins = tW;
        } else {
            lossCount++;
            const yL = Math.abs(actualGrossPnl) - grossLossesComp;
            const tL = totalGrossLosses + yL;
            grossLossesComp = (tL - totalGrossLosses) - yL;
            totalGrossLosses = tL;
        }

        trades.push({
            trade: i,
            isWin,
            grossPnl: +actualGrossPnl.toFixed(2),
            netPnl: +actualNetPnl.toFixed(2),
            charges: +actualCharges.toFixed(2),
            actualCharges: +actualCharges.toFixed(2),
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
 * @param {Object} params Simulation parameters.
 * @param {number} simCount Number of simulation paths (default: 500).
 */
export const runMonteCarlo = async (params, simCount = 500, abortSignal = null) => {
    let {
        winRate, rrRatio, riskPerTrade, numTrades,
        chargesPerTrade, initialCapital, riskMode, riskPercent,
        dpCharge = 0, leverage = 1
    } = params;

    // Hard bound trades for DOS protection
    numTrades = Math.min(numTrades, 10000);
    // Hard bound paths for DOS protection
    simCount = Math.min(simCount, 10000);

    const paramString = `${winRate}-${rrRatio}-${numTrades}-${initialCapital}-${chargesPerTrade}-${riskPercent}-${leverage}-${dpCharge}-${riskPerTrade}-${riskMode}`;
    let paramHash = 0x811c9dc5;
    for (let i = 0; i < paramString.length; i++) {
        paramHash ^= paramString.charCodeAt(i);
        paramHash = Math.imul(paramHash, 0x01000193);
    }

    const initialCompoundRisk = riskMode === 'compounding'
        ? initialCapital * (riskPercent / 100)
        : riskPerTrade;

    const step = Math.max(1, Math.floor(numTrades / 100));
    const samplePointsSet = new Set();
    for (let t = 0; t <= numTrades; t += step) {
        samplePointsSet.add(t);
    }
    samplePointsSet.add(numTrades);
    const sortedSamplePoints = Array.from(samplePointsSet).sort((a, b) => a - b);

    const results = [];
    for (let sim = 0; sim < simCount; sim++) {
        if (sim % 50 === 0 && sim > 0) {
            if (abortSignal?.aborted) throw Object.assign(new Error("AbortError"), { name: "AbortError" });
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        // Multiplying sim by a large prime spreads out bit changes, ensuring low-sim correlation mitigation
        let rng = (Math.imul(Math.imul(sim, 2654435761) ^ paramHash, 2654435761) ^ 0x8a5b3c2d) >>> 0;
        rng = (Math.imul(rng ^ (rng >>> 16), 2246822507)) >>> 0;
        rng = (Math.imul(rng ^ (rng >>> 13), 3266489909)) >>> 0;

        const seededRandom = () => {
            let t = rng += 0x6D2B79F5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        for (let i = 0; i < 15; i++) seededRandom();

        let capital = initialCapital;
        let reached2x = false;
        let isRuinedPath = false;

        const curveVals = [];
        let nextSampleIdx = 0;

        if (sortedSamplePoints[nextSampleIdx] === 0) {
            curveVals.push(+capital.toFixed(0));
            nextSampleIdx++;
        }

        for (let i = 1; i <= numTrades; i++) {
            if (capital > 0) {
                const isWin = seededRandom() < winRate;
                const res = calculateTradeResult(capital, isWin, params, initialCompoundRisk);
                capital = res.nextCapital;
                // Once 2x is hit or compounding cap is reached (if cap < 2x), flag it
                if (!reached2x && (capital >= initialCapital * 2 || res.overflowWarning)) {
                    reached2x = true;
                }
            }

            if (capital <= 0) {
                isRuinedPath = true;
                while (nextSampleIdx < sortedSamplePoints.length) {
                    curveVals.push(0);
                    nextSampleIdx++;
                }
                break;
            }

            if (nextSampleIdx < sortedSamplePoints.length && sortedSamplePoints[nextSampleIdx] === i) {
                curveVals.push(+capital.toFixed(0));
                nextSampleIdx++;
            }
        }

        results.push({ curve: curveVals, final: capital, reached2x, isRuinedPath });
    }

    const bands = [];
    for (let i = 0; i < sortedSamplePoints.length; i++) {
        const t = sortedSamplePoints[i];
        const vals = results
            .map((r) => r.curve[i])
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

    const ruinCount = results.filter((r) => r.isRuinedPath || r.final <= 0).length;
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
