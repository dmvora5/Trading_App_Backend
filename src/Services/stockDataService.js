const { isMarketOpen, getMarketCloseTime } = require('../Utils');
const logger = require('../Utils/logger');

const yahooFinance = require('yahoo-finance2').default;


async function fetchStockData({ symbol, interval, lookbackDays }) {
    try {
        const now = new Date();
        const period2 = isMarketOpen() ? now : getMarketCloseTime();
        const period1 = new Date();
        period1.setDate(period1.getDate() - lookbackDays);

        const queryOptions = { period1, period2, interval };
        const result = await yahooFinance.chart(symbol, queryOptions);

        return result.quotes;
    } catch (error) {
        logger.error(`Error fetching data for ${symbol}: ${error.message}`);
        console.log("err", error)
        throw error;
    }
}


module.exports = { fetchStockData }