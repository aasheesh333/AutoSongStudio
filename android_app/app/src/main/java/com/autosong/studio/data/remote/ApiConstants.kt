package com.autosong.studio.data.remote

object ApiConstants {
    const val BASE_URL = "https://51.222.156.30.sslip.io/api/"

    // Auth endpoints
    const val AUTH_YOUTUBE = "auth/youtube"
    const val AUTH_CALLBACK = "auth/callback"
    const val AUTH_REFRESH = "auth/refresh"
    const val AUTH_CHANNELS = "auth/channels"
    const val AUTH_SIGNOUT = "auth/signout"

    // Scheduler endpoints
    const val SCHEDULERS = "schedulers"
    fun schedulerById(id: String) = "schedulers/$id"
    fun schedulerToggle(id: String) = "schedulers/$id/toggle"

    // Video endpoints
    const val VIDEOS = "videos"
    fun videoById(id: String) = "videos/$id"
    fun videoThumbnail(id: String) = "videos/$id/thumbnail"
    fun videoUploadNow(id: String) = "videos/$id/upload-now"
    fun videoStream(id: String) = "videos/$id/stream"

    // Settings endpoints
    const val SETTINGS = "settings"
    const val SETTINGS_SUNO_KEY = "settings/suno-key"
    const val SETTINGS_QUOTA = "settings/quota"
    const val SETTINGS_UPGRADE = "settings/upgrade"

    // Webhooks
    const val WEBHOOK_VIDEO_DELETED = "webhooks/video-deleted"
}
