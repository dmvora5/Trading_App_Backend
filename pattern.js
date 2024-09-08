const yahooFinance = require('yahoo-finance2').default;

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

        const candles = result.quotes.map(entry => ({
            date: new Date(entry.date).toLocaleDateString('en-US'),
            high: entry.high,
            low: entry.low,
            open: entry.open,
            close: entry.close,
            volume: entry.volume,
            type: null, // We'll determine the type (Rally, Base, Drop) below
            pattern: null, // We'll determine the pattern below
            retestSignal: null // We'll determine the retest signal below
        }));

        let lastPatternCandleIndex = null;
        let baseHigh = null;

        // Determine candle types and identify patterns
        candles.forEach((candle, index) => {
            const bodySize = Math.abs(candle.close - candle.open);
            const totalHeight = candle.high - candle.low;

            if (bodySize / totalHeight >= 0.6) {
                // Identify Rally or Drop
                candle.type = candle.close > candle.open ? 'Rally' : 'Drop';
            } else if (bodySize / totalHeight <= 0.5) {
                // Identify Base
                candle.type = 'Base';
            }

            // Check for pattern formation and assign the pattern to the last candle in the sequence
            if (index >= 2) {
                const firstCandle = candles[index - 2];
                const secondCandle = candles[index - 1];
                const thirdCandle = candles[index];

                const isThirdCandleValid = Math.abs(thirdCandle.high - thirdCandle.low) > Math.abs(secondCandle.high - secondCandle.low);

                if (isThirdCandleValid) {
                    if (
                        firstCandle.type === 'Rally' &&
                        secondCandle.type === 'Base' &&
                        thirdCandle.type === 'Rally'
                    ) {
                        thirdCandle.pattern = 'RBR';
                        lastPatternCandleIndex = index;
                        baseHigh = secondCandle.high; // Store the high of the base candle
                    } else if (
                        firstCandle.type === 'Drop' &&
                        secondCandle.type === 'Base' &&
                        thirdCandle.type === 'Drop'
                    ) {
                        thirdCandle.pattern = 'DBD';
                        lastPatternCandleIndex = index;
                        baseHigh = secondCandle.high; // Store the high of the base candle
                    } else if (
                        firstCandle.type === 'Rally' &&
                        secondCandle.type === 'Base' &&
                        thirdCandle.type === 'Drop'
                    ) {
                        thirdCandle.pattern = 'RBD';
                        lastPatternCandleIndex = index;
                        baseHigh = secondCandle.high; // Store the high of the base candle
                    } else if (
                        firstCandle.type === 'Drop' &&
                        secondCandle.type === 'Base' &&
                        thirdCandle.type === 'Rally'
                    ) {
                        thirdCandle.pattern = 'DBR';
                        lastPatternCandleIndex = index;
                        baseHigh = secondCandle.high; // Store the high of the base candle
                    }
                }
            }
        });

        // Check for retest signals
        if (lastPatternCandleIndex !== null && baseHigh !== null) {
            for (let j = lastPatternCandleIndex + 1; j < candles.length; j++) {
                const retestCandle = candles[j];
                if (retestCandle.low <= baseHigh && retestCandle.high >= baseHigh) {
                    retestCandle.retestSignal = 'Retest';
                    break; // Only mark the first retest candle
                }
            }
        }

        // Print the results in a console.table
        console.table(candles.map(c => ({
            Date: c.date,
            High: c.high,
            Low: c.low,
            Open: c.open,
            Close: c.close,
            Volume: c.volume,
            Type: c.type,
            Pattern: c.pattern || null,
            RetestSignal: c.retestSignal || null
        })));

        return candles;
    } catch (error) {
        console.error(`Error fetching data for symbol ${symbol}:`, error);
        throw error;
    }
}

fetchStockData("INDIGO.NS");
