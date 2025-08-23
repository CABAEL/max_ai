import fs from 'fs';
import path from 'path';

let wakeWordsConfig = null;

/**
 * Load wake words configuration from JSON file
 * @returns {Object} Wake words configuration
 */
function loadWakeWords() {
    if (!wakeWordsConfig) {
        try {
            const configPath = path.resolve('config/wake-words.json');
            const configData = fs.readFileSync(configPath, 'utf8');
            wakeWordsConfig = JSON.parse(configData);
        } catch (error) {
            console.error('Error loading wake words config:', error.message);
            // Fallback to default wake words
            wakeWordsConfig = {
                wakeWords: ['hey max', 'wake up max'],
                exactMatches: ['max']
            };
        }
    }
    return wakeWordsConfig;
}

/**
 * Check if text contains any wake word
 * @param {string} text - Text to check
 * @returns {boolean} True if wake word detected
 */
export function detectWakeWord(text) {
    const config = loadWakeWords();
    const lowerText = text.toLowerCase().trim();

    // Check phrase-based wake words (substring matching)
    const phraseMatch = config.wakeWords.some(word => lowerText.includes(word));

    // Check exact matches (standalone word or with proper spacing)
    const exactMatch = config.exactMatches.some(word => {
        const lowerWord = word.toLowerCase();
        return lowerText === lowerWord ||
            lowerText.includes(` ${lowerWord} `) ||
            lowerText.startsWith(`${lowerWord} `) ||
            lowerText.endsWith(` ${lowerWord}`);
    });

    return phraseMatch || exactMatch;
}

/**
 * Get list of all wake words for display
 * @returns {string[]} Array of all wake words
 */
export function getWakeWordsList() {
    const config = loadWakeWords();
    return [...config.wakeWords, ...config.exactMatches];
}

/**
 * Reload wake words configuration (useful for runtime updates)
 */
export function reloadWakeWords() {
    wakeWordsConfig = null;
    return loadWakeWords();
}