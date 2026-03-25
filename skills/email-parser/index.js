/**
 * Email Parser Skill - IMSS Lab Appointment POC
 * Parses doctor emails requesting lab appointments
 */

const { parseEmailBody } = require('./parser');

/**
 * Main entry point for the email parser skill
 * @param {Object} context - OpenClaw execution context
 * @returns {Object} Parsed appointment data or error
 */
async function parseAppointmentRequest(context) {
    const { email } = context.input;

    context.log.info('Parsing appointment request email', {
        from: email.from,
        subject: email.subject,
        received: email.receivedAt
    });

    try {
        const parsed = parseEmailBody(email.body);

        // Validate required fields
        const errors = validateParsedData(parsed);

        if (errors.length > 0) {
            context.log.warn('Validation errors', { errors });
            return {
                success: false,
                error: 'INVALID_DATA',
                message: `Missing or invalid fields: ${errors.join(', ')}`,
                parsed: parsed
            };
        }

        context.log.info('Email parsed successfully', {
            patient: parsed.patientName,
            curp: parsed.curp,
            labType: parsed.labType
        });

        return {
            success: true,
            data: parsed
        };

    } catch (error) {
        context.log.error('Parse error', { error: error.message });
        return {
            success: false,
            error: 'PARSE_ERROR',
            message: `Failed to parse email: ${error.message}`
        };
    }
}

/**
 * Validate parsed appointment data
 */
function validateParsedData(data) {
    const errors = [];

    if (!data.patientName || data.patientName.trim().length < 3) {
        errors.push('Patient name is required (min 3 characters)');
    }

    if (!data.curp) {
        errors.push('CURP is required');
    } else if (data.curp.length !== 18) {
        errors.push('CURP must be 18 characters');
    } else if (!/^[A-Z0-9]{18}$/.test(data.curp)) {
        errors.push('CURP format invalid (must be 18 alphanumeric characters)');
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

module.exports = { parseAppointmentRequest };
