package com.autosong.studio.ui.screens

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.ui.input.nestedscroll.nestedScroll
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
import com.autosong.studio.data.models.YouTubeChannel
import com.autosong.studio.navigation.Screen
import com.autosong.studio.ui.theme.*
import com.autosong.studio.ui.viewmodel.AppViewModel
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    navController: NavController,
    viewModel: AppViewModel = hiltViewModel()
) {
    val selectedChannel by viewModel.selectedChannel.collectAsState()
    val channels by viewModel.channels.collectAsState()
    val schedulers by viewModel.schedulers.collectAsState()
    val videos by viewModel.videos.collectAsState()
    var showChannelPicker by remember { mutableStateOf(false) }

    // Poll every 5 seconds
    LaunchedEffect(Unit) {
        viewModel.loadSchedulers()
        viewModel.loadVideos()
        while (true) {
            delay(5000)
            viewModel.loadVideos()
        }
    }

    // Pull to refresh
    val pullRefreshState = rememberPullToRefreshState()
    if (pullRefreshState.isRefreshing) {
        LaunchedEffect(true) {
            viewModel.loadSchedulers()
            viewModel.loadVideos()
            pullRefreshState.endRefresh()
        }
    }

    Scaffold(
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { navController.navigate(Screen.Schedulers.route) },
                containerColor = PrimaryColor,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.RocketLaunch, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Start Automation", fontWeight = FontWeight.Bold)
            }
        },
        bottomBar = {
            BottomNavBar(navController = navController, currentRoute = Screen.Home.route)
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .nestedScroll(pullRefreshState.nestedScrollConnection)
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header with channel
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Channel Avatar
                        selectedChannel?.let { channel ->
                            AsyncImage(
                                model = channel.thumbnailUrl,
                                contentDescription = null,
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(CircleShape),
                                contentScale = ContentScale.Crop
                            )
                        }
                        
                        Spacer(modifier = Modifier.width(12.dp))
                        
                        // Channel info
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .clickable { if (channels.size > 1) showChannelPicker = true }
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = selectedChannel?.title ?: "My Channel",
                                    style = MaterialTheme.typography.titleMedium
                                )
                                if (channels.size > 1) {
                                    Icon(
                                        Icons.Default.KeyboardArrowDown,
                                        contentDescription = null,
                                        tint = TextSecondary
                                    )
                                }
                            }
                            Text(
                                text = "${selectedChannel?.subscriberCount ?: "0"} subscribers",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextSecondary
                            )
                        }
                        
                        IconButton(onClick = { navController.navigate(Screen.Settings.route) }) {
                            Icon(Icons.Default.Settings, contentDescription = "Settings")
                        }
                    }
                }

                // Stats Cards
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        StatCard(
                            modifier = Modifier.weight(1f),
                            icon = Icons.Default.Schedule,
                            title = "Scheduled",
                            value = schedulers.count { it.active }.toString(),
                            subtitle = "Active",
                            color = Info
                        )
                        StatCard(
                            modifier = Modifier.weight(1f),
                            icon = Icons.Default.CloudUpload,
                            title = "Uploaded",
                            value = videos.count { it.isUploaded }.toString(),
                            subtitle = "This week",
                            color = Success
                        )
                    }
                }

                // Recent Activity Header
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Recent Activity",
                            style = MaterialTheme.typography.titleLarge
                        )
                        TextButton(onClick = { navController.navigate(Screen.Library.route) }) {
                            Text("View All")
                        }
                    }
                }

                // Videos list
                val sortedVideos = videos.sortedByDescending { it.createdAt }.take(5)
                if (sortedVideos.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(200.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(
                                    Icons.Default.VideoLibrary,
                                    contentDescription = null,
                                    modifier = Modifier.size(64.dp),
                                    tint = TextSecondary
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Text(
                                    "No upcoming videos",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = TextSecondary
                                )
                                Text(
                                    "Create a scheduler to start",
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }
                    }
                } else {
                    items(sortedVideos) { video ->
                        VideoCard(
                            video = video,
                            onClick = { navController.navigate(Screen.SongDetail.createRoute(video.id)) }
                        )
                    }
                }
            }

            PullToRefreshContainer(
                state = pullRefreshState,
                modifier = Modifier.align(Alignment.TopCenter)
            )
        }
    }

    // Channel picker bottom sheet
    if (showChannelPicker) {
        ModalBottomSheet(
            onDismissRequest = { showChannelPicker = false },
            containerColor = SurfaceDark
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    "Switch Channel",
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
                channels.forEach { channel ->
                    ChannelItem(
                        channel = channel,
                        isSelected = channel.id == selectedChannel?.id,
                        onClick = {
                            viewModel.selectChannel(channel)
                            showChannelPicker = false
                        }
                    )
                }
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}

@Composable
fun StatCard(
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    value: String,
    subtitle: String,
    color: Color
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Icon(icon, contentDescription = null, tint = color)
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.displayMedium,
                fontWeight = FontWeight.ExtraBold,
                color = color
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = title, style = MaterialTheme.typography.bodyMedium)
            Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = TextSecondary)
        }
    }
}

@Composable
fun VideoCard(video: Video, onClick: () -> Unit) {
    val (statusText, statusColor) = when {
        video.isProcessing || video.isQueued -> "Processing" to Info
        video.isFailed -> "Failed" to Error
        video.isUploaded -> "Uploaded" to Success
        else -> "Ready" to Warning
    }

    val timeText = when {
        video.isProcessing || video.isQueued -> "Generating now..."
        video.isFailed -> video.error?.take(40) ?: "Error generating"
        video.isUploaded -> "On YouTube"
        else -> formatDate(video.scheduledPublishAt ?: video.createdAt)
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Thumbnail
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(SurfaceHighlight),
                contentAlignment = Alignment.Center
            ) {
                if (video.thumbnailUrl != null) {
                    AsyncImage(
                        model = video.thumbnailUrl,
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else if (video.isProcessing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(Icons.Default.MusicNote, contentDescription = null, modifier = Modifier.size(32.dp))
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = video.title.ifEmpty { "Generating Title..." },
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 2
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = video.genres.joinToString(" · ").ifEmpty { "Generating music..." },
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                    maxLines = 1
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Schedule,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = TextSecondary
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = timeText,
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                }
            }

            // Status badge
            Surface(
                color = statusColor.copy(alpha = 0.1f),
                shape = RoundedCornerShape(8.dp),
                border = BorderStroke(1.dp, statusColor.copy(alpha = 0.3f))
            ) {
                Text(
                    text = statusText,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.bodySmall,
                    color = statusColor,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
fun ChannelItem(channel: YouTubeChannel, isSelected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AsyncImage(
            model = channel.thumbnailUrl,
            contentDescription = null,
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(channel.title, style = MaterialTheme.typography.titleMedium)
            Text("${channel.subscriberCount} subscribers", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
        }
        if (isSelected) {
            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = PrimaryColor)
        }
    }
}

@Composable
fun BottomNavBar(navController: NavController, currentRoute: String) {
    Surface(
        color = SurfaceDark,
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceAround
        ) {
            NavButton(Icons.Default.Home, "Home", currentRoute == Screen.Home.route) {
                navController.navigate(Screen.Home.route)
            }
            NavButton(Icons.Default.Schedule, "Schedulers", currentRoute == Screen.Schedulers.route) {
                navController.navigate(Screen.Schedulers.route)
            }
            NavButton(Icons.Default.VideoLibrary, "Library", currentRoute == Screen.Library.route) {
                navController.navigate(Screen.Library.route)
            }
            NavButton(Icons.Default.Person, "Settings", currentRoute == Screen.Settings.route) {
                navController.navigate(Screen.Settings.route)
            }
        }
    }
}

@Composable
fun NavButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    isActive: Boolean,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable(onClick = onClick)
    ) {
        Icon(
            icon,
            contentDescription = label,
            tint = if (isActive) PrimaryColor else TextSecondary
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = if (isActive) PrimaryColor else TextSecondary,
            fontWeight = if (isActive) FontWeight.SemiBold else FontWeight.Normal
        )
    }
}

private fun formatDate(dateStr: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        val date = inputFormat.parse(dateStr) ?: return dateStr
        val now = Calendar.getInstance()
        val dateCalendar = Calendar.getInstance().apply { time = date }
        
        if (now.get(Calendar.DAY_OF_YEAR) == dateCalendar.get(Calendar.DAY_OF_YEAR)) {
            "Today at ${SimpleDateFormat("h:mm a", Locale.US).format(date)}"
        } else {
            SimpleDateFormat("MMM d, h:mm a", Locale.US).format(date)
        }
    } catch (e: Exception) {
        dateStr
    }
}
