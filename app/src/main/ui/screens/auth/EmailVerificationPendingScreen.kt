package com.example.swastik.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.ui.components.SwastikButton
import com.example.swastik.ui.components.SwastikTopBar
import com.example.swastik.ui.theme.SwastikPurple
import kotlinx.coroutines.delay

/**
 * Screen shown after successful registration.
 * Instructs the user to check their email for a verification link.
 */
@Composable
fun EmailVerificationPendingScreen(
    email: String = "",
    onBackClick: () -> Unit,
    onGoToLogin: () -> Unit
) {
    val viewModel: AuthViewModel = hiltViewModel()
    val uiState = viewModel.uiState
    var resendCooldown by remember { mutableIntStateOf(0) }
    var resendSuccess by remember { mutableStateOf(false) }

    // Cooldown timer
    LaunchedEffect(resendCooldown) {
        if (resendCooldown > 0) {
            delay(1000)
            resendCooldown--
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        // Top Bar
        SwastikTopBar(
            title = "Email Verification",
            onBackClick = onBackClick
        )

        Spacer(modifier = Modifier.height(60.dp))

        // Email Icon
        Box(
            modifier = Modifier
                .size(100.dp)
                .background(SwastikPurple.copy(alpha = 0.12f), CircleShape)
                .align(Alignment.CenterHorizontally),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Email,
                contentDescription = null,
                tint = SwastikPurple,
                modifier = Modifier.size(48.dp)
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Title
        Text(
            text = "Check Your Email",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = Color.Black,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Description
        Text(
            text = if (email.isNotBlank())
                "We've sent a verification link to\n$email\nPlease check your inbox and click the link to verify your account."
            else
                "We've sent a verification link to your email address.\nPlease check your inbox and click the link to verify your account.",
            fontSize = 14.sp,
            color = Color.Gray,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp),
            textAlign = TextAlign.Center,
            lineHeight = 22.sp
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Hint
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = null,
                tint = SwastikPurple.copy(alpha = 0.7f),
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = "Don't forget to check your spam folder",
                fontSize = 12.sp,
                color = Color.Gray
            )
        }

        // Resend success message
        if (resendSuccess) {
            Spacer(modifier = Modifier.height(16.dp))
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFE8F5E9))
            ) {
                Text(
                    text = "Verification email resent! Check your inbox.",
                    fontSize = 13.sp,
                    color = Color(0xFF2E7D32),
                    modifier = Modifier.padding(12.dp),
                    textAlign = TextAlign.Center
                )
            }
        }

        // Error message
        uiState.errorMessage?.let { error ->
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = error,
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp),
                textAlign = TextAlign.Center
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        // Buttons
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 32.dp)
        ) {
            // Resend verification button
            if (email.isNotBlank()) {
                OutlinedButton(
                    onClick = {
                        resendSuccess = false
                        viewModel.resendVerification(email)
                        resendCooldown = 60
                        resendSuccess = true
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    enabled = resendCooldown == 0 && !uiState.isLoading
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text(
                            text = if (resendCooldown > 0) "Resend in ${resendCooldown}s" else "Resend Verification Email",
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            SwastikButton(
                text = "Go to Login",
                onClick = onGoToLogin
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "After verifying your email, you can log in with your credentials.",
                fontSize = 12.sp,
                color = Color.Gray,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center
            )
        }
    }
}
