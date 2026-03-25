package com.example.swastik.ui.screens.consultation

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.swastik.ui.theme.SwastikPurple
import kotlin.math.cos
import kotlin.math.sin

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConsultationPrepareScreen(
    userName: String = "Gurpreet",
    doctorName: String = "Doctor",
    isConnecting: Boolean = false,
    statusMessage: String = "",
    onBackClick: () -> Unit,
    onStartConsultation: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Consultation Prepare",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 18.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { }) {
                        Icon(Icons.Default.Search, contentDescription = "Search")
                    }
                    Box {
                        IconButton(onClick = { }) {
                            Icon(Icons.Default.Notifications, contentDescription = "Notifications")
                        }
                        // Notification badge
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(Color.Red, CircleShape)
                                .align(Alignment.TopEnd)
                                .offset(x = (-8).dp, y = 8.dp)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.White
                )
            )
        },
        containerColor = Color.White
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Clock Icon with decorative elements
            ClockIcon()

            Spacer(modifier = Modifier.height(32.dp))

            // Greeting Text
            Text(
                text = buildAnnotatedString {
                    append("Hello, ")
                    withStyle(style = SpanStyle(fontWeight = FontWeight.Bold)) {
                        append("$userName!")
                    }
                },
                fontSize = 24.sp,
                color = Color.Black
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Description Text
            Text(
                text = "We will record your conversation with the doctor, useful for your history, in case you want to view the video again at a later time.",
                fontSize = 14.sp,
                color = Color.Gray,
                textAlign = TextAlign.Center,
                lineHeight = 22.sp,
                modifier = Modifier.padding(horizontal = 16.dp)
            )

            Spacer(modifier = Modifier.height(40.dp))

            // Start Consultation Button
            Button(
                onClick = onStartConsultation,
                enabled = !isConnecting,
                modifier = Modifier
                    .fillMaxWidth(0.9f)
                    .height(56.dp),
                shape = RoundedCornerShape(28.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = SwastikPurple,
                    disabledContainerColor = SwastikPurple.copy(alpha = 0.6f)
                )
            ) {
                if (isConnecting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = statusMessage.ifEmpty { "Connecting..." },
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.White
                    )
                } else {
                    Text(
                        text = "Start Consultation with $doctorName",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

@Composable
private fun ClockIcon() {
    Box(
        modifier = Modifier.size(160.dp),
        contentAlignment = Alignment.Center
    ) {
        // Decorative sparkles
        Canvas(modifier = Modifier.fillMaxSize()) {
            val sparkleColor = SwastikPurple

            // Top right sparkle
            drawCircle(
                color = sparkleColor,
                radius = 6.dp.toPx(),
                center = Offset(size.width * 0.85f, size.height * 0.15f)
            )

            // Small sparkles
            drawCircle(
                color = sparkleColor,
                radius = 3.dp.toPx(),
                center = Offset(size.width * 0.75f, size.height * 0.22f)
            )

            // Bottom left sparkle
            drawCircle(
                color = sparkleColor,
                radius = 4.dp.toPx(),
                center = Offset(size.width * 0.12f, size.height * 0.7f)
            )
        }

        // Outer ring (light purple)
        Box(
            modifier = Modifier
                .size(140.dp)
                .clip(CircleShape)
                .background(SwastikPurple.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            // Inner clock circle
            Box(
                modifier = Modifier
                    .size(100.dp)
                    .clip(CircleShape)
                    .background(SwastikPurple),
                contentAlignment = Alignment.Center
            ) {
                // Clock hands
                Canvas(modifier = Modifier.size(60.dp)) {
                    val center = Offset(size.width / 2, size.height / 2)
                    val hourHandLength = size.width * 0.25f
                    val minuteHandLength = size.width * 0.35f

                    // Hour hand (pointing to ~10)
                    val hourAngle = Math.toRadians(-60.0)
                    drawLine(
                        color = Color.White,
                        start = center,
                        end = Offset(
                            center.x + (hourHandLength * cos(hourAngle)).toFloat(),
                            center.y + (hourHandLength * sin(hourAngle)).toFloat()
                        ),
                        strokeWidth = 4.dp.toPx(),
                        cap = StrokeCap.Round
                    )

                    // Minute hand (pointing to ~6)
                    val minuteAngle = Math.toRadians(90.0)
                    drawLine(
                        color = Color.White,
                        start = center,
                        end = Offset(
                            center.x + (minuteHandLength * cos(minuteAngle)).toFloat(),
                            center.y + (minuteHandLength * sin(minuteAngle)).toFloat()
                        ),
                        strokeWidth = 4.dp.toPx(),
                        cap = StrokeCap.Round
                    )

                    // Center dot
                    drawCircle(
                        color = Color.White,
                        radius = 4.dp.toPx(),
                        center = center
                    )
                }
            }
        }
    }
}
