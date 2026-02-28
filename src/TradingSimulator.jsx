/**
 * @fileoverview TradingSimulator — slim orchestrator component.
 * Composes all sub-components and hooks into the full dashboard.
 */

import { useSimulation, useChartData, useMonteCarlo } from "./hooks";
import {
  Header,
  Footer,
  WarningBanners,
  KPIGrid,
  StrategyParametersPanel,
  ChargesBreakdownTable,
  ChartDashboard,
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
    capital: sim.capital,
    numTrades: sim.numTrades,
    chargesObj: sim.chargesObj,
    chargesPerTrade: sim.chargesPerTrade,
    riskPerTrade: sim.riskPerTrade,
  });

  const mc = useMonteCarlo({
    winRate: sim.winRate,
    rrRatio: sim.rrRatio,
    riskPerTrade: sim.riskPerTrade,
    numTrades: sim.numTrades,
    chargesPerTrade: sim.chargesPerTrade,
    capital: sim.capital,
    riskMode: sim.riskMode,
    riskPercent: sim.riskPercent,
    isBlocked: sim.isBlocked,
  });

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

        {sim.metrics && (
          <KPIGrid
            metrics={sim.metrics}
            simData={sim.simData}
            isCrypto={sim.isCrypto}
            capital={sim.capital}
            winRate={sim.winRate}
            rrRatio={sim.rrRatio}
          />
        )}

        {sim.metrics && (
          <ChargesBreakdownTable
            chargesObj={sim.chargesObj}
            chargesPerTrade={sim.chargesPerTrade}
            numTrades={sim.numTrades}
            isCrypto={sim.isCrypto}
            assetClass={sim.assetClass}
            metrics={sim.metrics}
            simData={sim.simData}
          />
        )}

        {sim.simData && sim.metrics && (
          <>
            <ChartDashboard
              chartData={chartData}
              metrics={sim.metrics}
              capital={sim.capital}
              winRate={sim.winRate}
              rrRatio={sim.rrRatio}
              chargesPerTrade={sim.chargesPerTrade}
            />

            <MonteCarloPanel
              mcResults={mc.mcResults}
              isMCRunning={mc.isMCRunning}
              handleRunMC={mc.handleRunMC}
              isBlocked={sim.isBlocked}
              capital={sim.capital}
            />
          </>
        )}

        {sim.metrics && (
          <PositionSizingTable
            metrics={sim.metrics}
            capital={sim.capital}
            lotSize={sim.lotSize}
            riskMode={sim.riskMode}
            riskPerTrade={sim.riskPerTrade}
            riskPercent={sim.riskPercent}
          />
        )}

        <ScenarioPanel
          scenarios={sim.scenarios}
          onSave={sim.handleSaveScenario}
          onDelete={(id) =>
            sim.setScenarios((s) => s.filter((x) => x.id !== id))
          }
          metrics={sim.metrics}
        />

        <Footer />
      </main>
    </div>
  );
}
