/**
 * Email Sender Service - Sends emails via Gmail API using gogcli
 * Handles: confirmation emails, error emails, retry logic, rate limiting
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class EmailSenderService {
    constructor(config = {}) {
        this.credentialsFile = config.credentialsFile || '~/.openclaw/credentials.json';
        this.serviceAccount = config.serviceAccount || 'lab-bot@gmail.com';
        this.maxRetries = config.maxRetries || 3;
        this.backoffSchedule = config.backoffSchedule || [5, 10, 15];
        this.rateLimitDelay = config.rateLimitDelayMs || 1000;
    }

    /**
     * Send email using gogcli
     * @param {Object} emailData - Email data { to, subject, body, threadId? }
     * @returns {Object} Send result with messageId and status
     */
    async sendEmail(emailData) {
        const { to, subject, body, threadId } = emailData;
        
        let lastError = null;
        let attempt = 0;

        while (attempt <= this.maxRetries) {
            try {
                // Rate limiting
                if (attempt > 0) {
                    const delay = this.backoffSchedule[Math.min(attempt - 1, this.backoffSchedule.length - 1)];
                    console.log(`Email send: Waiting ${delay}s before retry ${attempt}/${this.maxRetries}`);
                    await this.sleep(delay * 1000);
                }

                // Build MIME message
                const mimeMessage = this.buildMimeMessage(to, subject, body);

                // Send via gogcli
                const result = await this.sendViaGogcli(mimeMessage, threadId);

                return {
                    success: true,
                    messageId: result.messageId,
                    threadId: result.threadId,
                    status: 'sent',
                    sentAt: new Date().toISOString(),
                    attempt: attempt + 1
                };

            } catch (error) {
                lastError = error;
                attempt++;

                // Check if retryable error
                if (!this.isRetryableError(error)) {
                    console.error('Email send: Non-retryable error', { error: error.message });
                    break;
                }

                console.warn(`Email send: Attempt ${attempt} failed`, {
                    error: error.message,
                    retryable: true
                });
            }
        }

        // All retries exhausted
        return {
            success: false,
            error: lastError?.message || 'Unknown error',
            errorType: this.classifyError(lastError),
            attempts: attempt,
            failedAt: new Date().toISOString()
        };
    }

    /**
     * Build MIME formatted email message
     */
    buildMimeMessage(to, subject, body) {
        const boundary = 'boundary_' + Date.now();
        const date = new Date().toUTCString();

        // Encode body to base64
        const encodedBody = Buffer.from(body).toString('base64');

        const mimeMessage = [
            'From: IMSS Lab Appointments <lab-bot@gmail.com>',
            `To: ${to}`,
            `Subject: ${subject}`,
            `Date: ${date}`,
            'MIME-Version: 1.0',
            `Content-Type: text/plain; charset="UTF-8"`,
            'Content-Transfer-Encoding: base64',
            '',
            encodedBody
        ].join('\r\n');

        return mimeMessage;
    }

    /**
     * Send email via gogcli command
     */
    async sendViaGogcli(mimeMessage, threadId = null) {
        try {
            // Use gogcli to send email
            // gogcli gmail send --message <mime_message> [--thread_id <thread_id>]
            const threadOption = threadId ? `--thread_id "${threadId}"` : '';
            const command = `echo "${mimeMessage}" | gogcli gmail send ${threadOption}`;

            const { stdout, stderr } = await execAsync(command, {
                timeout: 30000,
                maxBuffer: 1024 * 1024
            });

            // Parse gogcli output (expects JSON with messageId and threadId)
            const result = JSON.parse(stdout);

            return {
                messageId: result.messageId || result.id,
                threadId: result.threadId || result.thread_id
            };

        } catch (error) {
            // Parse gogcli error
            throw this.parseGogcliError(error);
        }
    }

    /**
     * Parse gogcli error to extract meaningful information
     */
    parseGogcliError(error) {
        const stderr = error.stderr || '';
        const statusCode = error.status || error.code;

        // Check for specific error types
        if (stderr.includes('429') || stderr.includes('rate limit')) {
            return new Error(`GMAIL_RATE_LIMIT: ${error.message}`);
        }
        if (stderr.includes('401') || stderr.includes('unauthorized')) {
            return new Error(`GMAIL_UNAUTHORIZED: OAuth token expired or invalid`);
        }
        if (stderr.includes('403') || stderr.includes('forbidden')) {
            return new Error(`GMAIL_FORBIDDEN: ${error.message}`);
        }
        if (stderr.includes('timeout')) {
            return new Error(`GMAIL_TIMEOUT: ${error.message}`);
        }

        return new Error(`GMAIL_API_ERROR: ${error.message}`);
    }

    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        const errorStr = error.message.toUpperCase();
        
        // Retry on rate limit, timeout, temporary server errors
        if (errorStr.includes('RATE_LIMIT') || errorStr.includes('429')) return true;
        if (errorStr.includes('TIMEOUT')) return true;
        if (errorStr.includes('500') || errorStr.includes('502') || errorStr.includes('503')) return true;
        
        // Don't retry on auth errors or permanent failures
        if (errorStr.includes('UNAUTHORIZED') || errorStr.includes('401')) return false;
        if (errorStr.includes('FORBIDDEN') || errorStr.includes('403')) return false;
        if (errorStr.includes('INVALID')) return false;

        // Default: retry on unknown errors
        return true;
    }

    /**
     * Classify error type
     */
    classifyError(error) {
        if (!error) return 'UNKNOWN';
        
        const errorStr = error.message.toUpperCase();
        
        if (errorStr.includes('RATE_LIMIT') || errorStr.includes('429')) return 'GMAIL_RATE_LIMIT';
        if (errorStr.includes('UNAUTHORIZED') || errorStr.includes('401')) return 'GMAIL_UNAUTHORIZED';
        if (errorStr.includes('FORBIDDEN') || errorStr.includes('403')) return 'GMAIL_FORBIDDEN';
        if (errorStr.includes('TIMEOUT')) return 'GMAIL_TIMEOUT';
        if (errorStr.includes('500') || errorStr.includes('502') || errorStr.includes('503')) return 'GMAIL_SERVER_ERROR';
        
        return 'GMAIL_API_ERROR';
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Send confirmation email (wrapper with predefined template)
     */
    async sendConfirmationEmail(to, appointmentData) {
        const subject = '✅ Cita de Laboratorio Confirmada';
        const body = this.buildConfirmationBody(appointmentData);

        return await this.sendEmail({
            to,
            subject,
            body
        });
    }

    /**
     * Send error email (wrapper with predefined template)
     */
    async sendErrorEmail(to, errorData) {
        const subject = errorData.subject || '❌ Error - Solicitud de Cita';
        const body = this.buildErrorBody(errorData);

        return await this.sendEmail({
            to,
            subject,
            body
        });
    }

    /**
     * Build confirmation email body
     */
    buildConfirmationBody(data) {
        return `Hola ${data.doctorName},

Su cita ha sido confirmada exitosamente:

Paciente: ${data.patientName}
CURP: ${data.patientCurp}
Tipo de Estudio: ${data.labType}
Fecha: ${data.appointmentDate}
Hora: ${data.appointmentTime}
Laboratorio: ${data.labLocation || 'Laboratorio Principal'}

Por favor llegue 15 minutos antes de su cita.

Saludos,
IMSS Lab Appointments`;
    }

    /**
     * Build error email body
     */
    buildErrorBody(data) {
        return `Hola ${data.doctorName},

No pudimos procesar su solicitud:

Error: ${data.errorMessage}

${data.additionalInfo || ''}

Saludos,
IMSS Lab Appointments`;
    }
}

module.exports = { EmailSenderService };
