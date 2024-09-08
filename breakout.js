const yahooFinance = require('yahoo-finance2').default; // Assuming you are using yahoo-finance2 for stock data

// Detect pivot points for highs and lows
function isPivot(candles, candleIndex, window) {
    if (candleIndex - window < 0 || candleIndex + window >= candles.length) {
        return 0;
    }

    let pivotHigh = 1;
    let pivotLow = 2;

    for (let i = candleIndex - window; i <= candleIndex + window; i++) {
        if (candles[candleIndex].low > candles[i].low) {
            pivotLow = 0;
        }
        if (candles[candleIndex].high < candles[i].high) {
            pivotHigh = 0;
        }
    }

    if (pivotHigh && pivotLow) {
        return 3; // Both high and low pivot
    } else if (pivotHigh) {
        return 1; // Pivot high
    } else if (pivotLow) {
        return 2; // Pivot low
    }
    return 0; // No pivot
}

// Collect the channel by calculating regression on pivots
function collectChannel(candles, candleIndex, backcandles, window) {
    const localCandles = candles.slice(candleIndex - backcandles - window, candleIndex - window);

    const highs = localCandles.filter((_, idx) => isPivot(localCandles, idx, window) === 1).map(c => c.high);
    const idxHighs = localCandles.filter((_, idx) => isPivot(localCandles, idx, window) === 1).map((_, idx) => idx);

    const lows = localCandles.filter((_, idx) => isPivot(localCandles, idx, window) === 2).map(c => c.low);
    const idxLows = localCandles.filter((_, idx) => isPivot(localCandles, idx, window) === 2).map((_, idx) => idx);

    if (highs.length >= 2 && lows.length >= 2 && highs.length + lows.length >= 5) {
        const slopeLow = linearRegression(idxLows, lows);
        const slopeHigh = linearRegression(idxHighs, highs);

        return { slopeLow, slopeHigh };
    }

    return { slopeLow: null, slopeHigh: null };
}

// Simple linear regression to calculate slope and intercept
function linearRegression(x, y) {
    const n = x.length;
    const xSum = x.reduce((sum, xi) => sum + xi, 0);
    const ySum = y.reduce((sum, yi) => sum + yi, 0);
    const xySum = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const xSquareSum = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * xySum - xSum * ySum) / (n * xSquareSum - xSum * xSum);
    const intercept = (ySum - slope * xSum) / n;

    return { slope, intercept };
}

// Detect breakout when a candle closes outside the defined channel
function isBreakOut(candles, candleIndex, backcandles, window) {
    const { slopeLow, slopeHigh } = collectChannel(candles, candleIndex, backcandles, window);

    if (!slopeLow || !slopeHigh) {
        return null; // No channel
    }

    const currCandle = candles[candleIndex];
    const lowerLine = slopeLow.slope * candleIndex + slopeLow.intercept;
    const upperLine = slopeHigh.slope * candleIndex + slopeHigh.intercept;

    // Signal based on candle closing outside the channel
    if (currCandle.close < lowerLine) {
        return 'Breakout Low'; // Candle closed below the lower channel line
    } else if (currCandle.close > upperLine) {
        return 'Breakout High'; // Candle closed above the upper channel line
    }

    return null; // No breakout
}

async function fetchStockData(symbol, days = 10) {
    const now = new Date();
    const period2 = Math.floor(now.getTime() / 1000);
    const period1 = Math.floor(now.setDate(now.getDate() - days) / 1000);

    const queryOptions = { period1, period2, interval: '5m' };
    const result = await yahooFinance.chart(symbol, queryOptions);

    const candles = result.quotes.map(entry => ({
        date: new Date(entry.date).toLocaleString(),
        open: entry.open,
        high: entry.high,
        low: entry.low,
        close: entry.close,
        volume: entry.volume,
        signal: null,  // New column for signal
        pivot: null    // New column for pivot
    }));

    const backcandles = 40;
    const window = 4;
    let lastSignalIndex = -1;  // Track the last signal's candle index

    candles.forEach((candle, idx) => {
        if (idx >= backcandles + window) {
            // Check if the price is inside the channel, to reset the signal detection
            const signal = isBreakOut(candles, idx, backcandles, window);

            // If we are outside the channel and haven't seen a breakout recently, flag this candle
            if (signal && (lastSignalIndex === -1 || idx - lastSignalIndex > 1)) {
                candle.signal = signal;
                lastSignalIndex = idx;  // Remember the candle where the signal occurred
            } else {
                candle.signal = null; // No consecutive signal or inside channel
            }

            // Check for pivot points (optional, can be removed if not needed)
            const pivot = isPivot(candles, idx, window);
            candle.pivot = pivot === 1 ? 'Pivot High' : pivot === 2 ? 'Pivot Low' : pivot === 3 ? 'Pivot Both' : null;
        }
    });

    console.table(candles, ['date', 'open', 'high', 'low', 'close', 'volume', 'signal', 'pivot']);
    return candles;
}

// Example call
fetchStockData('BHARATFORG.NS', 10).then(data => {
    // Process the data as needed
});
