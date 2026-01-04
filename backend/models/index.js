const { getFirestore } = require('../config/firebase');
const config = require('../config');
const admin = require('firebase-admin');

/**
 * Firestore Data Models
 * 
 * Optimized for minimal storage - only essential fields
 */

class FirestoreModel {
    constructor(collectionName) {
        this.collection = collectionName;
    }

    async create(data) {
        const db = getFirestore();
        const now = new Date().toISOString();
        const docRef = await db.collection(this.collection).add({
            ...data,
            createdAt: now
        });
        return { id: docRef.id, ...data, createdAt: now };
    }

    async findById(id) {
        const db = getFirestore();
        const doc = await db.collection(this.collection).doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() };
    }

    async update(id, data) {
        const db = getFirestore();
        await db.collection(this.collection).doc(id).update({
            ...data,
            updatedAt: new Date().toISOString()
        });
        return this.findById(id);
    }

    async delete(id) {
        const db = getFirestore();
        await db.collection(this.collection).doc(id).delete();
    }

    async findMany(filters = {}, limit = 100) {
        const db = getFirestore();
        let query = db.collection(this.collection);

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
            query = query.where(key, '==', value);
        });

        const snapshot = await query.limit(limit).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
}

/**
 * User Model
 * Minimal fields to reduce storage
 */
class UserModel extends FirestoreModel {
    constructor() {
        super(config.collections.users);
    }

    async createUser(data) {
        return this.create({
            email: data.email,
            plan: data.plan || 'free',
            youtubeRefreshToken: data.youtubeRefreshToken || null,
            sunoApiKey: data.sunoApiKey || null,
            videosThisMonth: 0,
            schedulersCount: 0
        });
    }

    async findByEmail(email) {
        const db = getFirestore();
        const snapshot = await db.collection(this.collection)
            .where('email', '==', email)
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    async incrementVideosThisMonth(userId) {
        const db = getFirestore();
        await db.collection(this.collection).doc(userId).update({
            videosThisMonth: admin.firestore.FieldValue.increment(1)
        });
    }

    async resetMonthlyVideos(userId) {
        await this.update(userId, { videosThisMonth: 0, lastResetDate: new Date().toISOString() });
    }
}

/**
 * Scheduler Model
 * Minimal fields - only what's needed
 */
class SchedulerModel extends FirestoreModel {
    constructor() {
        super(config.collections.schedulers);
    }

    async createScheduler(data) {
        return this.create({
            name: data.name,
            userId: data.userId,
            channelId: data.channelId,

            // Immutable after creation
            time: data.time,  // HH:MM format
            frequency: data.frequency,  // daily/weekly/monthly
            activeDays: data.activeDays || [],  // [0-6] for weekly
            language: data.language,

            // Editable
            genres: data.genres,  // Priority array
            titlePrompt: data.titlePrompt || '',
            descPrompt: data.descPrompt || '',
            tagsPrompt: data.tagsPrompt || '',
            lyricsPrompt: data.lyricsPrompt || '',

            active: true,
            nextRunAt: data.nextRunAt
        });
    }

    async findByUser(userId, channelId = null) {
        const filters = { userId };
        if (channelId) filters.channelId = channelId;
        return this.findMany(filters);
    }

    async toggleActive(schedulerId) {
        const scheduler = await this.findById(schedulerId);
        if (!scheduler) throw new Error('Scheduler not found');
        return this.update(schedulerId, { active: !scheduler.active });
    }

    async deactivateAllForUser(userId, reason = null) {
        const schedulers = await this.findByUser(userId);
        const updateData = { active: false };
        if (reason) {
            updateData.error = reason;
        }

        const promises = schedulers.map(scheduler =>
            this.update(scheduler.id, updateData)
        );
        await Promise.all(promises);
        console.log(`[SchedulerModel] Deactivated ${schedulers.length} schedulers for user ${userId}. Reason: ${reason || 'None'}`);
    }
}

/**
 * Video Model
 * Storage-optimized - no redundant data
 */
class VideoModel extends FirestoreModel {
    constructor() {
        super(config.collections.videos);
    }

    async createVideo(data) {
        return this.create({
            schedulerId: data.schedulerId,
            userId: data.userId,
            channelId: data.channelId,

            // Content (generated)
            title: data.title,
            description: data.description,
            tags: data.tags,
            lyrics: data.lyrics,
            genres: data.genres,

            // Asset URLs (temporary - cleared after upload)
            audioUrl: data.audioUrl || null,
            thumbnailUrl: data.thumbnailUrl || null,

            // YouTube data
            youtubeId: data.youtubeId || null,
            scheduledPublishAt: data.scheduledPublishAt || null,

            // State
            status: data.status || 'queued',  // queued/processing/ready/uploading/uploaded/failed
            error: data.error || null,
            locked: data.locked || false  // Lock after upload
        });
    }

    async findByScheduler(schedulerId, limit = 50) {
        return this.findMany({ schedulerId }, limit);
    }

    async findByUser(userId, channelId = null, status = null) {
        const filters = { userId };
        if (channelId) filters.channelId = channelId;
        if (status) filters.status = status;
        return this.findMany(filters);
    }

    async updateStatus(videoId, status, error = null) {
        const update = { status };
        if (error) update.error = error;
        return this.update(videoId, update);
    }

    async markAsUploaded(videoId, youtubeId) {
        return this.update(videoId, {
            youtubeId,
            status: 'uploaded',
            locked: true,  // Lock editing after upload
            uploadedAt: new Date().toISOString(),
            // Clear temporary URLs to save storage
            audioUrl: null,
            thumbnailUrl: null
        });
    }

    async findReadyForUpload() {
        const db = getFirestore();
        const now = new Date().toISOString();

        const snapshot = await db.collection(this.collection)
            .where('status', '==', 'ready')
            .where('scheduledPublishAt', '<=', now)
            .limit(10)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
}

/**
 * Quota Tracking Model
 * Track daily YouTube API quota usage
 */
class QuotaTrackingModel extends FirestoreModel {
    constructor() {
        super(config.collections.quotaTracking);
    }

    async getTodayQuota(userId) {
        const today = new Date().toISOString().split('T')[0];  // YYYY-MM-DD
        const db = getFirestore();

        const snapshot = await db.collection(this.collection)
            .where('userId', '==', userId)
            .where('date', '==', today)
            .limit(1)
            .get();

        if (snapshot.empty) {
            // Create new quota tracking for today
            return this.create({
                userId,
                date: today,
                quotaUsed: 0,
                videosUploaded: 0
            });
        }

        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    async incrementQuota(userId, quotaCost) {
        const quota = await this.getTodayQuota(userId);
        const db = getFirestore();
        await db.collection(this.collection).doc(quota.id).update({
            quotaUsed: admin.firestore.FieldValue.increment(quotaCost),
            videosUploaded: admin.firestore.FieldValue.increment(1)
        });
    }

    async canUploadToday(userId) {
        const quota = await this.getTodayQuota(userId);
        return quota.videosUploaded < config.youtube.quota.maxUploadsPerDay;
    }
}

/**
 * Suno Key Usage Model
 * Track usage per API Key
 */
class SunoKeyUsageModel extends FirestoreModel {
    constructor() {
        super('suno_key_usage');
    }

    async getUsage(apiKey) {
        const db = getFirestore();
        // Use hashed key or just query by key if secure enough for this valid MVP
        // For simplicity, we query by key. In prod, hash it.
        const snapshot = await db.collection(this.collection)
            .where('apiKey', '==', apiKey)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return { id: null, usageCount: 0 };
        }
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    async incrementUsage(apiKey) {
        const usage = await this.getUsage(apiKey);

        if (!usage.id) {
            return this.create({
                apiKey,
                usageCount: 1,
                firstUsedAt: new Date().toISOString()
            });
        }

        return this.update(usage.id, {
            usageCount: admin.firestore.FieldValue.increment(1),
            lastUsedAt: new Date().toISOString()
        });
    }
}

module.exports = {
    UserModel: new UserModel(),
    SchedulerModel: new SchedulerModel(),
    VideoModel: new VideoModel(),
    QuotaTrackingModel: new QuotaTrackingModel(),
    SunoKeyUsageModel: new SunoKeyUsageModel()
};
