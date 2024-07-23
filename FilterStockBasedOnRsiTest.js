require('dotenv').config();
const { RSI, SMA } = require('technicalindicators');
const StocksSymbol = require('./src/Models/StocksSymbol');
const yahooFinance = require('yahoo-finance2').default;
const db = require('./src/Config/DatabaseConnect');

class TradingIndicators {
    constructor(config = {}) {
        const defaultConfig = {
            rsiLength: 25,
            maLength: 150,
            maType: 'SMA',
        };

        this.config = { ...defaultConfig, ...config };
    }

    // Utility function to calculate moving average
    calculateMA(source, length) {
        return SMA.calculate({ period: length, values: source });
    }

    // Function to calculate RSI
    calculateRSI(source, length) {
        return RSI.calculate({ period: length, values: source });
    }

    // Function to extract OHLC4 prices from the data
    extractOHLC4Prices(data) {
        return data.map(item => (item.open + item.high + item.low + item.close) / 4);
    }

    // Function to check if RSI has not touched or crossed MA for a given period
    checkRsiNeverTouchesMa(rsiValues, maValues, period) {
        const minLength = Math.min(rsiValues.length, maValues.length);
        const alignedRsi = rsiValues.slice(-minLength);
        const alignedMa = maValues.slice(-minLength);

        if (alignedRsi.length < period) {
            return false;
        }

        let initiallyAbove = alignedRsi[alignedRsi.length - period] > alignedMa[alignedMa.length - period];
        
        for (let i = alignedRsi.length - period + 1; i < alignedRsi.length; i++) {
            if (initiallyAbove) {
                if (alignedRsi[i] <= alignedMa[i]) {
                    return false;
                }
            } else {
                if (alignedRsi[i] >= alignedMa[i]) {
                    return false;
                }
            }
        }
        return true;
    }

    // Function to filter stocks based on RSI-MA touch condition
    filterStocksBasedOnRsiMaTouchCondition(data) {
        const { rsiLength, maLength } = this.config;
        const ohlc4Prices = this.extractOHLC4Prices(data);

        // Calculate RSI and RSI-based Moving Average
        const rsi = this.calculateRSI(ohlc4Prices, rsiLength);
        const rsiMA = this.calculateMA(rsi, maLength);

        // Check if RSI never touches MA for the last 30 candles
        const neverTouches = this.checkRsiNeverTouchesMa(rsi, rsiMA, 30);

        return neverTouches ? data : [];
    }
}

// Function to fetch 15-minute interval stock data
async function getFifteenMinutesData(symbol) {
    try {
        const now = new Date();
        const period2 = now;
        const period1 = new Date();
        period1.setDate(period1.getDate() - 25);

        const queryOptions = { period1, period2, interval: '15m' };
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
            const tradingIndicators = new TradingIndicators({ checkCandles: 2 });
            const filteredData = tradingIndicators.filterStocksBasedOnRsiMaTouchCondition(stockData);
            
            if (filteredData.length > 0) {
                console.log('symbol', symbol);
                // console.table(filteredData);
            } else {
                // console.log(`No stocks meet the RSI-MA touch condition for the last 30 candles for symbol ${symbol}.`);
            }
        }
    })();
});
