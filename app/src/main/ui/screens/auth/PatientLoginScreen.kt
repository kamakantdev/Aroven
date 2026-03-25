package com.example.swastik.ui.screens.auth

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.ui.theme.SwastikPurple

@Composable
fun PatientLoginScreen(
    onRegisterClick: () -> Unit,
    onBackClick: () -> Unit,
    onLoginSuccess: () -> Unit
) {
    val viewModel: AuthViewModel = hiltViewModel()
    val uiState = viewModel.uiState
    
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var rememberMe by remember { mutableStateOf(false) }
    var passwordVisible by remember { mutableStateOf(false) }
    
    // Handle success - navigate to dashboard
    LaunchedEffect(uiState.isSuccess) {
        if (uiState.isSuccess) {
            onLoginSuccess()
            viewModel.resetState()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(SwastikPurple, SwastikPurple.copy(alpha = 0.7f))))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(0.35f),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .background(Color.White.copy(alpha = 0.15f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                // Swastik Symbol
                Canvas(modifier = Modifier.size(45.dp)) {
                    val strokeWidth = size.width * 0.12f
                    val armLength = size.width * 0.35f
                    val bendLength = size.width * 0.2f
                    val center = Offset(size.width / 2, size.height / 2)

                    drawLine(Color.White, Offset(center.x - armLength, center.y), Offset(center.x + armLength, center.y), strokeWidth, StrokeCap.Round)
                    drawLine(Color.White, Offset(center.x, center.y - armLength), Offset(center.x, center.y + armLength), strokeWidth, StrokeCap.Round)
                    drawLine(Color.White, Offset(center.x, center.y - armLength), Offset(center.x + bendLength, center.y - armLength), strokeWidth, StrokeCap.Round)
                    drawLine(Color.White, Offset(center.x + armLength, center.y), Offset(center.x + armLength, center.y + bendLength), strokeWidth, StrokeCap.Round)
                    drawLine(Color.White, Offset(center.x, center.y + armLength), Offset(center.x - bendLength, center.y + armLength), strokeWidth, StrokeCap.Round)
                    drawLine(Color.White, Offset(center.x - armLength, center.y), Offset(center.x - armLength, center.y - bendLength), strokeWidth, StrokeCap.Round)
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text("SWASTIK", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold, letterSpacing = 4.sp)
            Text("Healthcare Reimagined", color = Color.White, fontSize = 14.sp, fontStyle = FontStyle.Italic)
        }

        Surface(
            modifier = Modifier.fillMaxSize(),
            shape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp),
            color = Color.White
        ) {
            Column(
                modifier = Modifier
                    .padding(24.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                Text("Login", fontSize = 28.sp, fontWeight = FontWeight.Bold)
                Text("Please Login to Online Consultant", color = Color.Gray, fontSize = 14.sp)
                Spacer(modifier = Modifier.height(24.dp))
                
                // Show error message if any
                uiState.errorMessage?.let { error ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFEBEE))
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Error, null, tint = Color.Red)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(error, color = Color.Red, fontSize = 14.sp)
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                }

                Text("Email*", fontWeight = FontWeight.Medium)
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = email,
                    onValueChange = { 
                        email = it
                        viewModel.clearError()
                    },
                    placeholder = { Text("Enter your email") },
                    leadingIcon = { Icon(Icons.Default.Email, null) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    enabled = !uiState.isLoading
                )

                Spacer(modifier = Modifier.height(16.dp))
                Text("Password*", fontWeight = FontWeight.Medium)
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = { 
                        password = it
                        viewModel.clearError()
                    },
                    placeholder = { Text("Password") },
                    leadingIcon = { Icon(Icons.Default.Lock, null) },
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff, null)
                        }
                    },
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    enabled = !uiState.isLoading
                )

                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = rememberMe, 
                            onCheckedChange = { rememberMe = it },
                            enabled = !uiState.isLoading
                        )
                        Text("Remember Me")
                    }
                    TextButton(onClick = {}, enabled = !uiState.isLoading) { 
                        Text("Forgot Password?") 
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
                Button(
                    onClick = {
                        // Try backend login first
                        viewModel.login(email, password)
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple),
                    enabled = email.isNotEmpty() && password.isNotEmpty() && !uiState.isLoading
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text("Login", fontSize = 16.sp)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    Text("Don't Have an account?")
                    TextButton(onClick = onRegisterClick, enabled = !uiState.isLoading) { 
                        Text("Register Here", fontWeight = FontWeight.Bold) 
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                TextButton(
                    onClick = onBackClick,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !uiState.isLoading
                ) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Back to Home")
                }
            }
        }
    }
}

