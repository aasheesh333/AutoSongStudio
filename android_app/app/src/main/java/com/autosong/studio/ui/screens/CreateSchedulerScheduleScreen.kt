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
fun CreateSchedulerScheduleScreen(
    navController: NavController,
    viewModel: AppViewModel = hiltViewModel()
) {
    val createData by viewModel.createSchedulerData.collectAsState()
    var name by remember { mutableStateOf(createData.name.ifEmpty { "My Scheduler" }) }
    var time by remember { mutableStateOf(createData.time) }
    var frequency by remember { mutableStateOf(createData.frequency) }
    var selectedDays by remember { mutableStateOf(createData.activeDays.toMutableSet()) }
    var language by remember { mutableStateOf(createData.language) }

    val frequencies = listOf("daily", "weekly", "monthly")
    val days = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
    val languages = listOf("Hindi", "English", "Punjabi", "Tamil", "Telugu", "Bengali")

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Schedule Settings") },
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
                progress = { 0.75f },
                modifier = Modifier.fillMaxWidth(),
                color = PrimaryColor,
                trackColor = SurfaceHighlight
            )

            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                Text("Set Your Schedule", style = MaterialTheme.typography.titleLarge)

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Scheduler Name") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                // Frequency
                Text("Frequency", style = MaterialTheme.typography.titleSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    frequencies.forEach { freq ->
                        FilterChip(
                            selected = frequency == freq,
                            onClick = { frequency = freq },
                            label = { Text(freq.replaceFirstChar { it.uppercase() }) }
                        )
                    }
                }

                // Days (for weekly)
                if (frequency == "weekly") {
                    Text("Active Days", style = MaterialTheme.typography.titleSmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        days.forEachIndexed { index, day ->
                            FilterChip(
                                selected = index in selectedDays,
                                onClick = {
                                    selectedDays = if (index in selectedDays) {
                                        selectedDays.toMutableSet().apply { remove(index) }
                                    } else {
                                        selectedDays.toMutableSet().apply { add(index) }
                                    }
                                },
                                label = { Text(day) }
                            )
                        }
                    }
                }

                // Time
                Text("Upload Time", style = MaterialTheme.typography.titleSmall)
                OutlinedTextField(
                    value = time,
                    onValueChange = { time = it },
                    label = { Text("Time (HH:MM)") },
                    placeholder = { Text("12:00") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                // Language
                Text("Language", style = MaterialTheme.typography.titleSmall)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.horizontalScroll(rememberScrollState())
                ) {
                    languages.forEach { lang ->
                        FilterChip(
                            selected = language == lang,
                            onClick = { language = lang },
                            label = { Text(lang) }
                        )
                    }
                }
            }

            Button(
                onClick = {
                    viewModel.updateCreateSchedulerSchedule(
                        name = name,
                        time = time,
                        frequency = frequency,
                        activeDays = selectedDays.toList().sorted(),
                        language = language
                    )
                    navController.navigate(Screen.CreateSchedulerReview.route)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                enabled = name.isNotBlank(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Review", fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.width(8.dp))
                Icon(Icons.Default.ArrowForward, contentDescription = null)
            }
        }
    }
}
