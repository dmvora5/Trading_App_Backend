const yahooFinance = require('yahoo-finance2').default;

// Fetch historical stock data
async function fetchStockData(symbol, days = 365) {
    const now = new Date();
    const period2 = Math.floor(now.getTime() / 1000);

    const pastDate = new Date(now);
    pastDate.setDate(now.getDate() - days);
    const period1 = Math.floor(pastDate.getTime() / 1000);

    const queryOptions = { period1, period2, interval: '1d' };

    try {
        const result = await yahooFinance.chart(symbol, queryOptions);

        if (!result || !result.quotes) {
            throw new Error('No quotes found in the response.');
        }

        return result.quotes.map(entry => ({
            date: new Date(entry.date).toLocaleDateString('en-US'),
            high: entry.high,
            low: entry.low,
            open: entry.open,
            close: entry.close,
            volume: entry.volume,
            pivot: 0,        // Initialize pivot detection as 0 (no pivot)
            pointpos: null,  // Initialize point position as null
            fibLevel: null   // Initialize Fibonacci level as null
        }));
    } catch (error) {
        console.error(`Error fetching data for symbol ${symbol}:`, error);
        throw error;
    }
}

// Function to detect pivot points
function detectPivots(data, window = 10) {
    data.forEach((current, i) => {
        if (i < window || i >= data.length - window) return;

        let pivotHigh = true;
        let pivotLow = true;

        for (let j = i - window; j <= i + window; j++) {
            if (data[j].low < current.low) {
                pivotLow = false;
            }
            if (data[j].high > current.high) {
                pivotHigh = false;
            }
        }

        if (pivotHigh && pivotLow) {
            current.pivot = 3; // Both high and low pivot
        } else if (pivotHigh) {
            current.pivot = 1; // Pivot High
        } else if (pivotLow) {
            current.pivot = 2; // Pivot Low
        }
    });

    return data;
}

// Function to calculate Fibonacci levels and classify candles in the last swing
function calculateCustomFibonacciLevelsForLastSwing(data) {
    let lastSwingHighIndex = null;
    let lastSwingLowIndex = null;

    // Identify last swing high and low index
    for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].pivot === 1 && lastSwingHighIndex === null) {
            lastSwingHighIndex = i;
        } else if (data[i].pivot === 2 && lastSwingLowIndex === null) {
            lastSwingLowIndex = i;
        }
        if (lastSwingHighIndex !== null && lastSwingLowIndex !== null) break;
    }

    if (lastSwingHighIndex !== null && lastSwingLowIndex !== null) {
        const swingHigh = data[lastSwingHighIndex].high;
        const swingLow = data[lastSwingLowIndex].low;

        const fibLevels = {
            0: swingLow,
            0.33: swingLow + 0.33 * (swingHigh - swingLow),
            0.66: swingLow + 0.66 * (swingHigh - swingLow),
            1: swingHigh,
        };

        const startIndex = Math.min(lastSwingHighIndex, lastSwingLowIndex);
        const endIndex = Math.max(lastSwingHighIndex, lastSwingLowIndex);

        // Classify candles within the last swing
        for (let i = startIndex; i <= endIndex; i++) {
            const current = data[i];

            if (current.close >= fibLevels[0] && current.close < fibLevels[0.33]) {
                current.fibLevel = '0-0.33';
            } else if (current.close >= fibLevels[0.33] && current.close < fibLevels[0.66]) {
                current.fibLevel = '0.33-0.66';
            } else if (current.close >= fibLevels[0.66] && current.close <= fibLevels[1]) {
                current.fibLevel = '0.66-1';
            } else {
                current.fibLevel = 'Outside';
            }
        }
    }

    return data;
}

// Main function
(async () => {
    const symbol = 'INDUSTOWER.NS';
    const days = 365;

    try {
        let stockData = await fetchStockData(symbol, days);
        stockData = detectPivots(stockData, 10);
        stockData = calculateCustomFibonacciLevelsForLastSwing(stockData);

        // Print the stock data with the Fibonacci levels for the last swing
        console.table(stockData, ['date', 'open', 'high', 'low', 'close', 'volume', 'pivot', 'fibLevel']);
    } catch (error) {
        console.error('Error:', error);
    }
})();
