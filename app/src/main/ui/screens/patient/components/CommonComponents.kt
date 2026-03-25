package com.example.swastik.ui.screens.patient.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.swastik.ui.theme.SwastikPurple

// ==================== BOTTOM NAVIGATION ====================
@Composable
fun PatientBottomNavigation(
    selectedTab: Int,
    onTabSelected: (Int) -> Unit
) {
    NavigationBar(
        containerColor = Color.White,
        tonalElevation = 8.dp
    ) {
        NavigationBarItem(
            selected = selectedTab == 0,
            onClick = { onTabSelected(0) },
            icon = {
                Icon(
                    if (selectedTab == 0) Icons.Filled.Home else Icons.Outlined.Home,
                    contentDescription = "Home"
                )
            },
            label = { Text("Home", fontSize = 11.sp) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = SwastikPurple,
                selectedTextColor = SwastikPurple,
                indicatorColor = SwastikPurple.copy(alpha = 0.1f)
            )
        )
        NavigationBarItem(
            selected = selectedTab == 1,
            onClick = { onTabSelected(1) },
            icon = {
                Icon(
                    if (selectedTab == 1) Icons.Filled.MedicalServices else Icons.Outlined.MedicalServices,
                    contentDescription = "Medicine"
                )
            },
            label = { Text("Medicine", fontSize = 11.sp) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = SwastikPurple,
                selectedTextColor = SwastikPurple,
                indicatorColor = SwastikPurple.copy(alpha = 0.1f)
            )
        )

        Spacer(modifier = Modifier.weight(1f))

        NavigationBarItem(
            selected = selectedTab == 2,
            onClick = { onTabSelected(2) },
            icon = {
                Icon(
                    if (selectedTab == 2) Icons.Filled.Folder else Icons.Outlined.Folder,
                    contentDescription = "Records"
                )
            },
            label = { Text("Records", fontSize = 11.sp) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = SwastikPurple,
                selectedTextColor = SwastikPurple,
                indicatorColor = SwastikPurple.copy(alpha = 0.1f)
            )
        )
        NavigationBarItem(
            selected = selectedTab == 3,
            onClick = { onTabSelected(3) },
            icon = {
                Icon(
                    if (selectedTab == 3) Icons.Filled.Person else Icons.Outlined.Person,
                    contentDescription = "Profile"
                )
            },
            label = { Text("Profile", fontSize = 11.sp) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = SwastikPurple,
                selectedTextColor = SwastikPurple,
                indicatorColor = SwastikPurple.copy(alpha = 0.1f)
            )
        )
    }
}

// ==================== COMMON HEADER COMPONENT ====================
@Composable
fun CommonScreenHeader(
    userName: String = "Gurpreet",
    userEmoji: String = "👳",
    subtitle: String = "Patient",
    showUploadButton: Boolean = false,
    onUploadClick: () -> Unit = {},
    onNotificationClick: () -> Unit = {}
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(45.dp)
                .clip(CircleShape)
                .background(SwastikPurple.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center
        ) {
            Text(userEmoji, fontSize = 24.sp)
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column {
            Text(
                text = userName,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            Text(
                text = subtitle,
                fontSize = 13.sp,
                color = Color.Gray
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        if (showUploadButton) {
            IconButton(onClick = onUploadClick) {
                Icon(
                    Icons.Outlined.CloudUpload,
                    contentDescription = "Upload",
                    tint = SwastikPurple
                )
            }
        }

        Box {
            IconButton(onClick = onNotificationClick) {
                Icon(
                    Icons.Outlined.Notifications,
                    contentDescription = "Notifications",
                    tint = Color.Black
                )
            }
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

// ==================== EMPTY STATE VIEW ====================
@Composable
fun EmptyStateView(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    actionText: String? = null,
    onAction: (() -> Unit)? = null
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(80.dp)
                .background(Color(0xFFF5F5F5), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = Color.Gray,
                modifier = Modifier.size(40.dp)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = title,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = Color.Black,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = subtitle,
            fontSize = 14.sp,
            color = Color.Gray,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )

        if (actionText != null && onAction != null) {
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onAction,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
            ) {
                Text(actionText)
            }
        }
    }
}

// ==================== LOADING SHIMMER ====================
@Composable
fun LoadingShimmer(modifier: Modifier = Modifier) {
    val shimmerColors = listOf(
        Color.LightGray.copy(alpha = 0.6f),
        Color.LightGray.copy(alpha = 0.2f),
        Color.LightGray.copy(alpha = 0.6f)
    )

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "translate"
    )

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = Offset(translateAnim - 500f, 0f),
        end = Offset(translateAnim, 0f)
    )

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(brush)
    )
}

// ==================== NO INTERNET VIEW ====================
@Composable
fun NoInternetView(onRetry: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            Icons.Default.WifiOff,
            contentDescription = null,
            tint = Color.Gray,
            modifier = Modifier.size(80.dp)
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "No Internet Connection",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = Color.Black
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Please check your connection and try again",
            fontSize = 14.sp,
            color = Color.Gray,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
        ) {
            Icon(Icons.Default.Refresh, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Try Again")
        }
    }
}
