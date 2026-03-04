import { useMemo } from 'react';
import { calculateCharges } from '../utils';

export const useCharges = ({
    assetClass,
    derivativeType,
    lotSize,
    isCrypto,
    cryptoQty,
    cryptoPrice,
    cryptoPremium,
    currentCryptoConfig,
    entryPrice,
    brokerageModel,
    brokerageRate,
    isMaker,
    isScalperActive,
    usdToInr
}) => {
    // Asset-class-aware turnover estimation using entryPrice
    const estimatedTurnover = useMemo(() => {
        if (isCrypto) {
            const cryptoLot = currentCryptoConfig?.lotSize || lotSize;
            const notional = Number(cryptoQty) * Number(cryptoLot) * Number(cryptoPrice);
            return { buy: notional, sell: notional };
        }
        // Use actual entry price for turnover when available
        if (Number(entryPrice) > 0) {
            const turnover = Number(entryPrice) * Number(lotSize);
            return { buy: turnover, sell: turnover };
        }
        // Use sensible default typical prices based on derivative type instead of arbitrary formulas
        let typicalPrice = 100; // conservative default fallback
        if (derivativeType === 'NIFTY') {
            typicalPrice = assetClass.includes('options') ? 150 : 24000;
        } else if (derivativeType === 'BANKNIFTY') {
            typicalPrice = assetClass.includes('options') ? 350 : 52000;
        } else if (derivativeType === 'FINNIFTY') {
            typicalPrice = assetClass.includes('options') ? 120 : 23000;
        } else if (derivativeType === 'MIDCPNIFTY') {
            typicalPrice = assetClass.includes('options') ? 80 : 12500;
        } else if (assetClass === 'mcx_options') {
            typicalPrice = derivativeType === 'CRUDE' ? 150 :
                derivativeType === 'NATGAS' ? 15 :
                    derivativeType === 'GOLD' ? 500 :
                        derivativeType === 'SILVER' ? 1000 : 100;
        } else if (assetClass.includes('mcx_')) {
            typicalPrice = derivativeType === 'CRUDE' ? 6500 :
                derivativeType === 'NATGAS' ? 250 :
                    derivativeType === 'GOLD' ? 70000 :
                        derivativeType === 'SILVER' ? 85000 : 1000;
        } else if (assetClass.includes('equity_') || assetClass.includes('stock_')) {
            typicalPrice = 1500; // generic stock price
        }

        const turnover = typicalPrice * Number(lotSize);
        return { buy: turnover, sell: turnover };
    }, [assetClass, lotSize, isCrypto, cryptoQty, cryptoPrice, currentCryptoConfig, entryPrice, derivativeType]);

    const chargesObj = useMemo(
        () =>
            calculateCharges(
                assetClass,
                estimatedTurnover.buy,
                estimatedTurnover.sell,
                brokerageModel,
                brokerageRate,
                isCrypto
                    ? {
                        isMaker,
                        isScalperActive,
                        contracts: Number(cryptoQty),
                        lotSize: Number(currentCryptoConfig?.lotSize || lotSize),
                        premium: Number(cryptoPremium),
                        btcPrice: Number(cryptoPrice),
                    }
                    : {},
                derivativeType,
            ),
        [
            assetClass, estimatedTurnover, brokerageModel, brokerageRate,
            isCrypto, isMaker, isScalperActive, cryptoQty, cryptoPremium, cryptoPrice,
            lotSize, currentCryptoConfig, derivativeType,
        ],
    );
    // chargesPerTrade is exposed to UI components. For crypto, this remains in USD (raw total)
    // because components like ChargesBreakdownTable handle the INR formatting locally.
    const chargesPerTrade = chargesObj.total;
    // chargesPerTradeForSim is strictly in INR, passed into the simulation engines
    // where all compounding and calculations are done exclusively in INR.
    const chargesPerTradeForSim = isCrypto ? chargesObj.total * usdToInr : chargesObj.total;

    return { estimatedTurnover, chargesObj, chargesPerTrade, chargesPerTradeForSim };
};
