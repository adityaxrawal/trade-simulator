/**
 * @fileoverview Collapsible strategy parameters panel with all input controls.
 */

import React from "react";
import { Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { ASSET_CLASSES, CRYPTO_ASSET_CONFIG } from "../../constants";
import { formatINR, formatUSD } from "../../utils";
import { USD_TO_INR } from "../../constants";

/**
 * Strategy input panel with asset class tabs, instrument selection,
 * capital, lot size, win rate, RR ratio, risk mode, brokerage,
 * and crypto-specific controls (leverage, per-asset pricing).
 *
 * @param {Object} props All simulation state values and setters from useSimulation.
 * @returns {React.ReactElement}
 */
const StrategyParametersPanel = ({
  // State values
  capital,
  assetClass,
  derivativeType,
  lotSize,
  numTrades,
  winRate,
  rrRatio,
  riskMode,
  riskPerTrade,
  riskPercent,
  brokerageModel,
  brokerageRate,
  isMaker,
  isScalperActive,
  cryptoQty,
  cryptoPrice,
  cryptoPremium,
  leverage,
  isPanelCollapsed,
  // Derived
  derivativeOptions,
  isCrypto,
  chargesPerTrade,
  currentCryptoConfig,
  assetQty,
  marginRequired,
  // Setters
  setCapital,
  setDerivativeType,
  setLotSize,
  setNumTrades,
  setWinRate,
  setRrRatio,
  setRiskMode,
  setRiskPerTrade,
  setRiskPercent,
  setBrokerageModel,
  setBrokerageRate,
  entryPrice,
  setEntryPrice,
  setIsMaker,
  setIsScalperActive,
  setCryptoQty,
  setCryptoPrice,
  setCryptoPremium,
  setLeverage,
  setIsPanelCollapsed,
  // Handlers
  handleAssetClassChange,
}) => {
  /** Handle derivative type change — for crypto, auto-set defaults. */
  const handleDerivativeChange = (value) => {
    setDerivativeType(value);
    const option = derivativeOptions.find((x) => x.value === value);
    if (option) setLotSize(option.lotSize);
    // Auto-set crypto defaults from per-asset config
    const config = CRYPTO_ASSET_CONFIG[value];
    if (isCrypto && config) {
      setCryptoPrice(config.defaultPrice);
      setLeverage(1);
    }
  };

  const cryptoSymbol = currentCryptoConfig?.symbol || "BTC";
  const maxLeverage = currentCryptoConfig?.maxLeverage || 200;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-800/50 transition-colors"
        onClick={() => setIsPanelCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <Calculator size={15} className="text-orange-400" />
          <span className="text-sm font-semibold text-gray-200">
            Strategy Parameters
          </span>
        </div>
        {isPanelCollapsed ? (
          <ChevronDown size={16} className="text-gray-500" />
        ) : (
          <ChevronUp size={16} className="text-gray-500" />
        )}
      </button>

      {!isPanelCollapsed && (
        <div className="px-5 pb-5 space-y-5 border-t border-gray-800">
          {/* Asset Class Tabs */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Asset Class
            </label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(ASSET_CLASSES).map(([key, ac]) => (
                <button
                  key={key}
                  onClick={() => handleAssetClassChange(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    assetClass === key
                      ? "bg-orange-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                  }`}
                >
                  {ac.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 1: Instrument, Capital, Lot Size, Trade Count */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Instrument
              </label>
              <select
                value={derivativeType}
                onChange={(e) => handleDerivativeChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
              >
                {derivativeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Initial Capital (₹)
              </label>
              <input
                type="number"
                value={capital}
                min={1000}
                max={100000000}
                onChange={(e) =>
                  setCapital(e.target.value === "" ? "" : e.target.value)
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Lot Size{" "}
                {isCrypto && <span className="text-gray-600">(fixed)</span>}
              </label>
              <input
                type="number"
                value={lotSize}
                min={isCrypto ? lotSize : 1}
                max={isCrypto ? lotSize : 100000}
                readOnly={isCrypto}
                onChange={(e) => {
                  if (!isCrypto) {
                    setLotSize(e.target.value === "" ? "" : e.target.value);
                  }
                }}
                className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500 ${
                  isCrypto ? "opacity-60 cursor-not-allowed" : ""
                }`}
              />
              {isCrypto && (
                <div className="text-[10px] text-gray-500 mt-0.5">
                  1 lot = {currentCryptoConfig?.lotSize} {cryptoSymbol}
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Trade Count: {numTrades}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={1000}
                  step={1}
                  value={numTrades}
                  onChange={(e) => setNumTrades(+e.target.value)}
                  className="flex-1 h-2 rounded-full accent-orange-500 cursor-pointer"
                />
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    value={numTrades}
                    onChange={(e) =>
                      setNumTrades(e.target.value === "" ? "" : e.target.value)
                    }
                    className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 pr-6 text-xs text-gray-200 text-center focus:outline-none focus:border-orange-500 appearance-none m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    aria-label="Trade count exact value"
                  />
                  <div className="absolute right-0 top-0 bottom-0 w-5 flex flex-col border-l border-gray-700 bg-gray-700/50 rounded-r-lg overflow-hidden">
                    <button
                      onClick={() =>
                        setNumTrades(Math.min(1000, numTrades + 1))
                      }
                      className="flex-1 flex items-center justify-center hover:bg-gray-600 transition-colors border-b border-gray-600"
                      aria-label="Increase trade count"
                    >
                      <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[5px] border-b-white"></div>
                    </button>
                    <button
                      onClick={() => setNumTrades(Math.max(1, numTrades - 1))}
                      className="flex-1 flex items-center justify-center hover:bg-gray-600 transition-colors"
                      aria-label="Decrease trade count"
                    >
                      <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[5px] border-t-white"></div>
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                <span>1</span>
                <span>1,000</span>
              </div>
            </div>
          </div>

          {/* Row 2: Win Rate, RR Ratio, Risk Mode, Risk Value */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Win Rate: {winRate}%
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={winRate}
                  onChange={(e) => setWinRate(+e.target.value)}
                  className="flex-1 h-2 rounded-full accent-green-500 cursor-pointer"
                  aria-label="Win rate slider"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={winRate}
                  onChange={(e) =>
                    setWinRate(e.target.value === "" ? "" : e.target.value)
                  }
                  className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 text-center focus:outline-none focus:border-green-500"
                  aria-label="Win rate exact value"
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                RR Ratio
              </label>
              <input
                type="number"
                value={rrRatio}
                min={0.1}
                max={100}
                step={0.1}
                onChange={(e) =>
                  setRrRatio(e.target.value === "" ? "" : e.target.value)
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Risk Mode
              </label>
              <div className="flex rounded-lg overflow-hidden border border-gray-700">
                {[
                  ["fixed", "Fixed ₹"],
                  ["compounding", "Compound %"],
                ].map(([m, l]) => (
                  <button
                    key={m}
                    onClick={() => setRiskMode(m)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                      riskMode === m
                        ? "bg-orange-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              {riskMode === "fixed" ? (
                <>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Risk Per Trade (₹)
                  </label>
                  <input
                    type="number"
                    value={riskPerTrade}
                    min={0}
                    onChange={(e) =>
                      setRiskPerTrade(
                        e.target.value === "" ? "" : e.target.value,
                      )
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
                  />
                </>
              ) : (
                <>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Risk % of Capital
                  </label>
                  <input
                    type="number"
                    value={riskPercent}
                    min={0.1}
                    max={50}
                    step={0.1}
                    onChange={(e) =>
                      setRiskPercent(
                        e.target.value === "" ? "" : e.target.value,
                      )
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
                  />
                </>
              )}
            </div>
          </div>

          {/* Row 3: Brokerage / Crypto Controls + Charges Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {isCrypto ? (
              <>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Order Type
                  </label>
                  <div className="flex rounded-lg overflow-hidden border border-gray-700">
                    {[
                      [true, "Maker"],
                      [false, "Taker"],
                    ].map(([val, l]) => (
                      <button
                        key={String(val)}
                        onClick={() => setIsMaker(val)}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${
                          isMaker === val
                            ? "bg-orange-600 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Scalper Offer
                  </label>
                  <div className="flex items-center gap-3 h-[38px]">
                    <span
                      className={`text-xs ${!isScalperActive ? "text-gray-200" : "text-gray-500"}`}
                    >
                      Inactive
                    </span>
                    <button
                      onClick={() => setIsScalperActive((s) => !s)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        isScalperActive ? "bg-orange-500" : "bg-gray-700"
                      }`}
                      aria-label="Toggle Scalper Offer"
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          isScalperActive ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                    <span
                      className={`text-xs font-semibold ${isScalperActive ? "text-orange-400" : "text-gray-500"}`}
                    >
                      Active
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    {cryptoSymbol} Price ($)
                  </label>
                  <input
                    type="number"
                    value={cryptoPrice}
                    min={1}
                    onChange={(e) =>
                      setCryptoPrice(
                        e.target.value === "" ? "" : e.target.value,
                      )
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Qty (# lots)
                  </label>
                  <input
                    type="number"
                    value={cryptoQty}
                    min={1}
                    onChange={(e) =>
                      setCryptoQty(e.target.value === "" ? "" : e.target.value)
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
                  />
                  <div className="text-[10px] text-cyan-400 mt-0.5 font-mono">
                    {cryptoQty} lot{cryptoQty !== 1 ? "s" : ""} = {assetQty}{" "}
                    {cryptoSymbol}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Brokerage Model
                  </label>
                  <div className="flex rounded-lg overflow-hidden border border-gray-700">
                    {[
                      ["flat20", "Flat ₹20"],
                      ["percentage", "% Based"],
                    ].map(([m, l]) => (
                      <button
                        key={m}
                        onClick={() => setBrokerageModel(m)}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${
                          brokerageModel === m
                            ? "bg-orange-600 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {brokerageModel === "percentage" && (
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                      Brokerage Rate (%)
                    </label>
                    <input
                      type="number"
                      value={
                        brokerageRate === ""
                          ? ""
                          : Number((brokerageRate * 100).toFixed(3))
                      }
                      min={0.001}
                      max={5}
                      step={0.001}
                      onChange={(e) =>
                        setBrokerageRate(
                          e.target.value === "" ? "" : e.target.value / 100,
                        )
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                )}
              </>
            )}

            {/* Entry Price for non-crypto (for accurate turnover/charges) */}
            {!isCrypto && (
              <div>
                <label
                  className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 cursor-help"
                  title={
                    assetClass.includes("options")
                      ? "For options: enter the option premium, not the underlying price."
                      : ""
                  }
                >
                  {assetClass.includes("options")
                    ? "Option Premium (₹)"
                    : "Entry Price (₹)"}
                </label>
                <input
                  type="number"
                  value={entryPrice}
                  min={0}
                  step={0.05}
                  onChange={(e) =>
                    setEntryPrice(e.target.value === "" ? "" : e.target.value)
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
                />
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {entryPrice > 0
                    ? `Turnover = ₹${(entryPrice * lotSize).toLocaleString("en-IN")}`
                    : "Set for accurate charge calc"}
                </div>
              </div>
            )}

            {/* Crypto options: premium input */}
            {assetClass === "crypto_options" && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Option Premium ($)
                </label>
                <input
                  type="number"
                  value={cryptoPremium}
                  min={0.01}
                  step={1}
                  onChange={(e) =>
                    setCryptoPremium(
                      e.target.value === "" ? "" : e.target.value,
                    )
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
                />
              </div>
            )}

            {/* Charges summary card */}
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1">
                Est. Charges / Trade
              </div>
              <div className="text-lg font-bold font-mono text-yellow-400">
                {isCrypto
                  ? formatUSD(chargesPerTrade)
                  : formatINR(chargesPerTrade, 2)}
              </div>
              {isCrypto && (
                <div className="text-xs font-mono text-gray-400 mt-0.5">
                  {formatINR(chargesPerTrade * USD_TO_INR, 2)}
                </div>
              )}
              <div className="text-xs text-gray-600 mt-0.5">
                on {ASSET_CLASSES[assetClass]?.exchange}
                {isCrypto && (
                  <span className="ml-1 text-gray-500">
                    ({isMaker ? "Maker" : "Taker"}
                    {isScalperActive ? " · Scalper" : ""})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Row 4: Crypto Leverage & Margin (only for crypto) */}
          {isCrypto && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Leverage: {leverage}x
                  <span className="text-gray-600 ml-1">
                    (max {maxLeverage}x)
                  </span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={maxLeverage}
                  step={1}
                  value={leverage}
                  onChange={(e) => setLeverage(+e.target.value)}
                  className="w-full h-2 rounded-full accent-cyan-500 cursor-pointer"
                  aria-label="Leverage slider"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                  <span>1x</span>
                  <span>{maxLeverage}x</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Margin Required
                </label>
                <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                  <div className="font-mono text-cyan-400">
                    {formatUSD(marginRequired)}
                  </div>
                  <div className="text-[10px] font-mono text-gray-500 mt-0.5">
                    {formatINR(marginRequired * USD_TO_INR, 2)}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Notional Value
                </label>
                <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
                  <div className="font-mono text-gray-300">
                    {formatUSD(marginRequired * leverage)}
                  </div>
                  <div className="text-[10px] font-mono text-gray-500 mt-0.5">
                    {formatINR(marginRequired * leverage * USD_TO_INR, 2)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

StrategyParametersPanel.displayName = "StrategyParametersPanel";

export default StrategyParametersPanel;
