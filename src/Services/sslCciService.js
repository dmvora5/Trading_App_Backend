const { SSLCciStrategy } = require("technical-strategies");
const { fetchStockData } = require("./stockDataService");
const { getSelectedStock } = require("../Events/socket");
const logger = require("../Utils/logger");
const Settings = require("../Models/Settimgs");
const StocksSymbol = require("../Models/StocksSymbol");
const StockData = require("../Models/StockData");
const { STATERGY_NAME } = require("../Constant");


class SslAndCciService {

    indicatorConfig;
    timeFrame;
    lookbackDay;
    lookBackCandleForSignal;
    count;
    pageSize;
    defaultIndex;

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
        lookBackCandleForSignal = 3,
        defaultIndex = "NITY200",
        pageSize = 10,
        count
    }) {
        this.indicatorConfig = {
            period,
            cciLength,
            cciLookbackBefore,
            cciLookbackAfter,
            cciLowerBand,
            cciUpperBand
        };
        this.timeFrame = timeFrame;
        this.lookbackDay = lookbackDay;
        this.lookBackCandleForSignal = lookBackCandleForSignal;
        this.pageSize = pageSize,
        this.count = count;
        this.defaultIndex = defaultIndex;
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

    async fetchAndFilterStocks(stocks) {
        const fetchPromises = stocks.map(symbol => this.processStockData(symbol));
        const results = await Promise.allSettled(fetchPromises);

        const savePromises = results.map(async result => {
            if (result.status === 'rejected') {
                console.error('Error:', result.reason);
            } else {
                const { enrichedData, symbol, recentSignal } = result.value;
                console.log('symbol', symbol)
                console.table(enrichedData.map(ele => ({ ...ele, date: new Date(ele.date).toLocaleString() })), ['date', 'open', 'high', 'low', 'close', 'crossover', 'trade']);
                if (recentSignal && typeof recentSignal === 'object') {
                    console.log('recentSignal', recentSignal)
                    console.log(`Stock with recent signal: ${symbol}`);
                    const stockDocument = new StockData({
                        name: STATERGY_NAME.SSLCCI,
                        symbol,
                        ...recentSignal
                    });
                    await stockDocument.save();
                }
            }
        });

        await Promise.all(savePromises);

        return results;
    }

    async run() {

       logger.info("SSLCCISTATERGYRUN" + new Date().toLocaleString())
        const totalPages = Math.ceil(this.count / this.pageSize);

        const query = this.defaultIndex ? { indices: this.defaultIndex } : {};
        await StockData.deleteMany({
            name: STATERGY_NAME.SSLCCI
        });

        for (let i = 1; i <= totalPages; i++) {

            const stocks = await StocksSymbol.find(query).skip((i - 1) * this.pageSize).limit(this.pageSize).lean();
            const stocksSymbols = stocks.map(stock => stock.symbol);

            await this.fetchAndFilterStocks(stocksSymbols);
        }
        getSelectedStock(STATERGY_NAME.SSLCCI);

    }

    async changeSetting(setting) {
        this.indicatorConfig = setting.indicatorConfig ? {
            ...this.indicatorConfig,
            ...setting.indicatorConfig
        } : this.indicatorConfig;
        this.timeFrame = setting.timeFrame ? setting.timeFrame : this.timeFrame;
        this.lookbackDay = setting.lookbackDay ? setting.lookbackDay : this.lookbackDay;
        this.lookBackCandleForSignal = setting.lookBackCandleForSignal ? setting.lookBackCandleForSignal : this.lookBackCandleForSignal;
        this.pageSize = setting.pageSize ? setting.pageSize : this.pageSize;

        if(setting.defaultIndex) {
            this.defaultIndex = setting.defaultIndex ? setting.defaultIndex : this.defaultIndex;
            this.count = await StocksSymbol.countDocuments({ indices: setting.defaultIndex })
        }


        try {
            await Settings.updateOne({}, {
                SSLCCI: {
                    indicatorConfig: this.indicatorConfig,
                    timeFrame: this.timeFrame,
                    lookbackDay: this.lookbackDay,
                    lookBackCandleForSignal: this.lookBackCandleForSignal,
                    pageSize: this.pageSize,
                    defaultIndex: this.defaultIndex
                }
            })
        } catch (err) {
            logger.error("[Error] in changer settings]" + err.message);
            console.log("[Error] in changer settings]", err);
        }
    }

}


module.exports = SslAndCciService;