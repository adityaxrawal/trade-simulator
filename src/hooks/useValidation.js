import { useMemo } from 'react';
import { formatINR } from '../utils';

export const useValidation = ({
    rrRatio, capital, lotSize, winRate, chargesPerTradeForSim, riskPerTrade,
    riskPercent, riskMode, isCrypto, entryPrice, cryptoPrice, cryptoQty,
    cryptoPremium, brokerageModel, brokerageRate, assetClass, marginRequired,
    numTrades, leverage, usdToInr
}) => {
    const validationErrors = useMemo(() => {
        const errors = [];

        // 1. Mandatory Input Checks
        const isMissing = (val) => val === '' || val === undefined || isNaN(Number(val));

        if (isMissing(capital)) errors.push({ id: 'req_cap', type: 'error', message: '⛔ Please enter Initial Capital', blockSim: true });
        if (isMissing(lotSize) && !isCrypto) errors.push({ id: 'req_lot', type: 'error', message: '⛔ Please enter Lot Size', blockSim: true });
        if (isMissing(numTrades) || Number(numTrades) <= 0) errors.push({ id: 'req_trades', type: 'error', message: '⛔ Please enter Trade Count (> 0)', blockSim: true });
        if (isMissing(winRate) || Number(winRate) < 0 || Number(winRate) > 100) errors.push({ id: 'req_wr', type: 'error', message: '⛔ Please enter Win Rate (0-100)', blockSim: true });
        if (isMissing(rrRatio)) errors.push({ id: 'req_rr', type: 'error', message: '⛔ Please enter RR Ratio', blockSim: true });

        if (riskMode === 'fixed' && isMissing(riskPerTrade)) errors.push({ id: 'req_rpt', type: 'error', message: '⛔ Please enter Risk Per Trade', blockSim: true });
        if (riskMode === 'compounding' && (isMissing(riskPercent) || Number(riskPercent) <= 0 || Number(riskPercent) > 100)) errors.push({ id: 'req_rpct', type: 'error', message: '⛔ Please enter Risk % (0-100)', blockSim: true });

        if (isCrypto) {
            if (isMissing(cryptoPrice)) errors.push({ id: 'req_cp', type: 'error', message: '⛔ Please enter Crypto Price', blockSim: true });
            if (isMissing(cryptoQty)) errors.push({ id: 'req_cq', type: 'error', message: '⛔ Please enter Crypto Qty', blockSim: true });
            if (assetClass === 'crypto_options' && isMissing(cryptoPremium)) errors.push({ id: 'req_cprem', type: 'error', message: '⛔ Please enter Option Premium', blockSim: true });
        } else if (brokerageModel === 'percentage' && isMissing(brokerageRate)) {
            errors.push({ id: 'req_br', type: 'error', message: '⛔ Please enter Brokerage Rate', blockSim: true });
        }

        if (assetClass === 'index_options' || assetClass === 'equity_options' || assetClass === 'mcx_options') {
            errors.push({
                id: 'opt_itm', type: 'info',
                message: 'ℹ️ STT models sell-to-close only. Options exercised In-The-Money (ITM) at expiry attract 0.125% STT on settlement value.',
                blockSim: false,
            });
        }

        // If mandatory fields are missing, block immediately to avoid NaN/0 errors below
        if (errors.some(e => e.blockSim)) return errors;

        const nCapital = Number(capital);
        const nLotSize = Number(lotSize);
        const nWinRate = Number(winRate);
        const nRrRatio = Number(rrRatio);
        const nRiskPerTrade = Number(riskPerTrade);
        const nRiskPercent = Number(riskPercent);
        const nCryptoQty = Number(cryptoQty);
        const nEntryPrice = Number(entryPrice);

        if (nRrRatio <= 0) {
            errors.push({
                id: 'rr_zero', type: 'error',
                message: '⛔ RR Ratio must be greater than 0', blockSim: true,
            });
        }
        if (nCapital < 1000) {
            errors.push({
                id: 'low_cap_abs', type: 'error',
                message: '⛔ Minimum capital is ₹1,000', blockSim: true,
            });
        }
        if (!isCrypto && nLotSize <= 0) {
            errors.push({
                id: 'lot_zero', type: 'error',
                message: '⛔ Lot size must be greater than 0', blockSim: true,
            });
        }

        // Validate riskPerTrade > 0 and Charges <= Risk
        const currentRisk = riskMode === 'fixed' ? nRiskPerTrade : nCapital * (nRiskPercent / 100) * (isCrypto ? leverage : 1);

        if (currentRisk <= 0) {
            errors.push({
                id: 'risk_zero', type: 'error',
                message: '⛔ Risk per trade must be greater than ₹0',
                blockSim: true,
            });
        } else if (chargesPerTradeForSim > currentRisk) {
            let maxLotsMsg = '';
            if (isCrypto && nCryptoQty > 0) {
                const chargesPerLot = chargesPerTradeForSim / nCryptoQty;
                if (chargesPerLot > 0) {
                    const maxLots = Math.floor((currentRisk - 0.01) / chargesPerLot);
                    maxLotsMsg = ` Max qty for this risk is ${Math.max(0, maxLots)} lot(s).`;
                }
            }

            errors.push({
                id: 'risk_too_low', type: 'error',
                message: `⛔ Risk (₹${formatINR(currentRisk, 2)}) is lower than est. charges (₹${formatINR(chargesPerTradeForSim, 2)}).${maxLotsMsg}`,
                blockSim: true,
            });
        }

        // Validation: Margin required must not exceed capital
        if (isCrypto && marginRequired > 0) {
            const requiredMarginINR = marginRequired * usdToInr;
            if (requiredMarginINR > nCapital) {
                const marginPerLotINR = requiredMarginINR / nCryptoQty;
                const maxLots = Math.floor(nCapital / marginPerLotINR);
                errors.push({
                    id: 'margin_exceeds_capital', type: 'error',
                    message: `⛔ Margin required (₹${formatINR(requiredMarginINR, 2)}) exceeds capital. Max qty you can trade is ${maxLots} lot(s).`,
                    blockSim: true,
                });
            }
        }
        if (nWinRate === 100) {
            errors.push({
                id: 'wr_100', type: 'info',
                message: 'ℹ️ 100% win rate is theoretical — use for upper-bound analysis only',
                blockSim: false,
            });
        }
        if (nWinRate === 0) {
            errors.push({
                id: 'wr_zero', type: 'warning',
                message: '⚠️ Win rate is 0% — all trades will be losses', blockSim: false,
            });
        }
        if (nCapital < chargesPerTradeForSim * 20) {
            errors.push({
                id: 'low_cap_rel', type: 'warning',
                message: `⚠️ Capital may be too low for charge drag. Recommended minimum: ${formatINR(chargesPerTradeForSim * 50)}`,
                blockSim: false,
            });
        }
        // Warn if non-crypto asset uses a 0 entry price fallback
        if (!isCrypto && nEntryPrice === 0) {
            errors.push({
                id: 'entry_zero', type: 'warning',
                message: '⚠️ Entry price is ₹0. Charge estimates may be highly inaccurate. Set entry price for accurate results.',
                blockSim: false,
            });
        }
        if (numTrades > 10000) {
            errors.push({
                id: 'max_trades', type: 'warning',
                message: '⚠️ Trade count capped at 10,000 for simulation performance',
                blockSim: false,
            });
        }
        return errors;
    }, [rrRatio, capital, lotSize, winRate, chargesPerTradeForSim, riskPerTrade, riskPercent, riskMode, isCrypto, entryPrice, cryptoPrice, cryptoQty, cryptoPremium, brokerageModel, brokerageRate, assetClass, marginRequired, numTrades, leverage, usdToInr]);

    const isBlocked = validationErrors.some((e) => e.blockSim);

    return { validationErrors, isBlocked };
};
