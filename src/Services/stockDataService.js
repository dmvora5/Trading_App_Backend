const { isMarketOpen, getMarketCloseTime, getYesterdayAtTime } = require('../Utils');
const logger = require('../Utils/logger');

const yahooFinance = require('yahoo-finance2').default;




async function fetchStockData({ symbol, interval, lookbackDays }) {

    console.log('interval', interval)
    try {
        // const now = new Date();
        // const period2 = isMarketOpen() ? now : getMarketCloseTime();
        // const period1 = new Date();
        // period1.setDate(period1.getDate() - lookbackDays);

        const now = getYesterdayAtTime(15, 30);
        const period2 = now;
        const period1 = new Date();
        period1.setDate(period1.getDate() - lookbackDays);

        console.log('period2', period2.toLocaleString())
        console.log('period1', period1.toLocaleString())


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