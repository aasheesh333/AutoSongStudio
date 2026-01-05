# AutoSong Studio Backend

Production-ready backend for YouTube music automation with AI-powered content generation.

## Features

- 🎵 **AI Music Generation** - Suno API integration
- ✍️ **Content Creation** - Groq LLaMA 3.3 70B for lyrics and metadata
- 🎨 **Thumbnail Generation** - HuggingFace Stable Diffusion
- 🎬 **Video Creation** - FFmpeg with memory optimization (512MB RAM compatible)
- 📺 **YouTube Integration** - OAuth 2.0 + auto-upload with scheduling
- 🔥 **Firebase** - Minimal Firestore schema for storage optimization
- ⚡ **Background Workers** - Automated video generation and upload pipeline

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB (Self-Hosted)
- **Authentication**: YouTube OAuth
- **AI Models**:
  - Lyrics & Metadata: Groq (Llama 3 70B)
- **Video Processing**: FFmpeg
- **Deployment**: Render.com

## Setup

### Prerequisites

- Node.js 18+
- FFmpeg installed locally for development
- Firebase service account JSON
- API keys for Groq, HuggingFace, Suno, YouTube

### Installation

```bash
cd backend
npm install
```

### Environment Variables

Create `.env` file in backend directory:

```bash
# Copy from .env.example
cp .env.example .env

# Edit with your credentials
nano .env
```

Required variables:
- `LLAMA_API_KEY` - Groq API key
- `HF_TOKEN` - HuggingFace API token
- `SUNO_API_KEY` - Suno API key (for Pro users)
- `GOOGLE_CLIENT_ID` - YouTube OAuth client ID
- `GOOGLE_CLIENT_SECRET` - YouTube OAuth client secret

### Development

```bash
# Start API server
npm run dev

# Start workers (in separate terminal)
npm run worker
```

### Production

```bash
# Start API server
npm start

# Start workers
npm run worker
```

## API Endpoints

### Authentication
- `GET /api/auth/youtube` - Get OAuth consent URL
- `GET /api/auth/callback` - OAuth callback
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/channels` - Get user channels

### Schedulers
- `GET /api/schedulers` - List schedulers
- `POST /api/schedulers` - Create scheduler
- `GET /api/schedulers/:id` - Get scheduler details
- `PATCH /api/schedulers/:id` - Update scheduler
- `POST /api/schedulers/:id/toggle` - Activate/deactivate
- `DELETE /api/schedulers/:id` - Delete scheduler

### Videos
- `GET /api/videos` - List videos
- `GET /api/videos/:id` - Get video details
- `PATCH /api/videos/:id` - Update metadata
- `POST /api/videos/:id/upload-now` - Trigger upload
- `DELETE /api/videos/:id` - Delete video

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings/suno-key` - Update Suno API key
- `GET /api/settings/quota` - Get quota usage

## Architecture

### Video Generation Pipeline

```
Scheduler Trigger
    ↓
1. Generate Lyrics (Groq)
    ↓
2. Generate Metadata (Groq)
    ↓
3. Generate Audio (Suno)
    ↓
4. Generate Thumbnail (HuggingFace)
    ↓
5. Create Video (FFmpeg)
    ↓
6. Mark as READY
    ↓
7. Upload to YouTube (at scheduled time)
    ↓
8. Lock & Cleanup
```

### Workers

- **Video Generation Worker**: Checks schedulers every minute, generates videos
- **Upload Worker**: Uploads ready videos to YouTube at scheduled times
- **Cleanup Worker**: Removes old temporary files hourly

### Storage Optimization

Firestore schema uses minimal fields to reduce storage costs:
- Temporary URLs cleared after upload
- Only essential metadata stored
- No duplicate data

## Rate Limits

### Groq (LLaMA 3.3 70B)
- 30 requests/minute
- 12,000 tokens/minute
- 1,000 requests/day

### Suno
- 20 requests per 10 seconds
- Credit-based billing

### HuggingFace
- 1,000 requests/day (free tier)
- 503 retry logic for model loading

### YouTube Data API v3
- 10,000 quota units/day
- 1,600 units per upload = **max 6 videos/day**

## Deployment

### Render.com

1. Connect GitHub repository
2. Use `render.yaml` blueprint
3. Add environment variables in Render dashboard
4. Deploy!

Services:
- **Web Service**: API server on port 3000
- **Worker Service**: Background job processing

## License

MIT

## Support

For issues, contact support or open a GitHub issue.
