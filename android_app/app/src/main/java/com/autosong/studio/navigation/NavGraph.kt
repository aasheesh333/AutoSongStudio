package com.autosong.studio.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.autosong.studio.ui.screens.*

@Composable
fun NavGraph(
    navController: NavHostController,
    startDestination: String = Screen.Splash.route
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Screen.Splash.route) {
            SplashScreen(navController = navController)
        }
        
        composable(Screen.SignIn.route) {
            SignInScreen(navController = navController)
        }
        
        composable(Screen.Home.route) {
            HomeScreen(navController = navController)
        }
        
        composable(Screen.Schedulers.route) {
            SchedulersScreen(navController = navController)
        }
        
        composable(Screen.CreateSchedulerGenres.route) {
            CreateSchedulerGenresScreen(navController = navController)
        }
        
        composable(Screen.CreateSchedulerPrompts.route) {
            CreateSchedulerPromptsScreen(navController = navController)
        }
        
        composable(Screen.CreateSchedulerSchedule.route) {
            CreateSchedulerScheduleScreen(navController = navController)
        }
        
        composable(Screen.CreateSchedulerReview.route) {
            CreateSchedulerReviewScreen(navController = navController)
        }
        
        composable(
            route = Screen.SchedulerDetails.route,
            arguments = listOf(navArgument("schedulerId") { type = NavType.StringType })
        ) { backStackEntry ->
            val schedulerId = backStackEntry.arguments?.getString("schedulerId") ?: ""
            SchedulerDetailsScreen(navController = navController, schedulerId = schedulerId)
        }
        
        composable(Screen.Library.route) {
            LibraryScreen(navController = navController)
        }
        
        composable(
            route = Screen.SongDetail.route,
            arguments = listOf(navArgument("videoId") { type = NavType.StringType })
        ) { backStackEntry ->
            val videoId = backStackEntry.arguments?.getString("videoId") ?: ""
            SongDetailScreen(navController = navController, videoId = videoId)
        }
        
        composable(Screen.PlanSelection.route) {
            PlanSelectionScreen(navController = navController)
        }
        
        composable(Screen.Settings.route) {
            SettingsScreen(navController = navController)
        }
    }
}
