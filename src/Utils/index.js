const { MARKET_TIME } = require("../Constant");

function isMarketOpen() {

    const now = new Date();
    const marketOpen = new Date();
    marketOpen.setHours(MARKET_TIME.OPENHOUR, MARKET_TIME.OPENMINUTE, 0, 0);

    const marketClose = new Date();
    marketClose.setHours(MARKET_TIME.CLOSEHOUR, MARKET_TIME.CLOSEMINUTE, 0, 0);

    return now >= marketOpen && now <= marketClose;
}

function getMarketCloseTime() {

    const marketClose = new Date();
    marketClose.setHours(MARKET_TIME.CLOSEHOUR, MARKET_TIME.CLOSEMINUTE, 0, 0);
    return marketClose;
}

const catchAsyncError = func => (req, res, next) => Promise.resolve(func(req, res, next)).catch(err => next(err));


const getYesterdayAtTime = (hours, minutes) => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(hours, minutes, 0, 0);
    return yesterday;
  };


module.exports = { isMarketOpen, getMarketCloseTime, catchAsyncError, getYesterdayAtTime }