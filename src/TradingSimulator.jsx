/**
 * @fileoverview TradingSimulator — slim orchestrator component.
 * Composes all sub-components and hooks into the full dashboard.
 */

import { RefreshCw } from "lucide-react";
import { useSimulation, useChartData, useMonteCarlo } from "./hooks";
import {
  Header,
  Footer,
  WarningBanners,
  KPIGrid,
  StrategyParametersPanel,
  ChargesBreakdownTable,
  ChartDashboard,
  ChartErrorBoundary,
  MonteCarloPanel,
  PositionSizingTable,
  ScenarioPanel,
} from "./components";
import { SimulatorProvider } from "./context/SimulatorContext";

/**
 * Root simulator component that orchestrates all sub-components.
 * @returns {React.ReactElement}
 */
export default function TradingSimulator() {
  const sim = useSimulation();

  const chartData = useChartData({
    simData: sim.simData,
    metrics: sim.metrics,
    capital: sim.capital,
    numTrades: sim.numTrades,
    chargesObj: sim.chargesObj,
    chargesPerTrade: sim.chargesPerTradeForSim,
    riskPerTrade: sim.initialRisk,
    isCrypto: sim.isCrypto,
    usdToInr: sim.usdToInr,
  });

  const mc = useMonteCarlo({
    winRate: sim.winRate,
    rrRatio: sim.rrRatio,
    riskPerTrade: sim.riskPerTrade,
    numTrades: sim.numTrades,
    chargesPerTrade: sim.chargesPerTradeForSim,
    capital: sim.capital,
    riskMode: sim.riskMode,
    riskPercent: sim.riskPercent,
    isBlocked: sim.isBlocked,
    leverage: sim.isCrypto ? sim.leverage : 1,
    dpCharge: sim.isCrypto ? 0 : sim.chargesObj.dpCharge,
  });

  const isReady = !!(sim.metrics && sim.simData);

  return (
    <SimulatorProvider value={sim}>
      <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
        <Header metrics={sim.metrics} healthColor={sim.healthColor} />

        <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
          <WarningBanners warnings={sim.allWarnings} />

          <StrategyParametersPanel />

          {isReady && (
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-200 flex items-center gap-3">
                Simulation Details
                {sim.isSimulating && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 bg-orange-900/30 text-orange-400 text-xs font-medium rounded-md border border-orange-800/50">
                    <RefreshCw
                      size={12}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Recalculating...
                  </span>
                )}
              </h2>
              <button
                onClick={sim.handleReroll}
                disabled={sim.isRerolling}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  sim.isRerolling
                    ? "bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700"
                }`}
                title="Generate a new randomized sequence of wins and losses based on the win rate."
              >
                <RefreshCw
                  size={14}
                  className={
                    sim.isRerolling
                      ? "text-gray-500 animate-spin"
                      : "text-gray-400"
                  }
                  aria-hidden="true"
                />
                {sim.isRerolling ? "Re-rolling..." : "Re-roll Sequence"}
              </button>
            </div>
          )}

          {isReady && (
            <KPIGrid
              metrics={sim.metrics}
              simData={sim.simData}
              isCrypto={sim.isCrypto}
              capital={sim.capital}
              winRate={sim.winRate}
              rrRatio={sim.rrRatio}
              riskMode={sim.riskMode}
              usdToInr={sim.usdToInr}
            />
          )}

          {isReady && (
            <ChargesBreakdownTable
              chargesObj={sim.chargesObj}
              chargesPerTrade={sim.chargesPerTrade}
              numTrades={sim.numTrades}
              isCrypto={sim.isCrypto}
              assetClass={sim.assetClass}
              metrics={sim.metrics}
              simData={sim.simData}
              usdToInr={sim.usdToInr}
            />
          )}

          {isReady && (
            <>
              <ChartErrorBoundary
                resetKey={sim.simData ? sim.seedOffset.toString() : "none"}
              >
                <ChartDashboard
                  chartData={chartData}
                  metrics={sim.metrics}
                  capital={sim.capital}
                  winRate={sim.winRate}
                  rrRatio={sim.rrRatio}
                  chargesPerTradeForSim={sim.chargesPerTradeForSim}
                  isCrypto={sim.isCrypto}
                  usdToInr={sim.usdToInr}
                />
              </ChartErrorBoundary>

              <ChartErrorBoundary
                resetKey={
                  mc.mcResults
                    ? mc.mcResults.ruinPct +
                      "_" +
                      mc.mcResults.target2xPct +
                      "_" +
                      mc.mcResults.finalCapitals.length
                    : "none"
                }
              >
                <MonteCarloPanel
                  mcResults={mc.mcResults}
                  isMCRunning={mc.isMCRunning}
                  handleRunMC={mc.handleRunMC}
                  isBlocked={sim.isBlocked}
                  capital={sim.capital}
                  isCrypto={sim.isCrypto}
                  usdToInr={sim.usdToInr}
                />
              </ChartErrorBoundary>
            </>
          )}

          {isReady && (
            <PositionSizingTable
              metrics={sim.metrics}
              capital={sim.capital}
              lotSize={sim.lotSize}
              riskMode={sim.riskMode}
              riskPerTrade={sim.riskPerTrade}
              riskPercent={sim.riskPercent}
              isCrypto={sim.isCrypto}
              cryptoPrice={sim.cryptoPrice}
              derivativeType={sim.derivativeType}
              usdToInr={sim.usdToInr}
            />
          )}

          {isReady && (
            <ScenarioPanel
              scenarios={sim.scenarios}
              metrics={sim.metrics}
              onSave={sim.handleSaveScenario}
              onDelete={sim.handleDeleteScenario}
            />
          )}

          <Footer />
        </main>
      </div>
    </SimulatorProvider>
  );
}
