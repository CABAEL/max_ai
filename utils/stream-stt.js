import { spawn } from 'child_process';
import path from 'path';
import { pcmToWav } from './stream-audio.js';

/**
 * Real-time speech-to-text using Whisper.cpp with streaming audio
 */
export class StreamingSTT {
  constructor(options = {}) {
    this.whisperPath = path.resolve('./bin/whisper-cli.exe');
    this.modelPath = path.resolve('./models/ggml-base.en.bin');
    this.sampleRate = options.sampleRate || 16000;
    this.channels = options.channels || 1;
  }

  /**
   * Transcribe audio buffer using temporary file (whisper.cpp doesn't support stdin)
   * @param {Buffer} audioBuffer - PCM audio data
   * @returns {Promise<string>} - Transcribed text
   */
  async transcribeBuffer(audioBuffer) {
    return new Promise((resolve, reject) => {
      // Convert PCM to WAV format in memory
      const wavBuffer = pcmToWav(audioBuffer, this.sampleRate, this.channels);

      // Create temporary file for this chunk
      const tempFile = `audio/stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`;
      
      // Ensure audio directory exists
      import('fs').then(fs => {
        if (!fs.existsSync('audio')) {
          fs.mkdirSync('audio', { recursive: true });
        }

        // Write WAV buffer to temporary file
        fs.writeFileSync(tempFile, wavBuffer);

        // Spawn whisper process with file input
        const whisper = spawn(this.whisperPath, [
          '-m', this.modelPath,
          '-f', tempFile,
          '--no-prints', // Reduce verbose output
          '--language', 'en'
        ], {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        // Collect output
        whisper.stdout.on('data', (data) => {
          output += data.toString();
        });

        whisper.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        whisper.on('close', (code) => {
          // Clean up temporary file
          try {
            fs.unlinkSync(tempFile);
            // Also clean up any .txt file whisper might create
            const txtFile = tempFile + '.txt';
            if (fs.existsSync(txtFile)) {
              const text = fs.readFileSync(txtFile, 'utf8').trim();
              fs.unlinkSync(txtFile);
              resolve(text);
              return;
            }
          } catch (cleanupError) {
            console.warn('Cleanup error:', cleanupError.message);
          }

          if (code === 0) {
            // Clean up the output text
            const text = output.trim()
              .replace(/\[.*?\]/g, '') // Remove [BLANK_AUDIO] etc.
              .replace(/\s+/g, ' ') // Normalize whitespace
              .trim();
            
            resolve(text);
          } else {
            reject(new Error(`Whisper failed with code ${code}: ${errorOutput}`));
          }
        });

        whisper.on('error', (err) => {
          // Clean up temporary file on error
          try {
            fs.unlinkSync(tempFile);
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
          reject(new Error(`Whisper process error: ${err.message}`));
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!whisper.killed) {
            whisper.kill();
            // Clean up temporary file on timeout
            try {
              fs.unlinkSync(tempFile);
            } catch (cleanupError) {
              // Ignore cleanup errors
            }
            reject(new Error('Whisper transcription timeout'));
          }
        }, 10000);
      });
    });
  }

  /**
   * Transcribe audio buffer with error handling and fallbacks
   * @param {Buffer} audioBuffer - PCM audio data
   * @returns {Promise<string>} - Transcribed text or empty string
   */
  async transcribeBufferSafe(audioBuffer) {
    try {
      // Check if buffer has enough audio data (at least 0.5 seconds)
      const minSamples = this.sampleRate * this.channels * 0.5 * 2; // 16-bit samples
      if (audioBuffer.length < minSamples) {
        return '';
      }

      // Check for silence (very low amplitude)
      const samples = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.length / 2);
      const avgAmplitude = samples.reduce((sum, sample) => sum + Math.abs(sample), 0) / samples.length;
      
      if (avgAmplitude < 100) { // Very quiet audio
        return '';
      }

      const text = await this.transcribeBuffer(audioBuffer);
      return text;
    } catch (error) {
      console.error('STT error:', error.message);
      return '';
    }
  }
}

/**
 * Simple audio activity detection
 * @param {Buffer} audioBuffer - PCM audio data
 * @param {number} threshold - Amplitude threshold (default: 500)
 * @returns {boolean} - True if audio contains speech-like activity
 */
export function detectAudioActivity(audioBuffer, threshold = 500) {
  if (audioBuffer.length < 1000) return false;

  const samples = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.length / 2);
  
  // Calculate RMS (Root Mean Square) for better activity detection
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }
  
  const rms = Math.sqrt(sumSquares / samples.length);
  return rms > threshold;
}

/**
 * Detect if audio buffer contains mostly silence
 * @param {Buffer} audioBuffer - PCM audio data
 * @param {number} silenceThreshold - Amplitude threshold for silence
 * @returns {boolean} - True if mostly silent
 */
export function isSilent(audioBuffer, silenceThreshold = 200) {
  const samples = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.length / 2);
  
  let silentSamples = 0;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) < silenceThreshold) {
      silentSamples++;
    }
  }
  
  const silenceRatio = silentSamples / samples.length;
  return silenceRatio > 0.8; // 80% silence
}