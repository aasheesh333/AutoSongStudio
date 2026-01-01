const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initializeFirebase } = require('./config/firebase');
const config = require('./config');

// Initialize Express app
const app = express();

// Trust proxy - required for Render.com and other reverse proxies
// This fixes the X-Forwarded-For header validation error from express-rate-limit
app.set('trust proxy', 1);

// Initialize Firebase
initializeFirebase();

// Middleware
app.use(helmet());  // Security headers
app.use(cors());  // Enable CORS
app.use(express.json());  // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    max: config.rateLimiting.maxRequestsPerMinute,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv
    });
});

// API Routes
const authRoutes = require('./routes/auth');
const schedulerRoutes = require('./routes/schedulers');
const videoRoutes = require('./routes/videos');
const settingsRoutes = require('./routes/settings');
const webhookRoutes = require('./routes/webhooks');

app.use('/api/auth', authRoutes);
app.use('/api/schedulers', schedulerRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/webhooks', webhookRoutes);

// Start Background Workers
const videoWorker = require('./workers/videoGenerationWorker');
// videoWorker is now a singleton instance, no need to instantiate
videoWorker.run();
app.set('videoWorker', videoWorker);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[Error]', err.stack);

    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(config.nodeEnv === 'development' && { stack: err.stack })
    });
});

// Start server
const PORT = config.port;
const server = app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`🚀 AutoSong Studio Backend`);
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
    console.log(`🔗 Base URL: ${config.baseUrl}`);
    console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = app;
