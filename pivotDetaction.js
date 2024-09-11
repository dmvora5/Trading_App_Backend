const yahooFinance = require('yahoo-finance2').default;

const COLSE_TYPE = {
    HL: "HL",
    CLOSE: "CLOSE"
};

const PIVOT_TYPE = {
    UP: "UP",
    DOWN: "DOWN",
    BOTH: "BOTH"
};

const LEVEL_TYPE = {
    SUPPORT: "SUPPORT",
    RESISTANCE: "RESISTANCE"
};

//helpers

function getPivotData(candle, type = COLSE_TYPE.HL) {
    if (type === COLSE_TYPE.HL) {
        if (candle.pivot === PIVOT_TYPE.UP) {
            return { ...candle, value: candle.high };
        } else if (candle.pivot === PIVOT_TYPE.DOWN) {
            return { ...candle, value: candle.low };
        }
    }
    return { ...candle, value: candle.close };
}

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

        return result.quotes.map(({ date, high, low, open, close, volume }) => ({
            date: new Date(date).toLocaleString(),
            high,
            low,
            open,
            close,
            volume
        }));
    } catch (error) {
        console.error(`Error fetching data for symbol ${symbol}:`, error);
        throw error;
    }
}

function detectPivotPoints(data, pivotStrength = 5, type = COLSE_TYPE.HL) {
    return data.map((current, index) => {
        if (index < pivotStrength) {
            return { ...current, pivot: null };
        }

        const previousCandles = data.slice(index - pivotStrength, index);
        const nextCandles = data.slice(index + 1, index + pivotStrength - 1);

        const prevHighs = previousCandles.map(c => c.high);
        const nextHighs = nextCandles.map(c => c.high);
        const prevLows = previousCandles.map(c => c.low);
        const nextLows = nextCandles.map(c => c.low);

        const isFractalUp = type === COLSE_TYPE.HL
            ? current.high >= Math.max(...prevHighs) && current.high > Math.max(...nextHighs)
            : current.close >= Math.max(...previousCandles.map(c => c.close)) && current.close > Math.max(...nextCandles.map(c => c.close));

        const isFractalDown = type === COLSE_TYPE.HL
            ? current.low <= Math.min(...prevLows) && current.low < Math.min(...nextLows)
            : current.close <= Math.min(...previousCandles.map(c => c.close)) && current.close < Math.min(...nextCandles.map(c => c.close));

        let pivot = null;
        if (isFractalUp && isFractalDown) {
            pivot = PIVOT_TYPE.BOTH;
        } else if (isFractalUp) {
            pivot = PIVOT_TYPE.UP;
        } else if (isFractalDown) {
            pivot = PIVOT_TYPE.DOWN;
        }

        return { ...current, pivot };
    });
}

function detectFVGs(data, type = COLSE_TYPE.HL) {
    let pivots = [];
    const allFvgs = [];

    data.forEach((current, index, array) => {
        const { close, low, high } = current;
        const previousCandle = array[index - 1] || {};
        const currentCandle = {
            ...current,
            type: null,
            range: null,
            pivotDate: null,
            valid: null,
            levelHigh: null,
            levelLow: null,
            retest: null,
            invalidDate: null
        };

        // Remove invalid FVGs
        allFvgs.forEach((fvg, i) => {
            const isInvalidSupport = fvg.type === LEVEL_TYPE.SUPPORT && close < fvg.low;
            const isInvalidResistance = fvg.type === LEVEL_TYPE.RESISTANCE && close > fvg.high;

            if (isInvalidSupport || isInvalidResistance) {
                data[fvg.index].valid = "invalid";
                data[fvg.index].invalidDate = current.date;
                allFvgs.splice(i, 1);
                return;
            }

            if (fvg.type === LEVEL_TYPE.SUPPORT && close > fvg.low && low <= fvg.high) {
                currentCandle.retest = "retest_support";
                currentCandle.retestDate = fvg.formedAt;
            }

            if (fvg.type === LEVEL_TYPE.RESISTANCE && close < fvg.high && high >= fvg.low) {
                currentCandle.retest = "retest_resistance";
                currentCandle.retestDate = fvg.formedAt;
            }
        });

        // Process pivots
        pivots.forEach((pivot, pivotIndex) => {
            const isValidPivot = (pivot.pivot === PIVOT_TYPE.UP && close > pivot.value) ||
                (pivot.pivot === PIVOT_TYPE.DOWN && close < pivot.value);

            if (isValidPivot) {
                const range = pivot.pivot === PIVOT_TYPE.UP
                    ? `${low} - ${previousCandle.high}`
                    : `${previousCandle.low} - ${high}`;

                const levelHigh = pivot.pivot === PIVOT_TYPE.UP
                    ? Math.max(low, previousCandle.high)
                    : Math.max(high, previousCandle.low);

                const levelLow = pivot.pivot === PIVOT_TYPE.UP
                    ? Math.min(low, previousCandle.high)
                    : Math.min(high, previousCandle.low);

                const levelType = pivot.pivot === PIVOT_TYPE.UP ? LEVEL_TYPE.SUPPORT : LEVEL_TYPE.RESISTANCE;

                currentCandle.type = levelType;
                currentCandle.range = range;
                currentCandle.pivotDate = pivot.date;
                currentCandle.valid = "valid";
                currentCandle.levelHigh = levelHigh;
                currentCandle.levelLow = levelLow;

                allFvgs.push({
                    formedAt: current.date,
                    range,
                    type: levelType,
                    index,
                    high: levelHigh,
                    low: levelLow,
                    valid: "valid"
                });

                pivots = pivots.filter(p => 
                    (p.pivot === PIVOT_TYPE.DOWN && p.value < pivot.value) || 
                    (p.pivot === PIVOT_TYPE.UP && p.value > pivot.value)
                );
            }
        });

        if (current.pivot) {
            const newPivot = getPivotData(current, type);
            pivots.push({ ...newPivot, index });
        }

        data[index] = currentCandle;
    });

    return { allFvgs };
}

async function main() {
    try {
        const symbol = 'ASIANPAINT.NS';
        const days = 60;
        const pivotStrength = 5;

        let stockData = await fetchStockData(symbol, days);

        // Detect pivot points
        stockData = detectPivotPoints(stockData, pivotStrength);

        // Get range and detect FVGs
        detectFVGs(stockData);

        console.table(stockData, ["date", "range", "pivot", "type", "valid", "invalidDate", "retest", "retestDate"]);
    } catch (error) {
        console.error('An error occurred during processing:', error);
    }
}

main();
