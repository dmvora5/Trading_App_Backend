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
            pattern: null // We'll determine the pattern below
        }));

        // Determine candle types
        candles.forEach(candle => {
            const bodySize = Math.abs(candle.close - candle.open);
            const totalHeight = candle.high - candle.low;

            if (bodySize / totalHeight >= 0.6) {
                // Identify Rally or Drop
                candle.type = candle.close > candle.open ? 'Rally' : 'Drop';
            } else if (bodySize / totalHeight <= 0.5) {
                // Identify Base
                candle.type = 'Base';
            }
        });

        // Identify patterns and assign the pattern to the last candle in the sequence
        for (let i = 0; i < candles.length - 2; i++) {
            const firstCandle = candles[i];
            const secondCandle = candles[i + 1];
            const thirdCandle = candles[i + 2];

            // Validate that Rally/Drop candles are larger than Base candles
            const isValidPattern = (
                Math.abs(firstCandle.high - firstCandle.low) > Math.abs(secondCandle.high - secondCandle.low) &&
                Math.abs(thirdCandle.high - thirdCandle.low) > Math.abs(secondCandle.high - secondCandle.low)
            );

            if (isValidPattern) {
                if (
                    firstCandle.type === 'Rally' &&
                    secondCandle.type === 'Base' &&
                    thirdCandle.type === 'Rally'
                ) {
                    thirdCandle.pattern = 'RBR';
                } else if (
                    firstCandle.type === 'Drop' &&
                    secondCandle.type === 'Base' &&
                    thirdCandle.type === 'Drop'
                ) {
                    thirdCandle.pattern = 'DBD';
                } else if (
                    firstCandle.type === 'Rally' &&
                    secondCandle.type === 'Base' &&
                    thirdCandle.type === 'Drop'
                ) {
                    thirdCandle.pattern = 'RBD';
                } else if (
                    firstCandle.type === 'Drop' &&
                    secondCandle.type === 'Base' &&
                    thirdCandle.type === 'Rally'
                ) {
                    thirdCandle.pattern = 'DBR';
                }
            }

            // Check for two base candles between rally/drop and assign the pattern to the last candle
            if (i < candles.length - 3) {
                const fourthCandle = candles[i + 3];
                const isFourthCandleValid = Math.abs(fourthCandle.high - fourthCandle.low) > Math.abs(thirdCandle.high - thirdCandle.low);

                if (
                    isValidPattern &&
                    isFourthCandleValid &&
                    secondCandle.type === 'Base' &&
                    thirdCandle.type === 'Base'
                ) {
                    if (firstCandle.type === 'Rally' && fourthCandle.type === 'Rally') {
                        fourthCandle.pattern = 'RBR';
                    } else if (firstCandle.type === 'Drop' && fourthCandle.type === 'Drop') {
                        fourthCandle.pattern = 'DBD';
                    }
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
            Pattern: c.pattern || null
        })));

        return candles;
    } catch (error) {
        console.error(`Error fetching data for symbol ${symbol}:`, error);
        throw error;
    }
}

fetchStockData("INDIGO.NS");
