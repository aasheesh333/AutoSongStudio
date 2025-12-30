const ffmpeg = require('fluent-ffmpeg');
const config = require('../config');
const fs = require('fs');
const path = require('path');

/**
 * FFmpeg Service
 * Creates videos from audio + thumbnail
 * Optimized for 512MB RAM environments
 */

class FFmpegService {
    constructor() {
        this.config = config.ffmpeg;
    }

    /**
     * Validate input files exist
     */
    validateInputs(audioPath, thumbnailPath) {
        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file not found: ${audioPath}`);
        }

        if (!fs.existsSync(thumbnailPath)) {
            throw new Error(`Thumbnail file not found: ${thumbnailPath}`);
        }

        console.log('[FFmpeg] ✅ Input files validated');
    }

    /**
     * Get audio duration
     */
    async getAudioDuration(audioPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(audioPath, (error, metadata) => {
                if (error) {
                    reject(error);
                } else {
                    const duration = metadata.format.duration;
                    resolve(duration);
                }
            });
        });
    }

    /**
     * Create video from audio and thumbnail
     * Memory-optimized for low RAM environments
     */
    async createVideo(audioPath, thumbnailPath, outputPath) {
        this.validateInputs(audioPath, thumbnailPath);

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const duration = await this.getAudioDuration(audioPath);
        console.log(`[FFmpeg] Audio duration: ${duration.toFixed(2)}s`);

        return new Promise((resolve, reject) => {
            console.log('[FFmpeg] Starting video creation...');

            ffmpeg()
                // Input: static image (loop it)
                .input(thumbnailPath)
                .inputOptions([
                    '-loop 1',
                    '-framerate 30'
                ])
                // Input: audio
                .input(audioPath)
                // Output options (memory-optimized)
                .outputOptions([
                    `-c:v ${this.config.videoCodec}`,
                    `-c:a ${this.config.audioCodec}`,
                    `-b:v ${this.config.videoBitrate}`,
                    `-b:a ${this.config.audioBitrate}`,
                    `-s ${this.config.resolution}`,
                    `-r ${this.config.fps}`,
                    `-preset ${this.config.preset}`,
                    `-crf ${this.config.crf}`,
                    '-pix_fmt yuv420p',  // Compatibility
                    '-movflags +faststart',  // Web optimization
                    '-shortest'  // End when audio ends
                ])
                // Output file
                .output(outputPath)
                // Event handlers
                .on('start', (commandLine) => {
                    console.log('[FFmpeg] Command:', commandLine);
                })
                .on('progress', (progress) => {
                    const percent = progress.percent ? progress.percent.toFixed(1) : '0.0';
                    console.log(`[FFmpeg] Progress: ${percent}%`);
                })
                .on('end', () => {
                    console.log('[FFmpeg] ✅ Video created successfully!');
                    resolve(outputPath);
                })
                .on('error', (error, stdout, stderr) => {
                    console.error('[FFmpeg] Error:', error.message);
                    console.error('[FFmpeg] stderr:', stderr);
                    reject(new Error(`FFmpeg failed: ${error.message}`));
                })
                .run();
        });
    }

    /**
     * Get video file size in MB
     */
    getFileSize(filePath) {
        const stats = fs.statSync(filePath);
        const fileSizeMB = stats.size / (1024 * 1024);
        return fileSizeMB.toFixed(2);
    }

    /**
     * Create video with validation and cleanup
     */
    async createVideoSafe(audioPath, thumbnailPath, outputPath, cleanupInputs = false) {
        try {
            await this.createVideo(audioPath, thumbnailPath, outputPath);

            const fileSize = this.getFileSize(outputPath);
            console.log(`[FFmpeg] Video size: ${fileSize} MB`);

            // Optional cleanup of input files
            if (cleanupInputs) {
                fs.unlinkSync(audioPath);
                fs.unlinkSync(thumbnailPath);
                console.log('[FFmpeg] ✅ Input files cleaned up');
            }

            return {
                videoPath: outputPath,
                fileSizeMB: parseFloat(fileSize)
            };
        } catch (error) {
            // Cleanup partial output on error
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
            throw error;
        }
    }
}

module.exports = new FFmpegService();
