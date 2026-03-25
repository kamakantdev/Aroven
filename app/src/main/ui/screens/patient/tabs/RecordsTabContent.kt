package com.example.swastik.ui.screens.patient.tabs

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.data.model.*
import com.example.swastik.ui.viewmodel.RecordsViewModel
import com.example.swastik.ui.viewmodel.UploadState
import com.example.swastik.ui.theme.SwastikPurple
import com.example.swastik.ui.theme.SwastikPurpleLight
import com.example.swastik.ui.components.RecordsListShimmer
import android.content.Intent
import android.net.Uri
import android.widget.Toast

/**
 * Records Tab Content
 * Shows medical records, consultations, prescriptions, and documents from backend API
 */
@Composable
fun RecordsTabContent(
    modifier: Modifier = Modifier,
    profile: PatientProfile? = null,
    unreadNotificationsCount: Int = 0,
    onNotificationClick: () -> Unit = {},
    onUploadClick: () -> Unit = {},
    onNavigateToPrescriptions: () -> Unit = {},
    onNavigateToReports: () -> Unit = {},
    viewModel: RecordsViewModel = hiltViewModel()
) {
    var selectedFilter by remember { mutableStateOf(RecordFilter.ALL) }
    var showUploadDialog by remember { mutableStateOf(false) }

    val state by viewModel.uiState.collectAsState()
    val consultations = state.consultations
    val documents = state.documents
    val context = LocalContext.current

    // Handle upload state changes
    LaunchedEffect(state.uploadState) {
        when (val uploadState = state.uploadState) {
            is UploadState.Success -> {
                Toast.makeText(context, uploadState.message, Toast.LENGTH_SHORT).show()
                viewModel.clearUploadState()
            }
            is UploadState.Error -> {
                Toast.makeText(context, uploadState.message, Toast.LENGTH_LONG).show()
                viewModel.clearUploadState()
            }
            else -> {}
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        RecordsHeader(
            profile,
            unreadNotificationsCount,
            onNotificationClick,
            onUploadClick = { showUploadDialog = true }
        )

        Card(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 8.dp),
            shape = RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 24.dp)
            ) {
// ... (rest of content)

                Text(
                    text = "Medical Records",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black,
                    modifier = Modifier.padding(horizontal = 20.dp)
                )

                Text(
                    text = "Your complete health history",
                    fontSize = 14.sp,
                    color = Color.Gray,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                RecordsFilterRow(
                    selectedFilter = selectedFilter,
                    onFilterSelected = { selectedFilter = it }
                )

                Spacer(modifier = Modifier.height(8.dp))

                if (state.isLoading) {
                    RecordsListShimmer()
                } else if (state.error != null) {
                    // Error state with retry
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Outlined.Warning,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp),
                                tint = Color.Gray
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = state.error ?: "Failed to load records",
                                fontSize = 14.sp,
                                color = Color.Gray
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(
                                onClick = { viewModel.loadRecords() },
                                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
                            ) {
                                Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Retry")
                            }
                        }
                    }
                } else if (consultations.isEmpty() && documents.isEmpty()) {
                    // Empty state
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Outlined.FolderOpen,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp),
                                tint = Color.LightGray
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "No medical records yet",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color.Gray
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Upload reports or consult a doctor to get started",
                                fontSize = 13.sp,
                                color = Color.LightGray
                            )
                            Spacer(modifier = Modifier.height(20.dp))
                            OutlinedButton(
                                onClick = { showUploadDialog = true },
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = SwastikPurple)
                            ) {
                                Icon(Icons.Outlined.CloudUpload, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Upload Report")
                            }
                        }
                    }
                } else {
                    LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    when (selectedFilter) {
                        RecordFilter.ALL -> {
                            item { SectionHeader("Recent Consultations", "See All") { selectedFilter = RecordFilter.CONSULTATIONS } }
                            items(consultations.take(2)) { ConsultationCard(it) }
                            item { Spacer(modifier = Modifier.height(8.dp)) }
                            item { SectionHeader("Documents", "See All") { selectedFilter = RecordFilter.REPORTS } }
                            items(documents.take(3)) { DocumentItem(it) }
                        }
                        RecordFilter.CONSULTATIONS -> {
                            item { SectionHeader("All Consultations", null) }
                            items(consultations) { ConsultationCard(it) }
                        }
                        RecordFilter.PRESCRIPTIONS -> {
                            item { SectionHeader("All Prescriptions", null) }
                            items(consultations) { PrescriptionCard(it) }
                        }
                        RecordFilter.REPORTS -> {
                            item { SectionHeader("All Reports & Documents", null) }
                            items(documents) { DocumentItem(it) }
                        }
                    }
                    item { Spacer(modifier = Modifier.height(16.dp)) }
                }
                } // end else
            }
        }
    }

    // Upload Report Dialog
    if (showUploadDialog) {
        UploadReportDialog(
            onDismiss = { showUploadDialog = false },
            onUpload = { uri, name, type ->
                viewModel.uploadReport(uri, name, type)
                showUploadDialog = false
            },
            isUploading = state.uploadState is UploadState.Uploading
        )
    }
}

@Composable
private fun RecordsHeader(
    profile: PatientProfile?,
    unreadCount: Int,
    onNotificationClick: () -> Unit = {},
    onUploadClick: () -> Unit = {}
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
            Text(
                profile?.initials?.ifEmpty { "👤" } ?: "👤",
                fontSize = if (profile?.initials?.isNotEmpty() == true) 16.sp else 24.sp,
                fontWeight = FontWeight.Bold,
                color = SwastikPurple
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column {
            Text(
                profile?.name?.split(" ")?.firstOrNull()?.ifEmpty { "User" } ?: "User",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            Text("Patient", fontSize = 13.sp, color = Color.Gray)
        }

        Spacer(modifier = Modifier.weight(1f))

        IconButton(onClick = onUploadClick) {
            Icon(Icons.Outlined.CloudUpload, contentDescription = "Upload", tint = SwastikPurple)
        }

        Box {
            IconButton(onClick = onNotificationClick) {
                Icon(Icons.Outlined.Notifications, contentDescription = "Notifications", tint = Color.Black)
            }
            if (unreadCount > 0) {
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

@Composable
private fun RecordsFilterRow(
    selectedFilter: RecordFilter,
    onFilterSelected: (RecordFilter) -> Unit
) {
    val filters = listOf(
        RecordFilter.ALL to "All",
        RecordFilter.CONSULTATIONS to "Consultations",
        RecordFilter.PRESCRIPTIONS to "Prescriptions",
        RecordFilter.REPORTS to "Reports"
    )

    LazyRow(
        contentPadding = PaddingValues(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(filters) { (filter, label) ->
            FilterChip(
                selected = selectedFilter == filter,
                onClick = { onFilterSelected(filter) },
                label = { Text(label, fontSize = 12.sp) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = SwastikPurple,
                    selectedLabelColor = Color.White
                )
            )
        }
    }
}

@Composable
private fun SectionHeader(title: String, actionText: String?, onAction: (() -> Unit)? = null) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Color.Black)
        if (actionText != null) {
            TextButton(onClick = { onAction?.invoke() }) {
                Text(actionText, color = SwastikPurple, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun ConsultationCard(consultation: ConsultationRecord) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8F9FA)),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(45.dp)
                            .clip(CircleShape)
                            .background(SwastikPurple.copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(consultation.doctorEmoji, fontSize = 22.sp)
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(consultation.doctorName, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Color.Black)
                        Text(consultation.doctorSpecialty, fontSize = 13.sp, color = Color.Gray)
                    }
                }
                Text(consultation.date, fontSize = 12.sp, color = Color.Gray)
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.LocalHospital, contentDescription = null, tint = SwastikPurple, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(consultation.diagnosis, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = Color.Black)
            }

            if (consultation.notes.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.Top) {
                    Icon(Icons.Outlined.Notes, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(consultation.notes, fontSize = 12.sp, color = Color.Gray)
                }
            }
        }
    }
}

@Composable
private fun PrescriptionCard(consultation: ConsultationRecord) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(45.dp)
                        .clip(CircleShape)
                        .background(SwastikPurple.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(consultation.doctorEmoji, fontSize = 22.sp)
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(consultation.doctorName, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    Text(consultation.date, fontSize = 12.sp, color = Color.Gray)
                }
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = SwastikPurple.copy(alpha = 0.1f)
                ) {
                    Text(
                        "${consultation.prescriptions.size} medicines",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        fontSize = 11.sp,
                        color = SwastikPurple
                    )
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = Color.LightGray.copy(alpha = 0.5f))

            consultation.prescriptions.forEachIndexed { index, prescription ->
                PrescriptionItemRow(index + 1, prescription)
                if (index < consultation.prescriptions.lastIndex) {
                    Spacer(modifier = Modifier.height(12.dp))
                }
            }
        }
    }
}

@Composable
private fun PrescriptionItemRow(index: Int, prescription: PrescriptionItem) {
    Row(verticalAlignment = Alignment.Top) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(SwastikPurple),
            contentAlignment = Alignment.Center
        ) {
            Text("$index", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(prescription.medicineName, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Color.Black)
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Surface(color = Color(0xFFE3F2FD), shape = RoundedCornerShape(6.dp)) {
                    Row(modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Medication, contentDescription = null, tint = Color(0xFF1976D2), modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(prescription.dosage, fontSize = 11.sp, color = Color(0xFF1976D2))
                    }
                }
                Surface(color = Color(0xFFE8F5E9), shape = RoundedCornerShape(6.dp)) {
                    Row(modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Schedule, contentDescription = null, tint = Color(0xFF4CAF50), modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(prescription.frequency, fontSize = 11.sp, color = Color(0xFF4CAF50))
                    }
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.DateRange, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(14.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Duration: ${prescription.duration}", fontSize = 12.sp, color = Color.Gray)
            }
        }
    }
}

@Composable
private fun DocumentItem(document: MedicalDocument) {
    val context = LocalContext.current
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                // Open document file in browser/viewer
                if (document.fileUrl.isNotEmpty()) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(document.fileUrl))
                        context.startActivity(intent)
                    } catch (e: Exception) {
                        Toast.makeText(context, "Cannot open document", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    Toast.makeText(context, "No file available for this report", Toast.LENGTH_SHORT).show()
                }
            },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8F9FA))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(getDocumentTypeColor(document.type)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = getDocumentTypeIcon(document.type),
                    contentDescription = null,
                    tint = getDocumentTypeIconColor(document.type),
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(document.name, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color.Black)
                Row {
                    Text(document.date, fontSize = 12.sp, color = Color.Gray)
                    if (!document.size.isNullOrBlank()) {
                        Text(" • ${document.size}", fontSize = 12.sp, color = Color.Gray)
                    }
                }
            }

            IconButton(onClick = {
                if (document.fileUrl.isNotEmpty()) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(document.fileUrl))
                        context.startActivity(intent)
                    } catch (e: Exception) {
                        Toast.makeText(context, "Cannot download file", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    Toast.makeText(context, "No file available", Toast.LENGTH_SHORT).show()
                }
            }) {
                Icon(Icons.Outlined.Download, contentDescription = "Download", tint = SwastikPurple)
            }
        }
    }
}

private fun getDocumentTypeColor(type: DocumentType): Color = when (type) {
    DocumentType.LAB_REPORT -> Color(0xFFE3F2FD)
    DocumentType.PRESCRIPTION -> Color(0xFFE8F5E9)
    DocumentType.SCAN -> Color(0xFFFFF3E0)
    DocumentType.DISCHARGE_SUMMARY -> Color(0xFFF3E5F5)
    DocumentType.VACCINATION -> Color(0xFFE0F7FA)
    else -> Color(0xFFF5F5F5)
}

private fun getDocumentTypeIcon(type: DocumentType) = when (type) {
    DocumentType.LAB_REPORT -> Icons.Outlined.Science
    DocumentType.PRESCRIPTION -> Icons.Outlined.Receipt
    DocumentType.SCAN -> Icons.Outlined.CameraAlt
    DocumentType.DISCHARGE_SUMMARY -> Icons.Outlined.Description
    DocumentType.VACCINATION -> Icons.Outlined.Vaccines
    else -> Icons.Outlined.Description
}

private fun getDocumentTypeIconColor(type: DocumentType): Color = when (type) {
    DocumentType.LAB_REPORT -> Color(0xFF1976D2)
    DocumentType.PRESCRIPTION -> Color(0xFF4CAF50)
    DocumentType.SCAN -> Color(0xFFFF9800)
    DocumentType.DISCHARGE_SUMMARY -> Color(0xFF6C63FF)
    DocumentType.VACCINATION -> Color(0xFF00ACC1)
    else -> Color.Gray
}

private enum class RecordFilter {
    ALL,
    CONSULTATIONS,
    PRESCRIPTIONS,
    REPORTS
}

/**
 * Upload Report Dialog
 * File picker + report name/type form
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UploadReportDialog(
    onDismiss: () -> Unit,
    onUpload: (Uri, String, String) -> Unit,
    isUploading: Boolean
) {
    var selectedUri by remember { mutableStateOf<Uri?>(null) }
    var selectedFileName by remember { mutableStateOf("") }
    var reportName by remember { mutableStateOf("") }
    var selectedType by remember { mutableStateOf("blood_test") }
    var typeExpanded by remember { mutableStateOf(false) }

    val reportTypes = listOf(
        "blood_test" to "Blood Test",
        "urine_test" to "Urine Test",
        "x_ray" to "X-Ray",
        "mri" to "MRI",
        "ct_scan" to "CT Scan",
        "ultrasound" to "Ultrasound",
        "ecg" to "ECG",
        "other" to "Other"
    )

    val filePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            selectedUri = it
            selectedFileName = it.lastPathSegment ?: "Selected file"
        }
    }

    AlertDialog(
        onDismissRequest = { if (!isUploading) onDismiss() },
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.CloudUpload,
                    contentDescription = null,
                    tint = SwastikPurple,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Upload Report", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // File picker button
                OutlinedButton(
                    onClick = { filePicker.launch("*/*") },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isUploading
                ) {
                    Icon(Icons.Outlined.AttachFile, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        if (selectedFileName.isEmpty()) "Select File (PDF, Image)"
                        else selectedFileName,
                        maxLines = 1
                    )
                }

                // Report name
                OutlinedTextField(
                    value = reportName,
                    onValueChange = { reportName = it },
                    label = { Text("Report Name") },
                    placeholder = { Text("Enter report name") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    enabled = !isUploading
                )

                // Report type dropdown
                ExposedDropdownMenuBox(
                    expanded = typeExpanded,
                    onExpandedChange = { if (!isUploading) typeExpanded = it }
                ) {
                    OutlinedTextField(
                        value = reportTypes.find { it.first == selectedType }?.second ?: "Blood Test",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Report Type") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = typeExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = typeExpanded,
                        onDismissRequest = { typeExpanded = false }
                    ) {
                        reportTypes.forEach { (typeId, typeName) ->
                            DropdownMenuItem(
                                text = { Text(typeName) },
                                onClick = {
                                    selectedType = typeId
                                    typeExpanded = false
                                }
                            )
                        }
                    }
                }

                // Loading indicator
                if (isUploading) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp,
                            color = SwastikPurple
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Uploading...", fontSize = 13.sp, color = Color.Gray)
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    selectedUri?.let { uri ->
                        val name = reportName.ifBlank { selectedFileName }
                        onUpload(uri, name, selectedType)
                    }
                },
                enabled = selectedUri != null && !isUploading,
                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
            ) {
                Text("Upload")
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !isUploading
            ) {
                Text("Cancel")
            }
        }
    )
}
