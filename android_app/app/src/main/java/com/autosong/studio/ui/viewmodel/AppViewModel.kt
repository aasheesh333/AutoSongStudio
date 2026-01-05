package com.autosong.studio.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.autosong.studio.data.models.*
import com.autosong.studio.data.repository.AppRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AppViewModel @Inject constructor(
    private val repository: AppRepository
) : ViewModel() {

    val currentUser: StateFlow<User?> = repository.currentUser
    val channels: StateFlow<List<YouTubeChannel>> = repository.channels
    val selectedChannel: StateFlow<YouTubeChannel?> = repository.selectedChannel
    val isAuthenticated: StateFlow<Boolean> = repository.isAuthenticated
    val schedulers: StateFlow<List<Scheduler>> = repository.schedulers
    val videos: StateFlow<List<Video>> = repository.videos

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    // Create scheduler state (shared across create flow screens)
    private val _createSchedulerData = MutableStateFlow(CreateSchedulerData())
    val createSchedulerData: StateFlow<CreateSchedulerData> = _createSchedulerData.asStateFlow()

    // ==================== AUTH ====================
    suspend fun checkAuthStatus(): Boolean {
        return repository.checkAuthStatus()
    }

    fun getYouTubeAuthUrl(onSuccess: (String) -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            repository.getYouTubeAuthUrl()
                .onSuccess { url -> onSuccess(url) }
                .onFailure { _error.value = it.message }
            _isLoading.value = false
        }
    }

    fun selectChannel(channel: YouTubeChannel) {
        repository.selectChannel(channel)
        loadSchedulers()
        loadVideos()
    }

    fun signOut(onComplete: () -> Unit) {
        viewModelScope.launch {
            repository.signOut()
            onComplete()
        }
    }

    // ==================== SCHEDULERS ====================
    fun loadSchedulers() {
        viewModelScope.launch {
            repository.loadSchedulers()
        }
    }

    fun toggleScheduler(id: String) {
        viewModelScope.launch {
            repository.toggleScheduler(id)
        }
    }

    fun deleteScheduler(id: String) {
        viewModelScope.launch {
            repository.deleteScheduler(id)
        }
    }

    // Create Scheduler Flow
    fun updateCreateSchedulerGenres(genres: List<String>) {
        _createSchedulerData.value = _createSchedulerData.value.copy(genres = genres)
    }

    fun updateCreateSchedulerPrompts(
        titlePrompt: String,
        descPrompt: String,
        tagsPrompt: String,
        lyricsPrompt: String
    ) {
        _createSchedulerData.value = _createSchedulerData.value.copy(
            titlePrompt = titlePrompt,
            descPrompt = descPrompt,
            tagsPrompt = tagsPrompt,
            lyricsPrompt = lyricsPrompt
        )
    }

    fun updateCreateSchedulerSchedule(
        name: String,
        time: String,
        frequency: String,
        activeDays: List<Int>,
        language: String
    ) {
        _createSchedulerData.value = _createSchedulerData.value.copy(
            name = name,
            time = time,
            frequency = frequency,
            activeDays = activeDays,
            language = language
        )
    }

    fun createScheduler(onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            val data = _createSchedulerData.value
            val userId = currentUser.value?.id ?: run {
                onError("User not logged in")
                _isLoading.value = false
                return@launch
            }
            val channelId = selectedChannel.value?.id ?: run {
                onError("No channel selected")
                _isLoading.value = false
                return@launch
            }

            val payload = mapOf(
                "userId" to userId,
                "channelId" to channelId,
                "name" to data.name,
                "time" to data.time,
                "frequency" to data.frequency,
                "activeDays" to data.activeDays,
                "language" to data.language,
                "genres" to data.genres,
                "titlePrompt" to data.titlePrompt,
                "descPrompt" to data.descPrompt,
                "tagsPrompt" to data.tagsPrompt,
                "lyricsPrompt" to data.lyricsPrompt
            )

            repository.createScheduler(payload)
                .onSuccess {
                    _createSchedulerData.value = CreateSchedulerData() // Reset
                    onSuccess()
                }
                .onFailure { onError(it.message ?: "Failed to create scheduler") }
            
            _isLoading.value = false
        }
    }

    fun resetCreateSchedulerData() {
        _createSchedulerData.value = CreateSchedulerData()
    }

    // ==================== VIDEOS ====================
    fun loadVideos(schedulerId: String? = null) {
        viewModelScope.launch {
            repository.loadVideos(schedulerId = schedulerId)
        }
    }

    fun uploadVideoNow(id: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            repository.uploadVideoNow(id)
                .onSuccess { onSuccess() }
                .onFailure { onError(it.message ?: "Upload failed") }
            _isLoading.value = false
            loadVideos()
        }
    }

    fun deleteVideo(id: String, schedulerId: String) {
        viewModelScope.launch {
            repository.deleteVideo(id, schedulerId)
        }
    }

    // ==================== SETTINGS ====================
    fun updateSunoKey(key: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            repository.updateSunoKey(key)
                .onSuccess { onSuccess() }
                .onFailure { onError(it.message ?: "Failed to update") }
            _isLoading.value = false
        }
    }

    fun clearError() {
        _error.value = null
    }
}

data class CreateSchedulerData(
    val genres: List<String> = emptyList(),
    val titlePrompt: String = "",
    val descPrompt: String = "",
    val tagsPrompt: String = "",
    val lyricsPrompt: String = "",
    val name: String = "",
    val time: String = "12:00",
    val frequency: String = "daily",
    val activeDays: List<Int> = listOf(1, 2, 3, 4, 5),
    val language: String = "Hindi"
)
