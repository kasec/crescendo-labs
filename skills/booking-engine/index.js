/**
 * Booking Engine Skill - IMSS Lab Appointment POC
 * Coordinates the full appointment booking flow with atomic transactions
 * 
 * Flow: Email Parser → Slot Manager → Booking Engine → Email Sender
 */

const { BookingService } = require('./booking-service');
const { AuditLogger } = require('./audit-logger');
const { handleError, classifyError } = require('./error-handler');
const { renderEmail } = require('./templates');
const path = require('path');

// Configuration
const DB_PATH = '~/Developer/crescendo-labs/data/sqlite.db';
const MAX_BOOKING_DAYS = 7;

/**
 * Main entry point for the booking engine skill
 * @param {Object} context - OpenClaw execution context
 * @returns {Object} Booking result
 */
async function processBookingRequest(context) {
    const bookingService = new BookingService(DB_PATH);
    const auditLogger = new AuditLogger(DB_PATH);
    
    context.log.info('Booking Engine: Processing request', {
        skill: 'booking-engine',
        timestamp: new Date().toISOString()
    });

    try {
        // Extract data from context
        const { parsedData, email, doctorInfo } = context.input;
        const doctorEmail = email.from;
        const doctorName = doctorInfo?.name || 'Doctor';

        // Step 1: Log booking initiated
        await auditLogger.logBookingInitiated(parsedData, doctorEmail);

        // Step 2: Execute booking with atomic transaction
        const bookingResult = await bookingService.executeBooking({
            ...parsedData,
            doctorEmail
        });

        if (bookingResult.success) {
            // Step 3: Log success actions
            await auditLogger.logSlotReserved({
                capacityId: bookingResult.capacityId,
                date: bookingResult.slotDate,
                hour: bookingResult.slotHour,
                labType: parsedData.labType
            }, doctorEmail);

            await auditLogger.logAppointmentCreated({
                appointmentId: bookingResult.appointmentId,
                patientId: bookingResult.patientId,
                doctorId: null,
                capacityId: bookingResult.capacityId,
                labType: parsedData.labType,
                bookedAt: new Date().toISOString()
            }, doctorEmail);

            // Step 4: Prepare confirmation email data
            const confirmationEmail = renderEmail('confirmation', {
                doctorName,
                patientName: parsedData.patientName,
                patientCurp: parsedData.curp,
                labType: parsedData.labType,
                appointmentDate: bookingResult.slotDate,
                appointmentTime: `${bookingResult.slotHour}:00`,
                labLocation: 'Laboratorio Principal'
            });

            // Step 5: Log confirmation email
            await auditLogger.logConfirmationSent(bookingResult.appointmentId, {
                to: doctorEmail,
                subject: confirmationEmail.subject
            }, doctorEmail);

            context.log.info('Booking completed successfully', {
                appointmentId: bookingResult.appointmentId,
                patient: parsedData.patientName,
                slot: `${bookingResult.slotDate} ${bookingResult.slotHour}:00`
            });

            return {
                success: true,
                action: 'SEND_CONFIRMATION_EMAIL',
                appointmentId: bookingResult.appointmentId,
                email: {
                    to: doctorEmail,
                    subject: confirmationEmail.subject,
                    body: confirmationEmail.body
                },
                booking: bookingResult
            };

        } else {
            // Booking failed - handle error
            return await handleBookingFailure(
                bookingResult,
                { parsedData, doctorEmail, doctorName },
                auditLogger,
                context
            );
        }

    } catch (error) {
        context.log.error('Booking Engine: Critical error', {
            error: error.message,
            stack: error.stack
        });

        // Handle critical error
        const errorType = classifyError(error.message);
        await auditLogger.logErrorOccurred(errorType, error.message, {
            patientName: context.input.parsedData?.patientName,
            curp: context.input.parsedData?.curp,
            labType: context.input.parsedData?.labType
        }, context.input.email?.from);

        return {
            success: false,
            action: 'HANDLE_CRITICAL_ERROR',
            error: error.message,
            errorType
        };
    }
}

/**
 * Handle booking failure with appropriate error handling
 */
async function handleBookingFailure(bookingResult, context, auditLogger, mainContext) {
    const { parsedData, doctorEmail, doctorName } = context;
    const errorType = bookingResult.errorType || classifyError(bookingResult.error);

    // Log error occurred
    await auditLogger.logErrorOccurred(errorType, bookingResult.error, {
        patientName: parsedData.patientName,
        curp: parsedData.curp,
        labType: parsedData.labType,
        appointmentId: bookingResult.appointmentId
    }, doctorEmail);

    // Log rollback if performed
    if (bookingResult.rollbackPerformed) {
        await auditLogger.logRollbackPerformed(
            bookingResult.appointmentId,
            bookingResult.error,
            doctorEmail
        );
    }

    // Handle error based on type
    const errorHandlerResult = await handleError(errorType, {
        doctorName,
        doctorEmail,
        labType: parsedData.labType,
        requestedDate: parsedData.preferredDate,
        requestedTime: parsedData.preferredTime,
        errorMessage: bookingResult.error,
        alternativeDate: bookingResult.alternativeDate,
        alternativeTime: bookingResult.alternativeTime,
        nextAvailableDate: bookingResult.nextAvailableDate
    });

    mainContext.log.warn('Booking failed', {
        errorType,
        error: bookingResult.error,
        action: errorHandlerResult.action
    });

    // Log error email if being sent
    if (errorHandlerResult.email) {
        await auditLogger.logErrorEmailSent(
            bookingResult.appointmentId,
            errorType,
            errorHandlerResult.email,
            doctorEmail
        );
    }

    return {
        success: false,
        action: errorHandlerResult.action,
        errorType,
        error: bookingResult.error,
        email: errorHandlerResult.email,
        metadata: errorHandlerResult.metadata,
        rollbackPerformed: bookingResult.rollbackPerformed
    };
}

/**
 * Validate booking data before processing
 */
function validateBookingData(data) {
    const errors = [];

    if (!data.patientName || data.patientName.trim().length < 3) {
        errors.push('Patient name is required (min 3 characters)');
    }

    if (!data.curp || data.curp.length !== 18) {
        errors.push('CURP must be 18 characters');
    }

    if (!data.dateOfBirth) {
        errors.push('Date of birth is required');
    }

    if (!data.labType) {
        errors.push('Lab type is required');
    }

    if (!data.preferredDate) {
        errors.push('Preferred date is required');
    }

    return errors;
}

module.exports = {
    processBookingRequest,
    validateBookingData
};
