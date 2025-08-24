import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import ffmpegPath from 'ffmpeg-static';

/**
 * Real-time audio streaming class
 * Streams microphone input directly to Whisper without creating temporary files
 */
export class AudioStreamer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.sampleRate = options.sampleRate || 16000;
    this.channels = options.channels || 1;
    this.chunkDuration = options.chunkDuration || 2000; // 2 seconds
    this.device = null;
    this.ffmpegProcess = null;
    this.isStreaming = false;
    this.audioBuffer = Buffer.alloc(0);
    this.chunkSize = Math.floor((this.sampleRate * this.channels * 2 * this.chunkDuration) / 1000); // 16-bit samples
  }

  /**
   * Get default audio input device
   */
  getDefaultAudioDevice() {
    try {
      const ffmpeg = spawn('ffmpeg', ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], {
        stdio: 'pipe'
      });
      
      return new Promise((resolve, reject) => {
        let stderr = '';
        
        ffmpeg.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        ffmpeg.on('close', () => {
          const lines = stderr.split('\n');
          for (const line of lines) {
            const match = line.match(/"(.+?)"\s+\(audio\)/);
            if (match) {
              resolve(match[1]);
              return;
            }
          }
          reject(new Error('No audio device found'));
        });
      });
    } catch (error) {
      throw new Error(`Failed to get audio device: ${error.message}`);
    }
  }

  /**
   * Start streaming audio from microphone
   */
  async startStreaming() {
    if (this.isStreaming) {
      throw new Error('Already streaming');
    }

    try {
      // Get default audio device
      this.device = await this.getDefaultAudioDevice();
      console.log(`🎤 Using audio device: ${this.device}`);

      // Start FFmpeg process for continuous audio capture
      const args = [
        '-f', 'dshow',
        '-i', `audio=${this.device}`,
        '-ar', this.sampleRate.toString(),
        '-ac', this.channels.toString(),
        '-f', 's16le', // 16-bit signed little-endian PCM
        '-'  // Output to stdout
      ];

      this.ffmpegProcess = spawn(ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.isStreaming = true;

      // Handle audio data stream
      this.ffmpegProcess.stdout.on('data', (chunk) => {
        this.handleAudioChunk(chunk);
      });

      // Handle errors
      this.ffmpegProcess.stderr.on('data', (data) => {
        const error = data.toString();
        if (error.includes('error') && !error.includes('frame=')) {
          console.error('FFmpeg error:', error);
        }
      });

      this.ffmpegProcess.on('close', (code) => {
        this.isStreaming = false;
        if (code !== 0) {
          this.emit('error', new Error(`FFmpeg exited with code ${code}`));
        }
      });

      this.ffmpegProcess.on('error', (err) => {
        this.isStreaming = false;
        this.emit('error', err);
      });

      this.emit('started');
      console.log('🎵 Audio streaming started');

    } catch (error) {
      this.isStreaming = false;
      throw error;
    }
  }

  /**
   * Handle incoming audio chunks
   */
  handleAudioChunk(chunk) {
    // Append to buffer
    this.audioBuffer = Buffer.concat([this.audioBuffer, chunk]);

    // Process complete chunks
    while (this.audioBuffer.length >= this.chunkSize) {
      const audioChunk = this.audioBuffer.slice(0, this.chunkSize);
      this.audioBuffer = this.audioBuffer.slice(this.chunkSize);
      
      // Emit audio chunk for processing
      this.emit('audioChunk', audioChunk);
    }
  }

  /**
   * Stop streaming
   */
  stopStreaming() {
    if (this.ffmpegProcess && this.isStreaming) {
      this.ffmpegProcess.kill('SIGTERM');
      this.isStreaming = false;
      this.audioBuffer = Buffer.alloc(0);
      this.emit('stopped');
      console.log('🔇 Audio streaming stopped');
    }
  }

  /**
   * Check if currently streaming
   */
  isActive() {
    return this.isStreaming;
  }
}

/**
 * Convert PCM audio buffer to WAV format in memory
 */
export function pcmToWav(pcmBuffer, sampleRate = 16000, channels = 1) {
  const length = pcmBuffer.length;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length, true);

  // Copy PCM data
  const wavBuffer = Buffer.from(arrayBuffer);
  pcmBuffer.copy(wavBuffer, 44);

  return wavBuffer;
}