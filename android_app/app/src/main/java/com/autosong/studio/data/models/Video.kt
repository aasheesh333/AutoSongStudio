package com.autosong.studio.data.models

import kotlinx.serialization.Serializable

@Serializable
data class Video(
    val id: String,
    val schedulerId: String,
    val userId: String,
    val channelId: String,
    val title: String,
    val description: String,
    val tags: List<String>,
    val lyrics: String = "",
    val genres: List<String>,
    val audioUrl: String? = null,
    val thumbnailUrl: String? = null,
    val youtubeId: String? = null,
    val scheduledPublishAt: String? = null,
    val status: String,  // queued/processing/ready/uploading/uploaded/failed
    val error: String? = null,
    val locked: Boolean = false,
    val createdAt: String,
    val uploadedAt: String? = null
) {
    val isEditable: Boolean get() = !locked && status != "uploaded"
    val isUploaded: Boolean get() = status == "uploaded"
    val isProcessing: Boolean get() = status == "processing"
    val isReady: Boolean get() = status == "ready"
    val isFailed: Boolean get() = status == "failed"
    val isQueued: Boolean get() = status == "queued"

    val statusDisplay: String
        get() = when (status) {
            "queued" -> "Queued"
            "processing" -> "Processing"
            "ready" -> "Ready"
            "uploading" -> "Uploading"
            "uploaded" -> "Uploaded"
            "failed" -> "Failed"
            else -> status
        }

    val youtubeUrl: String?
        get() = youtubeId?.let { "https://www.youtube.com/watch?v=$it" }
}

@Serializable
data class VideosResponse(
    val videos: List<Video>
)

@Serializable
data class VideoResponse(
    val video: Video
)
