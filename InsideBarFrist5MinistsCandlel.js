require('dotenv').config();
const { RSI, SMA } = require('technicalindicators');
const StocksSymbol = require('./src/Models/StocksSymbol');
const yahooFinance = require('yahoo-finance2').default;
const db = require('./src/Config/DatabaseConnect');



// Function to fetch 15-minute interval stock data
async function getFifteenMinutesData(symbol) {
    try {
        const now = new Date();
        now.setHours(9, 15, 0, 0);

        const now2 = new Date();
        now2.setHours(9, 26, 30, 0)
        const period2 = now2;
        const period1 = now;


        const queryOptions = { period1, period2, interval: '5m' };
        const result = await yahooFinance.chart(symbol, queryOptions);

        return result.quotes.map(entry => ({
            date: new Date(entry.date).toLocaleString(), // Ensure correct timestamp conversion
            open: entry.open,
            high: entry.high,
            low: entry.low,
            close: entry.close,
            volume: entry.volume
        }));
    } catch (error) {
        console.error(error);
        return [];
    }
}

db.once('open', async () => {
    (async () => {
        const stocks = await StocksSymbol.find({ indices: "NIFTY200" }).lean();
        const stocksSymbols = stocks.map(stock => stock.symbol);
        for (const symbol of stocksSymbols) {
            const stockData = await getFifteenMinutesData(symbol);
            if (stockData.length >= 2) {
                const firstCandle = stockData[0];
                const secondCandle = stockData[1];

                console.table(stockData);

                const isInsideBar = secondCandle.high < firstCandle.high && secondCandle.low > firstCandle.low;

                if (isInsideBar) {
                    console.log(symbol)
                } else {
                    //   console.log("The stock does not exhibit an inside bar pattern in the first two 5-minute candles.");
                }
            } else {
                // console.log("Not enough data to determine the inside bar pattern.");
            }
        }
    })();
});
