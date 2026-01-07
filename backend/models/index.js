const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// NOTE: Do NOT override _id - existing users have ObjectId format
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    plan: { type: String, default: 'free', enum: ['free', 'pro'] },
    youtubeRefreshToken: { type: String, default: null },
    sunoApiKey: { type: String, default: null },
    videosThisMonth: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: Date.now },
    // Data persistence fields
    lastActiveAt: { type: Date, default: Date.now },  // For 24-hour engagement rule
    channels: [{
        id: String,
        title: String,
        thumbnailUrl: String,
        subscriberCount: String,
        videoCount: String
    }],
    selectedChannelId: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

const SchedulerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    userId: { type: String, required: true, index: true }, // Changed to String for flexibility
    channelId: { type: String, required: true },

    // Immutable
    time: String,
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'] },
    activeDays: [Number],
    language: String,

    // Editable
    genres: [String],
    titlePrompt: String,
    descPrompt: String,
    tagsPrompt: String,
    lyricsPrompt: String,

    active: { type: Boolean, default: true },
    error: { type: String, default: null },
    nextRunAt: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date
});

const VideoSchema = new mongoose.Schema({
    schedulerId: { type: String, index: true }, // Changed to String
    userId: { type: String, index: true },      // Changed to String
    channelId: String,

    // Content
    title: String,
    description: String,
    tags: [String],
    lyrics: String,
    genres: [String],

    // Local Storage Paths
    audioPath: String,     // Internal disk path
    thumbnailPath: String, // Internal disk path
    videoPath: String,     // Internal disk path

    // Public URLs (Served by Express)
    audioUrl: String,
    thumbnailUrl: String,
    videoUrl: String,

    youtubeId: String,
    scheduledPublishAt: Date,

    status: {
        type: String,
        default: 'queued',
        enum: ['queued', 'processing', 'ready', 'uploading', 'uploaded', 'failed']
    },
    error: String,
    failedAt: { type: Date, default: null },  // For 7-day cleanup of failed videos
    locked: { type: Boolean, default: false },
    uploadedAt: Date,
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date
});

const QuotaTrackingSchema = new mongoose.Schema({
    userId: { type: String, index: true }, // Changed to String
    date: String, // YYYY-MM-DD
    quotaUsed: { type: Number, default: 0 },
    videosUploaded: { type: Number, default: 0 }
});

const SunoKeyUsageSchema = new mongoose.Schema({
    apiKey: { type: String, required: true, index: true },
    usageCount: { type: Number, default: 0 },
    firstUsedAt: { type: Date, default: Date.now },
    lastUsedAt: Date
});

// ==================== MODELS ====================

const User = mongoose.model('User', UserSchema);
const Scheduler = mongoose.model('Scheduler', SchedulerSchema);
const Video = mongoose.model('Video', VideoSchema);
const QuotaTracking = mongoose.model('QuotaTracking', QuotaTrackingSchema);
const SunoKeyUsage = mongoose.model('SunoKeyUsage', SunoKeyUsageSchema);

// ==================== ADAPTERS (API Compatibility) ====================

class UserModel {
    async createUser(data) {
        const user = await User.create(data);
        return this._transform(user);
    }
    async findByEmail(email) {
        const user = await User.findOne({ email });
        return this._transform(user);
    }
    async findById(id) {
        // Try to find regardless of validation first, or log if invalid
        // If it's a valid ObjectId, strict check passes. 
        // If we switched to String IDs, it might fail isValid but still be in DB? 
        // Actually, if we use Mongoose, findById expects ObjectId or castable string.
        // If we pass an invalid string, Mongoose throws CastError. 
        // We should try/catch it.
        try {
            const user = await User.findById(id);
            if (!user) {
                // Try searching by string _id if possible? No, User uses ObjectId _id.
                // If id passed is NOT ObjectId, it won't find anything.
                // Log strictly for debug
                // console.log(`[UserModel] User not found for ID: ${id}`);
            }
            return this._transform(user);
        } catch (e) {
            console.error(`[UserModel] findById CastError for ID: ${id}`, e.message);
            return null;
        }
    }
    async update(id, data) {
        const user = await User.findByIdAndUpdate(id, data, { new: true });
        return this._transform(user);
    }
    async incrementVideosThisMonth(userId) {
        await User.findByIdAndUpdate(userId, { $inc: { videosThisMonth: 1 } });
    }
    async resetMonthlyVideos(userId) {
        await User.findByIdAndUpdate(userId, { videosThisMonth: 0, lastResetDate: new Date() });
    }
    _transform(doc) {
        if (!doc) return null;
        return { ...doc.toObject(), id: doc._id.toString() };
    }
}

class SchedulerModel {
    async createScheduler(data) {
        const scheduler = await Scheduler.create(data);
        return this._transform(scheduler);
    }
    async findById(id) {
        if (!mongoose.Types.ObjectId.isValid(id)) return null;
        const scheduler = await Scheduler.findById(id);
        return this._transform(scheduler);
    }
    async findByUser(userId, channelId = null) {
        const query = { userId };
        if (channelId) query.channelId = channelId;
        const docs = await Scheduler.find(query);
        return docs.map(d => this._transform(d));
    }
    async update(id, data) {
        const scheduler = await Scheduler.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true });
        return this._transform(scheduler);
    }
    async deactivateAllForUser(userId, reason = null) {
        console.log(`[SchedulerModel] Deactivating all for user: ${userId}, Reason: ${reason}`);
        const update = { active: false };
        if (reason) update.error = reason;
        const result = await Scheduler.updateMany({ userId }, update);
        console.log(`[SchedulerModel] Deactivated count: ${result.modifiedCount || result.nModified}`);
    }

    async toggleActive(id) {
        const scheduler = await Scheduler.findById(id);
        if (!scheduler) throw new Error('Scheduler not found');
        scheduler.active = !scheduler.active;
        await scheduler.save();
        return this._transform(scheduler);
    }
    async delete(id) {
        await Scheduler.findByIdAndDelete(id);
    }
    _transform(doc) {
        if (!doc) return null;
        return { ...doc.toObject(), id: doc._id.toString() };
    }
}

class VideoModel {
    async createVideo(data) {
        const video = await Video.create(data);
        return this._transform(video);
    }
    async findById(id) {
        // Video ID might be UUID from worker, or Mongo ObjectId. 
        // If worker uses UUID, we need to handle that. 
        // BUT, better to let Mongo generate ID. 
        // Wait, worker generates UUID v4. We should probably use that as _id or store it.
        // For simplicity, we'll let Mongo generate _id and worker will update using that ID.
        // Actually, existing code passes UUID. Let's make _id be the String UUID if possible, OR just use Mongo ID.
        // Mongoose _id is ObjectId by default.
        // To support existing UUIDs from worker, we should search by `_id` if it's ObjectId, or creating with custom _id.
        // EASIEST: Transform incoming UUID to allow string _id or map it.
        // Let's rely on Mongoose's auto ID and update worker to use the ID returned by createVideo.

        if (mongoose.Types.ObjectId.isValid(id)) {
            const video = await Video.findById(id);
            return this._transform(video);
        }
        return null;
    }
    async update(id, data) {
        const video = await Video.findByIdAndUpdate(id, { ...data, updatedAt: new Date() }, { new: true });
        return this._transform(video);
    }
    async findByScheduler(schedulerId, limit = 50) {
        const docs = await Video.find({ schedulerId }).sort({ createdAt: -1 }).limit(limit);
        return docs.map(d => this._transform(d));
    }
    async findByUser(userId, channelId = null, status = null) {
        const query = { userId };
        if (channelId) query.channelId = channelId;
        if (status) query.status = status;
        const docs = await Video.find(query).sort({ createdAt: -1 });
        return docs.map(d => this._transform(d));
    }
    async updateStatus(id, status, error = null) {
        const update = { status };
        if (error) update.error = error;
        return this.update(id, update);
    }
    async markAsUploaded(id, youtubeId) {
        // Clear file paths to save space, but KEEP metadata for display
        const update = {
            status: 'uploaded',
            youtubeId,
            locked: true,
            uploadedAt: new Date(),

            // Clear all file paths and URLs (files deleted by user retention policy)
            audioPath: null,
            audioUrl: null,
            thumbnailPath: null,
            // Use YouTube Thumbnail for display
            thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`,
            videoPath: null,
            videoUrl: null,

            // KEEP metadata so it shows in the App (Read-Only mode)
        };
        return this.update(id, update);
    }
    async markAsFailed(id, error) {
        return this.update(id, {
            status: 'failed',
            error,
            failedAt: new Date()  // For 7-day retention cleanup
        });
    }
    async findReadyForUpload() {
        // Check for scheduled time <= now
        const docs = await Video.find({
            status: 'ready',
            scheduledPublishAt: { $lte: new Date() }
        }).limit(10);
        return docs.map(d => this._transform(d));
    }
    async delete(id) {
        await Video.findByIdAndDelete(id);
    }
    _transform(doc) {
        if (!doc) return null;
        return { ...doc.toObject(), id: doc._id.toString() };
    }
}

class QuotaTrackingModel {
    async getTodayQuota(userId) {
        const today = new Date().toISOString().split('T')[0];
        let quota = await QuotaTracking.findOne({ userId, date: today });
        if (!quota) {
            quota = await QuotaTracking.create({ userId, date: today });
        }
        return this._transform(quota);
    }
    async incrementQuota(userId, cost) {
        const today = new Date().toISOString().split('T')[0];
        await QuotaTracking.findOneAndUpdate(
            { userId, date: today },
            { $inc: { quotaUsed: cost, videosUploaded: 1 } },
            { upsert: true }
        );
    }
    async canUploadToday(userId) {
        const quota = await this.getTodayQuota(userId);
        return quota.videosUploaded < config.youtube.quota.maxUploadsPerDay; // 6
    }
    _transform(doc) {
        if (!doc) return null;
        return { ...doc.toObject(), id: doc._id.toString() };
    }
}

class SunoKeyUsageModel {
    async getUsage(apiKey) {
        let usage = await SunoKeyUsage.findOne({ apiKey });
        if (!usage) return { usageCount: 0 };
        return this._transform(usage);
    }
    async incrementUsage(apiKey) {
        await SunoKeyUsage.findOneAndUpdate(
            { apiKey },
            { $inc: { usageCount: 1 }, lastUsedAt: new Date() },
            { upsert: true }
        );
    }
    _transform(doc) {
        if (!doc) return null;
        return { ...doc.toObject(), id: doc._id.toString() };
    }
}

module.exports = {
    UserModel: new UserModel(),
    SchedulerModel: new SchedulerModel(),
    VideoModel: new VideoModel(),
    QuotaTrackingModel: new QuotaTrackingModel(),
    SunoKeyUsageModel: new SunoKeyUsageModel()
};

