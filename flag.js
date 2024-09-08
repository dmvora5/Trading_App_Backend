const yahooFinance = require('yahoo-finance2').default;

// Fetch stock data using Yahoo Finance API
async function fetchStockData(symbol, days = 10) {
    const now = new Date();
    const period2 = Math.floor(now.getTime() / 1000);
    const period1 = Math.floor(now.setDate(now.getDate() - days) / 1000);

    const queryOptions = { period1, period2, interval: '5m' };
    const result = await yahooFinance.chart(symbol, queryOptions);

    return result.quotes.map(entry => ({
        date: new Date(entry.date),
        open: entry.open,
        high: entry.high,
        low: entry.low,
        close: entry.close,
        volume: entry.volume,
    }));
}

// Function to calculate pivots
function pivotID(ohlc, l, n1, n2) {
    if (l - n1 < 0 || l + n2 >= ohlc.length) {
        return 0;
    }

    let pivotLow = 1;
    let pivotHigh = 1;

    for (let i = l - n1; i <= l + n2; i++) {
        if (ohlc[l].low > ohlc[i].low) {
            pivotLow = 0;
        }
        if (ohlc[l].high < ohlc[i].high) {
            pivotHigh = 0;
        }
    }

    if (pivotLow && pivotHigh) {
        return 3;  // Both pivot low and high
    } else if (pivotLow) {
        return 1;  // Pivot low
    } else if (pivotHigh) {
        return 2;  // Pivot high
    } else {
        return 0;  // No pivot
    }
}

// Manual linear regression function
function linearRegression(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.map((xi, i) => xi * y[i]).reduce((a, b) => a + b, 0);
    const sumX2 = x.map(xi => xi * xi).reduce((a, b) => a + b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate r-squared (goodness of fit)
    const meanY = sumY / n;
    const ssTotal = y.reduce((a, yi) => a + (yi - meanY) ** 2, 0);
    const ssResidual = y.reduce((a, yi, i) => a + (yi - (slope * x[i] + intercept)) ** 2, 0);
    const r2 = 1 - ssResidual / ssTotal;

    return { slope, intercept, r2 };
}

// Function to find triangle patterns (symmetrical, ascending, descending)
function findTrianglePoints(ohlc, backcandles, triangleType = "symmetrical") {
    let trianglePoints = [];

    for (let candleID = backcandles + 10; candleID < ohlc.length; candleID++) {
        let maxim = [];
        let minim = [];
        let xxMin = [];
        let xxMax = [];

        for (let i = candleID - backcandles; i <= candleID; i++) {
            if (ohlc[i].pivot === 1) {
                minim.push(ohlc[i].low);
                xxMin.push(i);
            }
            if (ohlc[i].pivot === 2) {
                maxim.push(ohlc[i].high);
                xxMax.push(i);
            }
        }

        if (xxMax.length < 3 && xxMin.length < 3) {
            continue;
        }

        const minRegression = linearRegression(xxMin, minim);
        const maxRegression = linearRegression(xxMax, maxim);

        if (triangleType === "symmetrical" && 
            Math.abs(minRegression.r2) >= 0.9 && Math.abs(maxRegression.r2) >= 0.9 && 
            minRegression.slope >= 0.0001 && maxRegression.slope <= -0.0001) {
            trianglePoints.push(candleID);
        }

        if (triangleType === "ascending" && 
            Math.abs(minRegression.r2) >= 0.9 && Math.abs(maxRegression.r2) >= 0.9 && 
            minRegression.slope >= 0.0001 && Math.abs(maxRegression.slope) <= 0.00001) {
            trianglePoints.push(candleID);
        }

        if (triangleType === "descending" && 
            Math.abs(minRegression.r2) >= 0.9 && Math.abs(maxRegression.r2) >= 0.9 && 
            maxRegression.slope <= -0.0001 && Math.abs(minRegression.slope) <= 0.00001) {
            trianglePoints.push(candleID);
        }
    }

    return trianglePoints;
}

// Function to print detailed information about the triangle points
function printTriangleDetails(ohlc, trianglePoints, patternType) {
    console.log(`\n=== ${patternType.toUpperCase()} TRIANGLE POINTS ===`);
    trianglePoints.forEach(point => {
        const candle = ohlc[point];
        console.log(`Date: ${candle.date.toLocaleString()}`);
        console.log(`Open: ${candle.open}, High: ${candle.high}, Low: ${candle.low}, Close: ${candle.close}`);
        console.log(`---------------------------------------`);
    });
}

// Main function to process stock data and find triangle patterns
async function main() {
    const symbol = 'ACC.NS';  // Stock symbol
    const days = 10;  // Number of days of data to fetch

    // Fetch stock data
    const stockData = await fetchStockData(symbol, days);

    // Calculate pivots for stock data
    stockData.forEach((entry, index) => {
        entry.pivot = pivotID(stockData, index, 3, 3);
    });

    // Identify triangle patterns
    const backcandles = 20;
    const trianglePointsSymmetrical = findTrianglePoints(stockData, backcandles, 'symmetrical');
    const trianglePointsAscending = findTrianglePoints(stockData, backcandles, 'ascending');
    const trianglePointsDescending = findTrianglePoints(stockData, backcandles, 'descending');

    // Print detailed information about each pattern type
    printTriangleDetails(stockData, trianglePointsSymmetrical, 'symmetrical');
    printTriangleDetails(stockData, trianglePointsAscending, 'ascending');
    printTriangleDetails(stockData, trianglePointsDescending, 'descending');
}

main().catch(err => console.error(err));
