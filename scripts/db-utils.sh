#!/bin/bash
# Database utility functions for IMSS Lab Appointment POC

DB_PATH="./data/sqlite.db"

# Check database integrity
check_integrity() {
    echo "=== Database Integrity Check ==="
    sqlite3 "$DB_PATH" "PRAGMA integrity_check;"
}

# Show table counts
show_counts() {
    echo "=== Record Counts ==="
    echo "Patients: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM patients;")"
    echo "Doctors: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM doctors;")"
    echo "Appointments: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM appointments;")"
    echo "Lab Capacity Days: $(sqlite3 "$DB_PATH" "SELECT COUNT(DISTINCT date) FROM lab_capacity;")"
    echo "Audit Log Entries: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM audit_log;")"
}

# Show available slots for a date
show_availability() {
    local date=${1:-$(date +%Y-%m-%d)}
    echo "=== Availability for $date ==="
    sqlite3 -header -column "$DB_PATH" "
        SELECT hour, max_slots, booked_slots, (max_slots - booked_slots) as available
        FROM lab_capacity
        WHERE date = '$date'
        ORDER BY hour;
    "
}

# Show recent appointments
show_recent_appointments() {
    echo "=== Recent Appointments ==="
    sqlite3 -header -column "$DB_PATH" "
        SELECT a.id, p.first_name || ' ' || p.last_name as patient,
               a.lab_type, a.status, a.booked_at
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        ORDER BY a.booked_at DESC
        LIMIT 10;
    "
}

# Show recent audit log entries
show_audit_log() {
    echo "=== Recent Audit Log ==="
    sqlite3 -header -column "$DB_PATH" "
        SELECT id, action, resource, created_at
        FROM audit_log
        ORDER BY created_at DESC
        LIMIT 10;
    "
}

# Show doctors by specialty
show_doctors() {
    echo "=== Doctors by Specialty ==="
    sqlite3 -header -column "$DB_PATH" "
        SELECT name, specialty, email
        FROM doctors
        ORDER BY specialty, name;
    "
}

# Show sample patients
show_patients() {
    echo "=== Sample Patients ==="
    sqlite3 -header -column "$DB_PATH" "
        SELECT curp, first_name, last_name, date_of_birth, gender
        FROM patients
        LIMIT 10;
    "
}

# Main command dispatcher
case "${1:-help}" in
    integrity) check_integrity ;;
    counts) show_counts ;;
    availability) show_availability "$2" ;;
    appointments) show_recent_appointments ;;
    audit) show_audit_log ;;
    doctors) show_doctors ;;
    patients) show_patients ;;
    *)
        echo "Usage: $0 {integrity|counts|availability [date]|appointments|audit|doctors|patients}"
        exit 1
        ;;
esac
