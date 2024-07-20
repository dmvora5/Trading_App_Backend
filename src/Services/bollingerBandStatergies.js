const { BollingerBandsSignal } = require("technical-strategies");
const logger = require("../Utils/logger");
const { fetchStockData } = require("./stockDataService");
const StockData = require("../Models/StockData");
const { STATERGY_NAME } = require("../Constant");
const StocksSymbol = require("../Models/StocksSymbol");
const { getSelectedStock } = require("../Events/socket");




class BolingerBandeStatergy {

    indicatorConfig = {
        length: 20,
        mult: 2.0,
        lookback: 100,
        smaLength: 5
    }

    higherTimeFrame = {
        interval: "1d",
        lookbackDays: 100,
        bbLookbackRange: 3
    }

    interMidTimeFrame = {
        interval: "1h",
        lookbackDays: 5,
        bbLookbackRange: 2
    }

    smallerTimeFrame = {
        interval: "15m",
        lookbackDays: 1,
        bbLookbackRange: 2
    }
    defaultIndex = "NIFTY200";
    pageSize = 10;
    count;

    bollingerBandsSignal;

    filteredStocks = [];

    isHigherTimeframeCheckRunning = false;

    constructor({
        indicatorConfig,
        higherTimeFrame,
        interMidTimeFrame,
        smallerTimeFrame,
        defaultIndex = "NIFTY200",
        pageSize = 10,
        count
    }) {
        this.indicatorConfig = indicatorConfig ? indicatorConfig : this.indicatorConfig;
        this.higherTimeFrame = higherTimeFrame ? higherTimeFrame : this.higherTimeFrame;
        this.interMidTimeFrame = interMidTimeFrame ? interMidTimeFrame : this.interMidTimeFrame;
        this.smallerTimeFrame = smallerTimeFrame ? smallerTimeFrame : this.smallerTimeFrame;
        this.defaultIndex = defaultIndex;
        this.pageSize = pageSize;
        this.count = count;

        this.bollingerBandsSignal = new BollingerBandsSignal(this.indicatorConfig);
    }


    isRising(data, lastN) {
        try {
            const signals = this.bollingerBandsSignal.apply(data);
            return signals.slice(-lastN).every(entry => entry.signal === 'rising');
        } catch (error) {
            logger.error(`Error applying Bollinger Bands signal: ${error.message}`);
            console.log('error', error)
            throw error;
        }
    }

    async filterHigtherTimeFrame(symbols) {
        try {
            const filteredStocks = [];
            for (const symbol of symbols) {
                const data = await fetchStockData({
                    symbol,
                    interval: this.higherTimeFrame.interval,
                    lookbackDays: this.higherTimeFrame.lookbackDays
                });
                if (this.isRising(data, this.higherTimeFrame.bbLookbackRange)) {
                    filteredStocks.push(symbol);
                }
            }
            return filteredStocks;
        } catch (error) {
            logger.error(`Error in daily time frame filtering: ${error.message}`);
            console.log('err', error);
            throw error;
        }
    }

    async filterInterMidTimeFrame(symbols) {
        try {
            const filteredStocks = [];
            for (const symbol of symbols) {
                const data = await fetchStockData({
                    symbol,
                    interval: this.interMidTimeFrame.interval,
                    lookbackDays: this.interMidTimeFrame.lookbackDays
                }); // Fetch last 5 days of hourly data
                if (this.isRising(data, this.interMidTimeFrame.bbLookbackRange)) {
                    filteredStocks.push(symbol);
                }
            }
            return filteredStocks;
        } catch (error) {
            logger.error(`Error in hourly time frame filtering: ${error.message}`);
            console.log('[filterHourlyTimeFrame] err', err)
            throw error;
        }
    }

    async filterSmallerTimeFrame(symbols) {
        try {
            const filteredStocks = [];
            for (const symbol of symbols) {
                const data = await fetchStockData({
                    symbol,
                    interval: this.smallerTimeFrame.interval,
                    lookbackDays: this.smallerTimeFrame.lookbackDays
                }); // Fetch last 1 day of 15-minute data
                if (this.isRising(data, this.smallerTimeFrame.bbLookbackRange)) {
                    filteredStocks.push(symbol);
                }
            }
            return filteredStocks;
        } catch (error) {
            console.log('error', error)
            logger.error(`Error in 15-minute time frame filtering: ${error.message}`);
            throw error;
        }
    }

    async perforHigherTimeFrameChecks() {
        try {

            ///////


            logger.info("BBTRANDSTATERGY RUN" + "HIGHERTIMEFRAME" + new Date().toLocaleString());

            this.isHigherTimeframeCheckRunning = true

            const totalPages = Math.ceil(this.count / this.pageSize);

            const query = this.defaultIndex ? { indices: this.defaultIndex } : {};

            this.filteredStocks = [];

            for (let i = 1; i <= totalPages; i++) {

                const stocks = await StocksSymbol.find(query).skip((i - 1) * this.pageSize).limit(this.pageSize).lean();

                const stocksSymbols = stocks.map(stock => stock.symbol);

                console.log('Running daily and hourly checks...');
                const dailyFilteredStocks = await this.filterHigtherTimeFrame(stocksSymbols);
                console.log(`Daily Filtered Stocks: ${dailyFilteredStocks.join(', ')}`);

                const stocksResults = await this.filterInterMidTimeFrame(dailyFilteredStocks);

                console.log('stocksResults', stocksResults);

                console.log('this.filteredStocks', this.filteredStocks)

                this.filteredStocks = [...this.filteredStocks, ...stocksResults];

                console.log(`Hourly Filtered Stocks: `);

            }

            await this.performSmallerTimeFrameChecks()
        } catch (error) {
            logger.error(`Error in daily and hourly checks: ${error.message}`);
            console.log('error', error)
        } finally {
            this.isHigherTimeframeCheckRunning = false;
        }
    }


    async performSmallerTimeFrameChecks() {

        if (this.isHigherTimeframeCheckRunning) {
            console.log('Hourly check is running, waiting...');
            return;
        }
        logger.info("BBTRANDSTATERGY RUN" + "LOWERTIMEFRAME" + new Date().toLocaleString());

        try {
            await StockData.deleteMany({
                name: STATERGY_NAME.BBTRAND
            });

            console.log('this.filteredStocks', this.filteredStocks)

            const totalCount = this.filteredStocks.length;
            const totalPages = Math.ceil(totalCount / this.pageSize);

            console.log('Running 15-minute checks...');

            let fifteenMinutesFilteredStocks = [];

            for (let i = 0; i < totalPages; i++) {
                const start = i * this.pageSize;
                const end = start + this.pageSize;
                const currentBatch = this.filteredStocks.slice(start, end);

                const result = await this.filterSmallerTimeFrame(currentBatch);

                fifteenMinutesFilteredStocks = [...fifteenMinutesFilteredStocks, ...result];

                console.log(`Page ${i + 1} - 15-Minutes Filtered Stocks: ${fifteenMinutesFilteredStocks.join(', ')}`);
            }

            if (fifteenMinutesFilteredStocks.length) {
                await StockData.deleteMany({ name: STATERGY_NAME.BBTRAND });
                const inserData = fifteenMinutesFilteredStocks.map(stock => ({
                    name: STATERGY_NAME.BBTRAND,
                    symbol: stock,
                    trade: "tranding"
                }))
                await StockData.insertMany(inserData)
                getSelectedStock(STATERGY_NAME.BBTRAND, inserData);


            }
        } catch (error) {
            console.log('error', error)
            logger.error(`Error in 15-minute checks: ${error.message}`);
        }
    }


}



module.exports = BolingerBandeStatergy