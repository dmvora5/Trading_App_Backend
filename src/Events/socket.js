function configureSocket(io) {
    global.io = io;
    io.on("connection", (socket) => {
        console.log("Connection established with socketId: ", socket?.id)
    })
}


async function getSelectedStock() {

    //pending fetch and send stock data
    
    global.io.emit("FilteredStocks")
}

module.exports = { configureSocket, getSelectedStock };