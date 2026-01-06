package com.autosong.studio.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.autosong.studio.navigation.Screen
import com.autosong.studio.ui.theme.*
import com.autosong.studio.ui.viewmodel.AppViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateSchedulerPromptsScreen(
    navController: NavController,
    viewModel: AppViewModel = hiltViewModel()
) {
    val createData by viewModel.createSchedulerData.collectAsState()
    var lyricsPrompt by remember { mutableStateOf(createData.lyricsPrompt) }
    var titlePrompt by remember { mutableStateOf(createData.titlePrompt) }
    var descPrompt by remember { mutableStateOf(createData.descPrompt) }
    var tagsPrompt by remember { mutableStateOf(createData.tagsPrompt) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Content Prompts") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BackgroundDark)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            LinearProgressIndicator(
                progress = 0.5f,
                modifier = Modifier.fillMaxWidth(),
                color = PrimaryColor,
                trackColor = SurfaceHighlight,
            )

            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text("Customize AI Prompts", style = MaterialTheme.typography.titleLarge)
                Text(
                    "Optional: Guide the AI to generate specific content",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary
                )

                OutlinedTextField(
                    value = lyricsPrompt,
                    onValueChange = { lyricsPrompt = it },
                    label = { Text("Lyrics Prompt") },
                    placeholder = { Text("e.g., Write a romantic Hindi song about love...") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    maxLines = 5
                )

                OutlinedTextField(
                    value = titlePrompt,
                    onValueChange = { titlePrompt = it },
                    label = { Text("Title Prompt") },
                    placeholder = { Text("e.g., Catchy title with Hindi words...") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    maxLines = 3
                )

                OutlinedTextField(
                    value = descPrompt,
                    onValueChange = { descPrompt = it },
                    label = { Text("Description Prompt") },
                    placeholder = { Text("e.g., SEO-optimized description with emojis...") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    maxLines = 3
                )

                OutlinedTextField(
                    value = tagsPrompt,
                    onValueChange = { tagsPrompt = it },
                    label = { Text("Tags Prompt") },
                    placeholder = { Text("e.g., Include trending Hindi music tags...") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    maxLines = 3
                )

                Text(
                    "💡 Tip: Leave blank for AI to generate automatically based on genres",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )
            }

            Button(
                onClick = {
                    viewModel.updateCreateSchedulerPrompts(titlePrompt, descPrompt, tagsPrompt, lyricsPrompt)
                    navController.navigate(Screen.CreateSchedulerSchedule.route)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Continue", fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.width(8.dp))
                Icon(Icons.Default.ArrowForward, contentDescription = null)
            }
        }
    }
}
