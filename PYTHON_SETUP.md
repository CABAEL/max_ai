# Python Dependencies for Max

## Required Python Dependencies

Max uses Python for text-to-speech functionality with **pyttsx3**.

### Dependencies List
- **pyttsx3**: Text-to-speech engine with voice control

## Installation Options

### Option 1: Using pip (Recommended)
```bash
pip install pyttsx3
```

### Option 2: Using requirements.txt
```bash
pip install -r requirements.txt
```

### Option 3: Using conda
```bash
conda install -c conda-forge pyttsx3
```

## Verification

Test if pyttsx3 is installed correctly:

```bash
python -c "import pyttsx3; print('pyttsx3 is working!')"
```

## How Max Uses Python

- **TTS (Text-to-Speech)**: `utils/tts.js` creates temporary Python scripts that use pyttsx3
- **Voice Configuration**: Female voice with configurable rate and volume
- **Fallback**: If Python/pyttsx3 isn't available, Max falls back to Windows SAPI

## Python Script Location

Max dynamically creates Python scripts in:
- `audio/tts_script.py` (temporary file, auto-generated)

## Troubleshooting

### If you get "python not found":
1. Install Python from python.org
2. Make sure Python is in your PATH
3. Try using `python3` instead of `python`

### If pyttsx3 installation fails:
```bash
# Try upgrading pip first
pip install --upgrade pip
pip install pyttsx3

# Or install with specific version
pip install pyttsx3==2.90
```

### Alternative: Use Windows SAPI Only
If you prefer not to install Python dependencies, Max will automatically fall back to Windows built-in SAPI voice synthesis (no additional setup required).