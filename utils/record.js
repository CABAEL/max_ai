import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import ffmpegPath from 'ffmpeg-static';

function getDefaultAudioDevice() {
  const ffmpeg = spawnSync('ffmpeg', ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  const lines = ffmpeg.stderr.split('\n');
  for (const line of lines) {
    const match = line.match(/"(.+?)"\s+\(audio\)/);
    if (match) return match[1];
  }
  throw new Error('No audio device found');
}

// Record a short audio chunk
export function recordChunk(filePath = 'audio/input.wav', duration = 3000) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync('audio', { recursive: true });
    const device = getDefaultAudioDevice();

    const args = [
      '-y',
      '-f', 'dshow',
      '-i', `audio=${device}`,
      '-ar', '16000',
      '-ac', '1',
      '-t', (duration / 1000).toString(), // duration in seconds
      filePath
    ];

    const ffmpeg = spawn(ffmpegPath, args);

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve(filePath);
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });
}
