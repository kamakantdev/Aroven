package com.example.swastik.ui.screens.auth

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.swastik.ui.theme.SwastikGreen
import com.example.swastik.ui.theme.SwastikPurple
import com.example.swastik.ui.theme.SwastikPurpleLight

@Composable
fun HomeScreen(
    onPatientClick: () -> Unit,
    onDoctorClick: () -> Unit = {} // Kept for compatibility, not used
) {
    // Subtle animation for the logo
    val infiniteTransition = rememberInfiniteTransition(label = "logo")
    val glowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 0.6f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "glow"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        SwastikPurple,
                        SwastikPurple.copy(alpha = 0.85f),
                        SwastikPurpleLight.copy(alpha = 0.7f)
                    )
                )
            )
    ) {
        // Top Section with Swastik Logo
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(0.55f),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Animated glow background
            Box(
                modifier = Modifier.size(160.dp),
                contentAlignment = Alignment.Center
            ) {
                // Glow effect
                Box(
                    modifier = Modifier
                        .size(140.dp)
                        .background(
                            Color.White.copy(alpha = glowAlpha * 0.3f),
                            CircleShape
                        )
                )

                // Main logo container
                Box(
                    modifier = Modifier
                        .size(120.dp)
                        .background(Color.White.copy(alpha = 0.15f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    // Swastik Symbol - Auspicious Healthcare Symbol
                    SwastikSymbol(
                        modifier = Modifier.size(70.dp),
                        color = Color.White
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // App Name with unique styling
            Text(
                text = "स्वस्तिक",
                fontSize = 20.sp,
                fontWeight = FontWeight.Medium,
                color = Color.White.copy(alpha = 0.9f),
                letterSpacing = 4.sp
            )

            Text(
                text = "SWASTIK",
                fontSize = 42.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                letterSpacing = 8.sp
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Tagline
            Surface(
                color = Color.White.copy(alpha = 0.2f),
                shape = RoundedCornerShape(20.dp)
            ) {
                Text(
                    text = "Healthcare Reimagined",
                    fontSize = 14.sp,
                    fontStyle = FontStyle.Italic,
                    color = Color.White,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                )
            }
        }

        // Bottom Section
        Surface(
            modifier = Modifier.fillMaxSize(),
            shape = RoundedCornerShape(topStart = 40.dp, topEnd = 40.dp),
            color = Color.White
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    "Welcome",
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    "Your health journey starts here",
                    fontSize = 16.sp,
                    color = Color.Gray,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(48.dp))

                // Get Started Button
                Button(
                    onClick = onPatientClick,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(60.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 8.dp)
                ) {
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.PersonAdd,
                            contentDescription = null,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            "Get Started",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Already have account
                Row(
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "Already have an account? ",
                        fontSize = 14.sp,
                        color = Color.Gray
                    )
                    TextButton(onClick = onPatientClick) {
                        Text(
                            "Sign In",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = SwastikPurple
                        )
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Features row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    FeatureItem(icon = "🏥", label = "Hospitals")
                    FeatureItem(icon = "👨‍⚕️", label = "Doctors")
                    FeatureItem(icon = "💊", label = "Medicines")
                    FeatureItem(icon = "📋", label = "Records")
                }

                Spacer(modifier = Modifier.weight(1f))

                Text(
                    "By continuing, you agree to our Terms & Privacy Policy",
                    fontSize = 12.sp,
                    color = Color.Gray,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
private fun SwastikSymbol(
    modifier: Modifier = Modifier,
    color: Color = Color.White
) {
    Canvas(modifier = modifier) {
        val strokeWidth = size.width * 0.12f
        val armLength = size.width * 0.35f
        val bendLength = size.width * 0.2f
        val center = Offset(size.width / 2, size.height / 2)

        // Draw the four arms of the Swastik
        // Horizontal line
        drawLine(
            color = color,
            start = Offset(center.x - armLength, center.y),
            end = Offset(center.x + armLength, center.y),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )

        // Vertical line
        drawLine(
            color = color,
            start = Offset(center.x, center.y - armLength),
            end = Offset(center.x, center.y + armLength),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )

        // Top arm bend (right)
        drawLine(
            color = color,
            start = Offset(center.x, center.y - armLength),
            end = Offset(center.x + bendLength, center.y - armLength),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )

        // Right arm bend (down)
        drawLine(
            color = color,
            start = Offset(center.x + armLength, center.y),
            end = Offset(center.x + armLength, center.y + bendLength),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )

        // Bottom arm bend (left)
        drawLine(
            color = color,
            start = Offset(center.x, center.y + armLength),
            end = Offset(center.x - bendLength, center.y + armLength),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )

        // Left arm bend (up)
        drawLine(
            color = color,
            start = Offset(center.x - armLength, center.y),
            end = Offset(center.x - armLength, center.y - bendLength),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )
    }
}

@Composable
private fun FeatureItem(icon: String, label: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(icon, fontSize = 28.sp)
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            label,
            fontSize = 11.sp,
            color = Color.Gray,
            fontWeight = FontWeight.Medium
        )
    }
}

