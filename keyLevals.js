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
            breakout: null,  // Initialize breakout signal as null
            pattern: null    // Initialize pattern detection as null
        }));
    } catch (error) {
        console.error(`Error fetching data for symbol ${symbol}:`, error);
        throw error;
    }
}

// Function to detect pivot points (swing highs and lows)
function detectPivots(data, window = 3) {
    data.forEach((current, i) => {
        if (i < window || i >= data.length - window) return;

        let isSwingHigh = true;
        let isSwingLow = true;

        for (let j = 1; j <= window; j++) {
            if (data[i - j].high >= current.high || data[i + j].high >= current.high) {
                isSwingHigh = false;
            }
            if (data[i - j].low <= current.low || data[i + j].low <= current.low) {
                isSwingLow = false;
            }
        }

        if (isSwingHigh) {
            current.pivot = 1; // Pivot High
        } else if (isSwingLow) {
            current.pivot = 2; // Pivot Low
        }
    });

    return data;
}

// Function to calculate point positions for plotting
function calculatePointPos(data) {
    data.forEach(current => {
        if (current.pivot === 1) {
            current.pointpos = current.high + 0.001; // Point position above the high
        } else if (current.pivot === 2) {
            current.pointpos = current.low - 0.001; // Point position below the low
        } else {
            current.pointpos = null; // No pivot, no point position
        }
    });

    return data;
}

// Function to detect breakout signals, parameterized by number of consecutive candles
function detectBreakouts(data, consecutiveCandles = 2) {
    let lastResistance = null;
    let lastSupport = null;
    let breakoutOccurred = false; // Flag to indicate a breakout has occurred

    data.forEach((current, i) => {
        if (current.pivot === 1) {
            lastResistance = current.high; // Update resistance
            breakoutOccurred = false; // Reset after new swing high
        } else if (current.pivot === 2) {
            lastSupport = current.low; // Update support
            breakoutOccurred = false; // Reset after new swing low
        }

        if (!breakoutOccurred && lastResistance !== null && i >= consecutiveCandles) {
            let breakoutHigh = true;
            for (let j = 0; j < consecutiveCandles; j++) {
                if (data[i - j].close <= lastResistance) {
                    breakoutHigh = false;
                    break;
                }
            }
            if (breakoutHigh) {
                current.breakout = 'Breakout High';
                breakoutOccurred = true; // Mark that a breakout has occurred
            }
        }

        if (!breakoutOccurred && lastSupport !== null && i >= consecutiveCandles) {
            let breakoutLow = true;
            for (let j = 0; j < consecutiveCandles; j++) {
                if (data[i - j].close >= lastSupport) {
                    breakoutLow = false;
                    break;
                }
            }
            if (breakoutLow) {
                current.breakout = 'Breakout Low';
                breakoutOccurred = true; // Mark that a breakout has occurred
            }
        }
    });

    return data;
}

// Function to validate if a candle's body is at least 75% of its total range
function isValidBodySize(candle) {
    const bodySize = Math.abs(candle.close - candle.open);
    const totalRange = candle.high - candle.low;
    return bodySize / totalRange >= 0.75;
}

// Function to detect valid Rally-Base-Rally, Drop-Base-Drop, Rally-Base-Drop, Drop-Base-Rally patterns
function detectPricePatterns(data, baseRange = 0.002) {
    for (let i = 2; i < data.length - 2; i++) {
        const firstCandle = data[i - 1];
        const baseCandle1 = data[i];
        const nextCandle = data[i + 1];
        const nextNextCandle = data[i + 2];

        const isRally = (candle) => candle.close > candle.open && isValidBodySize(candle);
        const isDrop = (candle) => candle.close < candle.open && isValidBodySize(candle);
        const isBase = (candle) => {
            const candleSize = candle.high - candle.low;
            return candleSize < Math.max(firstCandle.high - firstCandle.low, nextCandle.high - nextCandle.low) && 
                   Math.abs(candle.close - candle.open) / candle.open < baseRange;
        };
        const candleSize = (candle) => candle.high - candle.low;

        // Check for valid pattern with one base candle
        if (isRally(firstCandle) && isBase(baseCandle1) && isRally(nextCandle)) {
            if (candleSize(nextCandle) > candleSize(baseCandle1)) {
                firstCandle.pattern = 'Rally';
                baseCandle1.pattern = 'Base';
                nextCandle.pattern = 'Rally';
            }
        } else if (isDrop(firstCandle) && isBase(baseCandle1) && isDrop(nextCandle)) {
            if (candleSize(nextCandle) > candleSize(baseCandle1)) {
                firstCandle.pattern = 'Drop';
                baseCandle1.pattern = 'Base';
                nextCandle.pattern = 'Drop';
            }
        } else if (isRally(firstCandle) && isBase(baseCandle1) && isDrop(nextCandle)) {
            if (candleSize(nextCandle) > candleSize(baseCandle1)) {
                firstCandle.pattern = 'Rally';
                baseCandle1.pattern = 'Base';
                nextCandle.pattern = 'Drop';
            }
        } else if (isDrop(firstCandle) && isBase(baseCandle1) && isRally(nextCandle)) {
            if (candleSize(nextCandle) > candleSize(baseCandle1)) {
                firstCandle.pattern = 'Drop';
                baseCandle1.pattern = 'Base';
                nextCandle.pattern = 'Rally';
            }
        }

        // Check for valid pattern with two base candles
        if (isRally(firstCandle) && isBase(baseCandle1) && isBase(nextCandle) && isRally(nextNextCandle)) {
            if (candleSize(nextNextCandle) > candleSize(baseCandle1) && candleSize(nextNextCandle) > candleSize(nextCandle)) {
                firstCandle.pattern = 'Rally';
                baseCandle1.pattern = 'Base';
                nextCandle.pattern = 'Base';
                nextNextCandle.pattern = 'Rally';
            }
        } else if (isDrop(firstCandle) && isBase(baseCandle1) && isBase(nextCandle) && isDrop(nextNextCandle)) {
            if (candleSize(nextNextCandle) > candleSize(baseCandle1) && candleSize(nextNextCandle) > candleSize(nextCandle)) {
                firstCandle.pattern = 'Drop';
                baseCandle1.pattern = 'Base';
                nextCandle.pattern = 'Base';
                nextNextCandle.pattern = 'Drop';
            }
        } else if (isRally(firstCandle) && isBase(baseCandle1) && isBase(nextCandle) && isDrop(nextNextCandle)) {
            if (candleSize(nextNextCandle) > candleSize(baseCandle1) && candleSize(nextNextCandle) > candleSize(nextCandle)) {
                firstCandle.pattern = 'Rally';
                baseCandle1.pattern = 'Base';
                nextCandle.pattern = 'Base';
                nextNextCandle.pattern = 'Drop';
            }
        } else if (isDrop(firstCandle) && isBase(baseCandle1) && isBase(nextCandle) && isRally(nextNextCandle)) {
            if (candleSize(nextNextCandle) > candleSize(baseCandle1) && candleSize(nextNextCandle) > candleSize(nextCandle)) {
                firstCandle.pattern = 'Drop';
                baseCandle1.pattern = 'Base';
                nextCandle.pattern = 'Base';
                nextNextCandle.pattern = 'Rally';
            }
        }
    }

    return data;
}

// Main function
(async () => {
    const symbol = 'INDIGO.NS';
    const days = 365;
    const consecutiveCandles = 2; // Parameter to specify the number of consecutive candles

    try {
        let stockData = await fetchStockData(symbol, days);
        stockData = detectPivots(stockData, 3); // Adjust window size for better swing detection
        stockData = calculatePointPos(stockData);
        stockData = detectBreakouts(stockData, consecutiveCandles);
        stockData = detectPricePatterns(stockData); // Detect RBR, DBD, RBD, DBR patterns

        // Print the stock data with breakouts and patterns
        console.table(stockData, ['date', 'open', 'high', 'low', 'close', 'volume', 'pivot', 'pointpos', 'breakout', 'pattern']);
    } catch (error) {
        console.error('Error:', error);
    }
})();
