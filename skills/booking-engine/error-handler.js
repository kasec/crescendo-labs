/**
 * Error Handler Module - Comprehensive error handling for all edge cases
 * Handles: H1 (slot full), H2 (invalid data), H3 (DB errors), H4 (OAuth), H5 (Gmail API)
 */

const { renderEmail } = require('./templates');

// Error types enumeration
const ErrorTypes = {
    SLOT_FULL: 'SLOT_FULL',
    NO_AVAILABILITY: 'NO_AVAILABILITY',
    INVALID_DATA: 'INVALID_DATA',
    DB_ERROR: 'DB_ERROR',
    OAUTH_EXPIRED: 'OAUTH_EXPIRED',
    GMAIL_API_ERROR: 'GMAIL_API_ERROR'
};

/**
 * Main error handler - routes to specific handler based on error type
 * @param {string} errorType - Type of error
 * @param {Object} context - Error context with relevant data
 * @returns {Object} Handler result with action and email data
 */
async function handleError(errorType, context) {
    switch (errorType) {
        case ErrorTypes.SLOT_FULL:
            return await handleSlotFull(context);
        case ErrorTypes.NO_AVAILABILITY:
            return await handleNoAvailability(context);
        case ErrorTypes.INVALID_DATA:
            return await handleInvalidData(context);
        case ErrorTypes.DB_ERROR:
            return await handleDatabaseError(context);
        case ErrorTypes.OAUTH_EXPIRED:
            return await handleOAuthExpired(context);
        case ErrorTypes.GMAIL_API_ERROR:
            return await handleGmailApiError(context);
        default:
            return await handleUnknownError(context);
    }
}

/**
 * H1: Handle slot full error - offer next available slot
 */
async function handleSlotFull(context) {
    const { 
        doctorName, 
        doctorEmail, 
        labType, 
        requestedDate, 
        requestedTime,
        alternativeDate,
        alternativeTime,
        labLocation 
    } = context;

    const emailData = {
        doctorName,
        labType,
        requestedDate,
        requestedTime,
        alternativeDate,
        alternativeTime,
        labLocation
    };

    const email = renderEmail('errorSlotFull', emailData);

    return {
        action: 'SEND_EMAIL',
        errorType: ErrorTypes.SLOT_FULL,
        severity: 'WARNING',
        retryable: false,
        email: {
            to: doctorEmail,
            subject: email.subject,
            body: email.body
        },
        suggestion: 'Alternative slot offered',
        metadata: {
            alternativeDate,
            alternativeTime
        }
    };
}

/**
 * H1 (extended): Handle no availability in 7 days
 */
async function handleNoAvailability(context) {
    const { 
        doctorName, 
        doctorEmail, 
        labType,
        nextAvailableDate 
    } = context;

    const emailData = {
        doctorName,
        labType,
        nextAvailableDate
    };

    const email = renderEmail('errorNoAvailability', emailData);

    return {
        action: 'SEND_EMAIL',
        errorType: ErrorTypes.NO_AVAILABILITY,
        severity: 'ERROR',
        retryable: false,
        email: {
            to: doctorEmail,
            subject: email.subject,
            body: email.body
        },
        suggestion: 'No slots available in 7 days',
        metadata: {
            nextAvailableDate
        }
    };
}

/**
 * H2: Handle invalid email format/data
 */
async function handleInvalidData(context) {
    const { 
        doctorName, 
        doctorEmail, 
        errorMessage 
    } = context;

    const emailData = {
        doctorName,
        errorMessage
    };

    const email = renderEmail('errorInvalidData', emailData);

    return {
        action: 'SEND_EMAIL',
        errorType: ErrorTypes.INVALID_DATA,
        severity: 'WARNING',
        retryable: false,
        email: {
            to: doctorEmail,
            subject: email.subject,
            body: email.body
        },
        suggestion: 'User needs to correct data format',
        metadata: {
            validationErrors: context.validationErrors
        }
    };
}

/**
 * H3: Handle database errors with retry logic
 */
async function handleDatabaseError(context) {
    const { 
        doctorName, 
        doctorEmail, 
        errorMessage,
        retryAttempt = 0,
        maxRetries = 3 
    } = context;

    const shouldRetry = retryAttempt < maxRetries;
    const retryDelay = shouldRetry ? calculateBackoffDelay(retryAttempt) : 0;

    let email = null;
    if (!shouldRetry) {
        // Max retries exceeded, send error email
        const emailData = {
            doctorName,
            errorMessage
        };
        email = renderEmail('errorDatabase', emailData);
    }

    return {
        action: shouldRetry ? 'RETRY' : 'SEND_EMAIL',
        errorType: ErrorTypes.DB_ERROR,
        severity: 'ERROR',
        retryable: shouldRetry,
        retryAttempt: retryAttempt + 1,
        maxRetries,
        retryDelay,
        email: email ? {
            to: doctorEmail,
            subject: email.subject,
            body: email.body
        } : null,
        suggestion: shouldRetry ? `Retry in ${retryDelay}s` : 'Max retries exceeded',
        metadata: {
            databaseError: errorMessage,
            retryHistory: context.retryHistory || []
        }
    };
}

/**
 * H4: Handle OAuth token expiration
 */
async function handleOAuthExpired(context) {
    const { 
        errorMessage,
        tokenRefreshAttempted = false 
    } = context;

    // Alert admin (in production, this would send to monitoring system)
    const alert = {
        type: 'OAUTH_EXPIRED',
        severity: 'CRITICAL',
        message: 'Gmail OAuth token expired',
        details: errorMessage,
        timestamp: new Date().toISOString(),
        action: tokenRefreshAttempted ? 'TOKEN_REFRESH_ATTEMPTED' : 'MANUAL_INTERVENTION_REQUIRED'
    };

    return {
        action: tokenRefreshAttempted ? 'WAIT_FOR_REFRESH' : 'ALERT_ADMIN',
        errorType: ErrorTypes.OAUTH_EXPIRED,
        severity: 'CRITICAL',
        retryable: true,
        retryDelay: 60, // Wait 60s for token refresh
        alert,
        suggestion: tokenRefreshAttempted ? 'Waiting for token refresh' : 'Manual token refresh required',
        metadata: {
            oauthError: errorMessage,
            tokenRefreshAttempted
        }
    };
}

/**
 * H5: Handle Gmail API failures with exponential backoff
 */
async function handleGmailApiError(context) {
    const { 
        errorMessage, 
        retryAttempt = 0,
        maxRetries = 3,
        httpStatusCode 
    } = context;

    const shouldRetry = retryAttempt < maxRetries;
    
    // Exponential backoff: 5s, 10s, 15s
    const retryDelay = shouldRetry ? calculateBackoffDelay(retryAttempt, [5, 10, 15]) : 0;

    // Queue for later delivery if max retries exceeded
    const queueForLater = !shouldRetry && httpStatusCode === 429;

    return {
        action: shouldRetry ? 'RETRY' : (queueForLater ? 'QUEUE_FOR_LATER' : 'LOG_FAILURE'),
        errorType: ErrorTypes.GMAIL_API_ERROR,
        severity: httpStatusCode === 429 ? 'WARNING' : 'ERROR',
        retryable: shouldRetry,
        retryAttempt: retryAttempt + 1,
        maxRetries,
        retryDelay,
        queueForLater,
        suggestion: shouldRetry ? `Retry with backoff in ${retryDelay}s` : 'Queued for later delivery',
        metadata: {
            gmailError: errorMessage,
            httpStatusCode,
            backoffSchedule: [5, 10, 15],
            queuedAt: queueForLater ? new Date().toISOString() : null
        }
    };
}

/**
 * Handle unknown errors
 */
async function handleUnknownError(context) {
    const { 
        doctorName, 
        doctorEmail, 
        errorMessage 
    } = context;

    const emailData = {
        doctorName,
        errorMessage: errorMessage || 'Unknown error occurred'
    };

    const email = renderEmail('errorSystem', emailData);

    return {
        action: 'SEND_EMAIL',
        errorType: 'UNKNOWN_ERROR',
        severity: 'ERROR',
        retryable: false,
        email: {
            to: doctorEmail,
            subject: email.subject,
            body: email.body
        },
        suggestion: 'System error - manual review required',
        metadata: {
            unknownError: errorMessage
        }
    };
}

/**
 * Calculate backoff delay based on retry attempt
 * @param {number} attempt - Current retry attempt (0-indexed)
 * @param {Array} schedule - Backoff schedule in seconds
 * @returns {number} Delay in seconds
 */
function calculateBackoffDelay(attempt, schedule = [5, 10, 15]) {
    const index = Math.min(attempt, schedule.length - 1);
    return schedule[index];
}

/**
 * Classify error message to error type
 */
function classifyError(errorMessage) {
    if (!errorMessage) return ErrorTypes.UNKNOWN_ERROR;
    
    const errorStr = errorMessage.toUpperCase();
    
    if (errorStr.includes('SLOT_FULL') || errorStr.includes('NO SLOTS')) {
        return ErrorTypes.SLOT_FULL;
    }
    if (errorStr.includes('NO_AVAILABILITY') || errorStr.includes('NO AVAILABILITY')) {
        return ErrorTypes.NO_AVAILABILITY;
    }
    if (errorStr.includes('INVALID') || errorStr.includes('VALIDATION')) {
        return ErrorTypes.INVALID_DATA;
    }
    if (errorStr.includes('SQLITE') || errorStr.includes('DATABASE') || errorStr.includes('CONNECTION')) {
        return ErrorTypes.DB_ERROR;
    }
    if (errorStr.includes('OAUTH') || errorStr.includes('TOKEN') || errorStr.includes('EXPIRED')) {
        return ErrorTypes.OAUTH_EXPIRED;
    }
    if (errorStr.includes('GMAIL') || errorStr.includes('429') || errorStr.includes('RATE LIMIT')) {
        return ErrorTypes.GMAIL_API_ERROR;
    }
    
    return 'UNKNOWN_ERROR';
}

module.exports = {
    ErrorTypes,
    handleError,
    classifyError,
    calculateBackoffDelay
};
