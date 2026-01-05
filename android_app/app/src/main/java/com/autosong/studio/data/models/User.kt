package com.autosong.studio.data.models

import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: String,
    val email: String,
    val plan: String = "free",
    val videosThisMonth: Int = 0,
    val schedulersCount: Int = 0,
    val sunoApiKey: String? = null,
    val youtubeRefreshToken: String? = null
) {
    val isPro: Boolean get() = plan == "pro"
    val isFree: Boolean get() = plan == "free"
    val requiresSunoKey: Boolean get() = isFree && sunoApiKey.isNullOrEmpty()
}

@Serializable
data class YouTubeChannel(
    val id: String,
    val title: String,
    val description: String = "",
    val thumbnailUrl: String,
    val subscriberCount: String = "0",
    val videoCount: String = "0"
)

@Serializable
data class AuthResponse(
    val user: User,
    val channels: List<YouTubeChannel>,
    val tokens: Tokens
)

@Serializable
data class Tokens(
    val accessToken: String,
    val refreshToken: String
)
