import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { recordChunk } from './record.js';
import { transcribe } from './stt.js';

let currentSpeechProcess = null;

/**
 * Check if text contains stop words for interruption
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

// Configuration for pyttsx3 TTS
const PYTTSX3_CONFIG = {
  rate: 180,        // Speech rate (words per minute)
  volume: 1.0,      // Volume level (0.0 to 1.0)
  voice: 'female'   // Preferred voice gender
};

/**
 * Convert text to speech using pyttsx3 with fallback to Windows SAPI
 * @param {string} text - Text to speak
 * @param {string} outputPath - Path to save audio file (optional)
 * @param {boolean} interruptible - Whether speech can be interrupted (default: true)
 * @returns {Promise<{completed: boolean, interrupted: boolean}>}
 */
export async function speak(text, outputPath = null, interruptible = true) {
  // Try pyttsx3 first, fallback to SAPI if not available
  try {
    return await speakWithPyttsx3(text, outputPath, interruptible);
  } catch (error) {
    if (error.code === 'ENOENT' || error.message.includes('python')) {
      console.log('⚠️  pyttsx3 not available, using Windows SAPI...');
      return await speakWithSAPI(text, outputPath, interruptible);
    }
    throw error;
  }
}

/**
 * TTS using pyttsx3 with female voice
 * @param {string} text - Text to speak
 * @param {string} outputPath - Path to save audio file (optional)
 * @param {boolean} interruptible - Whether speech can be interrupted
 * @returns {Promise<{completed: boolean, interrupted: boolean}>}
 */
async function speakWithPyttsx3(text, outputPath = null, interruptible = true) {
  return new Promise(async (resolve, reject) => {
    try {
      // Create Python script for pyttsx3
      const pythonScript = `
import pyttsx3
import sys

def speak_text():
    engine = pyttsx3.init()
    
    # Configure voice settings
    voices = engine.getProperty('voices')
    if voices:
        # Try to use a female voice if available (Zira)
        for voice in voices:
            if 'female' in voice.name.lower() or 'zira' in voice.name.lower():
                engine.setProperty('voice', voice.id)
                break
        else:
            # If no female voice found, use the first available voice
            engine.setProperty('voice', voices[0].id)
    
    # Set speech rate (slower = more natural)
    engine.setProperty('rate', ${PYTTSX3_CONFIG.rate})  # Default is usually 200
    engine.setProperty('volume', ${PYTTSX3_CONFIG.volume})
    
    text = """${text.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"""
    
    ${outputPath ? `engine.save_to_file(text, '${outputPath}')` : 'engine.say(text)'}
    engine.runAndWait()
    engine.stop()

if __name__ == "__main__":
    speak_text()
`;

      // Write Python script to temp file
      const scriptPath = 'audio/tts_script.py';
      const audioDir = path.dirname(scriptPath);
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }

      fs.writeFileSync(scriptPath, pythonScript);

      console.log('🎤 Speaking with pyttsx3 (female voice)...');

      const python = spawn('python', [scriptPath], {
        stdio: 'pipe'
      });

      currentSpeechProcess = python;
      let speechCompleted = false;
      let wasInterrupted = false;

      // Start interrupt detection if enabled
      let interruptMonitor = null;
      if (interruptible) {
        interruptMonitor = startInterruptMonitoring();
      }

      python.on('close', (code) => {
        currentSpeechProcess = null;
        speechCompleted = true;

        // Clean up script file
        try {
          fs.unlinkSync(scriptPath);
        } catch (e) {
          // Ignore cleanup errors
        }

        if (interruptMonitor) {
          interruptMonitor.stop();
        }

        if (code === 0) {
          resolve({ completed: true, interrupted: wasInterrupted });
        } else if (wasInterrupted) {
          // If interrupted, don't treat as error
          resolve({ completed: false, interrupted: true });
        } else {
          reject(new Error(`pyttsx3 TTS failed with code ${code}`));
        }
      });

      python.on('error', (err) => {
        currentSpeechProcess = null;

        // Clean up script file
        try {
          fs.unlinkSync(scriptPath);
        } catch (e) {
          // Ignore cleanup errors
        }

        if (interruptMonitor) {
          interruptMonitor.stop();
        }
        reject(err);
      });

      // Handle interrupt detection
      if (interruptible && interruptMonitor) {
        interruptMonitor.onInterrupt = () => {
          if (!speechCompleted && currentSpeechProcess) {
            console.log('🛑 Speech interrupted by user!');
            wasInterrupted = true;
            currentSpeechProcess.kill('SIGTERM');
            currentSpeechProcess = null;
            resolve({ completed: false, interrupted: true });
          }
        };
      }

    } catch (error) {
      currentSpeechProcess = null;
      reject(error);
    }
  });
}

/**
 * Fallback TTS using Windows SAPI
 * @param {string} text - Text to speak
 * @param {string} outputPath - Path to save audio file (optional)
 * @param {boolean} interruptible - Whether speech can be interrupted
 * @returns {Promise<{completed: boolean, interrupted: boolean}>}
 */
async function speakWithSAPI(text, outputPath = null, interruptible = true) {
  return new Promise(async (resolve, reject) => {
    try {
      // Use PowerShell with Windows Speech API for TTS
      const psScript = `
        Add-Type -AssemblyName System.Speech;
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
        $synth.Rate = 0;
        $synth.Volume = 100;
        ${outputPath ? `$synth.SetOutputToWaveFile('${outputPath}');` : '$synth.SetOutputToDefaultAudioDevice();'}
        $synth.Speak('${text.replace(/'/g, "''")}');
        $synth.Dispose();
      `;

      const powershell = spawn('powershell', ['-Command', psScript], {
        stdio: 'pipe'
      });

      currentSpeechProcess = powershell;
      let speechCompleted = false;
      let wasInterrupted = false;

      // Start interrupt detection if enabled
      let interruptMonitor = null;
      if (interruptible) {
        interruptMonitor = startInterruptMonitoring();
      }

      powershell.on('close', (code) => {
        currentSpeechProcess = null;
        speechCompleted = true;

        if (interruptMonitor) {
          interruptMonitor.stop();
        }

        if (code === 0) {
          resolve({ completed: true, interrupted: wasInterrupted });
        } else if (wasInterrupted) {
          // If interrupted, don't treat as error
          resolve({ completed: false, interrupted: true });
        } else {
          reject(new Error(`PowerShell TTS failed with code ${code}`));
        }
      });

      powershell.on('error', (err) => {
        currentSpeechProcess = null;
        if (interruptMonitor) {
          interruptMonitor.stop();
        }
        reject(err);
      });

      // Handle interrupt detection
      if (interruptible && interruptMonitor) {
        interruptMonitor.onInterrupt = () => {
          if (!speechCompleted && currentSpeechProcess) {
            console.log('🛑 Speech interrupted by user!');
            wasInterrupted = true;
            currentSpeechProcess.kill('SIGTERM');
            currentSpeechProcess = null;
            resolve({ completed: false, interrupted: true });
          }
        };
      }

    } catch (error) {
      currentSpeechProcess = null;
      reject(error);
    }
  });
}

/**
 * Stop current speech immediately
 */
export function stopSpeech() {
  if (currentSpeechProcess) {
    console.log('🛑 Stopping speech...');
    currentSpeechProcess.kill('SIGTERM');
    currentSpeechProcess = null;
    return true;
  }
  return false;
}

/**
 * Start monitoring for interrupt signals (user voice)
 * @returns {Object} Monitor object with stop method
 */
function startInterruptMonitoring() {
  let monitoring = true;

  const monitor = {
    stop: () => {
      monitoring = false;
    },
    onInterrupt: null
  };

  // Start async monitoring
  (async () => {
    while (monitoring && currentSpeechProcess) {
      try {
        // Record short chunks to detect interruption
        const filePath = await recordChunk('audio/interrupt.wav', 1000); // 1s chunks
        const text = await transcribe(filePath);

        // Check if user said a stop command (only stop words interrupt)
        if (text.trim() &&
          !text.includes('[BLANK_AUDIO]') &&
          !text.includes('[inaudible]') &&
          text.length > 2 &&
          containsStopWords(text)) { // Only interrupt on stop commands

          console.log(`🛑 Stop command detected: "${text.trim()}"`);

          // Clean up interrupt detection file
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (e) {
            // Ignore cleanup errors
          }

          if (monitor.onInterrupt) {
            monitor.onInterrupt();
          }
          break;
        }

        // Clean up the interrupt detection file
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {
          // Ignore cleanup errors
        }

        // Small delay to prevent excessive CPU usage
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Ignore errors during interrupt monitoring
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  })();

  return monitor;
}

/**
 * Interrupt current speech immediately
 * @returns {boolean} - True if speech was interrupted, false if no speech was active
 */
export function interruptSpeech() {
  if (currentSpeechProcess) {
    console.log('🛑 Interrupting current speech...');
    try {
      currentSpeechProcess.kill('SIGTERM');
      currentSpeechProcess = null;
      return true;
    } catch (error) {
      console.error('Error interrupting speech:', error.message);
      currentSpeechProcess = null;
      return false;
    }
  }
  return false;
}

/**
 * Check if speech is currently active
 * @returns {boolean} - True if speech is active
 */
export function isSpeechActive() {
  return currentSpeechProcess !== null;
}

/**
 * Play an audio file using system default player
 * @param {string} filePath - Path to audio file
 * @returns {Promise<void>}
 */
export async function playAudio(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`Audio file not found: ${filePath}`));
      return;
    }

    // Use Windows start command to play audio
    const player = spawn('cmd', ['/c', 'start', '/min', filePath], {
      stdio: 'pipe'
    });

    player.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Audio playback failed with code ${code}`));
      }
    });

    player.on('error', (err) => reject(err));
  });
}