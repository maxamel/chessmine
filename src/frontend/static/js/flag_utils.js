/**
 * Convert ISO 3166-1 alpha-2 country code to flag using CSS
 * @param {string} countryCode - Two-letter country code (e.g., "US", "GB")
 * @returns {string} HTML string with flag or empty string if invalid
 */
export function countryCodeToFlag(countryCode) {
    if (!countryCode || countryCode === 'None' || typeof countryCode !== 'string') {
        console.log('Invalid country code:', countryCode);
        return '';
    }
    
    const code = countryCode.trim().toUpperCase();
    
    if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) {
        console.log('Country code not 2 letters:', code);
        return '';
    }
    
    // Return CSS class-based flag with SVG background
    return `<span class="country-flag-wrapper flag-${code.toLowerCase()}" title="${code}"></span>`;
}


/**
 * Display flag next to player name
 * @param {string} elementId - ID of the element to add flag to
 * @param {string} countryCode - Two-letter country code
 */
export function displayFlag(elementId, countryCode) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.log('Element not found:', elementId);
        return;
    }
    
    const flagHtml = countryCodeToFlag(countryCode);
    if (flagHtml) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = flagHtml;
        const flagElement = tempDiv.firstChild;
        
        // Insert flag before the text content
        element.insertBefore(flagElement, element.firstChild);
        console.log('Flag inserted successfully');
    } else {
        console.log('Flag conversion returned empty string');
    }
}

/**
 * Display Stockfish logo for computer players
 * @param {string} elementId - ID of the element to add logo to
 */
export function displayStockfishLogo(elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.log('Element not found:', elementId);
        return;
    }
    
    const logoSpan = document.createElement('span');
    logoSpan.className = 'stockfish-logo';
    logoSpan.title = 'Stockfish';
    
    // Insert logo before the text content
    element.insertBefore(logoSpan, element.firstChild);
}

/**
 * Remove existing flags from an element
 * @param {string} elementId - ID of the element to remove flags from
 */
export function removeFlag(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const flagSpans = element.querySelectorAll('.country-flag-wrapper');
    flagSpans.forEach(span => span.remove());
}
