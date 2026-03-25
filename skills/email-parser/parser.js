/**
 * Email body parser - extracts structured data from template
 */

/**
 * Parse email body using template-based extraction
 */
function parseEmailBody(body) {
    const result = {
        patientName: null,
        curp: null,
        dateOfBirth: null,
        labType: null,
        preferredDate: null,
        preferredTime: null,
        priority: 'routine',
        notes: null
    };

    if (!body) {
        throw new Error('Empty email body');
    }

    const lines = body.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.match(/^Patient:/i)) {
            result.patientName = extractValue(trimmed);
        }
        else if (trimmed.match(/^CURP:/i)) {
            result.curp = extractValue(trimmed).toUpperCase().replace(/\s/g, '');
        }
        else if (trimmed.match(/^Date of Birth:/i)) {
            result.dateOfBirth = parseDate(extractValue(trimmed));
        }
        else if (trimmed.match(/^Lab Type:/i)) {
            result.labType = extractValue(trimmed);
        }
        else if (trimmed.match(/^Preferred Date:/i)) {
            result.preferredDate = parseDate(extractValue(trimmed));
        }
        else if (trimmed.match(/^Preferred Time:/i)) {
            result.preferredTime = extractValue(trimmed);
        }
        else if (trimmed.match(/^Priority:/i)) {
            result.priority = extractValue(trimmed).toLowerCase();
        }
        else if (trimmed.match(/^Notes:/i)) {
            result.notes = extractValue(trimmed);
        }
    }

    return result;
}

/**
 * Extract value after colon
 */
function extractValue(line) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return '';
    return line.substring(colonIndex + 1).trim();
}

/**
 * Parse date string to YYYY-MM-DD format
 */
function parseDate(dateStr) {
    if (!dateStr) return null;

    dateStr = dateStr.trim();

    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const euroMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (euroMatch) {
        return `${euroMatch[3]}-${euroMatch[2]}-${euroMatch[1]}`;
    }

    return dateStr;
}

module.exports = { parseEmailBody, extractValue, parseDate };
