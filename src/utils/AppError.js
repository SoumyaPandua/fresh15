class AppError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = Array.isArray(details) ? details : [details];
    Error.captureStackTrace?.(this, AppError);
  }
}

export default AppError;