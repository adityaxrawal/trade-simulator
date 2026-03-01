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
    // Flaw 8 logic fix + Flaw 9 entropy loss fix.
    const seed = Math.imul(seedOffset, 2654435761) ^ 0x5f3759df;
    let rng = seed;
    // F-023: Fixed divisor for correct [0,1) range
    const random = () => {
        rng = (rng * 1664525 + 1013904223) & 0xffffffff;
        return (rng >>> 0) / 0x100000000;
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

    // Flaw 2 fix: Compute compounding initial risk base outside the loop
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
        // Flaw 3 fix: True probabilistic Bernoulli distribution draw per trade
        const isWin = random() < winRate;

        // Flaw 4 fix + Flaw 1 fix: Scale risk heavily by leverage
        const effectiveRisk =
            riskMode === 'compounding'
                ? capital * (riskPercent / 100) * leverage
                : Math.min(riskPerTrade, capital);

        const grossPnl = isWin ? effectiveRisk * rrRatio : -effectiveRisk;

        let currentCharges;
        if (riskMode === 'compounding') {
            // Flaw 2 fix: Use proper initialCompoundingRisk to scale
            const scaleFactor = safeDivide(effectiveRisk, initialCompoundingRisk || 1);
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
            actualGrossPnl -= overflow;
            overflowWarning = true;
        }

        const actualCharges = actualGrossPnl - actualNetPnl;

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
            capitalAtTradeStart: +capitalAtTradeStart.toFixed(2), // Flaw 6: needed for Sharpe
            grossCapital: +grossCapital.toFixed(2),
            drawdownRs: +drawdownRs.toFixed(2),
            drawdownPct: +drawdownPct.toFixed(2),
            isRuined: false,
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
        // #14: Exclude post-ruin zero-trades from loss count
        lossCount: trades.filter(t => !t.isWin && !t.isRuined).length,
        totalGrossWins: +totalGrossWins.toFixed(2),
        totalGrossLosses: +totalGrossLosses.toFixed(2),
        ruinAtTrade,
        overflowWarning,
    };
};

/**
 * Runs a Monte Carlo simulation with multiple random paths.
 * Uses a seeded PRNG for reproducibility (Flaw 8 fix).
 *
 * @param {Object} params Simulation parameters (same as runSimulation).
 * @param {number} simCount Number of simulation paths (default: 500).
 * @returns {Object} Results including percentile bands, ruin/target probabilities.
 */
export const runMonteCarlo = (params, simCount = 500) => {
    const {
        winRate, rrRatio, riskPerTrade, numTrades,
        chargesPerTrade, initialCapital, riskMode, riskPercent,
        dpCharge = 0, leverage = 1
    } = params;

    // Fixed base seed for Monte Carlo to ensure reproducible results
    // and smooth transitions when tweaking strategy parameters.
    const baseSeed = 0x5f3759df;

    const initialCompoundingRisk = initialCapital * (riskPercent / 100) * leverage;

    const results = [];
    for (let sim = 0; sim < simCount; sim++) {
        // Each simulation path gets a unique seed derived from baseSeed + sim index
        // Flaw 9 Entropy fix
        let rng = Math.imul(sim, 2654435761) ^ baseSeed;
        const seededRandom = () => {
            rng = (rng * 1664525 + 1013904223) & 0xffffffff;
            return (rng >>> 0) / 0x100000000;
        };

        let capital = initialCapital;
        const curve = [capital];
        for (let i = 0; i < numTrades; i++) {
            if (capital <= 0) {
                curve.push(0);
                continue;
            }
            const isWin = seededRandom() < winRate;
            // Flaw 4 fix + Flaw 1 fix: Account for leverage
            const risk =
                riskMode === 'compounding'
                    ? capital * (riskPercent / 100) * leverage
                    : Math.min(riskPerTrade, capital);
            const grossPnl = isWin ? risk * rrRatio : -risk;

            // Flaw 3 fix: Scale charges correctly
            let currentCharges;
            if (riskMode === 'compounding') {
                const scaleFactor = safeDivide(risk, initialCompoundingRisk || 1);
                const scalableCharges = chargesPerTrade - dpCharge;
                currentCharges = scalableCharges * scaleFactor + dpCharge;
            } else {
                currentCharges = chargesPerTrade;
            }

            // Flaw 4 fix: Cap the grossPnl and capital correctly
            const capitalBeforeTrade = capital;
            capital = Math.max(0, capital + grossPnl - currentCharges);
            const actualNetPnl = capital - capitalBeforeTrade;

            // F-009: Apply compounding cap in Monte Carlo too
            if (capital > COMPOUNDING_CAP) capital = COMPOUNDING_CAP;
            curve.push(+capital.toFixed(0));
        }
        results.push({ curve, final: capital });
    }

    const bands = [];
    const step = Math.max(1, Math.floor(numTrades / 100));
    for (let t = 0; t <= numTrades; t += step) {
        const vals = results
            .map((r) => r.curve[Math.min(t, r.curve.length - 1)])
            .sort((a, b) => a - b);
        const n = vals.length;
        bands.push({
            trade: t,
            p10: vals[Math.floor(n * 0.10)] || 0,
            p25: vals[Math.floor(n * 0.25)] || 0,
            p50: vals[Math.floor(n * 0.50)] || 0,
            p75: vals[Math.floor(n * 0.75)] || 0,
            p90: vals[Math.floor(n * 0.90)] || 0,
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
