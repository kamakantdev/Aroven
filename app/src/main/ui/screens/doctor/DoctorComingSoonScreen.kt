package com.example.swastik.ui.screens.doctor

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.MedicalServices
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.swastik.ui.theme.SwastikPurple

/**
 * Info screen shown when doctors try to log in via the app.
 * Doctor functionality is managed through the web dashboard.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DoctorPortalScreen(
    onBackClick: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Doctor Portal") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Outlined.MedicalServices,
                contentDescription = null,
                modifier = Modifier.size(96.dp),
                tint = SwastikPurple
            )
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "Doctor Portal",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = SwastikPurple
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "The doctor portal is available on the web dashboard.\nPlease visit the Swastik web app to manage your appointments, consultations, and patient records.",
                fontSize = 16.sp,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(32.dp))
            OutlinedButton(onClick = onBackClick) {
                Text("Go Back")
            }
        }
    }
}
