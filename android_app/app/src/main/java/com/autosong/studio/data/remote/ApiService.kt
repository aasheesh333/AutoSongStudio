package com.autosong.studio.data.remote

import com.autosong.studio.data.models.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {
    // ==================== AUTH ====================
    @GET(ApiConstants.AUTH_YOUTUBE)
    suspend fun getYouTubeAuthUrl(
        @Query("state") state: String
    ): Response<Map<String, String>>

    @GET(ApiConstants.AUTH_CALLBACK)
    suspend fun handleOAuthCallback(
        @Query("code") code: String
    ): Response<AuthResponse>

    @POST(ApiConstants.AUTH_REFRESH)
    suspend fun refreshAccessToken(
        @Body body: Map<String, String>
    ): Response<Map<String, String>>

    @GET(ApiConstants.AUTH_CHANNELS)
    suspend fun getChannels(
        @Query("accessToken") accessToken: String
    ): Response<Map<String, List<YouTubeChannel>>>

    @POST(ApiConstants.AUTH_SIGNOUT)
    suspend fun signOut(): Response<Unit>

    // ==================== SCHEDULERS ====================
    @GET(ApiConstants.SCHEDULERS)
    suspend fun getSchedulers(
        @Query("userId") userId: String,
        @Query("channelId") channelId: String?,
        @Query("accessToken") accessToken: String
    ): Response<SchedulersResponse>

    @POST(ApiConstants.SCHEDULERS)
    suspend fun createScheduler(
        @Body data: Map<String, @JvmSuppressWildcards Any>,
        @Query("accessToken") accessToken: String
    ): Response<SchedulerResponse>

    @GET("schedulers/{id}")
    suspend fun getSchedulerDetails(
        @Path("id") id: String,
        @Query("accessToken") accessToken: String
    ): Response<SchedulerResponse>

    @PATCH("schedulers/{id}")
    suspend fun updateScheduler(
        @Path("id") id: String,
        @Body updates: Map<String, @JvmSuppressWildcards Any>,
        @Query("accessToken") accessToken: String
    ): Response<SchedulerResponse>

    @POST("schedulers/{id}/toggle")
    suspend fun toggleScheduler(
        @Path("id") id: String,
        @Query("accessToken") accessToken: String
    ): Response<SchedulerResponse>

    @DELETE("schedulers/{id}")
    suspend fun deleteScheduler(
        @Path("id") id: String,
        @Query("accessToken") accessToken: String
    ): Response<Unit>

    // ==================== VIDEOS ====================
    @GET(ApiConstants.VIDEOS)
    suspend fun getVideos(
        @Query("userId") userId: String,
        @Query("channelId") channelId: String?,
        @Query("schedulerId") schedulerId: String?,
        @Query("status") status: String?,
        @Query("accessToken") accessToken: String
    ): Response<VideosResponse>

    @GET("videos/{id}")
    suspend fun getVideo(
        @Path("id") id: String,
        @Query("accessToken") accessToken: String
    ): Response<VideoResponse>

    @PATCH("videos/{id}")
    suspend fun updateVideo(
        @Path("id") id: String,
        @Body updates: Map<String, @JvmSuppressWildcards Any>,
        @Query("accessToken") accessToken: String
    ): Response<VideoResponse>

    @POST("videos/{id}/upload-now")
    suspend fun uploadVideoNow(
        @Path("id") id: String,
        @Body body: Map<String, String>
    ): Response<Map<String, Any>>

    @DELETE("videos/{id}")
    suspend fun deleteVideo(
        @Path("id") id: String,
        @Query("accessToken") accessToken: String
    ): Response<Unit>

    @POST(ApiConstants.WEBHOOK_VIDEO_DELETED)
    suspend fun triggerVideoDeleted(
        @Body body: Map<String, String>
    ): Response<Unit>

    // ==================== SETTINGS ====================
    @GET(ApiConstants.SETTINGS)
    suspend fun getSettings(
        @Query("userId") userId: String,
        @Query("accessToken") accessToken: String
    ): Response<Map<String, Any>>

    @PUT(ApiConstants.SETTINGS_SUNO_KEY)
    suspend fun updateSunoKey(
        @Body body: Map<String, String>
    ): Response<Unit>

    @GET(ApiConstants.SETTINGS_QUOTA)
    suspend fun getQuotaUsage(
        @Query("userId") userId: String,
        @Query("accessToken") accessToken: String
    ): Response<Map<String, Any>>
}
