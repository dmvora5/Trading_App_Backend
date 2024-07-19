function isMarketOpen() {

    const now = new Date();
    const marketOpen = new Date();
    marketOpen.setHours(global.config.marketOpenTime.hour, global.config.marketOpenTime.minute, 0, 0);

    const marketClose = new Date();
    marketClose.setHours(global.config.marketCloseTime.hour, global.config.marketCloseTime.minute, 0, 0);

    return now >= marketOpen && now <= marketClose;
}

function getMarketCloseTime() {

    const marketClose = new Date();
    marketClose.setHours(global.config.marketCloseTime.hour, global.config.marketCloseTime.minute, 0, 0);
    return marketClose;
}

module.exports = { isMarketOpen, getMarketCloseTime }