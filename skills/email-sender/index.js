/**
 * Email Sender Skill - IMSS Lab Appointment POC
 * Sends confirmation and error emails via Gmail API
 */

const { EmailSenderService } = require('./sender-service');
const { renderEmail } = require('./email-templates');

// Configuration
const EMAIL_CONFIG = {
    credentialsFile: '~/.openclaw/credentials.json',
    serviceAccount: 'lab-bot@gmail.com',
    maxRetries: 3,
    backoffSchedule: [5, 10, 15],
    rateLimitDelayMs: 1000
};

/**
 * Main entry point for the email sender skill
 * @param {Object} context - OpenClaw execution context
 * @returns {Object} Email send result
 */
async function sendEmail(context) {
    const emailService = new EmailSenderService(EMAIL_CONFIG);

    context.log.info('Email Sender: Processing request', {
        skill: 'email-sender',
        timestamp: new Date().toISOString()
    });

    try {
        const { email, appointmentId } = context.input;

        if (!email || !email.to || !email.subject || !email.body) {
            throw new Error('Invalid email data: missing required fields (to, subject, body)');
        }

        // Send email
        const result = await emailService.sendEmail({
            to: email.to,
            subject: email.subject,
            body: email.body,
            threadId: email.threadId
        });

        if (result.success) {
            context.log.info('Email sent successfully', {
                messageId: result.messageId,
                to: email.to,
                subject: email.subject
            });

            return {
                success: true,
                action: 'EMAIL_SENT',
                messageId: result.messageId,
                threadId: result.threadId,
                appointmentId,
                sentAt: result.sentAt,
                attempts: result.attempt
            };

        } else {
            context.log.error('Email send failed', {
                error: result.error,
                errorType: result.errorType,
                attempts: result.attempts
            });

            return {
                success: false,
                action: 'EMAIL_FAILED',
                error: result.error,
                errorType: result.errorType,
                attempts: result.attempts,
                failedAt: result.failedAt,
                queuedForLater: result.errorType === 'GMAIL_RATE_LIMIT'
            };
        }

    } catch (error) {
        context.log.error('Email Sender: Critical error', {
            error: error.message,
            stack: error.stack
        });

        return {
            success: false,
            action: 'EMAIL_CRITICAL_ERROR',
            error: error.message,
            errorType: 'CRITICAL_ERROR'
        };
    }
}

/**
 * Send confirmation email (convenience wrapper)
 */
async function sendConfirmationEmail(context) {
    const emailService = new EmailSenderService(EMAIL_CONFIG);

    try {
        const { to, appointmentData } = context.input;

        const result = await emailService.sendConfirmationEmail(to, appointmentData);

        return {
            success: result.success,
            ...result
        };

    } catch (error) {
        context.log.error('Send confirmation error', { error: error.message });
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Send error email (convenience wrapper)
 */
async function sendErrorEmail(context) {
    const emailService = new EmailSenderService(EMAIL_CONFIG);

    try {
        const { to, errorType, errorData } = context.input;

        const templateMap = {
            'INVALID_DATA': 'errorInvalidData',
            'NO_AVAILABILITY': 'errorNoAvailability',
            'SLOT_FULL': 'errorSlotFull',
            'DB_ERROR': 'errorDatabase',
            'UNKNOWN_ERROR': 'errorSystem'
        };

        const templateType = templateMap[errorType] || 'errorSystem';
        const email = renderEmail(templateType, errorData);

        const result = await emailService.sendEmail({
            to,
            subject: email.subject,
            body: email.body
        });

        return {
            success: result.success,
            ...result
        };

    } catch (error) {
        context.log.error('Send error email error', { error: error.message });
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    sendEmail,
    sendConfirmationEmail,
    sendErrorEmail
};
