class ErrorHandler extends Error {
	status;
	message;
	constructor(message, status) {
		super(message);
		this.message = message;
		this.status = status;
		Error.captureStackTrace(this, this.constructor);
	}
}

module.exports = ErrorHandler;
