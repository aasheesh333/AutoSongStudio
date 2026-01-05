package com.autosong.studio.ui.screens

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
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
import com.autosong.studio.navigation.Screen
import com.autosong.studio.ui.theme.*
import com.autosong.studio.ui.viewmodel.AppViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    navController: NavController,
    viewModel: AppViewModel = hiltViewModel()
) {
    val currentUser by viewModel.currentUser.collectAsState()
    val selectedChannel by viewModel.selectedChannel.collectAsState()
    var sunoKeyInput by remember { mutableStateOf(currentUser?.sunoApiKey ?: "") }
    var showSunoDialog by remember { mutableStateOf(false) }
    val isLoading by viewModel.isLoading.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BackgroundDark)
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            BottomNavBar(navController = navController, currentRoute = Screen.Settings.route)
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // User Profile Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    selectedChannel?.let { channel ->
                        AsyncImage(
                            model = channel.thumbnailUrl,
                            contentDescription = null,
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape),
                            contentScale = ContentScale.Crop
                        )
                    } ?: Box(
                        modifier = Modifier
                            .size(56.dp)
                            .background(SurfaceHighlight, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Person, contentDescription = null)
                    }

                    Spacer(modifier = Modifier.width(16.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = selectedChannel?.title ?: "User",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = currentUser?.email ?: "",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Surface(
                            color = if (currentUser?.isPro == true) Success.copy(alpha = 0.1f) else Warning.copy(alpha = 0.1f),
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                text = if (currentUser?.isPro == true) "PRO" else "FREE",
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                color = if (currentUser?.isPro == true) Success else Warning,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // Suno API Key
            Text("API Settings", style = MaterialTheme.typography.titleMedium)

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { showSunoDialog = true },
                colors = CardDefaults.cardColors(containerColor = SurfaceDark),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.05f))
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Key, contentDescription = null, tint = PrimaryColor)
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Suno API Key", style = MaterialTheme.typography.titleSmall)
                        Text(
                            text = if (currentUser?.sunoApiKey.isNullOrEmpty()) "Not configured" else "••••••••••",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondary
                        )
                    }
                    Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextSecondary)
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Sign Out Button
            OutlinedButton(
                onClick = {
                    viewModel.signOut {
                        navController.navigate(Screen.SignIn.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Error),
                border = BorderStroke(1.dp, Error)
            ) {
                Icon(Icons.Default.Logout, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Sign Out")
            }

            Text(
                "Version 1.0.3",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )
        }
    }

    // Suno Key Dialog
    if (showSunoDialog) {
        AlertDialog(
            onDismissRequest = { showSunoDialog = false },
            title = { Text("Suno API Key") },
            text = {
                Column {
                    Text(
                        "Enter your Suno API key to enable AI music generation.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    OutlinedTextField(
                        value = sunoKeyInput,
                        onValueChange = { sunoKeyInput = it },
                        label = { Text("API Key") },
                        placeholder = { Text("sk-...") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.updateSunoKey(
                            sunoKeyInput,
                            onSuccess = {
                                showSunoDialog = false
                            },
                            onError = { }
                        )
                    },
                    enabled = !isLoading && sunoKeyInput.isNotBlank()
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    } else {
                        Text("Save")
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { showSunoDialog = false }) {
                    Text("Cancel")
                }
            },
            containerColor = SurfaceDark
        )
    }
}
