const mongoose = require('mongoose');

const tradeDataSchema = new mongoose.Schema({
    indices: String,
    symbol: String,
});

const StocksSymbol = mongoose.model('StocksSymbol', tradeDataSchema);

module.exports = StocksSymbol;
