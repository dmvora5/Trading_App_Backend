const yahooFinance = require('yahoo-finance2').default; // Assuming yahoo-finance is used for fetching stock data

// Function to detect pivots
function isPivot(data, candle, window) {
    if (candle - window < 0 || candle + window >= data.length) {
        return 0;
    }

    let pivotHigh = true, pivotLow = true;
    for (let i = candle - window; i <= candle + window; i++) {
        if (data[candle].low > data[i].low) {
            pivotLow = false;
        }
        if (data[candle].high < data[i].high) {
            pivotHigh = false;
        }
    }
    if (pivotHigh && pivotLow) return 'Pivot High & Low';
    if (pivotHigh) return 'Pivot High';
    if (pivotLow) return 'Pivot Low';
    return null;
}

// Function to collect channel data
function collectChannel(data, candle, backcandles, window) {
    const localData = data.slice(candle - backcandles - window, candle - window);
    const highs = localData.filter((_, i) => isPivot(localData, i, window) === 'Pivot High').map(c => c.high);
    const lows = localData.filter((_, i) => isPivot(localData, i, window) === 'Pivot Low').map(c => c.low);

    if (lows.length >= 3 && highs.length >= 3) {
        const { slope: sl_lows, intercept: interc_lows } = linearRegression(lows);
        const { slope: sl_highs, intercept: interc_highs } = linearRegression(highs);

        return { sl_lows, interc_lows, sl_highs, interc_highs };
    }
    return { sl_lows: 0, interc_lows: 0, sl_highs: 0, interc_highs: 0 };
}

// Linear regression helper function
function linearRegression(values) {
    const n = values.length;
    const x = values.map((_, i) => i);
    const avgX = x.reduce((a, b) => a + b, 0) / n;
    const avgY = values.reduce((a, b) => a + b, 0) / n;

    const slope = x.map((xi, i) => (xi - avgX) * (values[i] - avgY))
                    .reduce((a, b) => a + b, 0) /
                    x.map(xi => (xi - avgX) ** 2).reduce((a, b) => a + b, 0);
    const intercept = avgY - slope * avgX;
    
    return { slope, intercept };
}

// Function to detect breakouts
function isBreakOut(data, candle, backcandles, window) {
    const { sl_lows, interc_lows, sl_highs, interc_highs } = collectChannel(data, candle, backcandles, window);

    const prev_idx = candle - 1;
    const prev = data[prev_idx];
    const curr = data[candle];

    // Check for breakouts
    if (prev.high > sl_lows * prev_idx + interc_lows &&
        prev.close < sl_lows * prev_idx + interc_lows &&
        curr.open < sl_lows * candle + interc_lows &&
        curr.close < sl_lows * candle + interc_lows) {
        return 'Sell';
    }

    if (prev.low < sl_highs * prev_idx + interc_highs &&
        prev.close > sl_highs * prev_idx + interc_highs &&
        curr.open > sl_highs * candle + interc_highs &&
        curr.close > sl_highs * candle + interc_highs) {
        return 'Buy';
    }

    return null;
}

// Fetch stock data and apply strategy
async function fetchStockDataWithSignal(symbol, days = 10) {
    const now = new Date();
    const period2 = Math.floor(now.getTime() / 1000);
    const period1 = Math.floor(now.setDate(now.getDate() - days) / 1000);

    const queryOptions = { period1, period2, interval: '1d' };
    const result = await yahooFinance.chart(symbol, queryOptions);

    const data = result.quotes.map(entry => ({
        date: new Date(entry.date).toLocaleString(), // Include time in the date format
        open: entry.open,
        high: entry.high,
        low: entry.low,
        close: entry.close,
        volume: entry.volume,
        pivot: null,   // Placeholder for pivot
        signal: null   // Placeholder for signal
    }));

    const window = 3;
    const backcandles = 5;

    // Apply pivot and signal detection
    for (let i = window + backcandles; i < data.length; i++) {
        const pivot = isPivot(data, i, window);
        const signal = isBreakOut(data, i, backcandles, window);
        data[i].pivot = pivot;
        data[i].signal = signal;
    }

    console.table(data); // Display data in console.table
}

// Example usage
fetchStockDataWithSignal('BHARATFORG.NS', 1000);
