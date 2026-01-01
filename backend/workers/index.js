require('dotenv').config();
const { initializeFirebase } = require('../config/firebase');
const VideoGenerationWorker = require('./videoGenerationWorker');
const UploadWorker = require('./uploadWorker');

/**
 * Worker Process Entry Point
 * 
 * Runs both video generation and upload workers
 */

console.log('='.repeat(60));
console.log('🔧 AutoSong Studio Workers Starting...');
console.log('='.repeat(60));

// Initialize Firebase
initializeFirebase();

// Start workers
const generationWorker = require('./videoGenerationWorker');
const uploadWorker = new UploadWorker();

generationWorker.run();
uploadWorker.run();

console.log('✅ All workers started successfully');
console.log('Press Ctrl+C to stop\n');

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\nSIGTERM received, shutting down workers...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down workers...');
    process.exit(0);
});
