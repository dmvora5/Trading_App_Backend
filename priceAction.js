const yahooFinance = require('yahoo-finance2').default;

// Fetch historical stock data
async function fetchStockData(symbol, days = 50) {
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
            type: null,        // Initialize the type as null
            support: null,     // Initialize support as null
            resistance: null   // Initialize resistance as null
        }));
    } catch (error) {
        console.error(`Error fetching data for symbol ${symbol}:`, error);
        throw error;
    }
}

// Function to detect major swing highs and lows, along with support and resistance levels
function detectClearSwings(data, lookback = 5, minSwingSize = 0.02) {
    for (let i = lookback; i < data.length - lookback; i++) {
        const current = data[i];
        let isSwingHigh = true;
        let isSwingLow = true;

        // Check for swing high
        for (let j = 1; j <= lookback; j++) {
            if (data[i - j].high >= current.high || data[i + j].high >= current.high) {
                isSwingHigh = false;
            }
        }

        // Check for swing low
        for (let j = 1; j <= lookback; j++) {
            if (data[i - j].low <= current.low || data[i + j].low <= current.low) {
                isSwingLow = false;
            }
        }

        // Ensure the swing is significant enough
        if (isSwingHigh && ((current.high - data[i - lookback].low) / data[i - lookback].low) < minSwingSize) {
            isSwingHigh = false;
        }

        if (isSwingLow && ((data[i - lookback].high - current.low) / current.low) < minSwingSize) {
            isSwingLow = false;
        }

        if (isSwingHigh) {
            current.type = 'Swing High';
            current.resistance = current.high; // Mark as resistance
        } else if (isSwingLow) {
            current.type = 'Swing Low';
            current.support = current.low;     // Mark as support
        } else {
            current.type = null;
        }
    }

    return data;
}

// Main function
(async () => {
    const symbol = 'INDIGO.NS';
    const days = 365;

    try {
        const stockData = await fetchStockData(symbol, days);
        const swingPoints = detectClearSwings(stockData, 5, 0.03); // Adjusted parameters for clarity

        console.table(swingPoints, ['date', 'type', 'high', 'low', 'open', 'close', 'volume', 'support', 'resistance']);
    } catch (error) {
        console.error('Error:', error);
    }
})();
