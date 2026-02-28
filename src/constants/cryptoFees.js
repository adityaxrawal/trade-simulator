/**
 * @fileoverview Crypto fee structure for Delta Exchange India.
 * Fees are percentage of notional value for futures,
 * with a premium cap for options.
 */

/**
 * BTC perpetual and options fee rates.
 * @const {!Object}
 */
export const CRYPTO_FEE_RATES = {
    futures: {
        maker: 0.0002,          // 0.02%
        taker: 0.0005,          // 0.05%
        scalper_maker: 0.0001,  // ~0.01% (Scalper Offer)
        scalper_taker: 0.00026, // ~0.026% (Scalper Offer)
    },
    options: {
        maker: 0.0002,          // 0.02%
        taker: 0.0003,          // 0.03%
        scalper_maker: 0.0001,  // ~0.01% (Scalper Offer)
        scalper_taker: 0.00015, // ~0.015% (Scalper Offer)
        premiumCapPct: 0.035,   // 3.5% of premium
    },
    gst: 0.18,                // 18% GST on trading fees
};
