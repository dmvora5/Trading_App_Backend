const { EVENT_NAME } = require("../Constant");
const StockData = require("../Models/StockData");
const logger = require("../Utils/logger");

function configureSocket(io) {
    global.io = io;
    io.on("connection", (socket) => {
        console.log("Connection established with socketId: ", socket?.id)
    })
}


async function getSelectedStock(name, data) {
    try {
        const stocks = data ? data : await StockData.find({
            name: name
        })
        const eventName = EVENT_NAME[name];
        global.io.emit(eventName, stocks)
    } catch (err) {
        logger.error("[Error in getSelectedStock]" + err.message);
        console.log('err', err)
    }
}

module.exports = { configureSocket, getSelectedStock };