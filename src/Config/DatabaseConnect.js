const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

module.exports = db;
