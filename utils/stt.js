import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Transcribe an audio file using whisper.cpp
 * @param {string} filePath - Path to the WAV file
 * @returns {Promise<string>} - Transcribed text
 */
export async function transcribe(filePath) {
  return new Promise((resolve, reject) => {
    // Path to whisper.cpp executable (clean portable setup)
    const whisperPath = path.resolve('./bin/whisper-cli.exe');

    // Path to Whisper model
    const modelPath = path.resolve('./models/ggml-base.en.bin');

    // Spawn whisper.cpp
    const whisper = spawn(whisperPath, ['-m', modelPath, '-f', filePath, '-otxt']);

    let output = '';
    whisper.stdout.on('data', (data) => {
      output += data.toString();
    });

    whisper.stderr.on('data', (data) => {
      // Suppress verbose Whisper output - it's normal debug info, not errors
      // Only show actual errors
      const output = data.toString();
      if (output.includes('error') && !output.includes('whisper_print_timings')) {
        console.error('Whisper error:', output);
      }
    });

    whisper.on('close', (code) => {
      const textFile = filePath + '.txt';
      if (fs.existsSync(textFile)) {
        const text = fs.readFileSync(textFile, 'utf8');
        resolve(text.trim());
      } else {
        // If no txt file, fallback to stdout
        resolve(output.trim());
      }
    });

    whisper.on('error', (err) => reject(err));
  });
}
