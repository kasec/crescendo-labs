/**
 * Slot database operations with atomic transactions
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve('./data/sqlite.db');

/**
 * Get available slots for a given date
 */
async function getAvailableSlots(date) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH);

        db.all(`
            SELECT hour, max_slots, booked_slots, (max_slots - booked_slots) as available
            FROM lab_capacity
            WHERE date = ? AND booked_slots < max_slots
            ORDER BY hour
        `, [date], (err, rows) => {
            db.close();
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

/**
 * Reserve a slot atomically (transaction)
 */
async function reserveSlot({ preferredDate, preferredTime, patientId, labType, context }) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH);

        const hour = parseTimeToHour(preferredTime);

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            db.get(`
                SELECT id, max_slots, booked_slots
                FROM lab_capacity
                WHERE date = ? AND hour = ?
            `, [preferredDate, hour], (err, row) => {
                if (err) {
                    db.run('ROLLBACK');
                    db.close();
                    reject(err);
                    return;
                }

                if (!row) {
                    db.run('ROLLBACK');
                    db.close();
                    resolve({
                        success: false,
                        error: 'NO_CAPACITY',
                        message: `No capacity defined for ${preferredDate} at ${hour}:00`
                    });
                    return;
                }

                if (row.booked_slots >= row.max_slots) {
                    db.run('ROLLBACK');
                    db.close();
                    resolve({
                        success: false,
                        error: 'SLOT_FULL'
                    });
                    return;
                }

                db.run(`
                    UPDATE lab_capacity
                    SET booked_slots = booked_slots + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [row.id], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        db.close();
                        reject(err);
                        return;
                    }

                    db.run(`
                        INSERT INTO audit_log (user_id, action, resource, resource_id, details)
                        VALUES (?, 'slot_reserved', 'lab_capacity', ?, ?)
                    `, ['system', row.id, JSON.stringify({
                        patientId,
                        labType,
                        date: preferredDate,
                        hour
                    })], (err) => {
                        if (err) {
                            context.log.warn('Audit log failed', { error: err.message });
                        }

                        db.run('COMMIT');
                        db.close();

                        resolve({
                            success: true,
                            capacityId: row.id,
                            hour,
                            date: preferredDate
                        });
                    });
                });
            });
        });
    });
}

/**
 * Get next available slot after preferred date/time
 */
async function getNextAvailable(preferredDate, context) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH);

        db.get(`
            SELECT date, hour
            FROM lab_capacity
            WHERE (date > ? OR (date = ? AND hour > ?))
              AND booked_slots < max_slots
            ORDER BY date, hour
            LIMIT 1
        `, [preferredDate, preferredDate, parseTimeToHour(context.input.preferredTime)], (err, row) => {
            db.close();
            if (err) reject(err);
            else resolve(row || { date: null, hour: null });
        });
    });
}

/**
 * Parse time string to hour integer
 */
function parseTimeToHour(timeStr) {
    if (!timeStr) return 9;

    const match = timeStr.match(/(\d{1,2})(?::\d{2})?\s*(AM|PM)?/i);
    if (!match) return 9;

    let hour = parseInt(match[1]);
    const period = match[2]?.toUpperCase();

    if (period === 'PM' && hour !== 12) {
        hour += 12;
    } else if (period === 'AM' && hour === 12) {
        hour = 0;
    }

    return hour;
}

module.exports = { getAvailableSlots, reserveSlot, getNextAvailable, parseTimeToHour };
