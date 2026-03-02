import { describe, it, expect } from 'vitest';
import { runSimulation } from '../utils';

describe('Trading Simulator Core', () => {
    it('should run a basic deterministic simulation without crashing', () => {
        const result = runSimulation({
            initialCapital: 100000,
            numTrades: 10,
            winRate: 0.5,
            rrRatio: 2,
            riskMode: 'fixed',
            riskPerTrade: 1000,
            riskPercent: 1,
            chargesPerTrade: 20,
            dpCharge: 15.93,
            seedOffset: 0,
            leverage: 1,
        });

        expect(result.trades.length).toBe(10);
        expect(result.initialCapital).toBe(100000);
        expect(result.netPnlSum).toBeTypeOf('number');
    });

    it('should handle zero win rate gracefully', () => {
        const result = runSimulation({
            initialCapital: 10000,
            numTrades: 5,
            winRate: 0,
            rrRatio: 1,
            riskMode: 'compounding',
            riskPerTrade: 100,
            riskPercent: 1,
            chargesPerTrade: 10,
            dpCharge: 0,
            seedOffset: 42,
            leverage: 1,
        });

        // Expecting all losses
        expect(result.winCount).toBe(0);
        expect(result.lossCount).toBe(5);
    });
});
