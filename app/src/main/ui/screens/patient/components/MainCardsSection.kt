package com.example.swastik.ui.screens.patient.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.swastik.ui.theme.*

// ==================== MAIN CARDS SECTION ====================
@Composable
fun MainCardsSection(
    onStartVideoConsultation: () -> Unit = {},
    onNavigateToAppointments: () -> Unit = {},
    onNavigateToReports: () -> Unit = {}
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Video Consultation Card (Large)
        Card(
            modifier = Modifier
                .weight(1.2f)
                .height(200.dp)
                .clickable { onStartVideoConsultation() },
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = CardBlue)
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .background(Color.White.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                            .padding(horizontal = 12.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "Today",
                            fontSize = 11.sp,
                            color = Color.White,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = "Video Consultation",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Outlined.CalendarMonth,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Schedule Now", fontSize = 12.sp, color = Color.White)
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Outlined.AccessTime,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("24/7 Available", fontSize = 12.sp, color = Color.White)
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Bottom
                    ) {
                        Column {
                            Text(
                                text = "Your Doctor",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Text(
                                text = "Video Consult",
                                fontSize = 11.sp,
                                color = Color.White.copy(alpha = 0.8f)
                            )
                        }

                        Box(
                            modifier = Modifier
                                .size(50.dp)
                                .border(2.dp, Color.White, CircleShape)
                                .clip(CircleShape)
                                .background(SwastikPurple.copy(alpha = 0.3f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("🩺", fontSize = 24.sp)
                        }
                    }
                }
            }
        }

        // Right Side Cards
        Column(
            modifier = Modifier.weight(0.8f),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Reports Card - Yellow with Document Icon
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(94.dp)
                    .clickable { onNavigateToReports() },
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = CardYellow)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(14.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color.White.copy(alpha = 0.25f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Outlined.Description,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Spacer(modifier = Modifier.weight(1f))
                    Text(
                        "Reports",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        "History",
                        fontSize = 11.sp,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                }
            }

            // Appointment Card - Orange
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(94.dp)
                    .clickable { onNavigateToAppointments() },
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = CardOrange)
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(14.dp)
                ) {
                    Icon(
                        Icons.Outlined.Schedule,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.weight(1f))
                    Text("Appointment", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    Text("History", fontSize = 11.sp, color = Color.White.copy(alpha = 0.8f))
                }
            }
        }
    }
}

// ==================== REPORTS & PRESCRIPTIONS QUICK ACCESS (Legacy - not used) ====================
@Composable
fun ReportsAndPrescriptionsSection() {
    Column(modifier = Modifier.padding(horizontal = 20.dp)) {
        Text(
            text = "My Health Records",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = Color.Black
        )

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            ReportQuickAccessCard(
                modifier = Modifier.weight(1f),
                onClick = { }
            )
            PrescriptionQuickAccessCard(
                modifier = Modifier.weight(1f),
                onClick = { }
            )
        }
    }
}

@Composable
private fun ReportQuickAccessCard(
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier
            .height(120.dp)
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = CardYellow),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.White.copy(alpha = 0.25f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Outlined.Description,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            Text(
                text = "Reports",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Text(
                text = "History",
                fontSize = 12.sp,
                color = Color.White.copy(alpha = 0.8f)
            )
        }
    }
}

@Composable
private fun PrescriptionQuickAccessCard(
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        modifier = modifier
            .height(120.dp)
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = BorderStroke(1.dp, Color.LightGray.copy(alpha = 0.5f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .border(1.5.dp, Color.LightGray, CircleShape)
                    .clip(CircleShape)
                    .background(Color.White),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Outlined.Receipt,
                    contentDescription = null,
                    tint = Color.Gray,
                    modifier = Modifier.size(26.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "Prescription",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = Color.Black
            )
        }
    }
}
