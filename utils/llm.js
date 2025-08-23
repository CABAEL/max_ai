import fetch from 'node-fetch';
import { processWithFunctions } from './function-processor.js';

/**
 * Send a message to LM Studio local server with conversation history
 * @param {string} message - The user's message
 * @param {Array} conversationHistory - Array of previous messages
 * @param {string} baseUrl - LM Studio server URL (default: http://localhost:1234)
 * @returns {Promise<string>} - AI response
 */
export async function sendToLMStudio(message, conversationHistory = [], baseUrl = 'http://127.0.0.1:1234') {
  try {
    // Process message with functions to get real-time data
    const enhancedMessage = await processWithFunctions(message);
    
    // Build messages array with conversation history
    const messages = [];
    
    // Add conversation history (keep last 10 exchanges to avoid token limits)
    const recentHistory = conversationHistory.slice(-20); // Last 10 user+assistant pairs
    messages.push(...recentHistory);
    
    // Add current message
    messages.push({
      role: "user",
      content: enhancedMessage
    });
    
    // If this is the first message, add system context
    if (conversationHistory.length === 0) {
      messages.unshift({
        role: "user",
        content: "You are Max, a helpful AI assistant. Keep responses concise and conversational."
      });
      messages.push({
        role: "assistant", 
        content: "Hello! I'm Max, your AI assistant. How can I help you today?"
      });
      messages.push({
        role: "user",
        content: enhancedMessage
      });
    }
    
    const requestBody = {
      messages: messages,
      temperature: 0.7,
      max_tokens: 150,
      stream: false
    };

    console.log('Sending request to LM Studio...');

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LM Studio API Error Response:', errorText);
      throw new Error(`LM Studio API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('LM Studio response received');

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    } else {
      console.error('Unexpected response format:', data);
      return "I received an unexpected response format.";
    }
  } catch (error) {
    console.error('Error connecting to LM Studio:', error.message);
    return "Sorry, I'm having trouble connecting to my brain right now.";
  }
}