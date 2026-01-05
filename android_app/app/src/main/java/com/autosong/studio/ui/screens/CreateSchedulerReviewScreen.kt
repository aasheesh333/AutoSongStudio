package com.autosong.studio.ui.screens

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.autosong.studio.navigation.Screen
import com.autosong.studio.ui.theme.*
import com.autosong.studio.ui.viewmodel.AppViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateSchedulerReviewScreen(
    navController: NavController,
    viewModel: AppViewModel = hiltViewModel()
) {
    val createData by viewModel.createSchedulerData.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Review & Create") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BackgroundDark)
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            LinearProgressIndicator(
                progress = { 1f },
                modifier = Modifier.fillMaxWidth(),
                color = PrimaryColor,
                trackColor = SurfaceHighlight
            )

            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text("Review Your Scheduler", style = MaterialTheme.typography.titleLarge)

                // Summary Card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                    border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        ReviewItem("Name", createData.name)
                        ReviewItem("Genres", createData.genres.joinToString(", "))
                        ReviewItem("Frequency", createData.frequency.replaceFirstChar { it.uppercase() })
                        ReviewItem("Time", createData.time)
                        ReviewItem("Language", createData.language)
                        
                        if (createData.lyricsPrompt.isNotBlank()) {
                            ReviewItem("Lyrics Prompt", createData.lyricsPrompt)
                        }
                        if (createData.titlePrompt.isNotBlank()) {
                            ReviewItem("Title Prompt", createData.titlePrompt)
                        }
                    }
                }

                // Info box
                Card(
                    colors = CardDefaults.cardColors(containerColor = Info.copy(alpha = 0.1f)),
                    border = BorderStroke(1.dp, Info.copy(alpha = 0.3f))
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Icon(Icons.Default.Info, contentDescription = null, tint = Info)
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            "Your first video will start generating immediately after creation!",
                            style = MaterialTheme.typography.bodySmall,
                            color = Info
                        )
                    }
                }
            }

            Button(
                onClick = {
                    viewModel.createScheduler(
                        onSuccess = {
                            navController.navigate(Screen.Home.route) {
                                popUpTo(Screen.CreateSchedulerGenres.route) { inclusive = true }
                            }
                        },
                        onError = { error ->
                            // Show error snackbar
                        }
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                enabled = !isLoading,
                shape = RoundedCornerShape(12.dp)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(Icons.Default.RocketLaunch, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Create Scheduler", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun ReviewItem(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
        Text(
            value.take(30) + if (value.length > 30) "..." else "",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold
        )
    }
}
