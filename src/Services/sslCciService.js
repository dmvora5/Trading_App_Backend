const { SSLCciStrategy } = require("technical-strategies");
const { fetchStockData } = require("./stockDataService");


class SslAndCciService {

    indicatorConfig;
    timeFrame;
    lookbackDay;
    lookBackCandleForSignal;

    constructor({ indicatorConfig: {
        period = 13,
        cciLength = 40,
        cciLookbackBefore = 3,
        cciLookbackAfter = 3,
        cciLowerBand = -100,
        cciUpperBand = 100
    },
        timeFrame = "5m",
        lookbackDay = 1,
        lookBackCandleForSignal = 3
    }) {

        this.indicatorConfig = {
            period,
            cciLength,
            cciLookbackBefore,
            cciLookbackAfter,
            cciLowerBand,
            cciUpperBand
        }
       this.timeFrame = timeFrame;
       this.lookbackDay = lookbackDay;
       this.lookBackCandleForSignal = lookBackCandleForSignal;

    }

    hasRecentSignal(data, lookbackPeriod) {
        const start = Math.max(data.length - lookbackPeriod, 0);
        for (let i = data.length - 1; i >= start; i--) {
            if (data[i].trade) {
                return data[i];
            }
        }
        return false;
    }

    async processStockData(symbol) {
       
        try {
            const stockData = await fetchStockData({
                symbol: symbol,
                interval: this.timeFrame,
                lookbackDays: this.lookbackDay
            });

            if (!stockData.length) {
                console.log(`Stock: ${symbol}, Not enough data`);
                return { symbol, enrichedData: [], recentSignal: false };
            }
            
            const strategy = new SSLCciStrategy(this.indicatorConfig);

            const enrichedData = strategy.apply(stockData);
            console.log(`Stock: ${symbol}`);

            const recentSignal = this.hasRecentSignal(enrichedData, this.lookBackCandleForSignal);

            return { symbol, enrichedData, recentSignal };
        } catch (error) {
            console.error(`Error fetching data for ${symbol}:`, error.message);
            return { symbol, enrichedData: [], recentSignal: false };
        }
    }


}