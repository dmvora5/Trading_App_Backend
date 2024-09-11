const yahooFinance = require('yahoo-finance2').default;

/**
 * Fetches historical stock data for a given symbol and number of days.
 * @param {string} symbol - The stock symbol to fetch data for.
 * @param {number} days - The number of past days to retrieve data for.
 * @returns {Promise<Array>} - A promise that resolves to an array of stock data objects.
 */
async function fetchStockData(symbol, days = 10) {
    const now = new Date();
    const period2 = Math.floor(now.getTime() / 1000);
    
    const pastDate = new Date(now);
    pastDate.setDate(now.getDate() - days);
    const period1 = Math.floor(pastDate.getTime() / 1000);

    const queryOptions = { period1, period2, interval: '1h' };
    
    try {
        const result = await yahooFinance.chart(symbol, queryOptions);
        
        if (!result || !result.quotes) {
            throw new Error('No quotes found in the response.');
        }

        return result.quotes.map(entry => ({
            date: new Date(entry.date).getTime(),  // Store date as timestamp for faster comparisons
            high: entry.high,
            low: entry.low,
            open: entry.open,
            close: entry.close,
            volume: entry.volume
        }));
    } catch (error) {
        console.error(`Error fetching data for symbol ${symbol}:`, error);
        throw error;
    }
}

/**
 * Detects pivot fractals in the stock data based on the high and low prices.
 * @param {Array} data - The array of stock data objects.
 * @param {number} pivotStrength - The number of candles to consider on each side for pivot detection.
 * @param {string} type - The type of fractal calculation ('hl' for both high and low).
 * @returns {Array} - The processed array with fractal data.
 */
function detectPivotFractals(data, pivotStrength = 5, type = 'hl') {
    return data.map((current, index) => {
        if (index < pivotStrength || index >= data.length - pivotStrength) {
            return { ...current, fractal: null }; // No fractals for early/late candles
        }

        const previousCandles = data.slice(index - pivotStrength, index);
        const nextCandles = data.slice(index + 1, index + 1 + pivotStrength);

        const isFractalUp = current.high >= Math.max(...previousCandles.map(c => c.high)) &&
            current.high > Math.max(...nextCandles.map(c => c.high));

        const isFractalDown = current.low <= Math.min(...previousCandles.map(c => c.low)) &&
            current.low < Math.min(...nextCandles.map(c => c.low));

        let fractal = null;

        if (type === 'hl') {
            if (isFractalUp && isFractalDown) {
                fractal = { type: 'both', value: { high: current.high, low: current.low } };
            } else if (isFractalUp) {
                fractal = { type: 'up', value: current.high };
            } else if (isFractalDown) {
                fractal = { type: 'down', value: current.low };
            }
        }

        return { ...current, fractal };
    });
}

/**
 * Detects FVGs (Fair Value Gaps) across all candles using fractals logic for highs and lows.
 * @param {Array} data - The array of stock data objects with identified fractals.
 * @param {number} pivotStrength - The number of candles to consider on each side for FVG detection.
 * @returns {Object} - The updated FVGs and data with FVG information.
 */
function detectFVGs(data, pivotStrength = 5) {
    let fractals = [];
    let allFVGs = [];
    const fvgInfo = [];

    data.forEach((current, index, array) => {
        if (index < pivotStrength || index >= array.length - pivotStrength) {
            fvgInfo.push({ current, fvgRange: null, breakout: null });
            return;
        }

        const prevCandles = array.slice(index - pivotStrength, index);
        const nextCandles = array.slice(index + 1, index + 1 + pivotStrength);

        const isFractalUp = current.high >= Math.max(...prevCandles.map(c => c.high)) &&
            current.high > Math.max(...nextCandles.map(c => c.high));

        const isFractalDown = current.low <= Math.min(...prevCandles.map(c => c.low)) &&
            current.low < Math.min(...nextCandles.map(c => c.low));

        let fvgRange = null;
        let breakout = null;

        if (fractals.length > 0) {
            fractals.forEach((fractal, fractalIndex) => {
                if (
                    (fractal.fractal.type === 'up' && current.close > fractal.fractal.value.high) ||
                    (fractal.fractal.type === 'down' && current.close < fractal.fractal.value.low)
                ) {
                    const prevCandle = array[index - 1];
                    fvgRange = fractal.fractal.type === 'up'
                        ? `${current.low} - ${prevCandle.high}`
                        : `${prevCandle.low} - ${current.high}`;
                    
                    breakout = "yes";

                    allFVGs.push({
                        type: fractal.fractal.type,
                        range: fvgRange,
                        low: fractal.fractal.type === 'up' ? current.low : prevCandle.low,
                        high: fractal.fractal.type === 'up' ? prevCandle.high : current.high,
                        valid: "valid",
                        formedAt: current.date
                    });

                    fractals.splice(fractalIndex, 1); // Remove the used fractal
                }
            });
        }

        if (isFractalUp || isFractalDown) {
            const newFractal = isFractalUp
                ? { type: 'up', value: { high: current.high } }
                : { type: 'down', value: { low: current.low } };
            fractals.push({ ...current, fractal: newFractal, index });
        }

        fvgInfo.push({ current, fvgRange, breakout });
    });

    return { allFVGs, fvgInfo };
}

/**
 * The main function that orchestrates fetching data, detecting pivot fractals, FVG zones, and displaying the results.
 */
async function main() {
    try {
        const symbol = 'SYNGENE.NS';
        const days = 30;
        const pivotStrength = 5;

        let stockData = await fetchStockData(symbol, days);

        stockData = detectPivotFractals(stockData, pivotStrength);

        const { allFVGs, fvgInfo } = detectFVGs(stockData, pivotStrength);

        const finalData = fvgInfo.map(info => {
            const { current, fvgRange, breakout } = info;
            return {
                date: new Date(current.date).toLocaleString(),
                open: current.open,
                high: current.high,
                low: current.low,
                close: current.close,
                volume: current.volume,
                fractalType: current.fractal ? current.fractal.type : null,
                // fractalValue: current.fractal ? JSON.stringify(current.fractal.value) : null,
                fvgRange,
                breakout
            };
        });

        console.table(finalData);
    } catch (error) {
        console.error('An error occurred during processing:', error);
    }
}

main();
