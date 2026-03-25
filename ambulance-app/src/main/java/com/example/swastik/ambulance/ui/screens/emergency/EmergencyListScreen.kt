package com.example.swastik.ambulance.ui.screens.emergency

import androidx.compose.foundation.clickable
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
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.ambulance.data.remote.dto.EmergencyDto
import com.example.swastik.ambulance.ui.viewmodel.DashboardViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmergencyListScreen(
    onBack: () -> Unit,
    onEmergencyDetail: (String) -> Unit,
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val state by viewModel.emergencyListState.collectAsState()
    var selectedFilter by remember { mutableStateOf("all") }

    LaunchedEffect(Unit) {
        viewModel.loadEmergencyHistory()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Emergencies", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadEmergencyHistory(
                        if (selectedFilter == "all") null else selectedFilter
                    ) }) {
                        Icon(Icons.Default.Refresh, "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFFD32F2F),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // Filter chips
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf("all" to "All", "active" to "Active", "completed" to "Completed").forEach { (key, label) ->
                    FilterChip(
                        selected = selectedFilter == key,
                        onClick = {
                            selectedFilter = key
                            viewModel.loadEmergencyHistory(if (key == "all") null else key)
                        },
                        label = { Text(label) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Color(0xFFD32F2F),
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }

            if (state.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Color(0xFFD32F2F))
                }
            } else if (state.emergencies.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Inbox,
                            null,
                            modifier = Modifier.size(64.dp),
                            tint = Color.Gray
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("No emergencies found", color = Color.Gray)
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(state.emergencies) { emergency ->
                        EmergencyListItem(
                            emergency = emergency,
                            onClick = { onEmergencyDetail(emergency.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EmergencyListItem(
    emergency: EmergencyDto,
    onClick: () -> Unit
) {
    val statusColor = when (emergency.status) {
        "completed" -> Color(0xFF4CAF50)
        "cancelled" -> Color.Gray
        "en_route", "transporting" -> Color(0xFF2196F3)
        else -> Color(0xFFFF9800)
    }

    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Warning,
                null,
                tint = statusColor,
                modifier = Modifier.size(40.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    emergency.emergencyType ?: "Emergency",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
                if (emergency.patientName != null) {
                    Text(emergency.patientName, fontSize = 14.sp, color = Color.Gray)
                }
                if (emergency.address != null) {
                    Text(
                        emergency.address,
                        fontSize = 13.sp,
                        color = Color.Gray,
                        maxLines = 1
                    )
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    emergency.status.replace("_", " ").uppercase(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = statusColor
                )
                emergency.createdAt?.take(10)?.let {
                    Text(it, fontSize = 11.sp, color = Color.Gray)
                }
            }
        }
    }
}
