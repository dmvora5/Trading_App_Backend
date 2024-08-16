const yahooFinance = require('yahoo-finance2').default;

// 1. Fetching Stock Data
async function fetchStockData(symbol, days = 1) {
    const now = new Date();
    const period2 = Math.floor((now.getTime() - 10)/ 1000);
    const period1 = Math.floor(now.setDate(now.getDate() - 2) / 1000);

    const queryOptions = { period1, period2, interval: '5m' };
    const result = await yahooFinance.chart(symbol, queryOptions);

    return result.quotes.map(entry => ({
        date: new Date(entry.date).toLocaleDateString(),
        open: parseFloat(entry.open),
        high: parseFloat(entry.high),
        low: parseFloat(entry.low),
        close: parseFloat(entry.close),
        volume: parseFloat(entry.volume)
    }));
}

// 2. Calculating Heikin-Ashi Candles
function calculateHeikinAshi(candles) {
    const heikinAshiCandles = [];

    for (let i = 0; i < candles.length; i++) {
        const prevHaCandle = heikinAshiCandles[i - 1];
        const currentCandle = candles[i];

        const haClose = (currentCandle.open + currentCandle.high + currentCandle.low + currentCandle.close) / 4;

        const haOpen = prevHaCandle 
            ? (prevHaCandle.open + prevHaCandle.close) / 2 
            : (currentCandle.open + currentCandle.close) / 2;

        const haHigh = Math.max(currentCandle.high, haOpen, haClose);
        const haLow = Math.min(currentCandle.low, haOpen, haClose);

        heikinAshiCandles.push({
            date: currentCandle.date,
            open: parseFloat(haOpen.toFixed(6)),
            high: parseFloat(haHigh.toFixed(6)),
            low: parseFloat(haLow.toFixed(6)),
            close: parseFloat(haClose.toFixed(6)),
            volume: currentCandle.volume
        });
    }

    return heikinAshiCandles;
}

// 3. Detecting Trade Signals
function detectTradeSignals(heikinAshiCandles, config) {
    const signals = [];

    for (let i = 1; i < heikinAshiCandles.length; i++) {
        const prevHaCandle = heikinAshiCandles[i - 1];
        const currentCandle = heikinAshiCandles[i];

        const currentCandleSize = currentCandle.high - currentCandle.low;
        const previousCandleSizes = heikinAshiCandles.slice(Math.max(0, i - 10), i).map(candle => candle.high - candle.low);
        const avgPreviousCandleSize = previousCandleSizes.length 
            ? previousCandleSizes.reduce((acc, size) => acc + size, 0) / previousCandleSizes.length
            : currentCandleSize;

        const sizeThreshold = config.sizeThreshold || 1.5; // Default to 1.5 if not provided

        let signal = null;

        if (currentCandleSize <= avgPreviousCandleSize * sizeThreshold) {
            const prevBody = Math.abs(prevHaCandle.close - prevHaCandle.open);
            const isDoji = prevBody < ((prevHaCandle.high - prevHaCandle.low) * 0.2);

            if (isDoji) {
                if (currentCandle.close > currentCandle.open && currentCandle.open === currentCandle.low && (config.tradeType === 'buy' || config.tradeType === 'both')) {
                    signal = 'Buy';
                } else if (currentCandle.close < currentCandle.open && currentCandle.open === currentCandle.high && (config.tradeType === 'sell' || config.tradeType === 'both')) {
                    signal = 'Sell';
                }
            }
        }

        signals.push({
            ...currentCandle,
            signal: signal,
            signalCandle: prevHaCandle // Store the Doji candle for stop loss calculation
        });
    }

    return signals;
}

// 4. Backtest Function with Capital Management, Configurable Parameters, and Win Rate Calculation
function backtestStrategy(signals, config) {
    let capital = config.initialCapital || 100000;
    const takeProfitPercentage = config.takeProfitPercentage || 2; // Default to 1.5% target
    const riskPercentage = config.riskPercentage || 1; // Default to 1% risk per trade
    const buffer = config.buffer || 0.001; // Default buffer size
    const tradeType = config.tradeType || 'buy'; // Default to both buy and sell

    const results = [];
    let wins = 0; // Count of winning trades
    let totalTrades = 0; // Total number of trades

    for (let i = 1; i < signals.length; i++) {
        const signal = signals[i];

        if (signal.signal) {
            const entryPrice = signal.close;
            const signalCandle = signal.signalCandle;
            const entryDate = new Date(signal.date);

            let stopLoss = null;
            let takeProfit = null;
            let exitDate = null;
            let daysToReachTarget = null;

            if (signal.signal === 'Buy' && (tradeType === 'buy' || tradeType === 'both')) {
                stopLoss = signalCandle.low - buffer; // Doji candle low minus buffer
                takeProfit = entryPrice * (1 + takeProfitPercentage / 100);

                for (let j = i + 1; j < signals.length; j++) {
                    const nextCandle = signals[j];

                    if (nextCandle.low <= stopLoss) {
                        const lossAmount = capital * (riskPercentage / 100); // Risk % of capital
                        capital -= lossAmount;

                        exitDate = new Date(nextCandle.date);
                        daysToReachTarget = Math.round((exitDate - entryDate) / (1000 * 60 * 60 * 24));

                        results.push({ 
                            signal: 'Buy', 
                            result: 'Loss', 
                            entryPrice, 
                            stopLoss, 
                            takeProfit, 
                            exitPrice: stopLoss, 
                            entryDate: entryDate.toLocaleDateString(), 
                            exitDate: exitDate.toLocaleDateString(),
                            daysToReachTarget,
                            capital 
                        });
                        totalTrades++; // Increment total trades
                        break;
                    }

                    if (nextCandle.high >= takeProfit) {
                        const profitAmount = capital * (takeProfitPercentage * riskPercentage / 100); // Adjusted by risk percentage
                        capital += profitAmount;

                        exitDate = new Date(nextCandle.date);
                        daysToReachTarget = Math.round((exitDate - entryDate) / (1000 * 60 * 60 * 24));

                        results.push({ 
                            signal: 'Buy', 
                            result: 'Win', 
                            entryPrice, 
                            stopLoss, 
                            takeProfit, 
                            exitPrice: takeProfit, 
                            entryDate: entryDate.toLocaleDateString(), 
                            exitDate: exitDate.toLocaleDateString(),
                            daysToReachTarget,
                            capital 
                        });
                        wins++; // Increment wins
                        totalTrades++; // Increment total trades
                        break;
                    }
                }
            } else if (signal.signal === 'Sell' && (tradeType === 'sell' || tradeType === 'both')) {
                stopLoss = signalCandle.high + buffer; // Doji candle high plus buffer
                takeProfit = entryPrice * (1 - takeProfitPercentage / 100);

                for (let j = i + 1; j < signals.length; j++) {
                    const nextCandle = signals[j];

                    if (nextCandle.high >= stopLoss) {
                        const lossAmount = capital * (riskPercentage / 100); // Risk % of capital
                        capital -= lossAmount;

                        exitDate = new Date(nextCandle.date);
                        daysToReachTarget = Math.round((exitDate - entryDate) / (1000 * 60 * 60 * 24));

                        results.push({ 
                            signal: 'Sell', 
                            result: 'Loss', 
                            entryPrice, 
                            stopLoss, 
                            takeProfit, 
                            exitPrice: stopLoss, 
                            entryDate: entryDate.toLocaleDateString(), 
                            exitDate: exitDate.toLocaleDateString(),
                            daysToReachTarget,
                            capital 
                        });
                        totalTrades++; // Increment total trades
                        break;
                    }

                    if (nextCandle.low <= takeProfit) {
                        const profitAmount = capital * (takeProfitPercentage * riskPercentage / 100); // Adjusted by risk percentage
                        capital += profitAmount;

                        exitDate = new Date(nextCandle.date);
                        daysToReachTarget = Math.round((exitDate - entryDate) / (1000 * 60 * 60 * 24));

                        results.push({ 
                            signal: 'Sell', 
                            result: 'Win', 
                            entryPrice, 
                            stopLoss, 
                            takeProfit, 
                            exitPrice: takeProfit, 
                            entryDate: entryDate.toLocaleDateString(), 
                            exitDate: exitDate.toLocaleDateString(),
                            daysToReachTarget,
                            capital 
                        });
                        wins++; // Increment wins
                        totalTrades++; // Increment total trades
                        break;
                    }
                }
            }
        }
    }

    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0; // Calculate win rate percentage

    return {
        results,
        winRate: winRate.toFixed(2) + '%' // Return win rate as a percentage with two decimal points
    };
}

// Example Usage
(async () => {
    const symbol = 'SBIN.NS'; // Example symbol
    const days = 300; // Number of days of historical data
    const config = {
        initialCapital: 100000, // Initial capital
        takeProfitPercentage: 2, // 1% take profit
        riskPercentage: 1, // 1% risk per trade
        buffer: 0.001, // Buffer for stop loss
        sizeThreshold: 1.5, // Size threshold for candles
        tradeType: 'buy' // 'buy', 'sell', or 'both'
    };

    const stockData = await fetchStockData(symbol, days);
    const heikinAshiData = calculateHeikinAshi(stockData);
    const signals = detectTradeSignals(heikinAshiData, config);
    const { results, winRate } = backtestStrategy(signals, config);

    console.table(results);
    console.log('Win Rate:', winRate); // Output the win rate percentage
})();
