package com.example.swastik.ui.screens.patient.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.swastik.data.local.AppSettingsStore
import com.example.swastik.data.repository.PatientRepository
import com.example.swastik.data.model.*
import com.example.swastik.ui.theme.SwastikPurple
import androidx.compose.material.icons.filled.Check

@Composable
fun DashboardHeader(
    profile: PatientProfile?,
    unreadNotificationsCount: Int,
    onNotificationClick: () -> Unit = {},
    onProfileClick: () -> Unit = {},
    onLanguageSelected: (String) -> Unit = {}
) {
    var showLanguageMenu by remember { mutableStateOf(false) }
    val appSettings by AppSettingsStore.settings.collectAsState()
    val selectedLanguage = appSettings.language


    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                Brush.horizontalGradient(
                    colors = listOf(
                        SwastikPurple.copy(alpha = 0.08f),
                        Color.Transparent
                    )
                )
            )
            .padding(horizontal = 20.dp, vertical = 16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .clip(RoundedCornerShape(12.dp))
                .clickable { onProfileClick() }
                .padding(4.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(50.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(SwastikPurple.copy(alpha = 0.25f), SwastikPurple.copy(alpha = 0.1f))
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    profile?.initials?.ifEmpty { "👤" } ?: "👤",
                    fontSize = if (profile?.initials?.isNotEmpty() == true) 18.sp else 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = SwastikPurple
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column {
                Text(
                    text = profile?.name?.split(" ")?.firstOrNull()?.ifEmpty { "Welcome" } ?: "Welcome",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF1A1A2E)
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.LocationOn,
                        contentDescription = "Location",
                        modifier = Modifier.size(14.dp),
                        tint = Color.Gray
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = profile?.location?.ifEmpty { "Set Location" } ?: "Set Location",
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                }
            }
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            Box {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { showLanguageMenu = true }
                        .padding(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = selectedLanguage,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Icon(
                        Icons.Default.KeyboardArrowDown,
                        contentDescription = "Select language",
                        modifier = Modifier.size(20.dp)
                    )
                }
                DropdownMenu(
                    expanded = showLanguageMenu,
                    onDismissRequest = { showLanguageMenu = false }
                ) {
                    listOf("English", "Hindi", "Bengali", "Telugu", "Tamil", "Kannada", "Marathi").forEach { lang ->
                        DropdownMenuItem(
                            text = { Text(lang) },
                            onClick = {
                                AppSettingsStore.updateLanguage(lang)
                                showLanguageMenu = false
                                onLanguageSelected(lang)
                            },
                            leadingIcon = if (lang == selectedLanguage) {
                                { Icon(Icons.Default.Check, contentDescription = null, tint = SwastikPurple) }
                            } else null
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            Box {
                IconButton(onClick = onNotificationClick) {
                    Icon(
                        Icons.Outlined.Notifications,
                        contentDescription = "Notifications",
                        tint = Color.Black
                    )
                }
                if (unreadNotificationsCount > 0) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .background(Color.Red, CircleShape)
                            .align(Alignment.TopEnd)
                            .offset(x = (-8).dp, y = 8.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun SearchBar(onSearchClick: () -> Unit = {}) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .clickable { onSearchClick() }
    ) {
        OutlinedTextField(
            value = "",
            onValueChange = { },
            enabled = false,
            placeholder = {
                Text("Search for Doctors / Specialist", color = Color.Gray)
            },
            leadingIcon = {
                Icon(Icons.Filled.Search, contentDescription = null, tint = Color.Gray)
            },
            trailingIcon = {
                Icon(Icons.Filled.Mic, contentDescription = "Voice Search", tint = SwastikPurple)
            },
            modifier = Modifier
                .fillMaxWidth()
                .shadow(4.dp, RoundedCornerShape(16.dp)),
            shape = RoundedCornerShape(16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                disabledBorderColor = Color.Transparent,
                disabledContainerColor = Color.White,
                disabledTextColor = Color.Black,
                disabledPlaceholderColor = Color.Gray,
                disabledLeadingIconColor = Color.Gray,
                disabledTrailingIconColor = SwastikPurple
            ),
            singleLine = true
        )
    }
}
