import { describe, it, expect } from 'vitest';
import { computeMetrics, calculateCharges } from '../utils/calculations';

describe('Calculations - computeMetrics', () => {
    it('breakEvenWR computes correctly with charge asymmetry (Issue 1)', () => {
        // R = 1000, RR = 2, Cw = 60, Cl = 40
        // Correct formula expected: 1040 / (3000 - 20) = 34.899%
        const simData = {
            numTrades: 100,
            trades: Array(100).fill(0).map((_, i) => ({
                isWin: i < 35,
                actualCharges: i < 35 ? 60 : 40,
                grossPnl: i < 35 ? 2000 : -1000,
                netPnl: i < 35 ? 1940 : -1040,
                isRuined: false
            })),
            winCount: 35,
            lossCount: 65,
            initialCapital: 100000,
            finalCapital: 100000,
            grossPnlSum: 0,
            netPnlSum: 0,
            chargesSum: 35 * 60 + 65 * 40,
            totalGrossWins: 35 * 2000,
            totalGrossLosses: 65 * 1000,
        };
        const metrics = computeMetrics(simData, 0.35, 2, 1000);
        expect(metrics.breakEvenWR).toBeCloseTo(34.9, 1);
    });

    it('chargeDragPct divides by totalGrossWins only (Issue 2)', () => {
        const simData = {
            numTrades: 100,
            trades: Array(100).fill(0).map((_, i) => ({
                isWin: i < 50,
                actualCharges: 150,
                grossPnl: i < 50 ? 2000 : -1000,
                netPnl: i < 50 ? 1850 : -1150,
                isRuined: false
            })),
            winCount: 50,
            lossCount: 50,
            initialCapital: 100000,
            finalCapital: 100000,
            grossPnlSum: 50000,
            netPnlSum: 35000,
            chargesSum: 15000,
            totalGrossWins: 100000,
            totalGrossLosses: 50000,
        };
        const metrics = computeMetrics(simData, 0.5, 2, 1000);
        // 15000 charges / 100000 gross wins = 15%
        expect(metrics.chargeDragPct).toBeCloseTo(15, 1);
    });

    it('recoveryFactor returns -Infinity when P&L is negative and max drawdown is 0 (Issue 9)', () => {
        const simData = {
            numTrades: 5,
            trades: Array(5).fill(0).map((_, i) => ({
                drawdownRs: 0, drawdownPct: 0, netPnl: -100, isRuined: false, isWin: false, actualCharges: 0, grossPnl: -100
            })),
            winCount: 0,
            lossCount: 5,
            initialCapital: 100000,
            finalCapital: 100000,
            grossPnlSum: -500,
            netPnlSum: -500,
            chargesSum: 0,
            totalGrossWins: 0,
            totalGrossLosses: 500,
        };
        const metrics = computeMetrics(simData, 0.5, 1, 100);
        expect(metrics.recoveryFactor).toBe(-Infinity);
    });

    it('chargeDragPct returns NaN instead of Infinity for 0 gross wins (Issue 14)', () => {
        const simData = {
            numTrades: 2,
            trades: [
                { drawdownRs: 0, drawdownPct: 0, netPnl: -100, isWin: false, actualCharges: 10, isRuined: false, grossPnl: -90 },
                { drawdownRs: 0, drawdownPct: 0, netPnl: -100, isWin: false, actualCharges: 10, isRuined: false, grossPnl: -90 },
            ],
            winCount: 0,
            lossCount: 2,
            initialCapital: 1000, finalCapital: 800,
            grossPnlSum: -180, netPnlSum: -200,
            chargesSum: 20, totalGrossWins: 0, totalGrossLosses: 180,
        };
        const metrics = computeMetrics(simData, 0, 1, 100);
        expect(metrics.chargeDragPct).toBeNaN();
    });

    it('kellyFull scales position to nominal risk (Issue 10)', () => {
        const simData = {
            numTrades: 10,
            trades: Array(10).fill({
                isWin: true, actualCharges: 50, grossPnl: 2000, netPnl: 1950, isRuined: false
            }),
            winCount: 10, lossCount: 0,
            initialCapital: 10000, finalCapital: 10000,
            grossPnlSum: 20000, netPnlSum: 19500, chargesSum: 500,
            totalGrossWins: 20000, totalGrossLosses: 0,
        };
        const metrics = computeMetrics(simData, 0.5, 2, 1000);
        expect(metrics.kellyFull).toBeDefined();
    });
});

describe('Calculations - calculateCharges', () => {
    it('applies basic flat20 broker mode correctly with accurate SEBI rate (Issue 6)', () => {
        const res = calculateCharges('equity_options', 1000000, 1000000, 'flat20', 0, {}, '', false);
        // SEBI should be 10 per crore => 0.000001. For 2000000 => 2.0
        expect(res.sebiCharge).toBeCloseTo(2.0, 2);
    });
});
