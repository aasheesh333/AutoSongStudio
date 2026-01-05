package com.autosong.studio.data.repository

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.autosong.studio.data.models.*
import com.autosong.studio.data.remote.ApiService
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppRepository @Inject constructor(
    private val apiService: ApiService,
    @ApplicationContext private val context: Context
) {
    private val json = Json { ignoreUnknownKeys = true }

    // Encrypted storage for tokens
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val securePrefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    // State
    private val _currentUser = MutableStateFlow<User?>(null)
    val currentUser: StateFlow<User?> = _currentUser.asStateFlow()

    private val _channels = MutableStateFlow<List<YouTubeChannel>>(emptyList())
    val channels: StateFlow<List<YouTubeChannel>> = _channels.asStateFlow()

    private val _selectedChannel = MutableStateFlow<YouTubeChannel?>(null)
    val selectedChannel: StateFlow<YouTubeChannel?> = _selectedChannel.asStateFlow()

    private val _isAuthenticated = MutableStateFlow(false)
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated.asStateFlow()

    private val _schedulers = MutableStateFlow<List<Scheduler>>(emptyList())
    val schedulers: StateFlow<List<Scheduler>> = _schedulers.asStateFlow()

    private val _videos = MutableStateFlow<List<Video>>(emptyList())
    val videos: StateFlow<List<Video>> = _videos.asStateFlow()

    // Token management
    fun getAccessToken(): String? = securePrefs.getString("access_token", null)
    
    private fun saveAccessToken(token: String) {
        securePrefs.edit().putString("access_token", token).apply()
    }

    private fun saveRefreshToken(token: String) {
        securePrefs.edit().putString("refresh_token", token).apply()
    }

    fun clearTokens() {
        securePrefs.edit()
            .remove("access_token")
            .remove("refresh_token")
            .remove("user_data")
            .remove("channels_data")
            .remove("selected_channel_id")
            .apply()
    }

    // ==================== AUTH ====================
    suspend fun getYouTubeAuthUrl(): Result<String> = runCatching {
        val response = apiService.getYouTubeAuthUrl()
        if (response.isSuccessful) {
            response.body()?.get("authUrl") ?: throw Exception("No authUrl in response")
        } else {
            throw Exception("Failed to get auth URL")
        }
    }

    suspend fun handleOAuthCallback(code: String): Result<Unit> = runCatching {
        val response = apiService.handleOAuthCallback(code)
        if (response.isSuccessful) {
            val data = response.body() ?: throw Exception("Empty response")
            processAuthData(data)
        } else {
            throw Exception("OAuth callback failed")
        }
    }

    fun processAuthDataFromParams(
        userId: String,
        email: String,
        plan: String,
        accessToken: String,
        refreshToken: String,
        channelsJson: String?
    ) {
        val user = User(id = userId, email = email, plan = plan)
        _currentUser.value = user
        saveAccessToken(accessToken)
        saveRefreshToken(refreshToken)
        
        // Parse channels
        if (!channelsJson.isNullOrEmpty()) {
            try {
                val decodedChannels = java.net.URLDecoder.decode(channelsJson, "UTF-8")
                val channelsList = json.decodeFromString<List<YouTubeChannel>>(decodedChannels)
                _channels.value = channelsList
                if (channelsList.isNotEmpty()) {
                    _selectedChannel.value = channelsList.first()
                    securePrefs.edit().putString("selected_channel_id", channelsList.first().id).apply()
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        
        // Persist user
        securePrefs.edit().putString("user_data", json.encodeToString(user)).apply()
        if (_channels.value.isNotEmpty()) {
            securePrefs.edit().putString("channels_data", json.encodeToString(_channels.value)).apply()
        }
        
        _isAuthenticated.value = true
    }

    private fun processAuthData(data: AuthResponse) {
        _currentUser.value = data.user
        _channels.value = data.channels
        if (data.channels.isNotEmpty()) {
            _selectedChannel.value = data.channels.first()
            securePrefs.edit().putString("selected_channel_id", data.channels.first().id).apply()
        }
        saveAccessToken(data.tokens.accessToken)
        saveRefreshToken(data.tokens.refreshToken)
        
        // Persist user
        securePrefs.edit().putString("user_data", json.encodeToString(data.user)).apply()
        securePrefs.edit().putString("channels_data", json.encodeToString(data.channels)).apply()
        
        _isAuthenticated.value = true
    }

    suspend fun checkAuthStatus(): Boolean {
        val token = getAccessToken()
        if (token != null) {
            _isAuthenticated.value = true
            
            // Restore user data
            securePrefs.getString("user_data", null)?.let { userData ->
                try {
                    _currentUser.value = json.decodeFromString(userData)
                } catch (e: Exception) { e.printStackTrace() }
            }
            
            // Restore channels
            securePrefs.getString("channels_data", null)?.let { channelsData ->
                try {
                    _channels.value = json.decodeFromString(channelsData)
                    val savedChannelId = securePrefs.getString("selected_channel_id", null)
                    _selectedChannel.value = _channels.value.find { it.id == savedChannelId }
                        ?: _channels.value.firstOrNull()
                } catch (e: Exception) { e.printStackTrace() }
            }
            return true
        }
        return false
    }

    fun selectChannel(channel: YouTubeChannel) {
        _selectedChannel.value = channel
        securePrefs.edit().putString("selected_channel_id", channel.id).apply()
    }

    suspend fun signOut(): Result<Unit> = runCatching {
        try { apiService.signOut() } catch (e: Exception) { /* ignore */ }
        clearTokens()
        _currentUser.value = null
        _channels.value = emptyList()
        _selectedChannel.value = null
        _isAuthenticated.value = false
        _schedulers.value = emptyList()
        _videos.value = emptyList()
    }

    // ==================== SCHEDULERS ====================
    suspend fun loadSchedulers(): Result<List<Scheduler>> = runCatching {
        val userId = _currentUser.value?.id ?: throw Exception("User not logged in")
        val token = getAccessToken() ?: throw Exception("No access token")
        val channelId = _selectedChannel.value?.id
        
        val response = apiService.getSchedulers(userId, channelId, token)
        if (response.isSuccessful) {
            val list = response.body()?.schedulers ?: emptyList()
            _schedulers.value = list
            list
        } else {
            throw Exception("Failed to load schedulers")
        }
    }

    suspend fun createScheduler(data: Map<String, Any>): Result<Scheduler> = runCatching {
        val token = getAccessToken() ?: throw Exception("No access token")
        val response = apiService.createScheduler(data, token)
        if (response.isSuccessful) {
            val scheduler = response.body()?.scheduler ?: throw Exception("Empty response")
            _schedulers.value = _schedulers.value + scheduler
            scheduler
        } else {
            throw Exception("Failed to create scheduler")
        }
    }

    suspend fun toggleScheduler(id: String): Result<Scheduler> = runCatching {
        val token = getAccessToken() ?: throw Exception("No access token")
        val response = apiService.toggleScheduler(id, token)
        if (response.isSuccessful) {
            val scheduler = response.body()?.scheduler ?: throw Exception("Empty response")
            _schedulers.value = _schedulers.value.map { if (it.id == id) scheduler else it }
            scheduler
        } else {
            throw Exception("Failed to toggle scheduler")
        }
    }

    suspend fun deleteScheduler(id: String): Result<Unit> = runCatching {
        val token = getAccessToken() ?: throw Exception("No access token")
        val response = apiService.deleteScheduler(id, token)
        if (response.isSuccessful) {
            _schedulers.value = _schedulers.value.filter { it.id != id }
        } else {
            throw Exception("Failed to delete scheduler")
        }
    }

    // ==================== VIDEOS ====================
    suspend fun loadVideos(schedulerId: String? = null, status: String? = null): Result<List<Video>> = runCatching {
        val userId = _currentUser.value?.id ?: throw Exception("User not logged in")
        val token = getAccessToken() ?: throw Exception("No access token")
        val channelId = _selectedChannel.value?.id
        
        val response = apiService.getVideos(userId, channelId, schedulerId, status, token)
        if (response.isSuccessful) {
            val list = response.body()?.videos ?: emptyList()
            _videos.value = list
            list
        } else {
            throw Exception("Failed to load videos")
        }
    }

    suspend fun uploadVideoNow(id: String): Result<Unit> = runCatching {
        val token = getAccessToken() ?: throw Exception("No access token")
        val response = apiService.uploadVideoNow(id, mapOf("accessToken" to token))
        if (!response.isSuccessful) {
            throw Exception("Failed to upload video")
        }
    }

    suspend fun deleteVideo(id: String, schedulerId: String): Result<Unit> = runCatching {
        val token = getAccessToken() ?: throw Exception("No access token")
        apiService.deleteVideo(id, token)
        apiService.triggerVideoDeleted(mapOf("videoId" to id, "schedulerId" to schedulerId))
        _videos.value = _videos.value.filter { it.id != id }
    }

    // ==================== SETTINGS ====================
    suspend fun updateSunoKey(sunoApiKey: String): Result<Unit> = runCatching {
        val userId = _currentUser.value?.id ?: throw Exception("User not logged in")
        val response = apiService.updateSunoKey(mapOf("userId" to userId, "sunoApiKey" to sunoApiKey))
        if (!response.isSuccessful) {
            throw Exception("Failed to update Suno key")
        }
    }
}
