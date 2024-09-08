const yahooFinance = require('yahoo-finance2').default;
const ta = require('technicalindicators');

// Stock Data Fetch Function
async function fetchStockData(symbol, days = 10) {
    const now = new Date();
    const period2 = Math.floor(now.getTime() / 1000);
    const period1 = Math.floor(now.setDate(now.getDate() - days) / 1000);

    const queryOptions = { period1, period2, interval: '5m' };
    const result = await yahooFinance.chart(symbol, queryOptions);

    return result.quotes.map(entry => ({
        date: new Date(entry.date).toLocaleString(), // Include time in the date format
        open: entry.open,
        high: entry.high,
        low: entry.low,
        close: entry.close,
        volume: entry.volume
    }));
}

// Strategy Class
class Strategy {
    constructor(stockData, rsiThresholdLow = 30, rsiThresholdHigh = 70, bbWidthThreshold = 0.0015, atrLength = 14) {
        this.stockData = stockData;
        this.rsiThresholdLow = rsiThresholdLow;
        this.rsiThresholdHigh = rsiThresholdHigh;
        this.bbWidthThreshold = bbWidthThreshold;
        this.atrLength = atrLength;
    }

    // Function to calculate Bollinger Bands
    calculateBollingerBands() {
        const inputBB = {
            period: 30,
            values: this.stockData.map(data => data.close),
            stdDev: 2
        };
        const bb = ta.bollingerbands(inputBB);

        // Map Bollinger Bands values back to stock data
        this.stockData.forEach((data, index) => {
            if (bb[index]) {
                data.bbl = bb[index].lower;
                data.bbm = bb[index].middle;
                data.bbh = bb[index].upper;
                data.bbWidth = (data.bbh - data.bbl) / data.bbm;
            } else {
                data.bbl = data.bbm = data.bbh = data.bbWidth = null;
            }
        });
    }

    // Function to calculate RSI
    calculateRSI() {
        const inputRSI = {
            values: this.stockData.map(data => data.close),
            period: 14
        };
        const rsi = ta.rsi(inputRSI);

        // Map RSI values back to stock data
        this.stockData.forEach((data, index) => {
            data.rsi = rsi[index] || null;
        });
    }

    // Function to calculate ATR (Average True Range)
    calculateATR() {
        const inputATR = {
            high: this.stockData.map(data => data.high),
            low: this.stockData.map(data => data.low),
            close: this.stockData.map(data => data.close),
            period: this.atrLength
        };
        const atr = ta.atr(inputATR);

        // Map ATR values back to stock data
        this.stockData.forEach((data, index) => {
            data.atr = atr[index] || null;
        });
    }

    // Apply strategy signals
    applyTotalSignal() {
        this.stockData.forEach((data, index) => {
            if (index === 0) {
                data.totalSignal = 0; // No signal for the first entry
                return;
            }

            const prevData = this.stockData[index - 1];

            // Debugging logs to see Bollinger Bands, RSI, and close prices
            console.log(`Date: ${data.date}`);
            console.log(`Prev Close: ${prevData.close}, Prev BBL: ${prevData.bbl}, Prev RSI: ${prevData.rsi}`);
            console.log(`Current Close: ${data.close}, BB Width: ${data.bbWidth}`);

            // Buy signal conditions
            const prevCandleClosesBelowBB = prevData.close < prevData.bbl;
            const prevRSIBelowThreshold = prevData.rsi < this.rsiThresholdLow;
            const currentCandleClosesAbovePrevHigh = data.close > prevData.high;
            const bbWidthGreaterThanThreshold = data.bbWidth > this.bbWidthThreshold;

            if (prevCandleClosesBelowBB && prevRSIBelowThreshold && currentCandleClosesAbovePrevHigh && bbWidthGreaterThanThreshold) {
                console.log("Buy Signal Detected!");
                data.totalSignal = 2; // Buy signal
            }

            // Sell signal conditions
            const prevCandleClosesAboveBB = prevData.close > prevData.bbh;
            const prevRSIAboveThreshold = prevData.rsi > this.rsiThresholdHigh;
            const currentCandleClosesBelowPrevLow = data.close < prevData.low;

            if (prevCandleClosesAboveBB && prevRSIAboveThreshold && currentCandleClosesBelowPrevLow && bbWidthGreaterThanThreshold) {
                console.log("Sell Signal Detected!");
                data.totalSignal = 1; // Sell signal
            }

            // If no signal, set it to 0
            if (!data.totalSignal) {
                data.totalSignal = 0; // No signal
            }
        });
    }

    // Execute the strategy and return signal candles
    executeStrategy() {
        this.calculateBollingerBands();
        this.calculateRSI();
        this.calculateATR();
        this.applyTotalSignal();

        // Filter only candles with a signal and return them with date
        return this.stockData
            .filter(data => data.totalSignal !== 0) // Filter for buy/sell signals
            .map(data => ({
                date: data.date,
                signal: data.totalSignal === 2 ? 'Buy' : 'Sell',
                close: data.close // Including the close price for reference
            }));
    }
}

// Example usage
(async () => {
    const stockData = await fetchStockData('SBIN.NS', 59); // Fetch stock data
    const strategy = new Strategy(stockData);
    const signals = strategy.executeStrategy(); // Execute strategy

    // Log only the signal candles with date and signal type
    signals.forEach(signal => {
        console.log(`Date: ${signal.date}, Signal: ${signal.signal}, Close Price: ${signal.close}`);
    });
})();
