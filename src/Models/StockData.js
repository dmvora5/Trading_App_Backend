const mongoose = require('mongoose');

const stockDataSchema = new mongoose.Schema({
    name: String,
    symbol: String,
    date: Date,
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: Number,
    trade: String
});

const StockData = mongoose.model('StockData', stockDataSchema);

module.exports = StockData;
