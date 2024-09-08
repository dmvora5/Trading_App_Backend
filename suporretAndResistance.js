const yahooFinance = require('yahoo-finance2').default;
const { ATR } = require('technicalindicators');  // Technical indicators for ATR

// Fetch stock data using Yahoo Finance API
async function fetchStockData(symbol, days = 10) {
    const now = new Date();
    const period2 = Math.floor(now.getTime() / 1000);
    const period1 = Math.floor(now.setDate(now.getDate() - days) / 1000);

    const queryOptions = { period1, period2, interval: '1d' };
    const result = await yahooFinance.chart(symbol, queryOptions);

    return result.quotes.map(entry => ({
        date: new Date(entry.date).toLocaleString(),
        open: entry.open,
        high: entry.high,
        low: entry.low,
        close: entry.close,
        volume: entry.volume,
    }));
}

// Function to calculate ATR (Average True Range)
function calculateATR(data, period) {
    const input = {
        high: data.map(d => d.high),
        low: data.map(d => d.low),
        close: data.map(d => d.close),
        period: period,
    };
    return ATR.calculate(input);
}

// Function to find support and resistance levels
function findLevels(price, atr, firstW = 0.1, atrMult = 3.0, promThresh = 0.1) {
    // Setup weights
    let weights = price.map((_, i) => firstW + (1.0 - firstW) * (i / price.length));

    // Kernel density estimation
    let kernel = gaussianKernel(price, atr * atrMult, weights);

    // Construct market profile
    let minPrice = Math.min(...price);
    let maxPrice = Math.max(...price);
    let step = (maxPrice - minPrice) / 200;
    let priceRange = Array.from({ length: 200 }, (_, i) => minPrice + i * step);

    // Calculate the PDF (probability density function)
    let pdf = priceRange.map(pr => kernel(pr));

    // Find significant peaks
    let peaks = findPeaks(pdf, promThresh);
    let levels = peaks.map(p => Math.exp(priceRange[p]));

    return levels;
}

// Simplified Gaussian kernel for density estimation
function gaussianKernel(values, bandwidth, weights) {
    return x => {
        let sum = 0;
        values.forEach((value, i) => {
            let weight = weights[i];
            let diff = value - x;
            sum += weight * Math.exp(-0.5 * (diff / bandwidth) ** 2);
        });
        return sum / (bandwidth * Math.sqrt(2 * Math.PI));
    };
}

// Simplified function to find peaks
function findPeaks(data, threshold) {
    let peaks = [];
    for (let i = 1; i < data.length - 1; i++) {
        if (data[i] > data[i - 1] && data[i] > data[i + 1] && data[i] > threshold) {
            peaks.push(i);
        }
    }
    return peaks;
}

// Function to generate buy/sell signals based on support and resistance penetration
function srPenetrationSignal(data, levels) {
    let signal = Array(data.length).fill(0);
    let closeArr = data.map(d => d.close);
    
    for (let i = 1; i < data.length; i++) {
        if (!levels[i]) continue;
        let lastClose = closeArr[i - 1];
        let currClose = closeArr[i];
        
        levels[i].forEach(level => {
            if (currClose > level && lastClose <= level) signal[i] = 1;  // Buy signal
            if (currClose < level && lastClose >= level) signal[i] = -1;  // Sell signal
        });
    }
    return signal;
}

// Function to process trade data from signals
function getTradesFromSignal(data, signals) {
    let longTrades = [];
    let shortTrades = [];
    let openTrade = null;
    let closeArr = data.map(d => d.close);
    
    signals.forEach((sig, i) => {
        if (sig === 1 && openTrade === null) {
            openTrade = { entryTime: data[i].date, entryPrice: closeArr[i], exitTime: null, exitPrice: null, type: 'long' };
        } else if (sig === -1 && openTrade !== null && openTrade.type === 'long') {
            openTrade.exitTime = data[i].date;
            openTrade.exitPrice = closeArr[i];
            longTrades.push(openTrade);
            openTrade = null;
        }
        if (sig === -1 && openTrade === null) {
            openTrade = { entryTime: data[i].date, entryPrice: closeArr[i], exitTime: null, exitPrice: null, type: 'short' };
        } else if (sig === 1 && openTrade !== null && openTrade.type === 'short') {
            openTrade.exitTime = data[i].date;
            openTrade.exitPrice = closeArr[i];
            shortTrades.push(openTrade);
            openTrade = null;
        }
    });

    return { longTrades, shortTrades };
}

// Main function to process stock data and generate trading signals
async function main() {
    const symbol = 'BANDHANBNK.NS';  // Stock symbol
    const days = 800;  // Number of days of data to fetch

    // Fetch stock data
    const stockData = await fetchStockData(symbol, days);
    
    // Calculate ATR
    const atr = calculateATR(stockData, 14);  // 14-day ATR
    
    // Calculate support and resistance levels
    const levels = stockData.map((_, i) => {
        if (i < 14) return null;
        const priceLog = stockData.slice(i - 14, i).map(d => Math.log(d.close));
        return findLevels(priceLog, atr[i]);
    });

    // Generate buy/sell signals
    const signals = srPenetrationSignal(stockData, levels);

    // Extract trades from signals
    const { longTrades, shortTrades } = getTradesFromSignal(stockData, signals);

    // Print trades
    console.table(longTrades);
    console.table(shortTrades);
}

main().catch(err => console.error(err));
