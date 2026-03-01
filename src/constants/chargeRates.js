/**
 * @fileoverview Regulatory charge rates for Indian market instruments.
 * STT rates updated to post-Oct 2024 SEBI schedule.
 * MCX exchange rates split by commodity type.
 * Equity delivery STT is 0.1% on BOTH buy and sell per SEBI rules.
 * Currency stamp duty 0.0001% per national standardized rates.
 */

/**
 * Charge rates per asset class (STT, CTT, exchange transaction, stamp duty, DP).
 * @const {!Object<string, {stt_buy: number, stt_sell: number, ctt_sell: number, exch_rate: number, stamp_buy: number, dp_charge: number}>}
 */
export const CHARGE_RATES = {
    equity_delivery: {
        stt_buy: 0.001, stt_sell: 0.001, ctt_sell: 0,
        exch_rate: 0.0000325, stamp_buy: 0.00015, dp_charge: 15.93,
    },
    equity_intraday: {
        stt_buy: 0, stt_sell: 0.00025, ctt_sell: 0,
        exch_rate: 0.0000325, stamp_buy: 0.00003, dp_charge: 0,
    },
    equity_futures: {
        stt_buy: 0, stt_sell: 0.0002, ctt_sell: 0,
        exch_rate: 0.0000173, stamp_buy: 0.00002, dp_charge: 0,
    },
    equity_options: {
        stt_buy: 0, stt_sell: 0.001, ctt_sell: 0,
        exch_rate: 0.0003503, stamp_buy: 0.00003, dp_charge: 0,
    },
    index_futures: {
        stt_buy: 0, stt_sell: 0.0002, ctt_sell: 0,
        exch_rate: 0.0000173, stamp_buy: 0.00002, dp_charge: 0,
    },
    index_options: {
        stt_buy: 0, stt_sell: 0.001, ctt_sell: 0,
        exch_rate: 0.0003503, stamp_buy: 0.00003, dp_charge: 0,
    },
    mcx_futures: {
        stt_buy: 0, stt_sell: 0, ctt_sell: 0.0001,
        exch_rate: 0.000021, stamp_buy: 0.00002, dp_charge: 0,
    },
    mcx_options: {
        stt_buy: 0, stt_sell: 0, ctt_sell: 0.0005,
        exch_rate: 0.000418, stamp_buy: 0.00003, dp_charge: 0, // Oct 2024 revised uniform rate
    },
    ncdex_agri: {
        stt_buy: 0, stt_sell: 0, ctt_sell: 0,
        exch_rate: 0.00001, stamp_buy: 0.00002, dp_charge: 0,
    },
    currency_futures: {
        stt_buy: 0, stt_sell: 0, ctt_sell: 0,
        exch_rate: 0.0000035, stamp_buy: 0.000001, dp_charge: 0,
    },
    currency_options: {
        stt_buy: 0, stt_sell: 0, ctt_sell: 0,
        exch_rate: 0.000311, stamp_buy: 0.000001, dp_charge: 0,
    },
    crypto_futures: {
        stt_buy: 0, stt_sell: 0, ctt_sell: 0,
        exch_rate: 0, stamp_buy: 0, dp_charge: 0,
    },
    crypto_options: {
        stt_buy: 0, stt_sell: 0, ctt_sell: 0,
        exch_rate: 0, stamp_buy: 0, dp_charge: 0,
    },
};

/** SEBI turnover fee: ₹10 per crore. */
export const SEBI_RATE = 0.000001;

/** GST rate on brokerage + exchange transaction charges. */
export const GST_RATE = 0.18;

/**
 * F-011: MCX commodity-specific exchange transaction rates.
 * @const {!Object<string, number>}
 */
export const MCX_EXCH_RATES = {
    GOLD: 0.000021,
    GOLDM: 0.000021,
    SILVER: 0.000021,
    SILVERM: 0.000021,
    CRUDE: 0.000026,
    NATGAS: 0.000026,
    COPPER: 0.000026,
    ZINC: 0.000026,
    ALUMIN: 0.000026,
    LEAD: 0.000026,
    NICKEL: 0.000026,
};
