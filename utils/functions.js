/**
 * System functions that Max can call to get real-time information
 */

/**
 * Get current date and time
 * @returns {string} Current date and time formatted
 */
export function getCurrentTime() {
  const now = new Date();
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  };
  return now.toLocaleString('en-US', options);
}

/**
 * Get current date only
 * @returns {string} Current date formatted
 */
export function getCurrentDate() {
  const now = new Date();
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  return now.toLocaleDateString('en-US', options);
}

/**
 * Get system information
 * @returns {Object} System info
 */
export function getSystemInfo() {
  return {
    platform: process.platform,
    nodeVersion: process.version,
    uptime: Math.floor(process.uptime()),
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB'
  };
}

/**
 * Simple calculator
 * @param {string} expression - Math expression to evaluate
 * @returns {string} Result or error message
 */
export function calculate(expression) {
  try {
    // Basic safety check - only allow numbers, operators, and parentheses
    if (!/^[0-9+\-*/.() ]+$/.test(expression)) {
      return "Invalid expression. Only numbers and basic operators allowed.";
    }
    const result = eval(expression);
    return `${expression} = ${result}`;
  } catch (error) {
    return `Error calculating: ${error.message}`;
  }
}

/**
 * Available functions that Max can call
 */
export const availableFunctions = {
  getCurrentTime: {
    name: 'getCurrentTime',
    description: 'Get the current date and time',
    function: getCurrentTime
  },
  getCurrentDate: {
    name: 'getCurrentDate', 
    description: 'Get the current date',
    function: getCurrentDate
  },
  getSystemInfo: {
    name: 'getSystemInfo',
    description: 'Get system information',
    function: getSystemInfo
  },
  calculate: {
    name: 'calculate',
    description: 'Perform basic math calculations',
    function: calculate,
    parameters: ['expression']
  }
};