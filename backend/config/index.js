require('dotenv').config();

module.exports = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',  // Suno API base URL
  backendUrl: process.env.BACKEND_URL || process.env.BASE_URL || 'http://localhost:3000',  // This server's URL

  // Firebase
  firebaseConfig: {
    jsonBase64: process.env.FIREBASE_JSON_BASE64
  },

  // API Keys
  groq: {
    apiKey: process.env.LLAMA_API_KEY,
    apiUrl: process.env.LLAMA_API_URL || 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    // Rate limits (from research)
    rateLimit: {
      requestsPerMinute: 30,
      tokensPerMinute: 12000,
      requestsPerDay: 1000,
      tokensPerDay: 100000
    }
  },

  huggingface: {
    token: process.env.HF_TOKEN,
    apiUrl: 'https://api-inference.huggingface.co/models',
    model: 'prompthero/openjourney',
    // Free tier limits
    rateLimit: {
      requestsPerDay: 1000
    }
  },

  suno: {
    apiKey: process.env.SUNO_API_KEY,
    baseUrl: process.env.SUNO_BASE_URL || process.env.BASE_URL || 'https://api.sunoapi.org',
    // Rate limits from research: 20 requests per 10 seconds
    rateLimit: {
      requestsPer10Seconds: 20,
      concurrencyLimit: 20
    }
  },

  youtube: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    webClientId: process.env.WEB_GOOGLE_CLIENT_ID,  // For Android app OAuth
    // IMPORTANT: redirectUri must point to THIS server, not the Suno API
    redirectUri: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/callback`,
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.readonly'
    ],
    // YouTube Data API v3 quota limits
    quota: {
      dailyLimit: 10000,
      uploadCost: 1600,  // Cost per video upload
      maxUploadsPerDay: 6  // 10000 / 1600 = 6.25, rounded down
    }
  },

  // Security
  planSignSecret: process.env.PLAN_SIGN_SECRET,

  // Redis (job queue)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },

  // Rate limiting
  rateLimiting: {
    maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 60,
    maxGenerationPerDay: parseInt(process.env.MAX_GENERATION_PER_DAY) || 6
  },

  // FFmpeg settings (ULTRA-FAST for Render.com free tier - must complete before restart)
  // Render free tier can restart at any time, so encoding MUST be fast (<30 seconds)
  ffmpeg: {
    videoCodec: 'libx264',
    audioCodec: 'aac',
    videoBitrate: '100k',      // Minimal bitrate for static image
    audioBitrate: '128k',
    resolution: '1280x720',
    fps: 1,                    // CRITICAL: Only 1 FPS for static image! (225 frames for 225s)
    preset: 'ultrafast',       // Fastest encoding
    crf: 30                    // Lower quality = faster encoding
  },

  // Temporary file settings
  temp: {
    directory: './temp',
    cleanupIntervalHours: 1,
    maxAgeHours: 24
  },

  // Firestore collections (minimal schema)
  collections: {
    users: 'users',
    schedulers: 'schedulers',
    videos: 'videos',
    quotaTracking: 'quota_tracking'
  },

  // Plan configuration
  plans: {
    free: {
      maxSchedulers: 3,
      maxVideosPerDay: 6,
      requiresOwnSunoKey: true,
      adsEnabled: true
    },
    pro: {
      maxSchedulers: 20,
      maxVideosPerDay: 6,  // Still limited by YouTube quota
      requiresOwnSunoKey: false,
      adsEnabled: false
    }
  }
};
