import { recordChunk } from './utils/record.js';
import { transcribe } from './utils/stt.js';
import { sendToLMStudio } from './utils/llm.js';
import { speak } from './utils/tts.js';
import { detectWakeWord, getWakeWordsList } from './utils/wake-words.js';

/**
 * Manage conversation history size to prevent token overflow
 * @param {Array} history - Conversation history array
 * @param {number} maxPairs - Maximum number of user/assistant pairs to keep
 * @returns {Array} - Trimmed history
 */
function trimConversationHistory(history, maxPairs = 8) {
  if (history.length <= maxPairs * 2) {
    return history;
  }

  // Keep the most recent exchanges
  return history.slice(-(maxPairs * 2));
}

/**
 * Check if text contains stop words
 * @param {string} text - Text to check
 * @returns {boolean} - True if contains stop words
 */
function containsStopWords(text) {
  const stopWords = [
    'stop', 'halt', 'cancel', 'abort', 'quit', 'enough', 'nevermind',
    'never mind', 'forget it', 'skip', 'pause', 'wait'
  ];

  const lowerText = text.toLowerCase();
  return stopWords.some(word => lowerText.includes(word));
}

/**
 * Send message to LM Studio with interrupt monitoring during processing
 * @param {string} message - User message
 * @param {Array} conversationHistory - Conversation history
 * @returns {Promise<string|null>} - Response or null if interrupted
 */
async function sendToLMStudioWithInterrupt(message, conversationHistory) {
  return new Promise(async (resolve) => {
    let isInterrupted = false;
    let llmResponse = null;

    // Start LLM processing
    const llmPromise = sendToLMStudio(message, conversationHistory)
      .then(response => {
        if (!isInterrupted) {
          llmResponse = response;
        }
      })
      .catch(error => {
        if (!isInterrupted) {
          console.error('LLM error:', error);
          llmResponse = "Sorry, I encountered an error while thinking.";
        }
      });

    // Start interrupt monitoring
    const interruptPromise = (async () => {
      console.log('🎧 Monitoring for stop commands while thinking...');
      while (!llmResponse && !isInterrupted) {
        try {
          // Record short chunks to detect interruption
          const filePath = await recordChunk('audio/thinking_interrupt.wav', 1000); // 1s chunks
          const text = await transcribe(filePath);

          // Debug: Show what was heard during thinking
          if (text.trim() && !text.includes('[BLANK_AUDIO]') && !text.includes('[inaudible]')) {
            console.log(`🎤 Heard while thinking: "${text.trim()}"`);
          }

          // Check if user said stop or similar
          if (text.trim() &&
            !text.includes('[BLANK_AUDIO]') &&
            !text.includes('[inaudible]') &&
            containsStopWords(text)) {

            console.log(`🛑 Stop command detected: "${text.trim()}"`);
            isInterrupted = true;
            break;
          }

          // Small delay to prevent excessive CPU usage
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          // Ignore errors during interrupt monitoring
          console.log('⚠️ Interrupt monitoring error:', error.message);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      console.log('🔇 Stop monitoring (thinking complete or interrupted)');
    })();

    // Wait for either LLM response or interrupt
    await Promise.race([llmPromise, interruptPromise]);

    // Clean up
    try {
      // Give a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (e) {
      // Ignore cleanup errors
    }

    resolve(isInterrupted ? null : llmResponse);
  });
}

async function waitForCompleteSentence() {
  console.log('🎧 Listening for your complete question...');

  let fullTranscript = '';
  let silenceCount = 0;
  const maxSilenceBeforeResponse = 1; // Wait for 1 silent chunk (2 seconds)

  while (true) {
    try {
      // Record shorter chunks to detect pauses better
      const filePath = await recordChunk('audio/sentence.wav', 2000); // 2s chunks
      const text = await transcribe(filePath);

      if (text.trim() && !text.includes('[BLANK_AUDIO]') && !text.includes('[inaudible]')) {
        // Got clear speech - add to transcript and reset silence counter
        fullTranscript += (fullTranscript ? ' ' : '') + text.trim();
        silenceCount = 0;
        console.log('📝 Building:', fullTranscript);
      } else {
        // No clear speech in this chunk
        silenceCount++;
        console.log(`⏳ Silence detected (${silenceCount}/${maxSilenceBeforeResponse})...`);

        // If we have some transcript and enough silence, process it
        if (fullTranscript.trim() && silenceCount >= maxSilenceBeforeResponse) {
          console.log('✅ Complete sentence detected!');
          return fullTranscript.trim();
        }

        // If too much silence without any speech, return empty
        if (silenceCount >= 4 && !fullTranscript.trim()) {
          console.log('🔇 Too much silence, continuing to listen...');
          return '';
        }
      }

      // Safety limit - don't let sentences get too long
      if (fullTranscript.length > 500) {
        console.log('📏 Sentence getting long, processing now...');
        return fullTranscript.trim();
      }

    } catch (err) {
      console.error('Sentence detection error:', err);
      break;
    }
  }

  return fullTranscript.trim();
}

async function conversationMode() {
  console.log('💬 Conversation mode active! Ask me anything. I\'ll go back to sleep after 1 minute of silence.');

  const conversationTimeout = 60000; // 1 minute
  let lastActivity = Date.now();
  let conversationHistory = []; // Track conversation context

  while (true) {
    try {
      // Check if conversation timeout exceeded
      if (Date.now() - lastActivity > conversationTimeout) {
        console.log('😴 Going back to sleep due to inactivity...');
        await speak("I'm going back to sleep now. Say my wake word if you need me again.");
        break;
      }

      // Wait for complete sentence instead of processing chunks immediately
      const completeSentence = await waitForCompleteSentence();

      if (completeSentence) {
        // Reset timeout when we get user input
        lastActivity = Date.now();
        console.log('💭 Complete question:', completeSentence);

        // Check for exit phrases
        const lowerText = completeSentence.toLowerCase();
        if (lowerText.includes('goodbye') || lowerText.includes('bye max') ||
          lowerText.includes('go to sleep') || lowerText.includes('that\'s all')) {
          console.log('👋 Goodbye!');
          await speak("Goodbye! Say my wake word if you need me again.");
          break;
        }

        console.log('🤔 Thinking...');
        // Keep activity alive while processing
        lastActivity = Date.now();

        // Send to LM Studio with conversation history, with interrupt monitoring
        const response = await sendToLMStudioWithInterrupt(completeSentence, conversationHistory);

        // Check if thinking was interrupted
        if (response === null) {
          console.log('🛑 Thinking interrupted by user!');
          console.log('💬 What else can I help you with?');
          continue; // Go back to listening
        }

        console.log('🤖 Max:', response);

        // Keep activity alive after getting response
        lastActivity = Date.now();

        // Add to conversation history and trim if needed
        conversationHistory.push(
          { role: "user", content: completeSentence },
          { role: "assistant", content: response }
        );
        conversationHistory = trimConversationHistory(conversationHistory);

        // Speak the response with interrupt handling
        console.log('🔊 Speaking response...');
        const speechResult = await speak(response);

        // Keep activity alive after speaking
        lastActivity = Date.now();

        // If speech was interrupted, immediately listen for new instruction
        if (speechResult.interrupted) {
          console.log('🎤 Speech interrupted! Listening for your instruction...');
          const newInstruction = await waitForCompleteSentence();
          if (newInstruction) {
            // Reset timeout for new instruction
            lastActivity = Date.now();
            console.log('💭 New instruction received:', newInstruction);

            // Check for exit phrases
            const lowerText = newInstruction.toLowerCase();
            if (lowerText.includes('goodbye') || lowerText.includes('bye max') ||
              lowerText.includes('go to sleep') || lowerText.includes('that\'s all')) {
              console.log('👋 Goodbye!');
              await speak("Goodbye! Say my wake word if you need me again.");
              break;
            }

            // Process the new instruction with conversation history
            console.log('🤔 Processing new instruction...');
            lastActivity = Date.now(); // Keep alive while processing

            const newResponse = await sendToLMStudioWithInterrupt(newInstruction, conversationHistory);

            // Check if thinking was interrupted
            if (newResponse === null) {
              console.log('🛑 Processing interrupted by user!');
              console.log('💬 What else can I help you with?');
              continue; // Go back to listening
            }

            console.log('🤖 Max:', newResponse);

            lastActivity = Date.now(); // Keep alive after response

            // Add to conversation history and trim if needed
            conversationHistory.push(
              { role: "user", content: newInstruction },
              { role: "assistant", content: newResponse }
            );
            conversationHistory = trimConversationHistory(conversationHistory);

            // Speak the new response
            console.log('🔊 Speaking new response...');
            await speak(newResponse);
            lastActivity = Date.now(); // Keep alive after speaking
          }
        }

        console.log('💬 What else can I help you with?');
      } else {
        console.log('👂 Still listening...');
      }
    } catch (err) {
      console.error('Conversation error:', err);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function main() {
  const wakeWords = getWakeWordsList();
  console.log(`Max is listening... Wake words: ${wakeWords.slice(0, 3).join(', ')}${wakeWords.length > 3 ? ` and ${wakeWords.length - 3} more` : ''}`);
  console.log('🔧 System capabilities: Process management, program execution, file operations');
  console.log('🖱️  Input control: Mouse movement, clicking, scrolling, keyboard input');
  console.log('🔐 Security: All dangerous operations require voice confirmation');

  while (true) {
    try {
      // Continuous listening for wake word
      const filePath = await recordChunk('audio/input.wav', 2000); // 2s chunk
      const text = await transcribe(filePath);

      // Debug: show what was transcribed (only if not empty)
      if (text.trim()) {
        console.log('Heard:', text.trim());
      }

      // Check for wake words using configuration
      if (detectWakeWord(text)) {
        console.log('🎤 Wake word detected! Starting conversation mode...');
        await speak("Ready.");

        // Enter conversation mode
        await conversationMode();

        console.log('\n👂 Back to listening for wake words...');
      }
    } catch (err) {
      console.error('Error:', err);
      // Continue listening even if there's an error
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

main();
