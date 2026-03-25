/**
 * Booking Service - Core booking logic with atomic transactions
 * Handles: slot reservation, appointment creation, rollback on failure
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class BookingService {
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
     * Execute booking with atomic transaction
     * @param {Object} bookingData - Patient and appointment data
     * @returns {Object} Booking result with appointment ID or error
     */
    async executeBooking(bookingData) {
        const {
            patientName,
            curp,
            dateOfBirth,
            labType,
            preferredDate,
            preferredTime,
            doctorEmail
        } = bookingData;

        let transactionStarted = false;
        let appointmentId = null;
        let capacityId = null;

        try {
            await this.init();

            // Begin transaction
            await this.runAsync('BEGIN TRANSACTION');
            transactionStarted = true;

            // Step 1: Find or create patient
            const patientId = await this.findOrCreatePatient({
                curp,
                firstName: patientName.split(' ')[0],
                lastName: patientName.split(' ').slice(1).join(' '),
                dateOfBirth,
                gender: this.extractGenderFromCurp(curp)
            });

            // Step 2: Find doctor by email
            const doctorId = await this.findDoctorByEmail(doctorEmail);

            // Step 3: Find available slot
            const slotInfo = await this.findAvailableSlot(preferredDate, preferredTime, labType);

            if (!slotInfo.available) {
                throw new Error(`SLOT_FULL: No available slots for ${preferredDate} at ${preferredTime}`);
            }

            capacityId = slotInfo.capacityId;

            // Step 4: Create appointment
            appointmentId = await this.createAppointment({
                patientId,
                doctorId,
                capacityId,
                labType,
                bookedAt: new Date().toISOString()
            });

            // Step 5: Update lab capacity
            await this.updateLabCapacity(capacityId);

            // Commit transaction
            await this.runAsync('COMMIT');

            return {
                success: true,
                appointmentId,
                capacityId,
                patientId,
                slotDate: slotInfo.date,
                slotHour: slotInfo.hour,
                message: 'Booking completed successfully'
            };

        } catch (error) {
            // Rollback on any failure
            if (transactionStarted) {
                await this.runAsync('ROLLBACK');
            }

            return {
                success: false,
                error: error.message,
                errorType: this.classifyError(error.message),
                appointmentId,
                rollbackPerformed: transactionStarted
            };
        } finally {
            await this.close();
        }
    }

    /**
     * Find existing patient or create new one
     */
    async findOrCreatePatient(patientData) {
        const { curp, firstName, lastName, dateOfBirth, gender } = patientData;

        // Try to find existing patient
        const existing = await this.getAsync(
            'SELECT id FROM patients WHERE curp = ?',
            [curp]
        );

        if (existing) {
            return existing.id;
        }

        // Create new patient
        const result = await this.runAsync(
            `INSERT INTO patients (curp, first_name, last_name, date_of_birth, gender)
             VALUES (?, ?, ?, ?, ?)`,
            [curp, firstName, lastName, dateOfBirth, gender]
        );

        return result.lastID;
    }

    /**
     * Find doctor by email
     */
    async findDoctorByEmail(email) {
        const doctor = await this.getAsync(
            'SELECT id FROM doctors WHERE email = ?',
            [email]
        );

        return doctor ? doctor.id : null;
    }

    /**
     * Find available slot for given date/time
     */
    async findAvailableSlot(date, time, labType) {
        // Parse time to hour (9-16)
        const hour = this.parseTimeToHour(time);

        // Check if capacity exists for this date/hour
        let capacity = await this.getAsync(
            `SELECT id, date, hour, max_slots, booked_slots 
             FROM lab_capacity 
             WHERE date = ? AND hour = ?`,
            [date, hour]
        );

        if (!capacity) {
            // Create capacity record for this date/hour
            const result = await this.runAsync(
                `INSERT INTO lab_capacity (date, hour, max_slots, booked_slots)
                 VALUES (?, ?, 20, 0)`,
                [date, hour]
            );

            capacity = {
                id: result.lastID,
                date,
                hour,
                max_slots: 20,
                booked_slots: 0
            };
        }

        // Check availability
        if (capacity.booked_slots >= capacity.max_slots) {
            // Try to find next available slot
            return await this.findNextAvailableSlot(date, hour, labType);
        }

        return {
            available: true,
            capacityId: capacity.id,
            date: capacity.date,
            hour: capacity.hour
        };
    }

    /**
     * Find next available slot when preferred slot is full
     */
    async findNextAvailableSlot(excludeDate, excludeHour, labType) {
        // Search next 7 days for available slots
        const startDate = new Date(excludeDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);

        const availableSlots = await this.getAllAsync(
            `SELECT id, date, hour, max_slots, booked_slots 
             FROM lab_capacity 
             WHERE date >= ? AND date <= ? 
             AND booked_slots < max_slots
             ORDER BY date, hour
             LIMIT 1`,
            [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
        );

        if (availableSlots && availableSlots.length > 0) {
            const slot = availableSlots[0];
            return {
                available: true,
                capacityId: slot.id,
                date: slot.date,
                hour: slot.hour,
                isAlternative: true,
                message: `Original slot full. Next available: ${slot.date} at ${slot.hour}:00`
            };
        }

        return {
            available: false,
            message: 'NO_AVAILABILITY: No slots available in next 7 days',
            nextAvailableDate: null
        };
    }

    /**
     * Create appointment record
     */
    async createAppointment(appointmentData) {
        const { patientId, doctorId, capacityId, labType, bookedAt } = appointmentData;

        const result = await this.runAsync(
            `INSERT INTO appointments 
             (patient_id, doctor_id, lab_capacity_id, lab_type, status, priority, booked_at)
             VALUES (?, ?, ?, ?, 'scheduled', 'routine', ?)`,
            [patientId, doctorId || null, capacityId, labType, bookedAt]
        );

        return result.lastID;
    }

    /**
     * Update lab capacity (increment booked_slots)
     */
    async updateLabCapacity(capacityId) {
        await this.runAsync(
            `UPDATE lab_capacity 
             SET booked_slots = booked_slots + 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [capacityId]
        );
    }

    /**
     * Extract gender from CURP (H=Male, F=Female)
     */
    extractGenderFromCurp(curp) {
        if (!curp || curp.length < 11) return 'O';
        const genderChar = curp[10];
        return genderChar === 'H' ? 'M' : (genderChar === 'F' ? 'F' : 'O');
    }

    /**
     * Parse time string to hour (9-16)
     */
    parseTimeToHour(timeStr) {
        // Handle formats: "09:00", "9:00 AM", "14:00", "2:00 PM"
        const match = timeStr.match(/(\d{1,2})(?::\d{2})?\s*(AM|PM)?/i);
        if (!match) return 9; // Default to 9 AM

        let hour = parseInt(match[1]);
        const period = match[2] ? match[2].toUpperCase() : null;

        if (period === 'PM' && hour < 12) {
            hour += 12;
        } else if (period === 'AM' && hour === 12) {
            hour = 0;
        }

        // Ensure hour is within lab hours (9-16)
        return Math.max(9, Math.min(16, hour));
    }

    /**
     * Classify error type for handling
     */
    classifyError(errorMessage) {
        if (errorMessage.includes('SLOT_FULL')) return 'SLOT_FULL';
        if (errorMessage.includes('NO_AVAILABILITY')) return 'NO_AVAILABILITY';
        if (errorMessage.includes('SQLITE') || errorMessage.includes('database')) return 'DB_ERROR';
        if (errorMessage.includes('UNIQUE constraint')) return 'DUPLICATE_PATIENT';
        return 'UNKNOWN_ERROR';
    }

    // Helper methods for async database operations
    runAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    getAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    getAllAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

module.exports = { BookingService };
