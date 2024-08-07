

const STATERGY_NAME = {
    SSLCCI: 'SSLCCI',
    BBTRAND: 'BBTRAND',
    RSICE: 'RSICE'
}

const MARKET_TIME = {
    OPENHOUR: 9,
    OPENMINUTE: 16,
    CLOSEHOUR: 15,
    CLOSEMINUTE: 30,
}

const EVENT_NAME = {
    [STATERGY_NAME.SSLCCI]: "SSLCCIEVENT",
    [STATERGY_NAME.BBTRAND]: "BBTRANDEVENT",
    [STATERGY_NAME.RSICE]: "RSICEEVENT"
}


module.exports = { STATERGY_NAME, MARKET_TIME, EVENT_NAME };