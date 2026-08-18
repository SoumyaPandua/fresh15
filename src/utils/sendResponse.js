const sendResponse = (
  res,
  statusCode,
  success,
  message,
  data = null,
  code = success ? null : "REQUEST_FAILED",
  errors = []
) => {
  const statusCodes = {
    200: "OK",
    201: "CREATED",
    204: "NO_CONTENT",
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
    500: "INTERNAL_SERVER_ERROR",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
  };

  return res.status(statusCode).json({
    success,
    message,
    code: code || (success ? statusCodes[statusCode] || "OK" : statusCodes[statusCode] || "REQUEST_FAILED"),
    data,
    errors: Array.isArray(errors) ? errors : [errors],
  });
};

export default sendResponse;
