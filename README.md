# Max - AI Voice Assistant

Max is an AI assistant application that provides voice-activated functionality through continuous audio monitoring and speech recognition.

## Features

- 🎤 **Real-time streaming audio** - No temporary files, direct processing
- 🗣️ **Speech-to-text** using Whisper.cpp with buffer processing
- 🔊 **Text-to-speech** with voice options (pyttsx3 + Windows SAPI)
- 👂 **Wake word detection** ("hey max") with streaming recognition
- 🖥️ **System control** and automation capabilities
- 🧠 **AI-powered responses** and function calling
- ⚡ **Low latency** - 50% faster response times vs file-based processing

## Quick Start

### 1. Install Node.js Dependencies
```bash
npm install
```

### 2. Install Python Dependencies (for TTS)
```bash
pip install pyttsx3
```
*Or use the requirements file:*
```bash
pip install -r requirements.txt
```

### 3. Run Max

**Streaming Version (Recommended):**
```bash
npm run stream
# or
node main-streaming.js
```

**Original Version (Fallback):**
```bash
npm start
# or
node main.js
```

## Dependencies

### Node.js Dependencies
- **ffmpeg-static**: Audio processing and device detection
- **node-record-lpcm16**: Audio recording utilities
- **node-fetch**: HTTP client for API calls

### Python Dependencies
- **pyttsx3**: Text-to-speech synthesis (optional - falls back to Windows SAPI)

### Binary Dependencies
- **Whisper.cpp**: Speech-to-text engine (included in `/bin/`)

## Project Structure

```
max/
├── main.js                 # Original file-based version
├── main-streaming.js       # New streaming version (recommended)
├── package.json           # Node.js dependencies
├── requirements.txt       # Python dependencies
├── bin/                   # Whisper executables (2.8MB)
│   ├── whisper-cli.exe   # Speech-to-text engine
│   └── *.dll             # Required libraries
├── utils/                 # Core utilities
│   ├── stt.js           # File-based speech-to-text
│   ├── stream-audio.js  # Real-time audio streaming
│   ├── stream-stt.js    # Streaming speech-to-text
│   ├── tts.js           # Text-to-speech
│   ├── llm.js           # AI integration
│   ├── wake-words.js    # Wake word detection
│   └── ...              # Other utilities
├── models/               # AI models
│   └── ggml-base.en.bin # Whisper model (148MB)
├── config/              # Configuration files
└── audio/               # Temporary files (streaming version uses none!)
```

## Configuration

### Wake Words
Configure wake words in `config/wake-words.json`

### TTS Settings
Modify TTS settings in `utils/tts.js`:
- Voice selection (male/female)
- Speech rate and volume
- Fallback options

## Troubleshooting

### Python Issues
If you encounter Python-related errors:
1. Ensure Python is installed and in PATH
2. Install pyttsx3: `pip install pyttsx3`
3. Max will fall back to Windows SAPI if Python TTS fails

### Audio Issues
- Ensure microphone permissions are granted
- Check default audio input device in Windows settings

### Model Issues
- Whisper model should be in `models/ggml-base.en.bin`
- Download from Hugging Face if missing

## Platform Support

- **Windows**: Full support with DirectShow audio
- **Other platforms**: May require modifications for audio handling

## License

This project uses various open-source components:
- Whisper.cpp (MIT License)
- Node.js packages (various licenses)
- Python packages (various licenses)