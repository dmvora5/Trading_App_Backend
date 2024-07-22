
const { RsiAndChandaliarExit } = require("technical-strategies");
const { fetchStockData } = require("./stockDataService");
const StocksSymbol = require("../Models/StocksSymbol");
const { getSelectedStock } = require("../Events/socket");
const { STATERGY_NAME } = require("../Constant");
const Settings = require("../Models/Settimgs");
const logger = require("../Utils/logger");
const StockData = require("../Models/StockData");



class RsiAndCEStatergy {

    indicatorConfig = {
        rsiLength: 25,
        maLength: 150,
        maType: 'SMA',
        atrPeriod: 1,
        atrMultiplier: 2,
        useClosePriceForExtremums: true,
        checkCandles: 2,
    };

    timeFrame;
    lookbackDay;
    count;
    pageSize;
    defaultIndex;
    lookBackCandleForSignal;
    count;

    rsiAndCe;

    constructor({
        indicatorConfig,
        timeFrame = "15m",
        lookbackDay = 5,
        pageSize = 10,
        defaultIndex = "NIFTY200",
        lookBackCandleForSignal = 3,
        count
    }) {

        this.indicatorConfig = indicatorConfig ? indicatorConfig : this.indicatorConfig;
        this.timeFrame = timeFrame;
        this.lookbackDay = lookbackDay;
        this.pageSize = pageSize;
        this.defaultIndex = defaultIndex;
        this.lookBackCandleForSignal = lookBackCandleForSignal,
        this.count = count;


        this.rsiAndCe = new RsiAndChandaliarExit(this.indicatorConfig);

    }

    hasRecentSignal(data, lookbackPeriod) {
        const start = Math.max(data.length - lookbackPeriod, 0);
        for (let i = data.length - 1; i >= start; i--) {
            if (data[i].signal) {
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


            const enrichedData = this.rsiAndCe.computeIndicators(stockData);
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
                console.table(enrichedData.map(ele => ({ ...ele, date: new Date(ele.date).toLocaleString() })), ['date', 'open', 'high', 'low', 'close', 'signal']);
                if (recentSignal && typeof recentSignal === 'object') {
                    console.log('recentSignal', recentSignal)
                    console.log(`Stock with recent signal: ${symbol}`);
                    const stockDocument = new StockData({
                        name: STATERGY_NAME.RSICE,
                        symbol,
                        ...recentSignal,
                        trade: recentSignal.signal
                    });
                    await stockDocument.save();
                }
            }
        });

        await Promise.all(savePromises);

        return results;
    }

    async run() {

       logger.info("RSICESTATERGY" + new Date().toLocaleString())
        const totalPages = Math.ceil(this.count / this.pageSize);


        const query = this.defaultIndex ? { indices: this.defaultIndex } : {};
        await StockData.deleteMany({
            name: STATERGY_NAME.RSICE
        });

        for (let i = 1; i <= totalPages; i++) {

            const stocks = await StocksSymbol.find(query).skip((i - 1) * this.pageSize).limit(this.pageSize).lean();
            const stocksSymbols = stocks.map(stock => stock.symbol);


            await this.fetchAndFilterStocks(stocksSymbols);
        }
        getSelectedStock(STATERGY_NAME.RSICE);

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
                RSICE: {
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

module.exports = RsiAndCEStatergy;