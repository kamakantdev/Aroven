package com.example.swastik.ui.screens.patient.profile

import android.content.Intent
import android.graphics.Bitmap
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.swastik.data.model.*
import com.example.swastik.ui.theme.*
import com.example.swastik.ui.viewmodel.PatientDashboardViewModel
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter

// ==================== FEEDBACK DIALOG ====================

@Composable
fun FeedbackDialog(onDismiss: () -> Unit) {
    var feedback by remember { mutableStateOf("") }
    var rating by remember { mutableIntStateOf(0) }
    val context = LocalContext.current

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Feedback, null, tint = SwastikPurple)
                Spacer(Modifier.width(8.dp))
                Text("Send Feedback", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("How would you rate your experience?", fontSize = 14.sp, color = Color.Gray)
                Row(
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    (1..5).forEach { star ->
                        IconButton(onClick = { rating = star }) {
                            Icon(
                                if (star <= rating) Icons.Default.Star else Icons.Outlined.StarBorder,
                                contentDescription = "Star $star",
                                tint = if (star <= rating) Color(0xFFFFC107) else Color.Gray,
                                modifier = Modifier.size(36.dp)
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = feedback,
                    onValueChange = { feedback = it },
                    label = { Text("Your feedback") },
                    modifier = Modifier.fillMaxWidth().height(120.dp),
                    shape = RoundedCornerShape(12.dp),
                    maxLines = 5
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    Toast.makeText(context, "Thank you for your feedback!", Toast.LENGTH_SHORT).show()
                    onDismiss()
                },
                enabled = rating > 0,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
            ) { Text("Submit") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        shape = RoundedCornerShape(20.dp)
    )
}

// ==================== HELP CENTER DIALOG ====================

@Composable
fun HelpCenterDialog(onDismiss: () -> Unit) {
    val faqs = listOf(
        "How do I book an appointment?" to "Go to Home tab and tap the + button at the bottom to book an appointment with any doctor.",
        "How to add family members?" to "Go to Profile > Family Members > Add Member to link family profiles.",
        "Is my data secure?" to "Yes! All data is encrypted end-to-end and ABDM compliant. We never share without consent.",
        "How to use video consultation?" to "Book a video consultation from the dashboard and join at the scheduled time.",
        "How to contact support?" to "Go to Profile > Support & Legal > 24/7 Support to chat with our team."
    )
    var expandedIndex by remember { mutableIntStateOf(-1) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.HelpOutline, null, tint = SwastikPurple)
                Spacer(Modifier.width(8.dp))
                Text("Help Center", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Frequently Asked Questions", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color.Gray)
                Spacer(Modifier.height(4.dp))
                faqs.forEachIndexed { index, (question, answer) ->
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable {
                            expandedIndex = if (expandedIndex == index) -1 else index
                        },
                        shape = RoundedCornerShape(10.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (expandedIndex == index) SwastikPurple.copy(alpha = 0.06f) else Color(0xFFF5F5F5)
                        )
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(question, fontSize = 13.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                                Icon(
                                    if (expandedIndex == index) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                    null, tint = SwastikPurple
                                )
                            }
                            if (expandedIndex == index) {
                                Spacer(Modifier.height(8.dp))
                                Text(answer, fontSize = 12.sp, color = Color.DarkGray)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
            ) { Text("Close") }
        },
        shape = RoundedCornerShape(20.dp)
    )
}

// ==================== QR CODE DIALOG ====================

@Composable
fun QrCodeDialog(
    profile: PatientProfile?,
    viewModel: PatientDashboardViewModel?,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val healthCardState by viewModel?.healthCardState?.collectAsState()
        ?: remember { mutableStateOf(PatientDashboardViewModel.HealthCardState()) }

    LaunchedEffect(Unit) {
        if (healthCardState.url == null && !healthCardState.isLoading) {
            viewModel?.generateHealthCard()
        }
    }

    val qrBitmap = remember(healthCardState.url) {
        val url = healthCardState.url ?: return@remember null
        try {
            val writer = QRCodeWriter()
            val bitMatrix = writer.encode(url, BarcodeFormat.QR_CODE, 512, 512)
            val width = bitMatrix.width
            val height = bitMatrix.height
            val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565)
            for (x in 0 until width) {
                for (y in 0 until height) {
                    bmp.setPixel(x, y, if (bitMatrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
                }
            }
            bmp
        } catch (_: Exception) { null }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.QrCode2, null, tint = SwastikPurple)
                Spacer(Modifier.width(8.dp))
                Text("Health QR Code", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(220.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.White)
                        .border(2.dp, SwastikPurple.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
                        .padding(12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    when {
                        healthCardState.isLoading -> {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                CircularProgressIndicator(modifier = Modifier.size(48.dp), color = SwastikPurple)
                                Spacer(Modifier.height(8.dp))
                                Text("Generating...", fontSize = 12.sp, color = Color.Gray)
                            }
                        }
                        healthCardState.error != null -> {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Outlined.ErrorOutline, null, tint = Color.Red, modifier = Modifier.size(48.dp))
                                Spacer(Modifier.height(8.dp))
                                Text(healthCardState.error ?: "Error", fontSize = 12.sp, color = Color.Red)
                            }
                        }
                        qrBitmap != null -> {
                            Image(
                                bitmap = qrBitmap.asImageBitmap(),
                                contentDescription = "Health QR Code",
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Fit
                            )
                        }
                        else -> {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Outlined.QrCode2, null, tint = Color.LightGray, modifier = Modifier.size(60.dp))
                                Text("Tap Generate below", fontSize = 12.sp, color = Color.Gray)
                            }
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))
                Text(profile?.name ?: "Patient", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                if (profile?.abhaNumber?.isNotEmpty() == true) {
                    Text("ABHA: ${profile.abhaNumber}", fontSize = 12.sp, color = Color.Gray)
                }

                if (healthCardState.hasActiveCard && healthCardState.expiresAt != null) {
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                        Icon(Icons.Outlined.Schedule, null, tint = SwastikPurple, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Valid for 24 hours", fontSize = 11.sp, color = SwastikPurple)
                    }
                }

                Spacer(Modifier.height(12.dp))
                Text(
                    "Any doctor can scan this QR to view your\ncomplete medical records securely",
                    fontSize = 12.sp, color = Color.Gray, textAlign = TextAlign.Center
                )

                Spacer(Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (healthCardState.url != null) {
                        OutlinedButton(
                            onClick = {
                                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_SUBJECT, "My Swastik Health Card")
                                    putExtra(Intent.EXTRA_TEXT, "View my health records: ${healthCardState.url}")
                                }
                                context.startActivity(Intent.createChooser(shareIntent, "Share Health Card"))
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, SwastikPurple.copy(alpha = 0.5f))
                        ) {
                            Icon(Icons.Outlined.Share, null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Share", fontSize = 13.sp)
                        }
                    }

                    if (healthCardState.hasActiveCard) {
                        OutlinedButton(
                            onClick = { viewModel?.revokeHealthCard() },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            border = BorderStroke(1.dp, Color.Red.copy(alpha = 0.4f)),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.Red)
                        ) {
                            Icon(Icons.Outlined.LinkOff, null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Revoke", fontSize = 13.sp)
                        }
                    } else if (!healthCardState.isLoading) {
                        Button(
                            onClick = { viewModel?.generateHealthCard() },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
                        ) {
                            Icon(Icons.Outlined.QrCode2, null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Generate", fontSize = 13.sp)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
            ) { Text("Close") }
        },
        shape = RoundedCornerShape(20.dp)
    )
}
