package com.example.swastik.ui.screens.patient.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.swastik.data.model.NotificationItem
import com.example.swastik.data.model.NotificationType
import com.example.swastik.ui.theme.SwastikPurple


@Composable
fun NotificationPanelDialog(
    notifications: List<NotificationItem>,
    onDismiss: () -> Unit,
    onMarkAllRead: () -> Unit = {},
    onMarkAsRead: (String) -> Unit = {}
) {

    var selectedFilter by remember { mutableStateOf("All") }
    val filters = listOf("All", "Unread", "Appointments", "Medicines", "Reports")

    val filteredNotifications = notifications.filter { notification ->
        when (selectedFilter) {
            "All" -> true
            "Unread" -> !notification.isRead
            "Appointments" -> notification.type == NotificationType.APPOINTMENT
            "Medicines" -> notification.type == NotificationType.MEDICINE_REMINDER
            "Reports" -> notification.type == NotificationType.REPORT_READY
            else -> true
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier
            .fillMaxWidth()
            .fillMaxHeight(0.85f),
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Notifications", fontWeight = FontWeight.Bold, fontSize = 20.sp)
                Row {
                    IconButton(onClick = { onMarkAllRead() }) {
                        Icon(Icons.Outlined.DoneAll, contentDescription = "Mark all read", tint = SwastikPurple)
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Outlined.Settings, contentDescription = "Settings", tint = Color.Gray)
                    }
                }
            }
        },
        text = {
            Column {
                // Filter Chips
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(bottom = 16.dp)
                ) {
                    items(filters) { filter ->
                        FilterChip(
                            selected = selectedFilter == filter,
                            onClick = { selectedFilter = filter },
                            label = { Text(filter, fontSize = 12.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = SwastikPurple,
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                }

                // Notifications List
                if (filteredNotifications.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Outlined.Notifications,
                                contentDescription = null,
                                tint = Color.LightGray,
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("No notifications", color = Color.Gray, fontSize = 14.sp)
                        }
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(filteredNotifications) { notification ->
                            NotificationCard(
                                notification = notification,
                                onMarkAsRead = onMarkAsRead
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        }
    )
}

@Composable
private fun NotificationCard(
    notification: NotificationItem,
    onMarkAsRead: (String) -> Unit = {}
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                if (!notification.isRead) {
                    onMarkAsRead(notification.id)
                }
            },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (notification.isRead) Color.White else SwastikPurple.copy(alpha = 0.05f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = if (notification.isRead) 1.dp else 2.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(getNotificationTypeColor(notification.type).copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = getNotificationTypeIcon(notification.type),
                    contentDescription = null,
                    tint = getNotificationTypeColor(notification.type),
                    modifier = Modifier.size(20.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = notification.title,
                        fontSize = 14.sp,
                        fontWeight = if (notification.isRead) FontWeight.Normal else FontWeight.SemiBold,
                        color = Color.Black
                    )
                    if (!notification.isRead) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(SwastikPurple, CircleShape)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = notification.message,
                    fontSize = 12.sp,
                    color = Color.Gray,
                    lineHeight = 16.sp
                )

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = notification.time,
                        fontSize = 11.sp,
                        color = Color.LightGray
                    )

                    if (notification.actionLabel != null) {
                        TextButton(
                            onClick = { onMarkAsRead(notification.id) },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                        ) {
                            Text(
                                text = notification.actionLabel,
                                fontSize = 12.sp,
                                color = SwastikPurple,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun getNotificationTypeIcon(type: NotificationType) = when (type) {
    NotificationType.APPOINTMENT -> Icons.Outlined.Event
    NotificationType.MEDICINE_REMINDER -> Icons.Outlined.Medication
    NotificationType.REPORT_READY -> Icons.Outlined.Description
    NotificationType.PRESCRIPTION -> Icons.Outlined.Receipt
    NotificationType.OFFER -> Icons.Outlined.LocalOffer
    NotificationType.SYSTEM -> Icons.Outlined.Info
}

private fun getNotificationTypeColor(type: NotificationType) = when (type) {
    NotificationType.APPOINTMENT -> Color(0xFF2196F3)
    NotificationType.MEDICINE_REMINDER -> Color(0xFF4CAF50)
    NotificationType.REPORT_READY -> Color(0xFFFF9800)
    NotificationType.PRESCRIPTION -> Color(0xFF6C63FF)
    NotificationType.OFFER -> Color(0xFFE91E63)
    NotificationType.SYSTEM -> Color.Gray
}


