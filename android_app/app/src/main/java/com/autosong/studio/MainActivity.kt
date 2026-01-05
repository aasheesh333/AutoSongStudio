package com.autosong.studio

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.autosong.studio.data.repository.AppRepository
import com.autosong.studio.navigation.NavGraph
import com.autosong.studio.navigation.Screen
import com.autosong.studio.ui.theme.AutoSongStudioTheme
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    
    @Inject
    lateinit var repository: AppRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        setContent {
            AutoSongStudioTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()
                    
                    // Handle deep link intent
                    LaunchedEffect(intent) {
                        handleDeepLink(intent)?.let { destination ->
                            navController.navigate(destination) {
                                popUpTo(Screen.Splash.route) { inclusive = true }
                            }
                        }
                    }
                    
                    NavGraph(navController = navController)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?): String? {
        val uri = intent?.data ?: return null
        
        // Handle OAuth callback
        if (uri.path?.contains("/auth/callback") == true || uri.scheme == "autosong") {
            // Extract auth data from URL params
            val userId = uri.getQueryParameter("user_id")
            val email = uri.getQueryParameter("email")
            val plan = uri.getQueryParameter("plan")
            val accessToken = uri.getQueryParameter("access_token")
            val refreshToken = uri.getQueryParameter("refresh_token")
            val channels = uri.getQueryParameter("channels")

            if (userId != null && accessToken != null && refreshToken != null) {
                repository.processAuthDataFromParams(
                    userId = userId,
                    email = email ?: "",
                    plan = plan ?: "free",
                    accessToken = accessToken,
                    refreshToken = refreshToken,
                    channelsJson = channels
                )
                return Screen.Home.route
            }
        }
        
        return null
    }
}
