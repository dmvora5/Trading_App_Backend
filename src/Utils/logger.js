const winston = require('winston');
const config = require("../Config/default");
const path = require('path');


const logDir = path.dirname(config.logFilePath);
const errorLogFile = path.join(logDir, 'error.log');
const infoLogFile = path.join(logDir, 'info.log');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: errorLogFile, level: 'error' }),
        new winston.transports.File({ filename: infoLogFile, level: 'info' }),
        new winston.transports.Console({ format: winston.format.simple() })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

module.exports = logger;
