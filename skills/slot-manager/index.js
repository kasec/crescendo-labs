/**
 * Slot Manager Skill - IMSS Lab Appointment POC
 * Checks availability and reserves slots atomically
 */

const { getAvailableSlots, reserveSlot, getNextAvailable } = require('./slot-service');

/**
 * Main entry point for slot management
 * @param {Object} context - OpenClaw execution context
 * @returns {Object} Available slots or reservation confirmation
 */
async function manageSlots(context) {
    const { action, preferredDate, preferredTime, patientId, labType } = context.input;

    context.log.info('Slot manager invoked', {
        action,
        preferredDate,
        preferredTime,
        patientId
    });

    try {
        if (action === 'check_availability') {
            const slots = await getAvailableSlots(preferredDate);
            return {
                success: true,
                action: 'availability_check',
                date: preferredDate,
                availableSlots: slots,
                totalAvailable: slots.length
            };
        }

        else if (action === 'reserve') {
            const reservation = await reserveSlot({
                preferredDate,
                preferredTime,
                patientId,
                labType,
                context
            });

            if (reservation.success) {
                context.log.info('Slot reserved successfully', {
                    capacityId: reservation.capacityId,
                    hour: reservation.hour
                });

                return {
                    success: true,
                    action: 'reservation',
                    capacityId: reservation.capacityId,
                    hour: reservation.hour,
                    date: preferredDate,
                    message: `Slot reserved for ${preferredDate} at ${reservation.hour}:00`
                };
            } else {
                context.log.warn('Preferred slot full, finding next available');
                const nextAvailable = await getNextAvailable(preferredDate, context);

                return {
                    success: false,
                    action: 'reservation',
                    error: 'SLOT_FULL',
                    message: `No availability at preferred time. Next available: ${nextAvailable.date} at ${nextAvailable.hour}:00`,
                    nextAvailable
                };
            }
        }

        else {
            return {
                success: false,
                error: 'INVALID_ACTION',
                message: `Unknown action: ${action}`
            };
        }

    } catch (error) {
        context.log.error('Slot manager error', { error: error.message });
        return {
            success: false,
            error: 'DATABASE_ERROR',
            message: `Failed to manage slots: ${error.message}`
        };
    }
}

module.exports = { manageSlots };
