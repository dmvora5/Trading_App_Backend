const { STATERGY_NAME, MARKET_TIME } = require("../Constant");
const Settings = require("../Models/Settimgs");
const StocksSymbol = require("../Models/StocksSymbol");
const { catchAsyncError } = require("../Utils");


const schedulerManager = require("../SchedulerManager/schedulerManager");
const ErrorHandler = require("../Error/ErrorHandler");
const { startSslCciService, startBbTrandService } = require("../Services/statergiesService");



exports.addNewStatergyAction = catchAsyncError(async (req, res, next) => {

    const { name } = req.body;

    if (schedulerManager.listJobs().includes(name)) {
        return next(new ErrorHandler("Statergy already running", 400))
    }

    const setting = await Settings.findOne({});
    const index = setting[name]?.defaultIndex || "";
    const count = await StocksSymbol.countDocuments({ indices: index });

    switch (name) {
        /**SSLCCI statergy */
        case STATERGY_NAME.SSLCCI:
            await startSslCciService({
                setting,
                count
            })
            break;

        /**BBTRAND statergy */
        case STATERGY_NAME.BBTRAND:
            await startBbTrandService({
                setting,
                count
            })
            break;
        default:
            break;
    };

    res.status(200).json({
        success: true,
        message: "Statergy added successfully"
    })
})


exports.removeRunningStatergisAction = catchAsyncError(async (req, res, next) => {
    const { name } = req.body;
    schedulerManager.removeJob(name);
    schedulerManager.removeJobGroup(name)
    res.status(200).json({
        success: true,
        message: "Statergy close successfully"
    });
})

exports.getRunningStatergiesAction = catchAsyncError(async (req, res, next) => {
    const jobs = schedulerManager.listJobs();
    res.status(200).json({
        success: true,
        data: jobs
    });
})