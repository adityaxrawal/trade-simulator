/**
 * @fileoverview Asset class definitions and derivative type configurations
 * for Indian market instruments (NSE, BSE, MCX, NCDEX) and crypto exchanges.
 * Updated: Feb 2026 (post-Oct 2024 STT revision, SEBI lot size changes).
 */

/**
 * Available asset classes with their exchange and tax applicability.
 * @const {!Object<string, {label: string, exchange: string, hasSTT: boolean, hasCTT: boolean}>}
 */
export const ASSET_CLASSES = {
    equity_delivery: {
        label: 'Equity Delivery',
        exchange: 'NSE/BSE',
        hasSTT: true,
        hasCTT: false,
    },
    equity_intraday: {
        label: 'Equity Intraday',
        exchange: 'NSE/BSE',
        hasSTT: true,
        hasCTT: false,
    },
    equity_futures: {
        label: 'Equity Futures',
        exchange: 'NSE',
        hasSTT: true,
        hasCTT: false,
    },
    equity_options_buy: {
        label: 'Equity Options (Buy)',
        exchange: 'NSE/BSE',
        hasSTT: true,
        hasCTT: false,
    },
    equity_options_sell: {
        label: 'Equity Options (Sell)',
        exchange: 'NSE/BSE',
        hasSTT: true,
        hasCTT: false,
    },
    index_futures: {
        label: 'Index Futures',
        exchange: 'NSE',
        hasSTT: true,
        hasCTT: false,
    },
    index_options_buy: {
        label: 'Index Options (Buy)',
        exchange: 'NSE',
        hasSTT: true,
        hasCTT: false,
    },
    index_options_sell: {
        label: 'Index Options (Sell)',
        exchange: 'NSE',
        hasSTT: true,
        hasCTT: false,
    },
    mcx_futures: {
        label: 'MCX Commodity Futures',
        exchange: 'MCX',
        hasSTT: false,
        hasCTT: true,
    },
    mcx_options: {
        label: 'MCX Commodity Options',
        exchange: 'MCX',
        hasSTT: false,
        hasCTT: true,
    },
    ncdex_agri: {
        label: 'NCDEX Agri Futures',
        exchange: 'NCDEX',
        hasSTT: false,
        hasCTT: false,
    },
    currency_futures: {
        label: 'Currency Futures',
        exchange: 'NSE/BSE',
        hasSTT: false,
        hasCTT: false,
    },
    currency_options: {
        label: 'Currency Options',
        exchange: 'NSE/BSE',
        hasSTT: false,
        hasCTT: false,
    },
    crypto_futures: {
        label: 'Crypto Futures',
        exchange: 'Delta',
        hasSTT: false,
        hasCTT: false,
    },
    crypto_options: {
        label: 'Crypto Options',
        exchange: 'Delta',
        hasSTT: false,
        hasCTT: false,
    },
};

/**
 * Derivative instrument options per asset class with lot sizes.
 * F-002: Updated lot sizes per SEBI revisions (late 2025).
 * F-027: Added mini contracts and additional NCDEX instruments.
 * @const {!Object<string, !Array<{value: string, label: string, lotSize: number}>>}
 */
export const DERIVATIVE_TYPES = {
    equity_delivery: [
        { value: 'stock', label: 'Stock (per share)', lotSize: 1 },
    ],
    equity_intraday: [
        { value: 'stock', label: 'Stock Intraday', lotSize: 1 },
    ],
    equity_futures: [
        { value: 'stock_fut', label: 'Stock Futures', lotSize: 500 },
    ],
    equity_options_buy: [
        { value: 'stock_opt', label: 'Stock Options', lotSize: 500 },
    ],
    equity_options_sell: [
        { value: 'stock_opt', label: 'Stock Options', lotSize: 500 },
    ],
    index_futures: [
        { value: 'NIFTY', label: 'NIFTY Futures', lotSize: 65 },
        { value: 'BANKNIFTY', label: 'BANKNIFTY Futures', lotSize: 30 },
        { value: 'FINNIFTY', label: 'FINNIFTY Futures', lotSize: 60 },
        { value: 'MIDCPNIFTY', label: 'MIDCPNIFTY Futures', lotSize: 75 },
    ],
    index_options_buy: [
        { value: 'NIFTY', label: 'NIFTY Options', lotSize: 65 },
        { value: 'BANKNIFTY', label: 'BANKNIFTY Options', lotSize: 30 },
        { value: 'FINNIFTY', label: 'FINNIFTY Options', lotSize: 60 },
        { value: 'MIDCPNIFTY', label: 'MIDCPNIFTY Options', lotSize: 75 },
    ],
    index_options_sell: [
        { value: 'NIFTY', label: 'NIFTY Short Options', lotSize: 65 },
        { value: 'BANKNIFTY', label: 'BANKNIFTY Short Options', lotSize: 30 },
        { value: 'FINNIFTY', label: 'FINNIFTY Short Options', lotSize: 60 },
        { value: 'MIDCPNIFTY', label: 'MIDCPNIFTY Short Options', lotSize: 75 },
    ],
    mcx_futures: [
        { value: 'GOLD', label: 'Gold (1 kg)', lotSize: 1 },
        { value: 'GOLDM', label: 'Gold Mini (100 g)', lotSize: 1 },
        { value: 'SILVER', label: 'Silver (30 kg)', lotSize: 30 },
        { value: 'SILVERM', label: 'Silver Mini (5 kg)', lotSize: 5 },
        { value: 'CRUDE', label: 'Crude Oil (100 bbl)', lotSize: 100 },
        { value: 'NATGAS', label: 'Natural Gas (1250)', lotSize: 1250 },
        { value: 'COPPER', label: 'Copper (2500 kg)', lotSize: 2500 },
        { value: 'ZINC', label: 'Zinc (5000 kg)', lotSize: 5000 },
        { value: 'ALUMIN', label: 'Aluminium (5000 kg)', lotSize: 5000 },
        { value: 'LEAD', label: 'Lead (5000 kg)', lotSize: 5000 },
        { value: 'NICKEL', label: 'Nickel (1500 kg)', lotSize: 1500 },
    ],
    mcx_options: [
        { value: 'GOLD_OPT', label: 'Gold Options', lotSize: 1 },
        { value: 'SILVER_OPT', label: 'Silver Options', lotSize: 30 },
        { value: 'CRUDE_OPT', label: 'Crude Options', lotSize: 100 },
        { value: 'COPPER_OPT', label: 'Copper Options', lotSize: 2500 },
    ],
    ncdex_agri: [
        { value: 'GUARSEED', label: 'Guar Seed (10 MT)', lotSize: 10000 },
        { value: 'CHANA', label: 'Chana (10 MT)', lotSize: 10000 },
        { value: 'SOYBEAN', label: 'Soybean (10 MT)', lotSize: 10000 },
        { value: 'JEERA', label: 'Jeera (3 MT)', lotSize: 3000 },
        { value: 'CASTORSEED', label: 'Castor Seed (10 MT)', lotSize: 10000 },
        { value: 'COTTONOIL', label: 'Cotton Seed Oil (10 MT)', lotSize: 10000 },
    ],
    currency_futures: [
        { value: 'USDINR', label: 'USDINR Futures', lotSize: 1000 },
        { value: 'EURINR', label: 'EURINR Futures', lotSize: 1000 },
        { value: 'GBPINR', label: 'GBPINR Futures', lotSize: 1000 },
        { value: 'JPYINR', label: 'JPYINR Futures', lotSize: 100000 },
    ],
    currency_options: [
        { value: 'USDINR_OPT', label: 'USDINR Options', lotSize: 1000 },
        { value: 'EURINR_OPT', label: 'EURINR Options', lotSize: 1000 },
    ],
    crypto_futures: [
        { value: 'BTCUSD', label: 'BTCUSD Perpetual', lotSize: 0.001 },
        { value: 'ETHUSD', label: 'ETHUSD Perpetual', lotSize: 0.01 },
        { value: 'PAXGUSD', label: 'PAXGUSD Perpetual', lotSize: 0.001 },
    ],
    crypto_options: [
        { value: 'BTC_OPT', label: 'BTC Options', lotSize: 0.001 },
        { value: 'ETH_OPT', label: 'ETH Options', lotSize: 0.01 },
    ],
};

/**
 * Per-asset crypto configuration from Delta Exchange contract specifications.
 * Includes lot sizes, leverage limits, margin requirements, and default prices.
 * @const {!Object<string, {symbol: string, lotSize: number, maxLeverage: number,
 *   defaultPrice: number, initialMarginPct: number, maintenanceMarginPct: number}>}
 */
export const CRYPTO_ASSET_CONFIG = {
    BTCUSD: {
        symbol: 'BTC',
        lotSize: 0.001,
        maxLeverage: 200,
        defaultPrice: 100000,
        initialMarginPct: 0.005,
        maintenanceMarginPct: 0.0025,
    },
    ETHUSD: {
        symbol: 'ETH',
        lotSize: 0.01,
        maxLeverage: 200,
        defaultPrice: 3500,
        initialMarginPct: 0.005,
        maintenanceMarginPct: 0.0025,
    },
    PAXGUSD: {
        symbol: 'PAXG',
        lotSize: 0.001,
        maxLeverage: 50,
        defaultPrice: 2700,
        initialMarginPct: 0.02,
        maintenanceMarginPct: 0.01,
    },
    BTC_OPT: {
        symbol: 'BTC',
        lotSize: 0.001,
        maxLeverage: 100,
        defaultPrice: 100000,
        initialMarginPct: 0.01,
        maintenanceMarginPct: 0.005,
    },
    ETH_OPT: {
        symbol: 'ETH',
        lotSize: 0.01,
        maxLeverage: 100,
        defaultPrice: 3500,
        initialMarginPct: 0.01,
        maintenanceMarginPct: 0.005,
    },
};
