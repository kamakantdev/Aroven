package com.example.swastik.ambulance.ui.screens.emergency

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.swastik.ambulance.data.remote.dto.EmergencyDto
import com.example.swastik.ambulance.ui.components.MapMarkerData
import com.example.swastik.ambulance.ui.components.OsmMapView
import org.osmdroid.util.GeoPoint

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmergencyDetailScreen(
    emergency: EmergencyDto?,
    isLoading: Boolean,
    onBack: () -> Unit,
    onUpdateStatus: (String) -> Unit
) {
    val context = LocalContext.current
    val patientName = emergency?.resolvedPatientName ?: emergency?.patientInfo ?: "Patient details unavailable"
    val patientPhone = emergency?.resolvedPatientPhone

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        emergency?.id?.take(8)?.uppercase() ?: "Emergency Detail",
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFFD32F2F),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { padding ->
        if (isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFFD32F2F))
            }
            return@Scaffold
        }

        if (emergency == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Error, "Error", Modifier.size(64.dp), tint = Color.Gray)
                    Spacer(Modifier.height(16.dp))
                    Text("Emergency not found", color = Color.Gray)
                }
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Status Badge
            StatusBadge(emergency.status)

            OperationalOverviewCard(
                emergency = emergency,
                patientName = patientName,
                patientPhone = patientPhone,
                onCallPatient = patientPhone?.let {
                    {
                        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$it"))
                        context.startActivity(intent)
                    }
                },
                onNavigate = {
                    val geoUri = Uri.parse("geo:${emergency.latitude},${emergency.longitude}?q=${emergency.latitude},${emergency.longitude}(${Uri.encode("Patient Pickup")})")
                    val geoIntent = Intent(Intent.ACTION_VIEW, geoUri)
                    try {
                        if (geoIntent.resolveActivity(context.packageManager) != null) {
                            context.startActivity(geoIntent)
                        } else {
                            val browserUri = Uri.parse("https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${emergency.latitude},${emergency.longitude}#map=15/${emergency.latitude}/${emergency.longitude}")
                            context.startActivity(Intent(Intent.ACTION_VIEW, browserUri))
                        }
                    } catch (_: android.content.ActivityNotFoundException) {
                        val browserUri = Uri.parse("https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${emergency.latitude},${emergency.longitude}")
                        context.startActivity(Intent(Intent.ACTION_VIEW, browserUri))
                    }
                }
            )

            // Emergency Info Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(4.dp)
            ) {
                Column(Modifier.padding(20.dp)) {
                    Text("Emergency Information", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Spacer(Modifier.height(16.dp))

                    InfoRow(Icons.Default.Warning, "Type", emergency.emergencyType ?: "Unspecified")
                    InfoRow(Icons.Default.Flag, "Priority", emergency.priority ?: "Normal")
                    InfoRow(Icons.Default.BroadcastOnPersonal, "Dispatch Mode", emergency.dispatchMode?.replace('_', ' ')?.uppercase() ?: "DIRECT")
                    InfoRow(Icons.Default.Numbers, "Request #", emergency.id.take(8).uppercase())
                    InfoRow(Icons.Default.Schedule, "Created", formatTimestamp(emergency.createdAt))

                    if (!emergency.notes.isNullOrBlank()) {
                        Spacer(Modifier.height(12.dp))
                        Text("Description", fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Color.Gray)
                        Spacer(Modifier.height(4.dp))
                        Text(emergency.notes, fontSize = 14.sp)
                    }
                }
            }

            // Patient Info Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(4.dp)
            ) {
                Column(Modifier.padding(20.dp)) {
                    Text("Patient Information", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Spacer(Modifier.height(16.dp))

                    InfoRow(Icons.Default.Person, "Name", patientName)

                    if (!patientPhone.isNullOrBlank()) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Phone, null, Modifier.size(20.dp), tint = Color.Gray)
                                Spacer(Modifier.width(12.dp))
                                Column {
                                    Text("Phone", fontSize = 12.sp, color = Color.Gray)
                                    Text(patientPhone, fontSize = 14.sp)
                                }
                            }
                            FilledTonalButton(
                                onClick = {
                                    val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$patientPhone"))
                                    context.startActivity(intent)
                                },
                                colors = ButtonDefaults.filledTonalButtonColors(
                                    containerColor = Color(0xFFE8F5E9)
                                )
                            ) {
                                Icon(Icons.Default.Call, null, Modifier.size(16.dp), tint = Color(0xFF2E7D32))
                                Spacer(Modifier.width(4.dp))
                                Text("Call", color = Color(0xFF2E7D32))
                            }
                        }
                    }

                    if (!emergency.requesterName.isNullOrBlank() && emergency.requesterName != patientName) {
                        Spacer(Modifier.height(8.dp))
                        InfoRow(Icons.Default.Badge, "Requester", emergency.requesterName)
                    }
                }
            }

            // Location Card
            if (emergency.latitude != null && emergency.longitude != null) {
                val pickupLatitude = emergency.latitude
                val pickupLongitude = emergency.longitude
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.cardElevation(4.dp)
                ) {
                    Column(Modifier.padding(20.dp)) {
                        Text("Live Pickup Monitoring", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = "Track the latest pickup point and launch navigation instantly.",
                            fontSize = 12.sp,
                            color = Color.Gray
                        )
                        Spacer(Modifier.height(12.dp))

                        // Embedded OSM map showing patient pickup location
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(180.dp),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            OsmMapView(
                                modifier = Modifier.fillMaxSize(),
                                center = GeoPoint(pickupLatitude, pickupLongitude),
                                zoom = 15.0,
                                markers = listOf(
                                    MapMarkerData(
                                        id = "patient",
                                        latitude = pickupLatitude,
                                        longitude = pickupLongitude,
                                        title = "Patient Pickup",
                                        snippet = emergency.address ?: "Pickup Location",
                                        markerColor = android.graphics.Color.parseColor("#D32F2F")
                                    )
                                )
                            )
                        }

                        Spacer(Modifier.height(12.dp))
                        InfoRow(Icons.Default.LocationOn, "Address", emergency.address ?: "Address unavailable")
                        InfoRow(Icons.Default.MyLocation, "Coordinates",
                            "${String.format(java.util.Locale.US, "%.5f", emergency.latitude)}, ${String.format(java.util.Locale.US, "%.5f", emergency.longitude)}")

                        Spacer(Modifier.height(12.dp))
                        Button(
                            onClick = {
                                // Use generic geo: intent — works with OsmAnd, Google Maps, any map app
                                val geoUri = Uri.parse("geo:${emergency.latitude},${emergency.longitude}?q=${emergency.latitude},${emergency.longitude}(${Uri.encode("Patient Pickup")})")
                                val geoIntent = Intent(Intent.ACTION_VIEW, geoUri)
                                try {
                                    if (geoIntent.resolveActivity(context.packageManager) != null) {
                                        context.startActivity(geoIntent)
                                    } else {
                                        // Fallback: OpenStreetMap in browser
                                        val browserUri = Uri.parse("https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${emergency.latitude},${emergency.longitude}#map=15/${emergency.latitude}/${emergency.longitude}")
                                        context.startActivity(Intent(Intent.ACTION_VIEW, browserUri))
                                    }
                                } catch (_: android.content.ActivityNotFoundException) {
                                    val browserUri = Uri.parse("https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${emergency.latitude},${emergency.longitude}")
                                    context.startActivity(Intent(Intent.ACTION_VIEW, browserUri))
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1976D2)),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.Navigation, null, Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Navigate to Pickup")
                        }
                    }
                }
            }

            StatusTimelineCard(currentStatus = emergency.status)

            // Status Action Buttons
            StatusActionButtons(
                currentStatus = emergency.status,
                onUpdateStatus = onUpdateStatus
            )

            Spacer(Modifier.height(16.dp))
        }
    }
}

@Composable
private fun OperationalOverviewCard(
    emergency: EmergencyDto,
    patientName: String,
    patientPhone: String?,
    onCallPatient: (() -> Unit)?,
    onNavigate: (() -> Unit)?
) {
    val priorityColor = when ((emergency.priority ?: "normal").lowercase()) {
        "critical" -> Color(0xFFD32F2F)
        "high" -> Color(0xFFEF6C00)
        else -> Color(0xFF1976D2)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFBFA))
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = patientName,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = emergency.emergencyType ?: "Emergency details pending",
                        color = Color.Gray,
                        fontSize = 14.sp
                    )
                }
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = priorityColor.copy(alpha = 0.12f)
                ) {
                    Text(
                        text = (emergency.priority ?: "normal").uppercase(),
                        color = priorityColor,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AssistChip(
                    onClick = {},
                    enabled = false,
                    label = { Text(emergency.status.replace('_', ' ').uppercase()) },
                    leadingIcon = { Icon(Icons.Default.LocalShipping, null, modifier = Modifier.size(16.dp)) }
                )
                emergency.dispatchMode?.let {
                    AssistChip(
                        onClick = {},
                        enabled = false,
                        label = { Text(it.replace('_', ' ')) },
                        leadingIcon = { Icon(Icons.Default.Radio, null, modifier = Modifier.size(16.dp)) }
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedButton(
                    onClick = { onCallPatient?.invoke() },
                    enabled = onCallPatient != null,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Call, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(if (patientPhone.isNullOrBlank()) "Phone unavailable" else "Call patient")
                }

                Button(
                    onClick = { onNavigate?.invoke() },
                    enabled = onNavigate != null,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1976D2))
                ) {
                    Icon(Icons.Default.Navigation, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Navigate")
                }
            }
        }
    }
}

@Composable
private fun StatusTimelineCard(currentStatus: String) {
    val allStages = listOf(
        "assigned" to "Assigned",
        "accepted" to "Accepted",
        "en_route" to "Drive to patient",
        "arrived" to "At pickup",
        "picked_up" to "Patient onboard",
        "en_route_hospital" to "Drive to hospital",
        "arrived_hospital" to "At hospital",
        "completed" to "Completed"
    )

    val normalized = when (currentStatus.lowercase()) {
        "pending", "requested", "broadcasting" -> "assigned"
        else -> currentStatus.lowercase()
    }
    val activeIndex = allStages.indexOfFirst { it.first == normalized }.coerceAtLeast(0)

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(4.dp)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text("Response Journey", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Spacer(Modifier.height(12.dp))

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                allStages.forEachIndexed { index, (_, label) ->
                    val completed = index <= activeIndex
                    val dotColor = if (completed) Color(0xFFD32F2F) else Color(0xFFE0E0E0)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(14.dp)
                                .clip(CircleShape)
                                .background(dotColor)
                                .border(2.dp, Color.White, CircleShape)
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(
                            text = label,
                            fontSize = 14.sp,
                            fontWeight = if (completed) FontWeight.SemiBold else FontWeight.Normal,
                            color = if (completed) Color(0xFF212121) else Color.Gray
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusBadge(status: String) {
    val (bgColor, textColor, label) = when (status.lowercase()) {
        "pending", "requested" -> Triple(Color(0xFFFFF3E0), Color(0xFFE65100), "⏳ Pending")
        "broadcasting" -> Triple(Color(0xFFFFF8E1), Color(0xFFFF6F00), "📡 Broadcasting")
        "assigned" -> Triple(Color(0xFFE3F2FD), Color(0xFF1565C0), "📋 Assigned")
        "accepted" -> Triple(Color(0xFFE8EAF6), Color(0xFF283593), "✅ Accepted")
        "dispatched" -> Triple(Color(0xFFE3F2FD), Color(0xFF1565C0), "✅ Dispatched")
        "en_route", "enroute" -> Triple(Color(0xFFE8F5E9), Color(0xFF2E7D32), "🚑 En Route")
        "arrived" -> Triple(Color(0xFFF3E5F5), Color(0xFF7B1FA2), "📍 Arrived at Pickup")
        "picked_up" -> Triple(Color(0xFFFFEBEE), Color(0xFFC62828), "🏥 Patient Picked Up")
        "en_route_hospital" -> Triple(Color(0xFFE0F2F1), Color(0xFF00695C), "🏥 En Route to Hospital")
        "arrived_hospital" -> Triple(Color(0xFFE8F5E9), Color(0xFF1B5E20), "✅ Arrived at Hospital")
        "completed" -> Triple(Color(0xFFE0F2F1), Color(0xFF00695C), "✔ Completed")
        "cancelled" -> Triple(Color(0xFFFBE9E7), Color(0xFFBF360C), "✖ Cancelled")
        "timeout" -> Triple(Color(0xFFFFF3E0), Color(0xFFE65100), "⏰ Timed Out")
        "no_ambulance" -> Triple(Color(0xFFFFEBEE), Color(0xFFB71C1C), "⚠ No Ambulance Available")
        else -> Triple(Color(0xFFF5F5F5), Color.Gray, status)
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(bgColor)
            .padding(16.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(label, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = textColor)
    }
}

@Composable
private fun InfoRow(icon: ImageVector, label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, Modifier.size(20.dp), tint = Color.Gray)
        Spacer(Modifier.width(12.dp))
        Column {
            Text(label, fontSize = 12.sp, color = Color.Gray)
            Text(value, fontSize = 14.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun StatusActionButtons(
    currentStatus: String,
    onUpdateStatus: (String) -> Unit
) {
    // Full dispatch lifecycle statuses
    val nextStatuses = when (currentStatus.lowercase()) {
        "pending", "broadcasting", "assigned", "requested" -> listOf("accept" to "Accept Emergency")
        "accepted" -> listOf("en_route" to "Start Route to Patient")
        "en_route", "enroute" -> listOf("arrived" to "Arrived at Pickup")
        "arrived" -> listOf("picked_up" to "Patient Picked Up")
        "picked_up" -> listOf("en_route_hospital" to "En Route to Hospital")
        "en_route_hospital" -> listOf("arrived_hospital" to "Arrived at Hospital")
        "arrived_hospital" -> listOf("completed" to "Complete Trip")
        else -> emptyList()
    }

    if (nextStatuses.isNotEmpty()) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            elevation = CardDefaults.cardElevation(4.dp)
        ) {
            Column(Modifier.padding(20.dp)) {
                Text("Actions", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(12.dp))

                nextStatuses.forEach { (status, label) ->
                    Button(
                        onClick = { onUpdateStatus(status) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFD32F2F)
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(label, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.height(8.dp))
                }
            }
        }
    }
}

private fun formatTimestamp(timestamp: String?): String {
    if (timestamp == null) return "—"
    return try {
        // Simple format: show date and time portion
        val parts = timestamp.split("T")
        if (parts.size >= 2) {
            "${parts[0]}  ${parts[1].take(5)}"
        } else {
            timestamp
        }
    } catch (e: Exception) {
        timestamp
    }
}
