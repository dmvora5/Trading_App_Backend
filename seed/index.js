require('dotenv').config();

const db = require("../src/Config/DatabaseConnect");
const Settings = require('../src/Models/Settimgs');


const seed = async () => {
    try {
        await Settings.deleteMany();

        const setting = new Settings({
            SSLCCI: {
                indicatorConfig: {
                    period: 13,
                    cciLength: 40,
                    cciLookbackBefore: 3,
                    cciLookbackAfter: 3,
                    cciLowerBand: -100,
                    cciUpperBand: 100
                },
                timeFrame: "5m",
                lookbackDay: 2, // change to 1 it's saaturday s holidy so only testing perpose
                lookBackCandleForSignal: 3,
                pageSize: 10,
                defaultIndex: "NIFTY200",
                interval: 5
            },
            BBTRAND: {
                indicatorConfig: {
                    length: 20,
                    mult: 2.0,
                    lookback: 100,
                    smaLength: 5
                },
                higherTimeFrame: {
                    interval: "1d",
                    lookbackDays: 100,
                    bbLookbackRange: 3,
                    tickinterval: 60
                },
                interMidTimeFrame: {
                    interval: "1h",
                    lookbackDays: 5,
                    bbLookbackRange: 2,
                    tickinterval: 60
                },
                smallerTimeFrame: {
                    interval: "15m",
                    lookbackDays: 1,
                    bbLookbackRange: 2,
                    tickinterval: 15
                },
                defaultIndex: "NIFTY200",
                pageSize: 10

            }
        });

        await setting.save();

        console.log("Seeding finish......");

        process.exit(0);

    } catch (err) {
        console.log('[ERROR IN SEED]', err)
    }
}


db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');

    seed()
});
