import { AudioStreamer } from './utils/stream-audio.js';
import { StreamingSTT, detectAudioActivity, isSilent } from './utils/stream-stt.js';
import { sendToLMStudio } from './utils/llm.js';
import { speak, interruptSpeech, isSpeechActive } from './utils/tts.js';
import { detectWakeWord, getWakeWordsList } from './utils/wake-words.js';
import fs from 'fs';

/**
 * Real-time Max AI Assistant with streaming audio processing
 * No temporary files - processes audio directly from microphone stream
 */
class StreamingMaxAssistant {
  constructor() {
    this.audioStreamer = new AudioStreamer({
      sampleRate: 16000,
      channels: 1,
      chunkDuration: 2000 // 2-second chunks
    });

    this.stt = new StreamingSTT({
      sampleRate: 16000,
      channels: 1
    });

    this.conversationHistory = [];
    this.isInConversation = false;
    this.lastActivity = Date.now();
    this.conversationTimeout = 60000; // 1 minute

    // Interruption handling
    this.isProcessingLLM = false;
    this.isSpeaking = false;
    this.currentLLMProcess = null;
    this.currentSpeechProcess = null;

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for audio streaming
   */
  setupEventHandlers() {
    // Handle audio chunks from stream
    this.audioStreamer.on('audioChunk', async (audioBuffer) => {
      await this.processAudioChunk(audioBuffer);
    });

    // Handle streaming errors
    this.audioStreamer.on('error', (error) => {
      console.error('Audio streaming error:', error);
      this.restartStreaming();
    });

    // Handle stream start/stop
    this.audioStreamer.on('started', () => {
      console.log('🎵 Real-time audio streaming active');
    });

    this.audioStreamer.on('stopped', () => {
      console.log('🔇 Audio streaming stopped');
    });
  }

  /**
   * Process incoming audio chunk
   */
  async processAudioChunk(audioBuffer) {
    try {
      // Check for audio activity with lower threshold
      const hasActivity = detectAudioActivity(audioBuffer, 200); // Lower threshold
      const isQuiet = isSilent(audioBuffer, 100); // Lower silence threshold

      if (!hasActivity || isQuiet) {
        // Show a simple listening indicator every 10 chunks during silence
        if (!this.isInConversation && Math.random() < 0.1) {
          process.stdout.write('👂');
        }

        // Check conversation timeout during silence - BUT NOT if LLM is processing or speaking
        if (this.isInConversation &&
          !this.isProcessingLLM &&
          !this.isSpeaking &&
          Date.now() - this.lastActivity > this.conversationTimeout) {
          await this.exitConversationMode();
        }
        return;
      }

      console.log('🎤 Processing audio with speech...');

      // Transcribe audio buffer directly
      const rawText = await this.stt.transcribeBufferSafe(audioBuffer);

      // Clean up transcription text
      const text = rawText
        .replace(/^[-\s]+/, '') // Remove leading dashes and spaces
        .replace(/[-\s]+$/, '') // Remove trailing dashes and spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      console.log(`🎯 Transcription result: "${text}"`);

      if (!text || text.length < 2) {
        console.log('⚠️ Skipping empty/short transcription');
        return; // Skip empty or very short transcriptions
      }

      console.log('🎤 Heard:', text);

      if (this.isInConversation) {
        await this.handleConversationInput(text);
      } else {
        await this.handleWakeWordDetection(text);
      }

    } catch (error) {
      console.error('Audio processing error:', error);
    }
  }

  /**
   * Handle wake word detection
   */
  async handleWakeWordDetection(text) {
    console.log(`🔍 Checking for wake word in: "${text}"`);
    if (detectWakeWord(text)) {
      console.log('🎤 Wake word detected! Starting conversation mode...');
      await this.enterConversationMode();
    } else {
      console.log('👂 No wake word detected, continuing to listen...');
    }
  }

  /**
   * Handle conversation input
   */
  async handleConversationInput(text) {
    this.lastActivity = Date.now();

    // Check for exit phrases
    const lowerText = text.toLowerCase();
    if (lowerText.includes('goodbye') || lowerText.includes('bye max') ||
      lowerText.includes('go to sleep') || lowerText.includes('that\'s all')) {
      console.log('👋 Goodbye!');
      await this.interruptCurrentProcesses();
      await speak('Goodbye! Say my wake word if you need me again.');
      await this.exitConversationMode();
      return;
    }

    // Check for stop words during processing - IMMEDIATE INTERRUPTION
    if (this.containsStopWords(text)) {
      console.log('🛑 Stop command detected - interrupting all processes!');
      await this.interruptCurrentProcesses();

      // Check if there's a new instruction after the stop command
      const newInstruction = this.extractInstructionAfterStop(text);
      if (newInstruction) {
        console.log(`🔄 Processing new instruction: "${newInstruction}"`);
        await this.processConversation(newInstruction);
      } else {
        console.log('✋ Stopped. What else can I help you with?');
      }
      return;
    }

    // If currently processing, ignore new input unless it's a stop command
    // (Only stop commands should interrupt, which are handled above)
    if (this.isProcessingLLM) {
      console.log('🤔 Max is thinking... (say "stop" to interrupt)');
      return;
    }

    if (this.isSpeaking) {
      console.log('🔊 Max is speaking... (say "stop" to interrupt)');
      return;
    }

    // Process the conversation
    await this.processConversation(text);
  }

  /**
   * Process conversation with LLM
   */
  async processConversation(text) {
    try {
      console.log('🤔 Thinking...');
      this.lastActivity = Date.now();
      this.isProcessingLLM = true;

      // Send to LM Studio with conversation history
      const response = await this.sendToLMStudioWithInterruption(text, this.conversationHistory);

      this.isProcessingLLM = false;

      // Check if process was interrupted
      if (response === null) {
        console.log('🛑 Thinking was interrupted');
        return;
      }

      console.log('🤖 Max:', response);
      this.lastActivity = Date.now();

      // Add to conversation history
      this.conversationHistory.push(
        { role: 'user', content: text },
        { role: 'assistant', content: response }
      );

      // Trim history to prevent token overflow
      this.conversationHistory = this.trimConversationHistory(this.conversationHistory);

      // Speak the response with interruption support
      console.log('🔊 Speaking response...');
      this.isSpeaking = true;
      const speechResult = await this.speakWithInterruption(response);
      this.isSpeaking = false;

      if (speechResult.interrupted) {
        console.log('🛑 Speech was interrupted');
        return;
      }

      this.lastActivity = Date.now();
      console.log('💬 What else can I help you with?');

    } catch (error) {
      this.isProcessingLLM = false;
      this.isSpeaking = false;
      console.error('Conversation processing error:', error);
      await speak('Sorry, I encountered an error while thinking.');
    }
  }

  /**
   * Enter conversation mode
   */
  async enterConversationMode() {
    this.isInConversation = true;
    this.lastActivity = Date.now();
    this.conversationHistory = [];

    await speak('Ready.');
    console.log('💬 Conversation mode active! Ask me anything.');
    console.log('🔇 I\'ll go back to sleep after 1 minute of silence.');
  }

  /**
   * Exit conversation mode
   */
  async exitConversationMode() {
    if (this.isInConversation) {
      this.isInConversation = false;
      this.conversationHistory = [];

      console.log('😴 Going back to sleep...');
      await speak('I\'m going back to sleep now. Say my wake word if you need me again.');
      console.log('\n👂 Back to listening for wake words...');
    }
  }

  /**
   * Check if text contains stop words
   */
  containsStopWords(text) {
    const stopWords = [
      'stop', 'halt', 'cancel', 'abort', 'quit', 'enough', 'nevermind',
      'never mind', 'forget it', 'skip', 'pause', 'wait'
    ];

    const lowerText = text.toLowerCase();
    return stopWords.some(word => lowerText.includes(word));
  }

  /**
   * Extract new instruction after stop command
   * Examples: "stop, tell me about cats" -> "tell me about cats"
   *          "cancel that, what's the weather" -> "what's the weather"
   */
  extractInstructionAfterStop(text) {
    const stopWords = [
      'stop', 'halt', 'cancel', 'abort', 'quit', 'enough', 'nevermind',
      'never mind', 'forget it', 'skip', 'pause', 'wait'
    ];

    const lowerText = text.toLowerCase();

    // Find the stop word and its position
    let stopWordEnd = -1;
    let foundStopWord = '';

    for (const stopWord of stopWords) {
      const index = lowerText.indexOf(stopWord);
      if (index !== -1) {
        const endIndex = index + stopWord.length;
        if (stopWordEnd === -1 || index < stopWordEnd - foundStopWord.length) {
          stopWordEnd = endIndex;
          foundStopWord = stopWord;
        }
      }
    }

    if (stopWordEnd === -1) return null;

    // Extract text after the stop word
    let remainingText = text.substring(stopWordEnd).trim();

    // Remove common separators like comma, "and", "then", etc.
    remainingText = remainingText.replace(/^[,;]\s*/, ''); // Remove leading comma/semicolon
    remainingText = remainingText.replace(/^(and|then|now)\s+/i, ''); // Remove connecting words

    // Return the instruction if it's substantial enough
    return remainingText.length > 3 ? remainingText : null;
  }

  /**
   * Interrupt all current processes (LLM and speech)
   */
  async interruptCurrentProcesses() {
    console.log('⚡ Interrupting current processes...');

    // Interrupt LLM processing
    if (this.isProcessingLLM && this.currentLLMProcess) {
      try {
        this.currentLLMProcess.abort();
        console.log('🛑 LLM process interrupted');
      } catch (error) {
        console.log('⚠️ LLM interruption error:', error.message);
      }
    }

    // Interrupt speech using global TTS function
    if (this.isSpeaking || isSpeechActive()) {
      const wasInterrupted = interruptSpeech();
      if (wasInterrupted) {
        console.log('🛑 Speech interrupted');
      }
    }

    // Reset states
    this.isProcessingLLM = false;
    this.isSpeaking = false;
    this.currentLLMProcess = null;
    this.currentSpeechProcess = null;
  }

  /**
   * Send to LM Studio with interruption support
   */
  async sendToLMStudioWithInterruption(text, history) {
    return new Promise(async (resolve) => {
      let isInterrupted = false;
      let response = null;

      // Create an abort controller for the LLM request
      const abortController = new AbortController();
      this.currentLLMProcess = abortController;

      // Start LLM processing
      const llmPromise = sendToLMStudio(text, history, { signal: abortController.signal })
        .then(result => {
          if (!isInterrupted) {
            response = result;
          }
        })
        .catch(error => {
          if (error.name === 'AbortError') {
            console.log('🛑 LLM request was aborted');
            isInterrupted = true;
            response = null; // Don't set error message for intentional interruption
          } else if (!isInterrupted) {
            console.error('LLM error:', error);
            response = "Sorry, I encountered an error while thinking.";
          }
        });

      // Wait for completion or interruption
      await llmPromise;

      // Clean up
      this.currentLLMProcess = null;
      resolve(isInterrupted ? null : response);
    });
  }



  /**
   * Speak with interruption support
   */
  async speakWithInterruption(text) {
    try {
      const result = await speak(text, null, true); // Enable interruptible speech
      return result;
    } catch (error) {
      console.error('Speech error:', error);
      return { completed: false, interrupted: true };
    }
  }

  /**
   * Trim conversation history to prevent token overflow
   */
  trimConversationHistory(history, maxPairs = 8) {
    if (history.length <= maxPairs * 2) {
      return history;
    }
    return history.slice(-(maxPairs * 2));
  }

  /**
   * Restart streaming after error
   */
  async restartStreaming() {
    console.log('🔄 Restarting audio streaming...');

    try {
      if (this.audioStreamer.isActive()) {
        this.audioStreamer.stopStreaming();
      }

      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      await this.audioStreamer.startStreaming();

    } catch (error) {
      console.error('Failed to restart streaming:', error);
      setTimeout(() => this.restartStreaming(), 5000); // Retry in 5 seconds
    }
  }

  /**
   * Start the assistant
   */
  async start() {
    try {
      const wakeWords = getWakeWordsList();
      console.log('🚀 Starting Max AI Assistant with real-time streaming...');
      console.log(`👂 Wake words: ${wakeWords.slice(0, 3).join(', ')}${wakeWords.length > 3 ? ` and ${wakeWords.length - 3} more` : ''}`);
      console.log('🔧 System capabilities: Process management, program execution, file operations');
      console.log('🖱️  Input control: Mouse movement, clicking, scrolling, keyboard input');
      console.log('🔐 Security: All dangerous operations require voice confirmation');
      console.log('');

      await this.audioStreamer.startStreaming();

      // Keep the process running
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down Max...');
        this.audioStreamer.stopStreaming();
        process.exit(0);
      });

    } catch (error) {
      console.error('Failed to start Max:', error);
      process.exit(1);
    }
  }
}

// Start the streaming assistant
const maxAssistant = new StreamingMaxAssistant();
maxAssistant.start().catch(console.error);