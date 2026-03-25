/**
 * Audit Logger Module - Logs all booking actions to audit_log table
 * Actions: booking_initiated, slot_reserved, appointment_created, confirmation_sent, error_occurred, rollback_performed
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class AuditLogger {
    constructor(dbPath) {
        this.dbPath = path.expanduser(dbPath);
        this.db = null;
    }

    /**
     * Initialize database connection
     */
    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Close database connection
     */
    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Log an action to the audit_log table
     * @param {string} action - Action type
     * @param {string} resource - Resource type (appointment, patient, etc.)
     * @param {number} resourceId - Resource ID
     * @param {Object} details - Additional details (will be JSON stringified)
     * @param {string} userId - User/doctor email
     */
    async log(action, resource, resourceId, details = {}, userId = null) {
        try {
            await this.init();

            const logEntry = {
                user_id: userId,
                action,
                resource,
                resource_id: resourceId,
                timestamp: new Date().toISOString(),
                details: JSON.stringify(details)
            };

            await this.runAsync(
                `INSERT INTO audit_log (user_id, action, resource, resource_id, details, created_at)
                 VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                [
                    logEntry.user_id,
                    logEntry.action,
                    logEntry.resource,
                    logEntry.resource_id,
                    logEntry.details
                ]
            );

            return logEntry;

        } catch (error) {
            console.error('Audit log error:', error.message);
            throw error;
        } finally {
            await this.close();
        }
    }

    /**
     * Log booking initiated
     */
    async logBookingInitiated(bookingData, doctorEmail) {
        return await this.log(
            'booking_initiated',
            'appointment',
            null,
            {
                patientName: bookingData.patientName,
                curp: bookingData.curp,
                labType: bookingData.labType,
                preferredDate: bookingData.preferredDate,
                preferredTime: bookingData.preferredTime
            },
            doctorEmail
        );
    }

    /**
     * Log slot reserved
     */
    async logSlotReserved(slotData, doctorEmail) {
        return await this.log(
            'slot_reserved',
            'lab_capacity',
            slotData.capacityId,
            {
                date: slotData.date,
                hour: slotData.hour,
                labType: slotData.labType
            },
            doctorEmail
        );
    }

    /**
     * Log appointment created
     */
    async logAppointmentCreated(appointmentData, doctorEmail) {
        return await this.log(
            'appointment_created',
            'appointment',
            appointmentData.appointmentId,
            {
                patientId: appointmentData.patientId,
                doctorId: appointmentData.doctorId,
                capacityId: appointmentData.capacityId,
                labType: appointmentData.labType,
                status: 'scheduled',
                bookedAt: appointmentData.bookedAt
            },
            doctorEmail
        );
    }

    /**
     * Log confirmation email sent
     */
    async logConfirmationSent(appointmentId, emailData, doctorEmail) {
        return await this.log(
            'confirmation_email_sent',
            'appointment',
            appointmentId,
            {
                emailTo: emailData.to,
                emailSubject: emailData.subject,
                sentAt: new Date().toISOString()
            },
            doctorEmail
        );
    }

    /**
     * Log error email sent
     */
    async logErrorEmailSent(appointmentId, errorType, emailData, doctorEmail) {
        return await this.log(
            'error_email_sent',
            'appointment',
            appointmentId,
            {
                errorType,
                emailTo: emailData.to,
                emailSubject: emailData.subject,
                sentAt: new Date().toISOString()
            },
            doctorEmail
        );
    }

    /**
     * Log error occurred
     */
    async logErrorOccurred(errorType, errorMessage, context, doctorEmail) {
        return await this.log(
            'error_occurred',
            'appointment',
            context.appointmentId || null,
            {
                errorType,
                errorMessage,
                context: {
                    patientName: context.patientName,
                    curp: context.curp,
                    labType: context.labType,
                    preferredDate: context.preferredDate
                },
                timestamp: new Date().toISOString()
            },
            doctorEmail
        );
    }

    /**
     * Log rollback performed
     */
    async logRollbackPerformed(appointmentId, reason, doctorEmail) {
        return await this.log(
            'rollback_performed',
            'appointment',
            appointmentId,
            {
                reason,
                timestamp: new Date().toISOString()
            },
            doctorEmail
        );
    }

    /**
     * Log email parsing completed
     */
    async logEmailParsingCompleted(emailData, parsedData) {
        return await this.log(
            'email_parsed',
            'email',
            null,
            {
                emailFrom: emailData.from,
                emailSubject: emailData.subject,
                parsedPatient: parsedData.patientName,
                parsedCurp: parsedData.curp,
                parsedLabType: parsedData.labType
            },
            emailData.from
        );
    }

    /**
     * Get audit logs for a resource
     */
    async getLogsForResource(resource, resourceId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM audit_log WHERE resource = ? AND resource_id = ? ORDER BY created_at DESC',
                [resource, resourceId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    /**
     * Get recent audit logs
     */
    async getRecentLogs(limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?',
                [limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Helper method for async database operations
    runAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }
}

module.exports = { AuditLogger };
