package com.autosong.studio.data.models

import kotlinx.serialization.Serializable

@Serializable
data class Scheduler(
    val id: String,
    val name: String,
    val userId: String,
    val channelId: String,
    val time: String,           // HH:MM format
    val frequency: String,      // daily/weekly/monthly
    val activeDays: List<Int> = emptyList(),  // [0-6] for weekly
    val language: String,
    val genres: List<String>,
    val titlePrompt: String = "",
    val descPrompt: String = "",
    val tagsPrompt: String = "",
    val lyricsPrompt: String = "",
    val active: Boolean = true,
    val error: String? = null,
    val nextRunAt: String? = null,
    val createdAt: String
) {
    val frequencyDisplay: String
        get() = when (frequency) {
            "daily" -> "Daily at $time"
            "weekly" -> {
                val days = activeDays.map { dayName(it) }.joinToString(", ")
                "Weekly on $days at $time"
            }
            "monthly" -> "Monthly at $time"
            else -> frequency
        }

    private fun dayName(day: Int): String {
        val days = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
        return days[day % 7]
    }
}

@Serializable
data class SchedulersResponse(
    val schedulers: List<Scheduler>
)

@Serializable
data class SchedulerResponse(
    val scheduler: Scheduler,
    val recentVideos: List<Video> = emptyList()
)
