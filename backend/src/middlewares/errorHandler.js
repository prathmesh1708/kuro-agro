import ApiError from '../utils/ApiError.js';

// Global error handler — must be last middleware in Express
const errorHandler = (err, req, res, next) => {
    let error = err;

    // Wrap non-ApiError instances
    if (!(error instanceof ApiError)) {
        let statusCode = error.statusCode || 500;
        let message = error.message || 'Internal Server Error';
        
        // Catch MongoDB Atlas / DNS resolution connection errors
        const errMsgStr = String(message).toLowerCase();
        if (errMsgStr.includes('getaddrinfo') || errMsgStr.includes('enotfound') || error.code === 'ENOTFOUND') {
            message = 'Database is temporarily unreachable. Please check your internet connection.';
            statusCode = 503;
        }
        
        error = new ApiError(statusCode, message, error.errors || [], err.stack);
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        error = new ApiError(409, `${field} already exists.`);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map((e) => ({
            field: e.path,
            message: e.message,
        }));
        const detailedMessage = `Validation failed: ${Object.values(err.errors).map((e) => e.message).join(', ')}`;
        error = new ApiError(400, detailedMessage, errors);
    }

    // Mongoose cast error (invalid ObjectId)
    if (err.name === 'CastError') {
        error = new ApiError(400, `Invalid ${err.path}: ${err.value}`);
    }

    const response = {
        success: false,
        message: error.message,
        ...(error.errors?.length > 0 && { errors: error.errors }),
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    };

    res.status(error.statusCode || 500).json(response);
};

export default errorHandler;
