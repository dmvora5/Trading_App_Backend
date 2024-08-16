const yahooFinance = require('yahoo-finance2').default;

// 1. Fetching Stock Data
async function fetchStockData(symbol, days = 300) {
    const now = new Date();
    const period2 = Math.floor(now.getTime() / 1000);
    const period1 = Math.floor(now.setDate(now.getDate() - days) / 1000);

    const queryOptions = { period1, period2, interval: '1d' };
    const result = await yahooFinance.chart(symbol, queryOptions);

    return result.quotes.map(entry => ({
        date: new Date(entry.date).toLocaleDateString(),
        open: parseFloat(entry.open),
        high: parseFloat(entry.high),
        low: parseFloat(entry.low),
        close: parseFloat(entry.close),
        volume: parseFloat(entry.volume)
    }));
}

// 2. Calculating Heikin-Ashi Candles
function calculateHeikinAshi(candles) {
    const heikinAshiCandles = [];

    for (let i = 0; i < candles.length; i++) {
        const prevHaCandle = heikinAshiCandles[i - 1];
        const currentCandle = candles[i];

        const haClose = (currentCandle.open + currentCandle.high + currentCandle.low + currentCandle.close) / 4;

        const haOpen = prevHaCandle 
            ? (prevHaCandle.open + prevHaCandle.close) / 2 
            : (currentCandle.open + currentCandle.close) / 2;

        const haHigh = Math.max(currentCandle.high, haOpen, haClose);
        const haLow = Math.min(currentCandle.low, haOpen, haClose);

        heikinAshiCandles.push({
            date: currentCandle.date,
            open: parseFloat(haOpen.toFixed(6)),
            high: parseFloat(haHigh.toFixed(6)),
            low: parseFloat(haLow.toFixed(6)),
            close: parseFloat(haClose.toFixed(6)),
            volume: currentCandle.volume
        });
    }

    return heikinAshiCandles;
}

// 3. Detecting Trade Signals
function detectTradeSignals(heikinAshiCandles) {
    const signals = [];

    for (let i = 1; i < heikinAshiCandles.length; i++) {
        const prevHaCandle = heikinAshiCandles[i - 1];
        const currentCandle = heikinAshiCandles[i];

        const currentCandleSize = currentCandle.high - currentCandle.low;
        const previousCandleSizes = heikinAshiCandles.slice(Math.max(0, i - 10), i).map(candle => candle.high - candle.low);
        const avgPreviousCandleSize = previousCandleSizes.length 
            ? previousCandleSizes.reduce((acc, size) => acc + size, 0) / previousCandleSizes.length
            : currentCandleSize;

        const sizeThreshold = 1.5; // Stricter threshold

        let signal = null;

        if (currentCandleSize <= avgPreviousCandleSize * sizeThreshold) {
            const prevBody = Math.abs(prevHaCandle.close - prevHaCandle.open);
            const isDoji = prevBody < ((prevHaCandle.high - prevHaCandle.low) * 0.2);

            if (isDoji) {
                if (currentCandle.close > currentCandle.open && currentCandle.open === currentCandle.low) {
                    signal = 'Buy';
                } else if (currentCandle.close < currentCandle.open && currentCandle.open === currentCandle.high) {
                    signal = 'Sell';
                }
            }
        }

        signals.push({
            ...currentCandle,
            signal: signal
        });
    }

    return signals;
}

// 4. Main Execution Logic
(async () => {
    const symbol = 'EVEREADY.NS'; // Example symbol
    const days = 300; // Number of days of historical data

    const stockData = await fetchStockData(symbol, days);
    const heikinAshiData = calculateHeikinAshi(stockData);
    const signals = detectTradeSignals(heikinAshiData);
    
    console.table(signals);
})();
