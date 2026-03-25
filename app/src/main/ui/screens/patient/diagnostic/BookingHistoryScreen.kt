package com.example.swastik.ui.screens.patient.diagnostic

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.data.remote.dto.DiagnosticBookingDto
import com.example.swastik.ui.theme.SwastikPurple
import com.example.swastik.ui.viewmodel.DiagnosticViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookingHistoryScreen(
    onBackClick: () -> Unit,
    viewModel: DiagnosticViewModel = hiltViewModel()
) {
    val historyState by viewModel.bookingHistoryState.collectAsState()
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("All", "Booked", "Sample Collected", "Processing", "Completed", "Cancelled")
    val statusFilters = listOf(null, "booked", "sample_collected", "processing", "completed", "cancelled")

    LaunchedEffect(Unit) {
        viewModel.loadBookingHistory()
    }

    LaunchedEffect(historyState.cancelSuccess) {
        if (historyState.cancelSuccess) {
            kotlinx.coroutines.delay(2000)
            viewModel.clearBookingHistoryError()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("My Bookings", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadBookingHistory(statusFilters[selectedTab]) }) {
                        Icon(Icons.Default.Refresh, "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = SwastikPurple,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Tab filter row
            ScrollableTabRow(
                selectedTabIndex = selectedTab,
                containerColor = SwastikPurple.copy(alpha = 0.05f),
                contentColor = SwastikPurple,
                edgePadding = 8.dp
            ) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = {
                            selectedTab = index
                            viewModel.loadBookingHistory(statusFilters[index])
                        },
                        text = { Text(title, fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal, fontSize = 13.sp) }
                    )
                }
            }

            // Cancel success banner
            AnimatedVisibility(visible = historyState.cancelSuccess) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFE8F5E9)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.CheckCircle, null, tint = Color(0xFF4CAF50))
                        Spacer(Modifier.width(8.dp))
                        Text("Booking cancelled successfully", color = Color(0xFF2E7D32), fontWeight = FontWeight.Medium)
                    }
                }
            }

            // Error banner
            historyState.error?.let { error ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFEBEE)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Error, null, tint = Color(0xFFE53935))
                        Spacer(Modifier.width(8.dp))
                        Text(error, color = Color(0xFFC62828), modifier = Modifier.weight(1f))
                        TextButton(onClick = { viewModel.clearBookingHistoryError() }) {
                            Text("Dismiss")
                        }
                    }
                }
            }

            when {
                historyState.isLoading -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = SwastikPurple)
                    }
                }
                historyState.bookings.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.Science, null, tint = Color.Gray, modifier = Modifier.size(64.dp))
                            Spacer(Modifier.height(12.dp))
                            Text("No bookings found", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color.Gray)
                            Text("Your diagnostic bookings will appear here", color = Color.Gray, fontSize = 14.sp)
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(historyState.bookings, key = { it.id }) { booking ->
                            BookingHistoryCard(
                                booking = booking,
                                onCancel = { viewModel.cancelBooking(booking.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BookingHistoryCard(
    booking: DiagnosticBookingDto,
    onCancel: () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val statusColor = when (booking.status) {
        "booked" -> Color(0xFF1976D2)
        "sample_collected" -> Color(0xFFFFA000)
        "processing" -> Color(0xFF7B1FA2)
        "completed" -> Color(0xFF4CAF50)
        "cancelled" -> Color(0xFFE53935)
        else -> Color.Gray
    }
    val statusLabel = when (booking.status) {
        "booked" -> "Booked"
        "sample_collected" -> "Sample Collected"
        "processing" -> "Processing"
        "completed" -> "Completed"
        "cancelled" -> "Cancelled"
        else -> booking.status?.replaceFirstChar { it.uppercase() } ?: "Unknown"
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(2.dp),
        onClick = { expanded = !expanded }
    ) {
        Column(Modifier.padding(16.dp)) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        booking.test?.name ?: "Diagnostic Test",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        booking.center?.name ?: "Diagnostic Center",
                        color = Color.Gray,
                        fontSize = 13.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(statusColor.copy(alpha = 0.15f))
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Text(statusLabel, color = statusColor, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                }
            }

            Spacer(Modifier.height(8.dp))

            // Date & price row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CalendarMonth, null, tint = SwastikPurple, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(
                        formatBookingDate(booking.bookingDate),
                        fontSize = 13.sp,
                        color = Color.Gray
                    )
                    booking.bookingTime?.let {
                        Text(" at $it", fontSize = 13.sp, color = Color.Gray)
                    }
                }
                booking.test?.price?.let {
                    Text("₹${it.toInt()}", fontWeight = FontWeight.Bold, color = SwastikPurple, fontSize = 15.sp)
                }
            }

            // Expanded details
            AnimatedVisibility(visible = expanded) {
                Column(Modifier.padding(top = 12.dp)) {
                    HorizontalDivider()
                    Spacer(Modifier.height(8.dp))

                    // Collection type
                    booking.collectionType?.let { ct ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.LocalShipping, null, tint = Color.Gray, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(
                                "Collection: ${ct.replace("_", " ").replaceFirstChar { it.uppercase() }}",
                                fontSize = 13.sp,
                                color = Color.Gray
                            )
                        }
                        Spacer(Modifier.height(4.dp))
                    }

                    // Test category
                    booking.test?.category?.let { cat ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Category, null, tint = Color.Gray, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Category: $cat", fontSize = 13.sp, color = Color.Gray)
                        }
                        Spacer(Modifier.height(4.dp))
                    }

                    // Report time
                    booking.test?.reportTime?.let { rt ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Timer, null, tint = Color.Gray, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Report: $rt", fontSize = 13.sp, color = Color.Gray)
                        }
                        Spacer(Modifier.height(4.dp))
                    }

                    // Result status
                    booking.resultStatus?.let { rs ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Assignment, null, tint = Color.Gray, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Result: ${rs.replaceFirstChar { it.uppercase() }}", fontSize = 13.sp, color = Color.Gray)
                        }
                        Spacer(Modifier.height(4.dp))
                    }

                    // Notes
                    booking.notes?.let { notes ->
                        Row(verticalAlignment = Alignment.Top) {
                            Icon(Icons.Default.Notes, null, tint = Color.Gray, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(notes, fontSize = 13.sp, color = Color.Gray)
                        }
                        Spacer(Modifier.height(4.dp))
                    }

                    // Center phone
                    booking.center?.phone?.let { phone ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Phone, null, tint = Color.Gray, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(phone, fontSize = 13.sp, color = Color.Gray)
                        }
                        Spacer(Modifier.height(4.dp))
                    }

                    // Cancel button (only for booked status)
                    if (booking.status == "booked") {
                        Spacer(Modifier.height(12.dp))
                        OutlinedButton(
                            onClick = onCancel,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFE53935)),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(Icons.Default.Cancel, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Cancel Booking")
                        }
                    }
                }
            }

            // Expand toggle
            Icon(
                if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                "Toggle details",
                tint = Color.Gray,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )
        }
    }
}

private fun formatBookingDate(dateStr: String?): String {
    if (dateStr == null) return "N/A"
    return try {
        val parts = dateStr.take(10).split("-")
        if (parts.size == 3) "${parts[2]}/${parts[1]}/${parts[0]}" else dateStr.take(10)
    } catch (_: Exception) { dateStr.take(10) }
}
