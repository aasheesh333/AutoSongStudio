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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.autosong.studio.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlanSelectionScreen(
    navController: NavController
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Choose Your Plan") },
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
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Free Plan
            PlanCard(
                title = "Free",
                price = "$0",
                period = "/month",
                features = listOf(
                    "1 Scheduler",
                    "10 Videos/month",
                    "Bring your own Suno API key",
                    "Basic support"
                ),
                isPro = false,
                onSelect = { navController.popBackStack() }
            )

            // Pro Plan
            PlanCard(
                title = "Pro",
                price = "$19",
                period = "/month",
                features = listOf(
                    "Unlimited Schedulers",
                    "Unlimited Videos",
                    "Included Suno API credits",
                    "Priority support",
                    "Advanced analytics"
                ),
                isPro = true,
                onSelect = { /* Payment flow */ }
            )

            Text(
                "Plans can be changed anytime. Cancel at any time.",
                style = MaterialTheme.typography.bodySmall,
                color = TextSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun PlanCard(
    title: String,
    price: String,
    period: String,
    features: List<String>,
    isPro: Boolean,
    onSelect: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isPro) PrimaryColor.copy(alpha = 0.1f) else SurfaceDark
        ),
        border = BorderStroke(
            2.dp,
            if (isPro) PrimaryColor else Color.White.copy(alpha = 0.05f)
        )
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            if (isPro) {
                Surface(
                    color = PrimaryColor,
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        "RECOMMENDED",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            
            Row(verticalAlignment = Alignment.Bottom) {
                Text(price, style = MaterialTheme.typography.displayMedium, fontWeight = FontWeight.ExtraBold)
                Text(period, style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
            }

            Spacer(modifier = Modifier.height(16.dp))

            features.forEach { feature ->
                Row(
                    modifier = Modifier.padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Check,
                        contentDescription = null,
                        tint = if (isPro) PrimaryColor else Success,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(feature, style = MaterialTheme.typography.bodyMedium)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = onSelect,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isPro) PrimaryColor else SurfaceHighlight
                )
            ) {
                Text(if (isPro) "Upgrade to Pro" else "Continue with Free")
            }
        }
    }
}
