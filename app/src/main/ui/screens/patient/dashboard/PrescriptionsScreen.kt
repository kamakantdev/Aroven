package com.example.swastik.ui.screens.patient.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.data.model.ConsultationRecord
import com.example.swastik.data.model.PrescriptionItem
import com.example.swastik.data.model.doctorEmoji
import com.example.swastik.ui.theme.SwastikPurple
import com.example.swastik.ui.viewmodel.RecordsViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrescriptionsScreen(
    onBackClick: () -> Unit = {},
    onPrescriptionClick: (ConsultationRecord) -> Unit = {},
    viewModel: RecordsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val prescriptions = uiState.consultations

    var selectedFilter by remember { mutableStateOf("All") }
    val filters = listOf("All", "Active", "Completed")

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("My Prescriptions", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier.fillMaxSize().background(Color(0xFFF5F5F5)).padding(paddingValues)
        ) {
            // Summary Card
            Card(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SwastikPurple),
                elevation = CardDefaults.cardElevation(4.dp)
            ) {
                Row(modifier = Modifier.fillMaxWidth().padding(20.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text(text = "${prescriptions.size}", fontSize = 32.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Text(text = "Total Prescriptions", fontSize = 14.sp, color = Color.White.copy(alpha = 0.8f))
                    }
                    Icon(Icons.Outlined.Receipt, contentDescription = null, tint = Color.White.copy(alpha = 0.6f), modifier = Modifier.size(60.dp))
                }
            }

            // Filter Chips
            LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(filters) { filter ->
                    FilterChip(
                        selected = selectedFilter == filter, onClick = { selectedFilter = filter },
                        label = { Text(filter, fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = SwastikPurple, selectedLabelColor = Color.White)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            when {
                uiState.isLoading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = SwastikPurple)
                    }
                }
                prescriptions.isEmpty() -> {
                    Column(modifier = Modifier.fillMaxSize().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Icon(Icons.Outlined.Receipt, contentDescription = null, tint = Color.LightGray, modifier = Modifier.size(80.dp))
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("No Prescriptions Yet", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.Black)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Your prescriptions from consultations will appear here", fontSize = 14.sp, color = Color.Gray, textAlign = TextAlign.Center)
                    }
                }
                else -> {
                    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(prescriptions) { prescription ->
                            PrescriptionListCard(consultation = prescription, onClick = { onPrescriptionClick(prescription) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PrescriptionListCard(consultation: ConsultationRecord, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(50.dp).clip(CircleShape).background(SwastikPurple.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) {
                    Text(consultation.doctorEmoji, fontSize = 24.sp)
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = consultation.doctorName, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Color.Black)
                    Text(text = consultation.doctorSpecialty, fontSize = 12.sp, color = Color.Gray)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(text = consultation.date, fontSize = 12.sp, color = Color.Gray)
                    Spacer(modifier = Modifier.height(4.dp))
                    Surface(shape = RoundedCornerShape(8.dp), color = SwastikPurple.copy(alpha = 0.1f)) {
                        Text(text = "${consultation.prescriptions.size} medicines", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = SwastikPurple, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                    }
                }
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = Color.LightGray.copy(alpha = 0.5f))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.LocalHospital, contentDescription = null, tint = SwastikPurple, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(text = consultation.diagnosis, fontSize = 13.sp, color = Color.Black)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                consultation.prescriptions.take(3).forEach { medicine ->
                    Surface(shape = RoundedCornerShape(20.dp), color = Color(0xFFF5F5F5)) {
                        Text(text = medicine.medicineName.split(" ").first(), fontSize = 11.sp, color = Color.Gray, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
                    }
                }
                if (consultation.prescriptions.size > 3) {
                    Surface(shape = RoundedCornerShape(20.dp), color = SwastikPurple.copy(alpha = 0.1f)) {
                        Text(text = "+${consultation.prescriptions.size - 3}", fontSize = 11.sp, color = SwastikPurple, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp))
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrescriptionDetailScreen(consultation: ConsultationRecord, onBackClick: () -> Unit = {}) {
    val context = androidx.compose.ui.platform.LocalContext.current
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Prescription Details", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBackClick) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") } },
                actions = {
                    IconButton(onClick = {
                        // Download prescription - build a summary since no direct URL
                        android.widget.Toast.makeText(context, "Prescription download not available yet", android.widget.Toast.LENGTH_SHORT).show()
                    }) { Icon(Icons.Outlined.Download, contentDescription = "Download") }
                    IconButton(onClick = {
                        // Share prescription
                        val shareText = buildString {
                            append("Prescription from ${consultation.doctorName}\n")
                            append("Date: ${consultation.date}\n")
                            append("Diagnosis: ${consultation.diagnosis}\n")
                            consultation.prescriptions.forEachIndexed { i, item ->
                                append("${i + 1}. ${item.medicineName} - ${item.dosage}\n")
                            }
                        }
                        val shareIntent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(android.content.Intent.EXTRA_TEXT, shareText)
                        }
                        context.startActivity(android.content.Intent.createChooser(shareIntent, "Share Prescription"))
                    }) { Icon(Icons.Outlined.Share, contentDescription = "Share") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().background(Color(0xFFF5F5F5)).padding(paddingValues),
            contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.size(60.dp).clip(CircleShape).background(SwastikPurple.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) {
                            Text(consultation.doctorEmoji, fontSize = 30.sp)
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text(text = consultation.doctorName, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.Black)
                            Text(text = consultation.doctorSpecialty, fontSize = 14.sp, color = Color.Gray)
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Outlined.CalendarMonth, contentDescription = null, tint = SwastikPurple, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = consultation.date, fontSize = 12.sp, color = SwastikPurple)
                            }
                        }
                    }
                }
            }
            item {
                Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color(0xFFE3F2FD))) {
                    Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.LocalHospital, contentDescription = null, tint = Color(0xFF1976D2), modifier = Modifier.size(24.dp))
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(text = "Diagnosis", fontSize = 12.sp, color = Color(0xFF1976D2))
                            Text(text = consultation.diagnosis, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF0D47A1))
                        }
                    }
                }
            }
            item { Text(text = "Prescribed Medicines", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.Black) }
            items(consultation.prescriptions) { medicine -> MedicineDetailCard(medicine) }
            if (consultation.notes.isNotEmpty()) {
                item {
                    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF8E1))) {
                        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
                            Icon(Icons.Outlined.Info, contentDescription = null, tint = Color(0xFFFF9800), modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(text = "Doctor's Notes", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFFE65100))
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(text = consultation.notes, fontSize = 13.sp, color = Color(0xFF5D4037))
                            }
                        }
                    }
                }
            }
            if (consultation.followUpDate != null) {
                item {
                    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = SwastikPurple.copy(alpha = 0.1f))) {
                        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Event, contentDescription = null, tint = SwastikPurple, modifier = Modifier.size(24.dp))
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(text = "Follow-up Appointment", fontSize = 12.sp, color = SwastikPurple)
                                Text(text = consultation.followUpDate!!, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = SwastikPurple)
                            }
                        }
                    }
                }
            }
            item { Spacer(modifier = Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun MedicineDetailCard(medicine: PrescriptionItem) {
    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(2.dp)) {
        Row(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.Top) {
            Box(modifier = Modifier.size(44.dp).clip(RoundedCornerShape(10.dp)).background(Color(0xFFE8F5E9)), contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.Medication, contentDescription = null, tint = Color(0xFF4CAF50), modifier = Modifier.size(24.dp))
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(text = medicine.medicineName, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Color.Black)
                Spacer(modifier = Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Medication, contentDescription = null, tint = SwastikPurple, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(text = medicine.dosage, fontSize = 12.sp, color = Color.Gray)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Schedule, contentDescription = null, tint = SwastikPurple, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(text = medicine.frequency, fontSize = 12.sp, color = Color.Gray)
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.DateRange, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = "Duration: ${medicine.duration}", fontSize = 12.sp, color = Color.Gray)
                }
            }
        }
    }
}
