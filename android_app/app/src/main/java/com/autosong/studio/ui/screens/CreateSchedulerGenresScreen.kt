package com.autosong.studio.ui.screens

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
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

val genresList = listOf(
    "Lofi", "Jazz", "Synthwave", "Ambient", "Classical",
    "Trap", "Phonk", "Deep House", "Acoustic", "Bollywood",
    "Hindi", "Romantic", "Pop", "Rock", "EDM",
    "R&B", "Soul", "Hip Hop", "Country", "Reggae"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateSchedulerGenresScreen(
    navController: NavController,
    viewModel: AppViewModel = hiltViewModel()
) {
    val createData by viewModel.createSchedulerData.collectAsState()
    var selectedGenres by remember { mutableStateOf(createData.genres.toMutableSet()) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Select Genres") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.Close, contentDescription = "Cancel")
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
            // Progress indicator
            LinearProgressIndicator(
                progress = { 0.25f },
                modifier = Modifier.fillMaxWidth(),
                color = PrimaryColor,
                trackColor = SurfaceHighlight,
            )

            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(20.dp)
            ) {
                Text(
                    "What genres do you want?",
                    style = MaterialTheme.typography.titleLarge
                )
                Text(
                    "Select up to 3 genres for your music",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary
                )

                Spacer(modifier = Modifier.height(24.dp))

                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    items(genresList) { genre ->
                        val isSelected = genre in selectedGenres
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    if (isSelected) {
                                        selectedGenres = selectedGenres.toMutableSet().apply { remove(genre) }
                                    } else if (selectedGenres.size < 3) {
                                        selectedGenres = selectedGenres.toMutableSet().apply { add(genre) }
                                    }
                                },
                            color = if (isSelected) PrimaryColor else SurfaceDark,
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(
                                1.dp,
                                if (isSelected) PrimaryColor else Color.White.copy(alpha = 0.05f)
                            )
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    genre,
                                    style = MaterialTheme.typography.titleSmall,
                                    modifier = Modifier.weight(1f)
                                )
                                if (isSelected) {
                                    Icon(
                                        Icons.Default.Check,
                                        contentDescription = null,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Next button
            Button(
                onClick = {
                    viewModel.updateCreateSchedulerGenres(selectedGenres.toList())
                    navController.navigate(Screen.CreateSchedulerPrompts.route)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                enabled = selectedGenres.isNotEmpty(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Continue", fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.width(8.dp))
                Icon(Icons.Default.ArrowForward, contentDescription = null)
            }
        }
    }
}
