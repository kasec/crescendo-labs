/**
 * Email Templates for Booking Confirmations and Errors
 */

const emailTemplates = {
    /**
     * Confirmation Email Template
     */
    confirmation: {
        subject: '✅ Cita de Laboratorio Confirmada',
        body: (data) => `Hola ${data.doctorName},

Su cita ha sido confirmada exitosamente:

Paciente: ${data.patientName}
CURP: ${data.patientCurp}
Tipo de Estudio: ${data.labType}
Fecha: ${data.appointmentDate}
Hora: ${data.appointmentTime}
Laboratorio: ${data.labLocation || 'Laboratorio Principal'}

Por favor llegue 15 minutos antes de su cita.

Saludos,
IMSS Lab Appointments`
    },

    /**
     * Error Email - Invalid Data
     */
    errorInvalidData: {
        subject: '❌ Error - Solicitud de Cita',
        body: (data) => `Hola ${data.doctorName},

No pudimos procesar su solicitud:

Error: ${data.errorMessage}

Campos requeridos:
- Patient: Nombre completo del paciente
- CURP: CURP de 18 caracteres
- Date of Birth: Fecha de nacimiento (YYYY-MM-DD o DD/MM/YYYY)
- Lab Type: Tipo de estudio (Blood Work, X-Ray, Urinalysis, etc.)
- Preferred Date: Fecha preferida (YYYY-MM-DD)
- Preferred Time: Hora preferida (HH:MM AM/PM)

Ejemplo de formato correcto:

---
Appointment Request

Patient: Juan Pérez García
CURP: PEHJ850101HDFRRR09
Date of Birth: 1985-01-01
Lab Type: Blood Work
Preferred Date: 2026-03-25
Preferred Time: 09:00 AM
---

Saludos,
IMSS Lab Appointments`
    },

    /**
     * Error Email - No Availability
     */
    errorNoAvailability: {
        subject: '⚠️ Sin Disponibilidad - Solicitud de Cita',
        body: (data) => `Hola ${data.doctorName},

No hay slots disponibles en los próximos 7 días para: ${data.labType}

Próxima disponibilidad: ${data.nextAvailableDate || 'No disponible en el rango de 7 días'}

¿Le gustaría agendar para esta fecha? Responda este email.

Saludos,
IMSS Lab Appointments`
    },

    /**
     * Error Email - Slot Full (Alternative Offered)
     */
    errorSlotFull: {
        subject: '🔄 Slot Occupado - Alternativa Ofrecida',
        body: (data) => `Hola ${data.doctorName},

El slot solicitado para ${data.labType} en la fecha ${data.requestedDate} a las ${data.requestedTime} está ocupado.

Hemos encontrado la siguiente disponibilidad:

Fecha alternativa: ${data.alternativeDate}
Hora alternativa: ${data.alternativeTime}
Laboratorio: ${data.labLocation || 'Laboratorio Principal'}

¿Le gustaría aceptar esta alternativa? Responda este email para confirmar.

Saludos,
IMSS Lab Appointments`
    },

    /**
     * Error Email - Database Error
     */
    errorDatabase: {
        subject: '⚠️ Error Temporal - Solicitud de Cita',
        body: (data) => `Hola ${data.doctorName},

Ocurrió un error temporal al procesar su solicitud:

Error: ${data.errorMessage}

Estamos trabajando para resolverlo. Por favor intente nuevamente en unos minutos o contacte soporte.

Saludos,
IMSS Lab Appointments`
    },

    /**
     * Error Email - OAuth/Gmail Error
     */
    errorSystem: {
        subject: '⚠️ Error de Sistema - Solicitud de Cita',
        body: (data) => `Hola ${data.doctorName},

Ocurrió un error de sistema al procesar su solicitud:

Error: ${data.errorMessage}

Nuestro equipo ha sido notificado. Intentaremos procesar su solicitud automáticamente.

Saludos,
IMSS Lab Appointments`
    }
};

/**
 * Render email template with data
 * @param {string} templateType - Type of template
 * @param {Object} data - Data to populate template
 * @returns {Object} { subject, body }
 */
function renderEmail(templateType, data) {
    const template = emailTemplates[templateType];
    if (!template) {
        throw new Error(`Unknown template type: ${templateType}`);
    }

    return {
        subject: template.subject,
        body: template.body(data)
    };
}

module.exports = {
    emailTemplates,
    renderEmail
};
