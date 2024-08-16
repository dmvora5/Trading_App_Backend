const yahooFinance = require('yahoo-finance2').default;

class StockData {
    static calculateRSI(prices, period) {
        let gains = [];
        let losses = [];
        let rsiValues = Array(prices.length).fill(null);

        for (let i = 1; i < prices.length; i++) {
            let difference = prices[i] - prices[i - 1];
            if (difference >= 0) {
                gains.push(difference);
                losses.push(0);
            } else {
                gains.push(0);
                losses.push(Math.abs(difference));
            }
        }

        let avgGain = gains.slice(0, period).reduce((acc, val) => acc + val, 0) / period;
        let avgLoss = losses.slice(0, period).reduce((acc, val) => acc + val, 0) / period;

        rsiValues[period] = 100 - (100 / (1 + avgGain / avgLoss));

        for (let i = period + 1; i < prices.length; i++) {
            avgGain = ((avgGain * (period - 1)) + gains[i - 1]) / period;
            avgLoss = ((avgLoss * (period - 1)) + losses[i - 1]) / period;

            let rs = avgGain / avgLoss;
            rsiValues[i] = 100 - (100 / (1 + rs));
        }

        return rsiValues;
    }

    static detectPivotLow(rsi, lbL, lbR) {
        let pivotLows = Array(rsi.length).fill(false);

        for (let i = lbL; i < rsi.length - lbR; i++) {
            let isPivotLow = true;
            for (let j = 1; j <= lbL; j++) {
                if (rsi[i] >= rsi[i - j]) {
                    isPivotLow = false;
                    break;
                }
            }
            for (let j = 1; j <= lbR; j++) {
                if (rsi[i] >= rsi[i + j]) {
                    isPivotLow = false;
                    break;
                }
            }
            if (isPivotLow) pivotLows[i] = true;
        }

        return pivotLows;
    }

    static detectPivotHigh(rsi, lbL, lbR) {
        let pivotHighs = Array(rsi.length).fill(false);

        for (let i = lbL; i < rsi.length - lbR; i++) {
            let isPivotHigh = true;
            for (let j = 1; j <= lbL; j++) {
                if (rsi[i] <= rsi[i - j]) {
                    isPivotHigh = false;
                    break;
                }
            }
            for (let j = 1; j <= lbR; j++) {
                if (rsi[i] <= rsi[i + j]) {
                    isPivotHigh = false;
                    break;
                }
            }
            if (isPivotHigh) pivotHighs[i] = true;
        }

        return pivotHighs;
    }

    static detectDivergence(prices, rsi, pivotLows, pivotHighs, lbR) {
        let signals = Array(prices.length).fill(null);

        // Look for Bullish Divergence
        for (let i = lbR; i < pivotLows.length; i++) {
            if (pivotLows[i]) {
                let prevPivotLowIndex = -1;
                for (let j = i - lbR - 1; j >= 0; j--) {
                    if (pivotLows[j]) {
                        prevPivotLowIndex = j;
                        break;
                    }
                }
                if (prevPivotLowIndex !== -1) {
                    let prevPivotLow = prices[prevPivotLowIndex];
                    let currentPriceLow = prices[i];
                    let prevRsiLow = rsi[prevPivotLowIndex];
                    let currentRsiLow = rsi[i];

                    if (currentPriceLow < prevPivotLow && currentRsiLow > prevRsiLow) {
                        signals[i] = 'Bullish Divergence';
                    }
                }
            }
        }

        // Look for Bearish Divergence
        for (let i = lbR; i < pivotHighs.length; i++) {
            if (pivotHighs[i]) {
                let prevPivotHighIndex = -1;
                for (let j = i - lbR - 1; j >= 0; j--) {
                    if (pivotHighs[j]) {
                        prevPivotHighIndex = j;
                        break;
                    }
                }
                if (prevPivotHighIndex !== -1) {
                    let prevPivotHigh = prices[prevPivotHighIndex];
                    let currentPriceHigh = prices[i];
                    let prevRsiHigh = rsi[prevPivotHighIndex];
                    let currentRsiHigh = rsi[i];

                    if (currentPriceHigh > prevPivotHigh && currentRsiHigh < prevRsiHigh) {
                        signals[i] = 'Bearish Divergence';
                    }
                }
            }
        }

        return signals;
    }

    static async fetchStockData(symbol, days = 1) {
        const now = new Date();
        const period2 = Math.floor(now.getTime() / 1000);
        const period1 = Math.floor(now.setDate(now.getDate() - days) / 1000);

        const queryOptions = { period1, period2, interval: '5m' };
        const result = await yahooFinance.chart(symbol, queryOptions);

        const stockData = result.quotes.map(entry => ({
            date: new Date(entry.date).toLocaleString(),
            high: entry.high,
            low: entry.low,
            close: entry.close,
            volume: entry.volume
        }));

        const closes = stockData.map(data => data.close);
        const rsiPeriod = 14;
        const lbL = 5; // Adjusted Pivot Lookback Left
        const lbR = 5; // Adjusted Pivot Lookback Right
        const rsi = StockData.calculateRSI(closes, rsiPeriod);
        const pivotLows = StockData.detectPivotLow(rsi, lbL, lbR);
        const pivotHighs = StockData.detectPivotHigh(rsi, lbL, lbR);

        const signals = StockData.detectDivergence(closes, rsi, pivotLows, pivotHighs, lbR);

        const finalData = stockData.map((entry, index) => ({
            ...entry,
            rsi: rsi[index] !== null && rsi[index] !== undefined ? rsi[index].toFixed(2) : null,
            pivotLow: pivotLows[index] ? "Yes" : "No",
            pivotHigh: pivotHighs[index] ? "Yes" : "No",
            signal: signals[index]
        }));

        return finalData;
    }

    static backtest(stockData, signals, initialCapital = 100000, targetProfit = 0.02, stopLoss = 0.01) {
        let capital = initialCapital;
        let trades = [];
        let isTradeOpen = false;
        let winCount = 0;

        for (let i = 1; i < stockData.length; i++) {
            if (isTradeOpen) continue; // Skip if there's an open trade

            const entry = stockData[i];
            const previousEntry = stockData[i - 1];
            const signal = signals[i];

            if (signal === 'Bullish Divergence') {
                let entryPrice = previousEntry.high; // Entry when high of signal candle is broken
                let stopLossPrice = entry.low * (1 - stopLoss);
                let targetPrice = entryPrice * (1 + targetProfit);

                for (let j = i + 1; j < stockData.length; j++) {
                    const nextEntry = stockData[j];

                    if (nextEntry.low <= stopLossPrice) {
                        capital -= capital * stopLoss;
                        trades.push({
                            type: 'Buy',
                            entryDate: entry.date,
                            entryPrice,
                            exitDate: nextEntry.date,
                            exitPrice: stopLossPrice,
                            result: 'Loss'
                        });
                        isTradeOpen = false;
                        break;
                    }

                    if (nextEntry.high >= targetPrice) {
                        capital += capital * targetProfit;
                        trades.push({
                            type: 'Buy',
                            entryDate: entry.date,
                            entryPrice,
                            exitDate: nextEntry.date,
                            exitPrice: targetPrice,
                            result: 'Profit'
                        });
                        winCount++;
                        isTradeOpen = false;
                        break;
                    }

                    isTradeOpen = true;
                }
            } else if (signal === 'Bearish Divergence') {
                let entryPrice = previousEntry.low; // Entry when low of signal candle is broken
                let stopLossPrice = entry.high * (1 + stopLoss);
                let targetPrice = entryPrice * (1 - targetProfit);

                for (let j = i + 1; j < stockData.length; j++) {
                    const nextEntry = stockData[j];

                    if (nextEntry.high >= stopLossPrice) {
                        capital -= capital * stopLoss;
                        trades.push({
                            type: 'Sell',
                            entryDate: entry.date,
                            entryPrice,
                            exitDate: nextEntry.date,
                            exitPrice: stopLossPrice,
                            result: 'Loss'
                        });
                        isTradeOpen = false;
                        break;
                    }

                    if (nextEntry.low <= targetPrice) {
                        capital += capital * targetProfit;
                        trades.push({
                            type: 'Sell',
                            entryDate: entry.date,
                            entryPrice,
                            exitDate: nextEntry.date,
                            exitPrice: targetPrice,
                            result: 'Profit'
                        });
                        winCount++;
                        isTradeOpen = false;
                        break;
                    }

                    isTradeOpen = true;
                }
            }
        }

        let finalGrowth = ((capital - initialCapital) / initialCapital) * 100;
        let winRate = (winCount / trades.length) * 100;

        console.table(trades);
        console.log(`Final Capital: ${capital.toFixed(2)} (Growth: ${finalGrowth.toFixed(2)}%)`);
        console.log(`Win Rate: ${winRate.toFixed(2)}%`);

        return { finalCapital: capital, trades, finalGrowth, winRate };
    }
}

// Usage example:
StockData.fetchStockData('HDFCBANK.NS', 30).then(stockData => {
    const signals = stockData.map(data => data.signal);
    const backtestResult = StockData.backtest(stockData, signals, 100000, 0.02, 0.01);
});

