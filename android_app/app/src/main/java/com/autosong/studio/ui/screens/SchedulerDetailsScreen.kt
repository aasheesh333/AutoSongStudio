package com.autosong.studio.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.autosong.studio.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SchedulerDetailsScreen(
    navController: NavController,
    schedulerId: String
) {
    // Placeholder - can be expanded later
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Scheduler Details") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BackgroundDark)
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center
        ) {
            Text("Scheduler: $schedulerId")
        }
    }
}
