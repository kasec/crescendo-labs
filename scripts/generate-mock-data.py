#!/usr/bin/env python3
"""
Generate mock patient and doctor data for IMSS Lab Appointment POC.
All data is synthetic - no real personal information used.
"""

import sqlite3
import random
from datetime import datetime, timedelta, date

# Mexican name components (common surnames and given names)
FIRST_NAMES_M = [
    "José", "Juan", "Pedro", "Luis", "Carlos", "Jorge", "Miguel", "Antonio",
    "Francisco", "Jesús", "Alejandro", "Sergio", "Raúl", "Ricardo", "Alberto",
    "Arturo", "Héctor", "Roberto", "Manuel", "Fernando", "David", "Javier",
    "Ángel", "Eduardo", "Gustavo", "Pablo", "Andrés", "Oscar", "Enrique", "Ramón"
]

FIRST_NAMES_F = [
    "María", "Juana", "Patricia", "Elizabeth", "Yolanda", "Guadalupe", "Teresa",
    "Rosa", "Carmen", "Ana", "Lucía", "Isabel", "Margarita", "Verónica",
    "Silvia", "Gabriela", "Mónica", "Alejandra", "Adriana", "Laura",
    "Daniela", "Sofía", "Valentina", "Camila", "Valeria", "Ximena", "Fernanda"
]

LAST_NAMES = [
    "Hernández", "García", "Martínez", "López", "González", "Rodríguez",
    "Pérez", "Sánchez", "Ramírez", "Cruz", "Flores", "Gómez", "Morales",
    "Jiménez", "Reyes", "Gutiérrez", "Ruiz", "Díaz", "Moreno", "Álvarez",
    "Muñoz", "Romero", "Vázquez", "Castillo", "Ramos", "Ortiz", "Mendoza",
    "Aguilar", "Vega", "Torres", "Domínguez", "Guerrero", "Medina", "Delgado"
]

STATES = [
    "AS", "BC", "BS", "CC", "CS", "CH", "CL", "CM", "DF", "DG", "GT", "GR",
    "HG", "JC", "MC", "MN", "MS", "NT", "NL", "OC", "PL", "QT", "QR", "SP",
    "SL", "SR", "TC", "TS", "TL", "VZ", "YN", "ZS", "NE"  # Mexican state codes
]


def generate_curp(first_name, last_name, dob, gender):
    """
    Generate a CURP-like 18-character code.
    Format: AAAA000000H000000 (simplified - not full RFC validation)
    """
    names = last_name.split()
    paternal_surname = names[0] if names else last_name
    maternal_surname = names[1] if len(names) > 1 else 'X'

    # First 4 chars: first letter of paternal surname + first vowel + first letter of maternal surname + first letter of first name
    curp = paternal_surname[0].upper()

    # Find first vowel in paternal surname
    vowel_found = False
    for char in paternal_surname[1:]:
        if char in 'AEIOUÁÉÍÓÚ':
            curp += char.upper()
            vowel_found = True
            break
    if not vowel_found:
        curp += 'X'

    # Maternal surname first letter (or X if none)
    curp += maternal_surname[0].upper() if maternal_surname != 'X' else 'X'

    # First name first letter
    curp += first_name[0].upper()

    # Date of birth (YYMMDD)
    curp += dob.strftime('%y%m%d')

    # Gender
    curp += 'H' if gender == 'M' else 'M'

    # State code (2 chars)
    curp += random.choice(STATES)

    # Consonants from surnames and name (3 chars)
    consonants = ''.join([c for c in (paternal_surname + maternal_surname + first_name) if c not in 'AEIOUÁÉÍÓÚ'])
    if len(consonants) >= 3:
        curp += ''.join(random.sample(consonants.upper(), 3))
    else:
        curp += consonants.upper().ljust(3, 'X')

    # Checksum digit (simplified - random for POC)
    curp += str(random.randint(0, 9))

    # Ensure exactly 18 characters
    if len(curp) < 18:
        curp = curp.ljust(18, 'X')
    elif len(curp) > 18:
        curp = curp[:18]

    return curp


def generate_patients(conn, count=55):
    """Generate synthetic patient records."""
    cursor = conn.cursor()

    patients = []
    for _ in range(count):
        gender = random.choice(['M', 'F'])
        first_name = random.choice(FIRST_NAMES_M if gender == 'M' else FIRST_NAMES_F)
        last_name = f"{random.choice(LAST_NAMES)} {random.choice(LAST_NAMES)}"

        # Random DOB between 1950 and 2020
        dob = datetime(1950, 1, 1) + timedelta(days=random.randint(0, 25550))

        curp = generate_curp(first_name, last_name, dob, gender)

        patients.append({
            'curp': curp,
            'first_name': first_name,
            'last_name': last_name,
            'dob': dob.strftime('%Y-%m-%d'),
            'gender': gender,
            'phone': f"55{random.randint(10000000, 99999999)}",
            'email': f"{first_name.lower().replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')}.{last_name.split()[0].lower().replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')}{random.randint(1, 999)}@email.com"
        })

    # Insert patients
    inserted = 0
    for p in patients:
        try:
            cursor.execute("""
                INSERT INTO patients (curp, first_name, last_name, date_of_birth, gender, phone, email)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (p['curp'], p['first_name'], p['last_name'], p['dob'], p['gender'], p['phone'], p['email']))
            inserted += 1
        except sqlite3.IntegrityError:
            # CURP already exists, skip
            continue

    conn.commit()
    return cursor.execute("SELECT COUNT(*) FROM patients").fetchone()[0]


def generate_doctors(conn, count=6):
    """Generate synthetic doctor records."""
    cursor = conn.cursor()

    doctors = [
        ("Dr. María García", "Blood Work", "mgarcia@imss-clinic.mx"),
        ("Dr. Juan Hernández", "X-Ray", "jhernandez@imss-clinic.mx"),
        ("Dr. Patricia López", "Urinalysis", "plopez@imss-clinic.mx"),
        ("Dr. Carlos Martínez", "Blood Work", "cmartinez@imss-clinic.mx"),
        ("Dr. Ana Rodríguez", "X-Ray", "arodriguez@imss-clinic.mx"),
        ("Dr. Luis Pérez", "General Lab", "lperez@imss-clinic.mx"),
    ]

    inserted = 0
    for name, specialty, email in doctors[:count]:
        try:
            cursor.execute("""
                INSERT INTO doctors (name, specialty, email)
                VALUES (?, ?, ?)
            """, (name, specialty, email))
            inserted += 1
        except sqlite3.IntegrityError:
            continue

    conn.commit()
    return cursor.execute("SELECT COUNT(*) FROM doctors").fetchone()[0]


def generate_lab_capacity(conn, days=7):
    """Generate lab capacity slots for next N days."""
    cursor = conn.cursor()

    today = date.today()
    hours = list(range(9, 17))  # 9:00 to 16:00 (each hour represents a slot)

    days_generated = 0
    for day_offset in range(days * 2):  # Multiply by 2 to account for weekends
        if days_generated >= days:
            break
            
        current_date = today + timedelta(days=day_offset)

        # Skip weekends for realistic scheduling
        if current_date.weekday() >= 5:  # Saturday=5, Sunday=6
            continue

        days_generated += 1
        
        for hour in hours:
            try:
                cursor.execute("""
                    INSERT INTO lab_capacity (date, hour, max_slots, booked_slots)
                    VALUES (?, ?, 20, 0)
                """, (current_date.strftime('%Y-%m-%d'), hour))
            except sqlite3.IntegrityError:
                continue

    conn.commit()
    return cursor.execute("SELECT COUNT(DISTINCT date) FROM lab_capacity").fetchone()[0]


if __name__ == "__main__":
    import os
    import sys
    
    # Determine database path
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    else:
        # Default to data/sqlite.db relative to script location
        script_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(script_dir, '..', 'data', 'sqlite.db')
    
    db_path = os.path.abspath(db_path)
    
    print(f"Using database: {db_path}")
    
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")

    patient_count = generate_patients(conn, 55)
    print(f"Generated {patient_count} patients")

    doctor_count = generate_doctors(conn, 6)
    print(f"Generated {doctor_count} doctors")

    capacity_days = generate_lab_capacity(conn, 7)
    print(f"Generated capacity for {capacity_days} days")

    conn.close()
    
    print("\nMock data generation complete!")
