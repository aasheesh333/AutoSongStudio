package com.autosong.studio.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.autosong.studio.navigation.Screen
import com.autosong.studio.ui.theme.*
import com.autosong.studio.ui.viewmodel.AppViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    navController: NavController,
    viewModel: AppViewModel = hiltViewModel()
) {
    val videos by viewModel.videos.collectAsState()
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("All", "Ready", "Uploaded", "Failed")

    LaunchedEffect(Unit) {
        viewModel.loadVideos()
    }

    val filteredVideos = when (selectedTab) {
        1 -> videos.filter { it.isReady }
        2 -> videos.filter { it.isUploaded }
        3 -> videos.filter { it.isFailed }
        else -> videos
    }.sortedByDescending { it.createdAt }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Library") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BackgroundDark)
            )
        },
        bottomBar = {
            BottomNavBar(navController = navController, currentRoute = Screen.Library.route)
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Tabs
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = SurfaceDark,
                contentColor = PrimaryColor
            ) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = { Text(title) }
                    )
                }
            }

            if (filteredVideos.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
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
                        Text("No videos found", color = TextSecondary)
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(filteredVideos) { video ->
                        VideoCard(
                            video = video,
                            onClick = { navController.navigate(Screen.SongDetail.createRoute(video.id)) }
                        )
                    }
                }
            }
        }
    }
}
