# Persian Meeting Assistant

A sophisticated voice-powered meeting assistant that provides real-time transcription, automatic question detection, and AI-generated summaries in Persian (Farsi). Built with React, Node.js, and integrated with Google Cloud Speech-to-Text and OpenAI APIs.

## 🌟 Features

- **Real-time Voice Transcription**: Live speech-to-text conversion in Persian using Google Cloud Speech-to-Text API
- **Speaker Diarization**: Automatic speaker identification and management
- **Intelligent Question Detection**: Automatically identifies and highlights questions during meetings
- **AI-Powered Summaries**: Generate comprehensive meeting summaries using OpenAI GPT
- **Multi-speaker Support**: Add, edit, and manage multiple meeting participants
- **Export Functionality**: Download meeting transcripts and summaries
- **Offline Fallback**: Works with browser-based speech recognition when server is unavailable
- **Real-time Processing**: Continuous audio processing with 30-second chunks
- **Browser Extension Ready**: Can be packaged as a browser extension

## 🏗️ Architecture

### Backend Components

- **Express.js Server**: RESTful API with middleware for CORS, file upload handling
- **Google Cloud Speech-to-Text**: Advanced Persian language transcription
- **OpenAI Integration**: GPT-powered summary generation
- **Multer**: File upload handling for audio processing
- **Real-time Audio Processing**: Chunked audio processing for continuous transcription

### Frontend Components

- **React**: Modern UI with hooks for state management
- **Lucide Icons**: Clean and consistent iconography
- **Tailwind CSS**: Responsive and modern styling
- **Web APIs**: MediaRecorder, SpeechRecognition for browser-based functionality

### Key APIs

- `POST /api/transcribe` - Audio file transcription with speaker diarization
- `POST /api/detect-questions` - Persian question detection
- `POST /api/generate-summary` - AI-powered meeting summary generation
- `GET /api/health` - Server health check

## 🚀 Quick Start

### Prerequisites

- Node.js 22+
- Docker (optional)
- Google Cloud Speech-to-Text API credentials
- OpenAI API key

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/persian-meeting-assistant.git
cd persian-meeting-assistant
```

2. **Install dependencies**

```bash
npm install
```

3. **Environment Setup**
   Create a `.env` file in the root directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json
PORT=5173
```

4. **Google Cloud Setup**

   - Create a Google Cloud project
   - Enable Speech-to-Text API
   - Create service account credentials
   - Download the JSON key file

5. **Start Development Server**

```bash
npm run nodemon
```

The application will be available at `http://localhost:5173`

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 📋 Usage

1. **Start Recording**: Click the microphone button to begin recording
2. **Manage Speakers**: Add, edit, or remove meeting participants
3. **Real-time Transcription**: View live transcription with speaker identification
4. **Question Detection**: Questions are automatically highlighted
5. **Generate Summary**: Create AI-powered meeting summaries
6. **Export Data**: Download transcripts and summaries as text files

## 🔧 Configuration

### Audio Settings

- **Sample Rate**: 16kHz (configurable in transcribe.js)
- **Encoding**: WEBM_OPUS (auto-detected)
- **Language**: Persian (fa-IR)
- **Processing Chunks**: 30-second intervals

### Speaker Diarization

- **Default Speakers**: 2 (configurable)
- **Maximum Speakers**: Unlimited
- **Speaker Labels**: Customizable names

### Question Detection Patterns

The system detects Persian questions using:

- Question mark (؟)
- Question words: چی، چه، کی، کجا، چرا، چطور، آیا
- Regular expression patterns for Persian interrogatives

## 🌐 Browser Extension

Build the browser extension:

```bash
npm run build:extension
npm run pack:extension
```

This creates a packaged extension in `dist/extension/meeting-assistant-extension.zip`

## 📁 Project Structure

```
persian-meeting-assistant/
├── backend/
│   └── apis/
│       ├── index.js          # API routes aggregation
│       ├── transcribe.js     # Audio transcription endpoint
│       ├── questions.js      # Question detection logic
│       └── summary.js        # AI summary generation
├── src/
│   ├── App.jsx              # Main React component
│   ├── App.css              # Component styles
│   └── server.js            # Express server setup
├── docker-compose.yml       # Docker configuration
├── package.json            # Dependencies and scripts
├── .env.example           # Environment variables template
└── README.md              # Project documentation
```

## 🔌 API Reference

### Transcription Endpoint

```http
POST /api/transcribe
Content-Type: multipart/form-data

Parameters:
- audio: Audio file (WebM/WAV/MP3)
- speakerCount: Number of speakers (default: 2)
```

### Summary Generation

```http
POST /api/generate-summary
Content-Type: application/json

{
  "transcript": [...],
  "speakerNames": [...]
}
```

### Question Detection

```http
POST /api/detect-questions
Content-Type: application/json

{
  "transcript": [...]
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow Persian language conventions for UI text
- Maintain RTL (Right-to-Left) text direction
- Test with various Persian accents and dialects
- Ensure mobile responsiveness

## 📊 Performance

- **Real-time Processing**: < 2 second latency for transcription
- **Audio Chunk Size**: 30 seconds for optimal processing
- **Memory Usage**: Efficient with chunked processing
- **Offline Capability**: Browser-based fallback when server unavailable

## 🔐 Security

- No audio data stored permanently on server
- Temporary file cleanup after processing
- API key validation for external services
- CORS protection for cross-origin requests

## 🐛 Troubleshooting

### Common Issues

**Microphone Permission Denied**

- Ensure browser microphone permissions are granted
- Check HTTPS requirement for audio access

**Transcription Not Working**

- Verify Google Cloud credentials
- Check API quotas and billing
- Ensure Persian language model availability

**Summary Generation Fails**

- Validate OpenAI API key
- Check API usage limits
- Verify internet connection

**Docker Issues**

- Ensure user permissions (UID 1000)
- Check port availability (5173, 24678)
- Verify volume mounts

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Cloud Speech-to-Text for Persian language support
- OpenAI for advanced summary generation capabilities
- React and Node.js communities for excellent tooling
- Persian NLP community for language processing insights

## 📞 Support

For support, please open an issue on GitHub or contact [alalamohseni@gmail.com](mailto:alalamohseni@gmail.com)

---

**Made with ❤️ for the Persian-speaking community**
