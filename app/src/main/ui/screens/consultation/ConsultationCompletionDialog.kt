package com.example.swastik.ui.screens.consultation

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.swastik.ui.theme.SwastikPurple

@Composable
fun ConsultationCompletionDialog(
    userName: String = "Gurpreet",
    onDismiss: () -> Unit
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            dismissOnBackPress = false,
            dismissOnClickOutside = false
        )
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Success Icon with decorations
                SuccessIcon()

                Spacer(modifier = Modifier.height(24.dp))

                // Thank You Text
                Text(
                    text = buildAnnotatedString {
                        append("Thank You, ")
                        withStyle(style = SpanStyle(fontWeight = FontWeight.Bold)) {
                            append("$userName!")
                        }
                    },
                    fontSize = 22.sp,
                    color = Color.Black
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Description
                Text(
                    text = "You have completed the\nonline consultation.\nWe will send the medicine to you.",
                    fontSize = 14.sp,
                    color = Color.Gray,
                    textAlign = TextAlign.Center,
                    lineHeight = 22.sp
                )

                Spacer(modifier = Modifier.height(28.dp))

                // OK Button
                Button(
                    onClick = onDismiss,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(26.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
                ) {
                    Text(
                        "Ok",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

@Composable
private fun SuccessIcon() {
    val goldColor = Color(0xFFF5C842)
    val goldLightColor = Color(0xFFFFF3CD)

    Box(
        modifier = Modifier.size(100.dp),
        contentAlignment = Alignment.Center
    ) {
        // Decorative sparkles
        Canvas(modifier = Modifier.fillMaxSize()) {
            val sparkleColor = goldColor

            // Top right sparkle
            drawCircle(
                color = sparkleColor,
                radius = 5.dp.toPx(),
                center = Offset(size.width * 0.9f, size.height * 0.1f)
            )

            // Small sparkle
            drawCircle(
                color = sparkleColor,
                radius = 3.dp.toPx(),
                center = Offset(size.width * 0.78f, size.height * 0.2f)
            )

            // Top left sparkle
            drawCircle(
                color = sparkleColor,
                radius = 4.dp.toPx(),
                center = Offset(size.width * 0.1f, size.height * 0.25f)
            )
        }

        // Outer ring (light gold)
        Box(
            modifier = Modifier
                .size(90.dp)
                .clip(CircleShape)
                .background(goldLightColor),
            contentAlignment = Alignment.Center
        ) {
            // Inner circle (gold)
            Box(
                modifier = Modifier
                    .size(70.dp)
                    .clip(CircleShape)
                    .background(goldColor),
                contentAlignment = Alignment.Center
            ) {
                // Check mark
                Icon(
                    Icons.Default.Check,
                    contentDescription = "Success",
                    tint = Color.White,
                    modifier = Modifier.size(36.dp)
                )
            }
        }
    }
}
