package com.example.swastik.ui.screens.patient.medicine

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
import com.example.swastik.data.remote.dto.MedicineOrderDto
import com.example.swastik.ui.theme.SwastikPurple
import com.example.swastik.ui.viewmodel.MedicineViewModel
import kotlinx.coroutines.flow.collectLatest

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderHistoryScreen(
    onBackClick: () -> Unit,
    viewModel: MedicineViewModel = hiltViewModel()
) {
    val historyState by viewModel.orderHistoryState.collectAsState()
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("All", "Pending", "Confirmed", "Processing", "Delivered", "Cancelled")
    val statusFilters = listOf(null, "pending", "confirmed", "processing", "delivered", "cancelled")
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(Unit) {
        viewModel.loadOrderHistory()
    }

    // Cancel success snackbar
    LaunchedEffect(historyState.cancelSuccess) {
        if (historyState.cancelSuccess) {
            kotlinx.coroutines.delay(2000)
            viewModel.clearOrderHistoryError()
        }
    }

    // Real-time order status update notifications via Socket.IO
    LaunchedEffect(Unit) {
        viewModel.realtimeOrderEvent.collectLatest { update ->
            val statusEmoji = when (update.status) {
                "confirmed" -> "🧾"
                "processing" -> "🔄"
                "ready" -> "📦"
                "delivered" -> "✅"
                "cancelled" -> "❌"
                else -> "📦"
            }
            snackbarHostState.showSnackbar(
                message = "$statusEmoji Order updated: ${update.status.replaceFirstChar { it.uppercase() }}",
                duration = SnackbarDuration.Short
            )
        }
    }

    Scaffold(
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState) { data ->
                Snackbar(
                    snackbarData = data,
                    containerColor = SwastikPurple,
                    contentColor = Color.White,
                    shape = RoundedCornerShape(12.dp)
                )
            }
        },
        topBar = {
            TopAppBar(
                title = { Text("My Orders", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.loadOrderHistory(statusFilters[selectedTab]) }) {
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
                            viewModel.loadOrderHistory(statusFilters[index])
                        },
                        text = { Text(title, fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal) }
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
                        Text("Order cancelled successfully", color = Color(0xFF2E7D32), fontWeight = FontWeight.Medium)
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
                        TextButton(onClick = { viewModel.clearOrderHistoryError() }) {
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
                historyState.orders.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.ShoppingBag, null, tint = Color.Gray, modifier = Modifier.size(64.dp))
                            Spacer(Modifier.height(12.dp))
                            Text("No orders found", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color.Gray)
                            Text("Your medicine orders will appear here", color = Color.Gray, fontSize = 14.sp)
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(historyState.orders, key = { it.id }) { order ->
                            OrderHistoryCard(
                                order = order,
                                onCancel = { viewModel.cancelOrder(order.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OrderHistoryCard(
    order: MedicineOrderDto,
    onCancel: () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val statusColor = when (order.status) {
        "pending" -> Color(0xFFFFA000)
        "confirmed" -> Color(0xFF3949AB)
        "processing" -> Color(0xFF1976D2)
        "ready" -> Color(0xFFFB8C00)
        "dispatched" -> Color(0xFF00897B)
        "delivered" -> Color(0xFF4CAF50)
        "cancelled" -> Color(0xFFE53935)
        else -> Color.Gray
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(2.dp),
        onClick = { expanded = !expanded }
    ) {
        Column(Modifier.padding(16.dp)) {
            // Header row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        order.pharmacy?.name ?: "Pharmacy",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        "Order #${order.id.take(8)}",
                        color = Color.Gray,
                        fontSize = 12.sp
                    )
                }
                // Status badge
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(statusColor.copy(alpha = 0.15f))
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Text(
                        order.status.replaceFirstChar { it.uppercase() },
                        color = statusColor,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.sp
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            // Summary row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Medication, null, tint = SwastikPurple, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("${order.items?.size ?: 0} item(s)", fontSize = 13.sp, color = Color.Gray)
                }
                order.totalAmount?.let {
                    Text("₹${it.toInt()}", fontWeight = FontWeight.Bold, color = SwastikPurple, fontSize = 15.sp)
                }
            }

            // Date
            order.createdAt?.let {
                Spacer(Modifier.height(4.dp))
                Text(formatDateShort(it), fontSize = 12.sp, color = Color.Gray)
            }

            // Expanded details
            AnimatedVisibility(visible = expanded) {
                Column(Modifier.padding(top = 12.dp)) {
                    HorizontalDivider()
                    Spacer(Modifier.height(8.dp))

                    // Items
                    Text("Items:", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    order.items?.forEach { item ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 2.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                "${item.name ?: "Medicine"} × ${item.quantity}",
                                fontSize = 13.sp,
                                modifier = Modifier.weight(1f)
                            )
                            item.subtotal?.let {
                                Text("₹${it.toInt()}", fontSize = 13.sp, color = Color.Gray)
                            } ?: item.price?.let {
                                Text("₹${(it * item.quantity).toInt()}", fontSize = 13.sp, color = Color.Gray)
                            }
                        }
                    }

                    // Delivery address
                    order.deliveryAddress?.let { addr ->
                        Spacer(Modifier.height(8.dp))
                        Row(verticalAlignment = Alignment.Top) {
                            Icon(Icons.Default.LocationOn, null, tint = Color.Gray, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(addr, fontSize = 13.sp, color = Color.Gray)
                        }
                    }

                    // Payment status
                    order.paymentStatus?.let { ps ->
                        Spacer(Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Payment, null, tint = Color.Gray, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Payment: ${ps.replaceFirstChar { it.uppercase() }}", fontSize = 13.sp, color = Color.Gray)
                        }
                    }

                    // Cancel button (only for pending/processing)
                    if (order.status in listOf("pending", "confirmed", "processing")) {
                        Spacer(Modifier.height(12.dp))
                        OutlinedButton(
                            onClick = onCancel,
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFE53935)),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(Icons.Default.Cancel, null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Cancel Order")
                        }
                    }
                }
            }

            // Expand indicator
            Icon(
                if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                "Toggle details",
                tint = Color.Gray,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )
        }
    }
}

private fun formatDateShort(dateStr: String): String {
    return try {
        val parts = dateStr.take(10).split("-")
        if (parts.size == 3) "${parts[2]}/${parts[1]}/${parts[0]}" else dateStr.take(10)
    } catch (_: Exception) { dateStr.take(10) }
}
