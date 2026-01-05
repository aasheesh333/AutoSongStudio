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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.autosong.studio.data.models.Video
import com.autosong.studio.ui.theme.*
import com.autosong.studio.ui.viewmodel.AppViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SongDetailScreen(
    navController: NavController,
    videoId: String,
    viewModel: AppViewModel = hiltViewModel()
) {
    val videos by viewModel.videos.collectAsState()
    val video = videos.find { it.id == videoId }
    val isLoading by viewModel.isLoading.collectAsState()
    var showDeleteDialog by remember { mutableStateOf(false) }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        viewModel.loadVideos()
    }

    if (video == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Song Details") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    if (!video.isUploaded) {
                        IconButton(onClick = { showDeleteDialog = true }) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Error)
                        }
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
                .verticalScroll(rememberScrollState())
        ) {
            // Thumbnail
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(16f / 9f)
                    .background(SurfaceHighlight)
            ) {
                if (video.thumbnailUrl != null) {
                    AsyncImage(
                        model = video.thumbnailUrl,
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        if (video.isProcessing) {
                            CircularProgressIndicator()
                        } else {
                            Icon(Icons.Default.MusicNote, contentDescription = null, modifier = Modifier.size(64.dp))
                        }
                    }
                }

                // Status badge
                val (statusText, statusColor) = when {
                    video.isProcessing || video.isQueued -> "Processing" to Info
                    video.isFailed -> "Failed" to Error
                    video.isUploaded -> "Uploaded" to Success
                    else -> "Ready" to Warning
                }
                Surface(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(12.dp),
                    color = statusColor,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = statusText,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Column(modifier = Modifier.padding(20.dp)) {
                // Title
                Text(
                    text = video.title.ifEmpty { "Generating..." },
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Genres
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    video.genres.forEach { genre ->
                        Surface(
                            color = PrimaryColor.copy(alpha = 0.1f),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text(
                                text = genre,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                style = MaterialTheme.typography.bodySmall,
                                color = PrimaryColor
                            )
                        }
                    }
                }

                // Error message
                if (video.isFailed && !video.error.isNullOrEmpty()) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Error.copy(alpha = 0.1f)),
                        border = BorderStroke(1.dp, Error.copy(alpha = 0.3f))
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.Top
                        ) {
                            Icon(Icons.Default.Error, contentDescription = null, tint = Error)
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(video.error!!, style = MaterialTheme.typography.bodySmall, color = Error)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Description
                Text("Description", style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = video.description.ifEmpty { "Generating..." },
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Lyrics
                if (video.lyrics.isNotEmpty()) {
                    Text("Lyrics", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
                    ) {
                        Text(
                            text = video.lyrics,
                            modifier = Modifier.padding(16.dp),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // YouTube button (if uploaded)
                if (video.isUploaded && video.youtubeUrl != null) {
                    Button(
                        onClick = { /* Open YouTube */ },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF0000))
                    ) {
                        Icon(Icons.Default.PlayCircle, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Watch on YouTube")
                    }
                }

                // Upload button (if ready)
                if (video.isReady) {
                    Button(
                        onClick = {
                            viewModel.uploadVideoNow(
                                video.id,
                                onSuccess = { },
                                onError = { }
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isLoading
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.CloudUpload, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Upload Now")
                        }
                    }
                }
            }
        }
    }

    // Delete dialog
    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Delete Video?") },
            text = { Text("This action cannot be undone.") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteVideo(video.id, video.schedulerId)
                        showDeleteDialog = false
                        navController.popBackStack()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Error)
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Cancel")
                }
            },
            containerColor = SurfaceDark
        )
    }
}
