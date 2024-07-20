const { STATERGY_NAME, MARKET_TIME } = require("../Constant");
const SslAndCciService = require("./sslCciService");
const schedulerManager = require("../SchedulerManager/schedulerManager");
const BolingerBandeStatergy = require("./bollingerBandStatergies");




exports.startSslCciService = async ({ setting, count }) => {
    const sslcciIntance = new SslAndCciService({
        ...setting[STATERGY_NAME.SSLCCI],
        count: count
    });

    await sslcciIntance.run();

    const bindedRunFunction = sslcciIntance.run.bind(sslcciIntance);

    schedulerManager.addJob(STATERGY_NAME.SSLCCI, {
        initialHour: MARKET_TIME.OPENHOUR,
        initialMinute: MARKET_TIME.OPENMINUTE,
        intervalMinutes: setting[STATERGY_NAME.SSLCCI].tickinterval,
        jobFunction: bindedRunFunction
    });
}



exports.startBbTrandService = async ({ setting, count }) => {
    const bbtrandInstance = new BolingerBandeStatergy({
        ...setting[STATERGY_NAME.BBTRAND],
        count: count
    });

    await bbtrandInstance.perforHigherTimeFrameChecks();
    await bbtrandInstance.performSmallerTimeFrameChecks();

    const bindedPerforHigherTimeFrameChecks = bbtrandInstance.perforHigherTimeFrameChecks.bind(bbtrandInstance);
    const bindedPerformSmallerTimeFrameChecks = bbtrandInstance.performSmallerTimeFrameChecks.bind(bbtrandInstance);

    schedulerManager.addJobGroup(STATERGY_NAME.BBTRAND, [
        {
            name: "HIGHERTIME",
            options: {
                initialHour: MARKET_TIME.OPENHOUR,
                initialMinute: MARKET_TIME.OPENMINUTE,
                intervalMinutes: setting[STATERGY_NAME.BBTRAND].higherTimeFrame.tickinterval,
                jobFunction: bindedPerforHigherTimeFrameChecks
            }
        },
        {
            name: "LOWERTIME",
            options: {
                initialHour: MARKET_TIME.OPENHOUR,
                initialMinute: MARKET_TIME.OPENMINUTE,
                intervalMinutes: setting[STATERGY_NAME.BBTRAND].smallerTimeFrame.tickinterval,
                secondFraction: 32,
                jobFunction: bindedPerformSmallerTimeFrameChecks
            }
        }
    ])
}