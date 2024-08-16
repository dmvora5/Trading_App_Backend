
const yahooFinance = require('yahoo-finance2').default;

class StockIndicator {
    static calculateSMA(values, period) {
        const sma = [];
        for (let i = 0; i <= values.length - period; i++) {
            const sum = values.slice(i, i + period).reduce((acc, val) => acc + val, 0);
            sma.push(sum / period);
        }
        return sma;
    }

    static calculateEMA(values, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        let prevEma = this.calculateSMA(values.slice(0, period), period)[0];

        for (let i = period; i < values.length; i++) {
            const currentEma = (values[i] - prevEma) * multiplier + prevEma;
            ema.push(currentEma);
            prevEma = currentEma;
        }

        return ema;
    }

    static calculateVWAP(highs, lows, closes, volumes) {
        const vwap = [];
        let cumulativeVolume = 0;
        let cumulativePV = 0;

        for (let i = 0; i < closes.length; i++) {
            const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
            cumulativeVolume += volumes[i];
            cumulativePV += typicalPrice * volumes[i];
            vwap.push(cumulativePV / cumulativeVolume);
        }

        return vwap;
    }

    static async fetchStockData(symbol, days = 10) {
        const now = new Date();
        const period2 = Math.floor(now.getTime() / 1000);
        const period1 = Math.floor(now.setDate(now.getDate() - days) / 1000);

        const queryOptions = { period1, period2, interval: '5m' };
        const result = await yahooFinance.chart(symbol, queryOptions);

        return result.quotes.map(entry => ({
            date: new Date(entry.date).toLocaleDateString(),
            open: entry.open,
            high: entry.high,
            low: entry.low,
            close: entry.close,
            volume: entry.volume
        }));
    }

    static generateSignals(data, bbMiddle, ema9, vwap) {
        const minLength = Math.min(bbMiddle.length, ema9.length, vwap.length);
        const mappedData = data.slice(-minLength).map((d, i) => ({
            ...d,
            bbMiddle: bbMiddle[i],
            ema9: ema9[i],
            vwap: vwap[i]
        }));

        const signals = mappedData.map((entry, index) => {
            const prevEntry = mappedData[index - 1];
            if (!prevEntry) return null;

            // Debugging output for each value and its context
            console.log(`Date: ${entry.date}, EMA: ${entry.ema9.toFixed(2)}, BB Middle: ${entry.bbMiddle.toFixed(2)}, VWAP: ${entry.vwap.toFixed(2)}`);

            const isBBMiddleInRange = entry.bbMiddle >= 700.00 && entry.bbMiddle <= 700.65;
            const isEMAInRange = entry.ema9 >= 723.47 && entry.ema9 <= 723.67;
            const isVWAPInRange = entry.vwap >= 693.47 && entry.vwap <= 702.52;

            if (isBBMiddleInRange && isEMAInRange && isVWAPInRange) {
                console.log(`Potential Signal Detected on ${entry.date}`);
                return {
                    date: entry.date,
                    signal: 'BUY',
                    bbMiddle: entry.bbMiddle,
                    ema9: entry.ema9,
                    vwap: entry.vwap
                };
            }

            return null;
        }).filter(signal => signal !== null);

        if (signals.length === 0) {
            console.log('No signals detected within the specified ranges.');
        }

        return signals;
    }

    static async analyzeStock(symbol) {
        const data = await this.fetchStockData(symbol);

        const closes = data.map(d => d.close);
        const volumes = data.map(d => d.volume);
        const highs = data.map(d => d.high);
        const lows = data.map(d => d.low);

        const bbMiddle = this.calculateSMA(closes, 20);
        const ema9 = this.calculateEMA(closes, 9);
        const vwap = this.calculateVWAP(highs.slice(19), lows.slice(19), closes.slice(19), volumes.slice(19));

        const signals = this.generateSignals(data, bbMiddle, ema9, vwap);

        console.table(signals);
    }
}

// Run the analysis for a specific stock symbol
const symbol = 'CENTURYPLY.NS'; // Replace with your desired symbol
StockIndicator.analyzeStock(symbol);
