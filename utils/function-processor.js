import { availableFunctions } from './functions.js';
import { processSystemCommands, containsSystemCommands } from './system-processor.js';

/**
 * Process user message and execute any needed functions before sending to LLM
 * @param {string} message - User's message
 * @returns {Promise<string>} Enhanced message with function results
 */
export async function processWithFunctions(message) {
  const lowerMessage = message.toLowerCase();
  let enhancedMessage = message;
  let functionResults = [];

  // Check for system commands first (they take priority)
  if (containsSystemCommands(message)) {
    console.log('🔧 System command detected, processing...');
    return await processSystemCommands(message);
  }

  // Check for time-related queries
  if (lowerMessage.includes('time') || lowerMessage.includes('clock')) {
    const timeResult = availableFunctions.getCurrentTime.function();
    functionResults.push(`Current time: ${timeResult}`);
  }

  // Check for date-related queries
  if (lowerMessage.includes('date') || lowerMessage.includes('today') || lowerMessage.includes('day')) {
    const dateResult = availableFunctions.getCurrentDate.function();
    functionResults.push(`Current date: ${dateResult}`);
  }

  // Check for system info queries
  if (lowerMessage.includes('system') || lowerMessage.includes('computer') || lowerMessage.includes('memory')) {
    const sysInfo = availableFunctions.getSystemInfo.function();
    functionResults.push(`System info: Platform: ${sysInfo.platform}, Node: ${sysInfo.nodeVersion}, Memory: ${sysInfo.memory}, Uptime: ${sysInfo.uptime}s`);
  }

  // Check for math calculations
  const mathMatch = lowerMessage.match(/calculate|compute|math|what is|what's|\d+[\+\-\*\/]\d+/);
  if (mathMatch) {
    // Extract potential math expression
    const expressionMatch = message.match(/(\d+[\+\-\*\/\.\(\)\s]*\d+)/);
    if (expressionMatch) {
      const calcResult = availableFunctions.calculate.function(expressionMatch[1]);
      functionResults.push(`Calculation: ${calcResult}`);
    }
  }

  // If we have function results, enhance the message
  if (functionResults.length > 0) {
    enhancedMessage = `User question: ${message}\n\nReal-time data available:\n${functionResults.join('\n')}\n\nPlease use this real data in your response, not placeholder text.`;
  } else {
    enhancedMessage = `User question: ${message}`;
  }

  return enhancedMessage;
}

/**
 * Get list of available functions for display
 * @returns {string[]} List of function descriptions
 */
export function getFunctionsList() {
  return Object.values(availableFunctions).map(func => 
    `${func.name}: ${func.description}`
  );
}