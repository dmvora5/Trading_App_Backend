const logger = require("../Utils/logger");

exports.errorHandler = (err, req, res, next) => {
    logger.error(err?.status || 500 + "-" + err.message)
	console.log("err", err);
	res.status(err?.status || 500).json({
		success: false,
		message: err.message,
		status: err.status,
		err: err,
	});
};
