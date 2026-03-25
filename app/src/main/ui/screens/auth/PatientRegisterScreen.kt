package com.example.swastik.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.ui.screens.auth.AuthViewModel
import com.example.swastik.ui.theme.SwastikPurple

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PatientRegisterScreen(
    onLoginClick: () -> Unit,
    onBackClick: () -> Unit,
    onRegisterSuccess: (String) -> Unit
) {
    val viewModel: AuthViewModel = hiltViewModel()
    val uiState = viewModel.uiState

    var fullName by remember { mutableStateOf("") }
    var selectedRole by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var phoneNumber by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var roleExpanded by remember { mutableStateOf(false) }
    var languageExpanded by remember { mutableStateOf(false) }
    var selectedLanguage by remember { mutableStateOf("English") }

    val roles = listOf("Patient", "Caregiver", "Family Member")
    val languages = listOf("English", "Hindi", "Tamil", "Telugu", "Bengali")

    // Navigate to verification pending screen on successful registration
    LaunchedEffect(uiState.registrationComplete) {
        if (uiState.registrationComplete) {
            viewModel.onRegistrationNavigated()
            onRegisterSuccess(email)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SwastikPurple)
    ) {
        // Purple header area with back button
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 40.dp, start = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBackClick) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = Color.White
                )
            }
        }

        // White form area
        Surface(
            modifier = Modifier.fillMaxSize(),
            shape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp),
            color = Color.White
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp)
            ) {
                // Header with Language selector
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            "Register",
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.Black
                        )
                        Text(
                            "Please Register Before Login",
                            fontSize = 14.sp,
                            color = Color.Gray
                        )
                    }

                    // Language Dropdown
                    Box {
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { languageExpanded = true }
                                .padding(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(selectedLanguage, fontWeight = FontWeight.Medium)
                            Icon(Icons.Default.KeyboardArrowDown, contentDescription = null)
                        }
                        DropdownMenu(
                            expanded = languageExpanded,
                            onDismissRequest = { languageExpanded = false }
                        ) {
                            languages.forEach { language ->
                                DropdownMenuItem(
                                    text = { Text(language) },
                                    onClick = {
                                        selectedLanguage = language
                                        languageExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Full Name Field
                Text("Full Name*", fontWeight = FontWeight.Medium)
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = fullName,
                    onValueChange = { fullName = it },
                    placeholder = { Text("Fullname") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedBorderColor = Color.LightGray,
                        focusedBorderColor = SwastikPurple
                    )
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Role Dropdown
                Text("Role*", fontWeight = FontWeight.Medium)
                Spacer(modifier = Modifier.height(8.dp))
                ExposedDropdownMenuBox(
                    expanded = roleExpanded,
                    onExpandedChange = { roleExpanded = !roleExpanded }
                ) {
                    OutlinedTextField(
                        value = selectedRole,
                        onValueChange = {},
                        readOnly = true,
                        placeholder = { Text("Select your Role") },
                        trailingIcon = {
                            ExposedDropdownMenuDefaults.TrailingIcon(expanded = roleExpanded)
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            unfocusedBorderColor = Color.LightGray,
                            focusedBorderColor = SwastikPurple
                        )
                    )
                    ExposedDropdownMenu(
                        expanded = roleExpanded,
                        onDismissRequest = { roleExpanded = false }
                    ) {
                        roles.forEach { role ->
                            DropdownMenuItem(
                                text = { Text(role) },
                                onClick = {
                                    selectedRole = role
                                    roleExpanded = false
                                }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Email Field
                Text("Email*", fontWeight = FontWeight.Medium)
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    placeholder = { Text("Enter your email") },
                    leadingIcon = { Icon(Icons.Default.Email, null, tint = Color.Gray) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedBorderColor = Color.LightGray,
                        focusedBorderColor = SwastikPurple
                    )
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Password Field
                Text("Password*", fontWeight = FontWeight.Medium)
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    placeholder = { Text("Password") },
                    leadingIcon = { Icon(Icons.Default.Lock, null, tint = Color.Gray) },
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(
                                if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                null,
                                tint = Color.Gray
                            )
                        }
                    },
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedBorderColor = Color.LightGray,
                        focusedBorderColor = SwastikPurple
                    )
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Phone Input Field (optional)
                Text("Phone Number", fontWeight = FontWeight.Medium)
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = phoneNumber,
                    onValueChange = { phoneNumber = it },
                    placeholder = { Text("Input Phone Number (optional)") },
                    leadingIcon = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(start = 12.dp)
                        ) {
                            Text("🇮🇳", fontSize = 20.sp)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("+91", fontWeight = FontWeight.Medium)
                            Icon(
                                Icons.Default.KeyboardArrowDown,
                                contentDescription = null,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Box(
                                modifier = Modifier
                                    .width(1.dp)
                                    .height(24.dp)
                                    .background(Color.LightGray)
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedBorderColor = Color.LightGray,
                        focusedBorderColor = SwastikPurple
                    )
                )

                Spacer(modifier = Modifier.height(32.dp))

                // Error message
                uiState.errorMessage?.let { error ->
                    Text(
                        text = error,
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 14.sp,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                // Register Button
                Button(
                    onClick = {
                        // Call register API with email verification
                        val phone = if (phoneNumber.isNotBlank()) "+91$phoneNumber" else ""
                        viewModel.register(
                            name = fullName,
                            phone = phone,
                            email = email,
                            password = password
                        )
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple),
                    enabled = fullName.isNotEmpty() && email.isNotEmpty() && password.isNotEmpty() && !uiState.isLoading
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text("Register", fontSize = 18.sp, fontWeight = FontWeight.Medium)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Login Link
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Have an account?", color = Color.Gray)
                    TextButton(onClick = onLoginClick) {
                        Text(
                            "Login Here",
                            color = SwastikPurple,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}
