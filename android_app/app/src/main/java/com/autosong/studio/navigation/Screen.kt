package com.autosong.studio.navigation

sealed class Screen(val route: String) {
    object Splash : Screen("splash")
    object SignIn : Screen("sign_in")
    object Home : Screen("home")
    object Schedulers : Screen("schedulers")
    object CreateSchedulerGenres : Screen("create_scheduler/genres")
    object CreateSchedulerPrompts : Screen("create_scheduler/prompts")
    object CreateSchedulerSchedule : Screen("create_scheduler/schedule")
    object CreateSchedulerReview : Screen("create_scheduler/review")
    object SchedulerDetails : Screen("scheduler_details/{schedulerId}") {
        fun createRoute(schedulerId: String) = "scheduler_details/$schedulerId"
    }
    object Library : Screen("library")
    object SongDetail : Screen("song_detail/{videoId}") {
        fun createRoute(videoId: String) = "song_detail/$videoId"
    }
    object PlanSelection : Screen("plan_selection")
    object Settings : Screen("settings")
}
