/**
 * @fileoverview Grid of KPI cards displaying simulation metrics.
 */

import React from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Target,
  RefreshCw,
  Shield,
  Zap,
} from "lucide-react";
import KPICard from "./KPICard";
import { formatINR, formatCrypto, safeDivide } from "../../utils";
import { USD_TO_INR } from "../../constants";

/**
 * Renders a responsive grid of 12 KPI metric cards.
 *
 * @param {Object} props
 * @param {Object} props.metrics Computed simulation metrics.
 * @param {Object} props.simData Raw simulation data.
 * @param {boolean} props.isCrypto Whether current asset is crypto.
 * @param {number} props.capital Initial capital.
 * @param {number} props.winRate Win rate (0–100).
 * @param {number} props.rrRatio Risk-to-reward ratio.
 * @returns {React.ReactElement}
 */
const KPIGrid = React.memo(
  ({ metrics, simData, isCrypto, capital, winRate, rrRatio, riskMode }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      <KPICard
        label="Net P&L"
        value={
          isCrypto
            ? formatCrypto(metrics.netPnL / USD_TO_INR)
            : formatINR(metrics.netPnL)
        }
        subText={
          isCrypto
            ? `Gross: ${formatCrypto(metrics.grossPnL / USD_TO_INR)}`
            : `Gross: ${formatINR(metrics.grossPnL)}`
        }
        isPositive={metrics.netPnL > 0}
        isNegative={metrics.netPnL < 0}
        icon={metrics.netPnL >= 0 ? TrendingUp : TrendingDown}
      />
      <KPICard
        label="Profit Factor"
        value={
          !isFinite(metrics.profitFactor)
            ? "∞"
            : metrics.profitFactor.toFixed(2)
        }
        subText={`W:${simData?.winCount} L:${simData?.lossCount}`}
        tooltip="Gross Wins ÷ Gross Losses (∞ = no losing trades)"
        isPositive={metrics.profitFactor > 1.5}
        isNegative={isFinite(metrics.profitFactor) && metrics.profitFactor < 1}
        icon={Activity}
      />
      <KPICard
        label="Expectancy"
        value={
          isCrypto
            ? formatCrypto(metrics.expectancy / USD_TO_INR)
            : formatINR(metrics.expectancy)
        }
        subText={
          isCrypto
            ? `${(metrics.expectancyPerRupee * 100).toFixed(1)}¢/$`
            : `${(metrics.expectancyPerRupee * 100).toFixed(1)}¢/₹`
        }
        isPositive={metrics.expectancy > 0}
        isNegative={metrics.expectancy < 0}
        icon={Target}
      />
      <KPICard
        label="Max Drawdown"
        value={`${Math.abs(metrics.maxDrawdownPct).toFixed(1)}%`}
        subText={
          isCrypto
            ? formatCrypto(metrics.maxDrawdownRs / USD_TO_INR, 0)
            : formatINR(metrics.maxDrawdownRs)
        }
        isNegative={Math.abs(metrics.maxDrawdownPct) > 30}
        isWarning={
          Math.abs(metrics.maxDrawdownPct) > 15 &&
          Math.abs(metrics.maxDrawdownPct) <= 30
        }
        icon={TrendingDown}
      />
      <KPICard
        label="Recovery Factor"
        value={
          metrics.ruinAtTrade
            ? "RUIN"
            : !isFinite(metrics.recoveryFactor)
              ? "∞"
              : metrics.recoveryFactor.toFixed(2)
        }
        subText="Net P&L ÷ MaxDD"
        tooltip="Net Profit ÷ Max Drawdown (∞ = no drawdown)"
        isPositive={metrics.recoveryFactor > 3 && !metrics.ruinAtTrade}
        isNegative={
          (isFinite(metrics.recoveryFactor) && metrics.recoveryFactor < 1) ||
          !!metrics.ruinAtTrade
        }
        icon={RefreshCw}
      />
      <KPICard
        label="Total Charges"
        value={
          isCrypto
            ? formatCrypto(metrics.totalCharges / USD_TO_INR)
            : formatINR(metrics.totalCharges)
        }
        subText={`Drag: ${isFinite(metrics.chargeDragPct) ? `${metrics.chargeDragPct.toFixed(1)}%` : "N/A"}`}
        isWarning={metrics.chargeDragPct > 30}
        isNegative={metrics.chargeDragPct > 50}
        icon={DollarSign}
      />
      <KPICard
        label="Break-Even WR"
        value={`${metrics.breakEvenWR.toFixed(1)}%`}
        subText={winRate >= metrics.breakEvenWR ? "✓ Above" : "✗ Below"}
        isPositive={winRate >= metrics.breakEvenWR}
        isNegative={winRate < metrics.breakEvenWR}
        icon={Shield}
      />
      <KPICard
        label="Break-Even RR"
        value={`${metrics.breakEvenRR.toFixed(2)}:1`}
        subText={rrRatio >= metrics.breakEvenRR ? "✓ Above" : "✗ Below"}
        isPositive={rrRatio >= metrics.breakEvenRR}
        isNegative={rrRatio < metrics.breakEvenRR}
        icon={Shield}
      />
      <KPICard
        label={riskMode === "compounding" ? "Init Cap Kelly" : "Kelly Full"}
        value={`${metrics.kellyFull.toFixed(1)}%`}
        subText={`Half: ${metrics.kellyHalf.toFixed(1)}%`}
        isPositive={metrics.kellyFull > 0}
        isNegative={metrics.kellyFull <= 0}
        isWarning={metrics.kellyFull > 25}
        icon={Zap}
      />
      <KPICard
        label="Sharpe Ratio"
        value={
          !isFinite(metrics.annualizedSharpe)
            ? "∞"
            : metrics.annualizedSharpe.toFixed(2)
        }
        subText={`Per Trade`}
        tooltip="Sharpe Ratio (Per Trade)"
        isPositive={metrics.annualizedSharpe > 1}
        isNegative={metrics.annualizedSharpe < 0}
        icon={Activity}
      />
      <KPICard
        label="Max Win Streak"
        value={metrics.maxWinStreak}
        subText={`Loss: ${metrics.maxLossStreak}`}
        icon={TrendingUp}
      />
      <KPICard
        label="Final Capital"
        value={
          isCrypto
            ? formatCrypto(metrics.finalCapital / USD_TO_INR)
            : formatINR(metrics.finalCapital)
        }
        subText={`${(safeDivide(metrics.netPnL, capital) * 100).toFixed(1)}% return`}
        isPositive={metrics.finalCapital > capital}
        isNegative={metrics.finalCapital < capital}
        icon={DollarSign}
      />
    </div>
  ),
);

KPIGrid.displayName = "KPIGrid";

export default KPIGrid;
