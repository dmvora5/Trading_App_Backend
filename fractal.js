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

    const queryOptions = { period1, period2, interval: '5m' };
    
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
 * @param {number} lookback - The number of candles to consider on each side for pivot detection.
 * @returns {Array} - The processed array with an added 'pivot' property indicating 'up' or 'down' fractal.
 */
function detectPivotFractals(data, lookback = 5) {
    return data.map((current, index, array) => {
        if (index < lookback || index >= array.length - lookback) {
            return { ...current };
        }

        const previousHighs = array.slice(index - lookback, index).map(candle => candle.high);
        const nextHighs = array.slice(index + 1, index + 1 + lookback).map(candle => candle.high);
        const previousLows = array.slice(index - lookback, index).map(candle => candle.low);
        const nextLows = array.slice(index + 1, index + 1 + lookback).map(candle => candle.low);

        const pivot = (current.high >= Math.max(...previousHighs, ...nextHighs))
            ? 'up'
            : (current.low <= Math.min(...previousLows, ...nextLows)) ? 'down' : null;

        return { ...current, pivot };
    });
}

/**
 * Validates existing FVGs based on the subsequent candle data after the FVG was formed.
 * @param {Array} allFVGs - Array of all detected FVGs.
 * @param {Array} candles - The array of all candle data.
 * @returns {Array} - Updated FVGs with validity status.
 */
function validateFVGs(allFVGs, candles) {
    return allFVGs.map(fvg => {
        const formedAtIndex = candles.findIndex(candle => candle.date === fvg.formedAt);
        let isValid = "valid";

        for (let i = formedAtIndex + 1; i < candles.length; i++) {
            const currentCandle = candles[i];

            if (
                (fvg.type === 'up' && currentCandle.close < fvg.low) ||  
                (fvg.type === 'down' && currentCandle.close > fvg.high) 
            ) {
                isValid = "invalid";
                break;  
            }
        }

        return { ...fvg, valid: isValid };
    });
}

/**
 * Attaches FVG information to the current candle data.
 * @param {Array} allFVGs - Array of all detected FVGs.
 * @param {Object} current - The current candle data.
 * @param {string|null} fvgRange - The FVG range for the current candle.
 * @param {string|null} breakout - Indicates if there was a breakout.
 * @returns {Object} - Current candle data with attached FVG information.
 */
function attachFVGInfo(allFVGs, current, fvgRange, breakout) {
    const validFVG = allFVGs.find(fvg => fvg.range === fvgRange);
    return {
        ...current,
        fvgRange: validFVG ? validFVG.range : null,
        breakout,
        fvgValid: validFVG ? validFVG.valid : null
    };
}

/**
 * Checks if the current price is within 0.5% of any valid FVG.
 * @param {Array} validFVGs - Array of valid FVGs.
 * @param {number} currentPrice - The current price to check.
 * @returns {boolean} - Returns true if within 0.5% of any FVG, otherwise false.
 */
function checkPriceNearFVG(validFVGs, currentPrice) {
    return validFVGs.some(fvg => {
        const lowerBound = fvg.low * 0.995; // 0.5% below the lower bound
        const upperBound = fvg.high * 1.005; // 0.5% above the upper bound
        return currentPrice >= lowerBound && currentPrice <= upperBound;
    });
}

/**
 * Detects FVGs across all candles and checks if the price is near any valid FVG.
 * @param {Array} data - The array of stock data objects with identified fractals.
 * @returns {Object} - The updated FVGs and data with FVG information.
 */
function detectFVGs(data) {
    let fractals = [];
    let allFVGs = [];
    const fvgInfo = [];

    data.forEach((current, index, array) => {
        fractals = fractals.filter(fractal => {
            if (fractal.pivot === 'up' && current.pivot === 'up' && current.high > fractal.high) {
                if (current.close >= fractal.high) {
                    return false;  // Invalidate previous fractal
                } else {
                    return true;   // New fractal is invalid
                }
            }
            if (fractal.pivot === 'down' && current.pivot === 'down' && current.low < fractal.low) {
                if (current.close <= fractal.low) {
                    return false;  // Invalidate previous fractal
                } else {
                    return true;   // New fractal is invalid
                }
            }
            return true;
        });

        let fvgRange = null;
        let breakout = null;

        if (fractals.length > 0) {
            fractals.forEach((fractal, fractalIndex) => {
                if (
                    (fractal.pivot === 'up' && current.close > fractal.high) ||
                    (fractal.pivot === 'down' && current.close < fractal.low)
                ) {
                    const prevCandle = array[index - 1];
                    fvgRange = fractal.pivot === 'up'
                        ? `${current.low} - ${prevCandle.high}`
                        : `${prevCandle.low} - ${current.high}`;
                    
                    breakout = "yes";

                    allFVGs.push({
                        type: fractal.pivot,
                        range: fvgRange,
                        low: fractal.pivot === 'up' ? current.low : prevCandle.low,
                        high: fractal.pivot === 'up' ? prevCandle.high : current.high,
                        valid: "valid",
                        formedAt: current.date
                    });

                    fractals.splice(fractalIndex, 1);
                }
            });
        }

        if (current.pivot) {
            fractals.push({ ...current, index });
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
        const symbol = 'BIOCON.NS';
        const days = 5;
        const lookback = 5;

        let stockData = await fetchStockData(symbol, days);

        stockData = detectPivotFractals(stockData, lookback);

        const { allFVGs, fvgInfo } = detectFVGs(stockData);

        const validatedFVGs = validateFVGs(allFVGs, stockData);

        const finalData = fvgInfo.map(info => {
            const { current } = info;
            const isPriceNearFVG = current && current.close !== undefined
                ? checkPriceNearFVG(validatedFVGs, current.close)
                : null;

            return {
                ...info,
                date: new Date(current.date).toLocaleString(),
                nearFVG: isPriceNearFVG ? 'near FVG' : null
            };
        }).map((info, idx, arr) => {
            // Ensure only one candle is marked "near FVG"
            if (info.nearFVG && idx > 0 && arr[idx - 1].nearFVG) {
                return { ...info, nearFVG: null };
            }
            return info;
        });

        console.table(finalData.map(({ date, current, fvgRange, breakout, nearFVG }) => ({
            date,
            open: current.open,
            high: current.high,
            low: current.low,
            close: current.close,
            volume: current.volume,
            fvgRange,
            breakout,
            nearFVG
        })));
    } catch (error) {
        console.error('An error occurred during processing:', error);
    }
}

main();
