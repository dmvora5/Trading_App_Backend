const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    SSLCCI: {
        indicatorConfig: {
            period: Number,
            cciLength: Number,
            cciLookbackBefore: Number,
            cciLookbackAfter: Number,
            cciLowerBand: Number,
            cciUpperBand: Number
        },
        timeFrame: String,
        lookbackDay: Number,
        lookBackCandleForSignal: Number,
        pageSize: Number,
        defaultIndex: String,
        interval: Number
    },
    BBTRAND: {
        indicatorConfig: {
            length: Number,
            mult: Number,
            lookback: Number,
            smaLength: Number
        },
        higherTimeFrame : {
            interval: String,
            lookbackDays: Number,
            bbLookbackRange: Number,
            tickinterval: Number
        },
        interMidTimeFrame : {
            interval: String,
            lookbackDays: Number,
            bbLookbackRange: Number,
            tickinterval: Number
        },
        smallerTimeFrame : {
            interval: String,
            lookbackDays: Number,
            bbLookbackRange: Number,
            tickinterval: Number
        },
        defaultIndex: String,
        pageSize: Number

    }
});


const Settings = mongoose.model('Settings', schema);

module.exports = Settings;