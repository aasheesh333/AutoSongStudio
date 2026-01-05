package com.autosong.studio.ui.screens

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.autosong.studio.data.models.Scheduler
import com.autosong.studio.navigation.Screen
import com.autosong.studio.ui.theme.*
import com.autosong.studio.ui.viewmodel.AppViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SchedulersScreen(
    navController: NavController,
    viewModel: AppViewModel = hiltViewModel()
) {
    val schedulers by viewModel.schedulers.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadSchedulers()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Schedulers") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BackgroundDark)
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = {
                    viewModel.resetCreateSchedulerData()
                    navController.navigate(Screen.CreateSchedulerGenres.route)
                },
                containerColor = PrimaryColor,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("New Scheduler", fontWeight = FontWeight.Bold)
            }
        },
        bottomBar = {
            BottomNavBar(navController = navController, currentRoute = Screen.Schedulers.route)
        }
    ) { padding ->
        if (schedulers.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.Schedule,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = TextSecondary
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        "No Schedulers Yet",
                        style = MaterialTheme.typography.titleMedium,
                        color = TextSecondary
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Create your first scheduler to automate uploads",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(schedulers) { scheduler ->
                    SchedulerCard(
                        scheduler = scheduler,
                        onClick = { navController.navigate(Screen.SchedulerDetails.createRoute(scheduler.id)) },
                        onToggle = { viewModel.toggleScheduler(scheduler.id) }
                    )
                }
            }
        }
    }
}

@Composable
fun SchedulerCard(
    scheduler: Scheduler,
    onClick: () -> Unit,
    onToggle: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = SurfaceDark),
        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = scheduler.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Switch(
                    checked = scheduler.active,
                    onCheckedChange = { onToggle() },
                    colors = SwitchDefaults.colors(checkedTrackColor = PrimaryColor)
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Genres chips
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                scheduler.genres.take(3).forEach { genre ->
                    Surface(
                        color = PrimaryColor.copy(alpha = 0.1f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            text = genre,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            style = MaterialTheme.typography.bodySmall,
                            color = PrimaryColor
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Schedule info
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Schedule,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = TextSecondary
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = scheduler.frequencyDisplay,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )
            }

            // Error message if any
            scheduler.error?.let { error ->
                Spacer(modifier = Modifier.height(8.dp))
                Surface(
                    color = Error.copy(alpha = 0.1f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Error,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = Error
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = error,
                            style = MaterialTheme.typography.bodySmall,
                            color = Error,
                            maxLines = 2
                        )
                    }
                }
            }
        }
    }
}
