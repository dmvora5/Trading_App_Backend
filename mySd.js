const yahooFinance = require('yahoo-finance2').default;


const COLSE_TYPE = {
    HL: "HL",
    CLOSE: "CLOSE"
}

const PIVOT_TYPE = {
    UP: "UP",
    DOWN: "DOWN",
    BOTH: "BOTH"
}

const LEVEL_TYPE = {
    SUPPORT: "SUPPORT",
    RESISTANCE: "RESISTANCE"
}

//helpers

function getPivotData(candle, type = COLSE_TYPE.HL) {
    switch (type) {
        case COLSE_TYPE.HL:
            if (candle.pivot === PIVOT_TYPE.UP) {
                return { ...candle, value: candle.high }
            } else if (candle.pivot === PIVOT_TYPE.DOWN) {
                return { ...candle, value: candle.low }
            }
            break;
        case COLSE_TYPE.CLOSE:
            return {
                ...candle,
                value: candle.close
            }
        default:
            return candle
    }
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

        return result.quotes.map(entry => ({
            date: new Date(entry.date).toLocaleString(),  // Store date as timestamp for faster comparisons
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



function detectPivotPoints(data, pivotStrength = 5, type = COLSE_TYPE.HL) {
    return data.map((current, index) => {
        if (index < pivotStrength
            // || index >= data.length - pivotStrength
        ) {
            return { ...current, pivot: null }
        }

        const previousCandles = data.slice(index - pivotStrength, index);
        const nextCandles = data.slice(index + 1, index + (pivotStrength - 1));

        const isFractalUp = type === COLSE_TYPE.HL
            ? current.high >= Math.max(...previousCandles.map(c => c.high)) &&
            current.high > Math.max(...nextCandles.map(c => c.high))
            :
            current.close >= Math.max(...previousCandles.map(c => c.close)) &&
            current.close > Math.max(...nextCandles.map(c => c.close));

        const isFractalDown = type === COLSE_TYPE.HL
            ? current.low <= Math.min(...previousCandles.map(c => c.low)) &&
            current.low < Math.min(...nextCandles.map(c => c.low))
            :
            current.close <= Math.min(...previousCandles.map(c => c.close)) &&
            current.close < Math.min(...nextCandles.map(c => c.close))
            ;

        let pivot = null;

        if (isFractalUp && isFractalDown) {
            pivot = PIVOT_TYPE.BOTH;
        } else if (isFractalUp) {
            pivot = PIVOT_TYPE.UP;
        } else if (isFractalDown) {
            pivot = PIVOT_TYPE.DOWN;
        }

        return { ...current, pivot };

    })
}


function detectFVGs(data, type = COLSE_TYPE.HL) {
    let pivots = [];
    let allFvgs = [];

    data.forEach((current, index, array) => {

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
        }

        //remove invalid fvgs
        allFvgs.forEach((fvg, index) => {
            if(fvg.type === LEVEL_TYPE.SUPPORT && current.close < fvg.low) {
                data[fvg.index].valid = "invalid";
                data[fvg.index].invalidDate = current.date;
                allFvgs.splice(index, 1);
                return;
            }
            if(fvg.type === LEVEL_TYPE.RESISTANCE && current.close > fvg.high) {
                data[fvg.index].valid = "invalid";
                data[fvg.index].invalidDate = current.date;
                allFvgs.splice(index, 1);
                return;
            }


            if(fvg.type === LEVEL_TYPE.SUPPORT && (current.close > fvg.low && current.low <= fvg.high)) {
                currentCandle.retest = "retest_support";
                currentCandle.retestDate = fvg.formedAt
            }

            if(fvg.type === LEVEL_TYPE.RESISTANCE && (current.close < fvg.high && current.high >= fvg.low)) {
                currentCandle.retest = "retest_resistance";
                currentCandle.retestDate = fvg.formedAt
            }
        })

        //loop throue pivot
        if (pivots.length > 0) {
            pivots.forEach((currentPivot, pivotIndex) => {
                if ((currentPivot.pivot === PIVOT_TYPE.UP && current.close > currentPivot.value) ||
                    (currentPivot.pivot === PIVOT_TYPE.DOWN && current.close < currentPivot.value)) {
                    const previousCandle = array[index - 1];
                    const range = currentPivot.pivot === PIVOT_TYPE.UP
                        ? `${current.low} - ${previousCandle.high}`
                        : `${previousCandle.low} - ${current.high}`;

                    const levelHigh = currentPivot.pivot === PIVOT_TYPE.UP
                        ? previousCandle.high > current.low ? previousCandle.high : current.low
                        : current.high > previousCandle.low ? current.high : previousCandle.low;

                    const levelLow = currentPivot.pivot === PIVOT_TYPE.UP
                        ? current.low < previousCandle.high ? current.low : previousCandle.high
                        : previousCandle.low < current.high ? previousCandle.low : current.high;


                    const levelType = currentPivot.pivot === PIVOT_TYPE.UP ? LEVEL_TYPE.SUPPORT : LEVEL_TYPE.RESISTANCE;

                    //add in curret cabdle
                    currentCandle.type = levelType;
                    currentCandle.range = range;
                    currentCandle.pivotDate = currentPivot.date;
                    currentCandle.valid = "valid";
                    currentCandle.levelHigh = levelHigh;
                    currentCandle.levelLow = levelLow;

                    allFvgs.push({
                        formedAt: current.date,
                        range: range,
                        type: levelType,
                        index: index,
                        high: levelHigh,
                        low: levelLow,
                        valid: "valid"
                    })

                    if (currentPivot.pivot === PIVOT_TYPE.UP) {
                        pivots = pivots.filter(ele => ele.pivot === PIVOT_TYPE.DOWN || (ele.value > currentPivot.value))
                    }

                    if (currentPivot.pivot === PIVOT_TYPE.DOWN) {
                        pivots = pivots.filter(ele => ele.pivot === PIVOT_TYPE.UP || (ele.value < currentPivot.value))
                    }

                    // pivots.splice(pivotIndex, 1)
                }
            });
        }


        //if pivot present then push in a array
        if (current.pivot) {
            const newPivot = getPivotData(current, type);
            pivots.push({ ...newPivot, index });
        }

        data[index] = currentCandle;

    });

    return {
        allFvgs
    }
}


async function main() {
    try {
        const symbol = 'ASIANPAINT.NS';
        const days = 60;
        const pivotStrength = 5;

        let stockData = await fetchStockData(symbol, days);

        // Detect pivot points
        stockData = detectPivotPoints(stockData, pivotStrength);

        //get range =
        detectFVGs(stockData);

        console.table(stockData, ["date", "range", "pivot", "type", "valid", "invalidDate", "retest", "retestDate"]);
    } catch (error) {
        console.error('An error occurred during processing:', error);
    }
}

main();