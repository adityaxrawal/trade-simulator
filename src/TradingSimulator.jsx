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
    dpCharge: sim.chargesObj.dpCharge,
  });

  const isReady = !!(sim.metrics && sim.simData);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      <Header metrics={sim.metrics} healthColor={sim.healthColor} />

      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <WarningBanners warnings={sim.allWarnings} />

        <StrategyParametersPanel
          capital={sim.capital}
          setCapital={sim.setCapital}
          assetClass={sim.assetClass}
          derivativeType={sim.derivativeType}
          setDerivativeType={sim.setDerivativeType}
          lotSize={sim.lotSize}
          setLotSize={sim.setLotSize}
          numTrades={sim.numTrades}
          setNumTrades={sim.setNumTrades}
          winRate={sim.winRate}
          setWinRate={sim.setWinRate}
          rrRatio={sim.rrRatio}
          setRrRatio={sim.setRrRatio}
          riskMode={sim.riskMode}
          setRiskMode={sim.setRiskMode}
          riskPerTrade={sim.riskPerTrade}
          setRiskPerTrade={sim.setRiskPerTrade}
          riskPercent={sim.riskPercent}
          setRiskPercent={sim.setRiskPercent}
          brokerageModel={sim.brokerageModel}
          setBrokerageModel={sim.setBrokerageModel}
          brokerageRate={sim.brokerageRate}
          setBrokerageRate={sim.setBrokerageRate}
          entryPrice={sim.entryPrice}
          setEntryPrice={sim.setEntryPrice}
          isMaker={sim.isMaker}
          setIsMaker={sim.setIsMaker}
          isScalperActive={sim.isScalperActive}
          setIsScalperActive={sim.setIsScalperActive}
          cryptoQty={sim.cryptoQty}
          setCryptoQty={sim.setCryptoQty}
          cryptoPrice={sim.cryptoPrice}
          setCryptoPrice={sim.setCryptoPrice}
          leverage={sim.leverage}
          setLeverage={sim.setLeverage}
          cryptoPremium={sim.cryptoPremium}
          setCryptoPremium={sim.setCryptoPremium}
          usdToInr={sim.usdToInr}
          setUsdToInr={sim.setUsdToInr}
          marginRequired={sim.marginRequired}
          assetQty={sim.assetQty}
          currentCryptoConfig={sim.currentCryptoConfig}
          isPanelCollapsed={sim.isPanelCollapsed}
          setIsPanelCollapsed={sim.setIsPanelCollapsed}
          derivativeOptions={sim.derivativeOptions}
          isCrypto={sim.isCrypto}
          chargesPerTrade={sim.chargesPerTrade}
          handleAssetClassChange={sim.handleAssetClassChange}
        />

        {isReady && (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-200 flex items-center gap-3">
              Simulation Details
              {sim.isSimulating && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-orange-900/30 text-orange-400 text-xs font-medium rounded-md border border-orange-800/50">
                  <RefreshCw size={12} className="animate-spin" />
                  Recalculating...
                </span>
              )}
            </h2>
            <button
              onClick={() => sim.setSeedOffset((o) => o + 1)}
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
            <ChartErrorBoundary resetKey={sim.simData}>
              <ChartDashboard
                chartData={chartData}
                metrics={sim.metrics}
                capital={sim.capital}
                winRate={sim.winRate}
                rrRatio={sim.rrRatio}
                chargesPerTrade={sim.chargesPerTradeForSim}
                isCrypto={sim.isCrypto}
                usdToInr={sim.usdToInr}
              />
            </ChartErrorBoundary>

            <ChartErrorBoundary resetKey={mc.mcResults}>
              <MonteCarloPanel
                mcResults={mc.mcResults}
                isMCRunning={mc.isMCRunning}
                handleRunMC={mc.handleRunMC}
                isBlocked={sim.isBlocked}
                capital={sim.capital}
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
  );
}
