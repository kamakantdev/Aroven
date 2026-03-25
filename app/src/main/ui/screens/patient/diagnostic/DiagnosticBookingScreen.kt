package com.example.swastik.ui.screens.patient.diagnostic

import android.Manifest
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.data.remote.dto.DiagnosticCenterDto
import com.example.swastik.data.remote.dto.DiagnosticTestDto
import com.example.swastik.ui.viewmodel.DiagnosticViewModel
import java.util.Locale

private val SwastikPurple = Color(0xFF6C63FF)

/**
 * Diagnostic Booking Screen — search centers, view tests, and book.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiagnosticBookingScreen(
    onBackClick: () -> Unit,
    viewModel: DiagnosticViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var showBookingDialog by remember { mutableStateOf(false) }
    var bookingDate by remember { mutableStateOf("") }
    var bookingTime by remember { mutableStateOf("") }
    var collectionType by remember { mutableStateOf("walk_in") }
    var collectionAddress by remember { mutableStateOf("") }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    // DC3: Use location-aware search on initial load when possible
    val context = LocalContext.current
    LaunchedEffect(Unit) {
        val hasLocationPermission = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (hasLocationPermission) {
            try {
                val locationManager = context.getSystemService(android.content.Context.LOCATION_SERVICE) as? LocationManager
                val location = locationManager?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                    ?: locationManager?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                if (location != null) {
                    viewModel.findNearbyCenters(location.latitude, location.longitude)
                } else {
                    viewModel.searchCenters()
                }
            } catch (_: SecurityException) {
                viewModel.searchCenters()
            }
        } else {
            viewModel.searchCenters()
        }
    }

    // Booking success dialog
    if (uiState.bookingSuccess) {
        AlertDialog(
            onDismissRequest = {
                viewModel.resetBooking()
                onBackClick()
            },
            icon = { Icon(Icons.Default.CheckCircle, null, tint = Color(0xFF4CAF50), modifier = Modifier.size(48.dp)) },
            title = { Text("Booking Confirmed!", fontWeight = FontWeight.Bold) },
            text = { Text("Your diagnostic test has been booked successfully. You'll receive a confirmation notification.") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.resetBooking()
                        onBackClick()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
                ) { Text("Done") }
            }
        )
    }

    val snackbarHostState = remember { SnackbarHostState() }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("Diagnostic Centers", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SwastikPurple, titleContentColor = Color.White, navigationIconContentColor = Color.White)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = {
                    searchQuery = it
                    viewModel.searchCenters(it)
                },
                placeholder = { Text("Search centers or tests...") },
                leadingIcon = { Icon(Icons.Default.Search, null) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                shape = RoundedCornerShape(12.dp),
                singleLine = true
            )

            if (uiState.isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = SwastikPurple)
                }
            } else if (uiState.selectedCenter != null) {
                // Show tests for selected center
                CenterTestsView(
                    center = uiState.selectedCenter!!,
                    tests = uiState.tests,
                    selectedTest = uiState.selectedTest,
                    onTestSelect = { viewModel.selectTest(it) },
                    onBookClick = { showBookingDialog = true },
                    onBackToList = {
                        viewModel.searchCenters(searchQuery)
                        viewModel.resetBooking()
                    }
                )
            } else {
                // Show centers list
                if (uiState.centers.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.Biotech, null, tint = Color.Gray, modifier = Modifier.size(64.dp))
                            Spacer(Modifier.height(8.dp))
                            Text("No diagnostic centers found", color = Color.Gray)
                        }
                    }
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(uiState.centers) { center ->
                            CenterCard(center = center, onClick = { viewModel.selectCenter(center) })
                        }
                    }
                }
            }
        }
    }

    // Booking Dialog
    if (showBookingDialog && uiState.selectedTest != null) {
        AlertDialog(
            onDismissRequest = { showBookingDialog = false },
            title = { Text("Book Test", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Test: ${uiState.selectedTest!!.name}", fontWeight = FontWeight.SemiBold)
                    uiState.selectedTest!!.price?.let {
                        Text("Price: ₹${it.toInt()}", color = SwastikPurple, fontWeight = FontWeight.Bold)
                    }

                    OutlinedTextField(
                        value = bookingDate,
                        onValueChange = { },
                        label = { Text("Select Date") },
                        modifier = Modifier.fillMaxWidth().clickable { showDatePicker = true },
                        enabled = false,
                        trailingIcon = {
                            IconButton(onClick = { showDatePicker = true }) {
                                Icon(Icons.Outlined.CalendarMonth, contentDescription = "Pick Date", tint = SwastikPurple)
                            }
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            disabledTextColor = Color.Black,
                            disabledLabelColor = Color.Gray,
                            disabledBorderColor = Color.Gray,
                            disabledTrailingIconColor = SwastikPurple
                        ),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = bookingTime,
                        onValueChange = { },
                        label = { Text("Select Time") },
                        modifier = Modifier.fillMaxWidth().clickable { showTimePicker = true },
                        enabled = false,
                        trailingIcon = {
                            IconButton(onClick = { showTimePicker = true }) {
                                Icon(Icons.Outlined.AccessTime, contentDescription = "Pick Time", tint = SwastikPurple)
                            }
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            disabledTextColor = Color.Black,
                            disabledLabelColor = Color.Gray,
                            disabledBorderColor = Color.Gray,
                            disabledTrailingIconColor = SwastikPurple
                        ),
                        singleLine = true
                    )

                    Text("Collection Type", fontWeight = FontWeight.Medium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = collectionType == "walk_in",
                            onClick = { collectionType = "walk_in" },
                            label = { Text("Walk In") }
                        )
                        FilterChip(
                            selected = collectionType == "home_collection",
                            onClick = { collectionType = "home_collection" },
                            label = { Text("Home Collection") }
                        )
                    }

                    if (collectionType == "home_collection") {
                        OutlinedTextField(
                            value = collectionAddress,
                            onValueChange = { collectionAddress = it },
                            label = { Text("Collection Address") },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 2
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.bookTest(
                            bookingDate = bookingDate,
                            bookingTime = bookingTime.ifBlank { null },
                            collectionType = collectionType,
                            collectionAddress = if (collectionType == "home_collection") collectionAddress else null
                        )
                        showBookingDialog = false
                    },
                    enabled = bookingDate.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
                ) { Text("Confirm Booking") }
            },
            dismissButton = {
                TextButton(onClick = { showBookingDialog = false }) { Text("Cancel") }
            }
        )
    }

    // Error snackbar
    uiState.error?.let { error ->
        LaunchedEffect(error) {
            snackbarHostState.showSnackbar(
                message = error,
                duration = SnackbarDuration.Short
            )
            viewModel.clearError()
        }
    }

    // DatePicker Dialog
    if (showDatePicker) {
        val datePickerState = rememberDatePickerState()
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { millis ->
                        val calendar = java.util.Calendar.getInstance().apply { timeInMillis = millis }
                        bookingDate = String.format(
                            Locale.US,
                            "%04d-%02d-%02d",
                            calendar.get(java.util.Calendar.YEAR),
                            calendar.get(java.util.Calendar.MONTH) + 1,
                            calendar.get(java.util.Calendar.DAY_OF_MONTH)
                        )
                    }
                    showDatePicker = false
                }) { Text("OK", color = SwastikPurple) }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Cancel") }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    // TimePicker Dialog
    if (showTimePicker) {
        val timePickerState = rememberTimePickerState()
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            title = { Text("Select Time") },
            text = {
                TimePicker(state = timePickerState)
            },
            confirmButton = {
                TextButton(onClick = {
                    bookingTime = String.format(Locale.US, "%02d:%02d", timePickerState.hour, timePickerState.minute)
                    showTimePicker = false
                }) { Text("OK", color = SwastikPurple) }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun CenterCard(center: DiagnosticCenterDto, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(4.dp),
        onClick = onClick
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(50.dp)
                    .clip(CircleShape)
                    .background(SwastikPurple.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Biotech, null, tint = SwastikPurple, modifier = Modifier.size(28.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(center.name, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(center.address ?: "", color = Color.Gray, fontSize = 13.sp, maxLines = 1)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    center.rating?.let {
                        Icon(Icons.Default.Star, null, tint = Color(0xFFFFC107), modifier = Modifier.size(14.dp))
                        Text(" ${String.format(Locale.US, "%.1f", it)}", fontSize = 12.sp, color = Color.Gray)
                        Spacer(Modifier.width(8.dp))
                    }
                    center.distance?.let {
                        Icon(Icons.Default.LocationOn, null, tint = Color.Gray, modifier = Modifier.size(14.dp))
                        Text(" ${String.format(Locale.US, "%.1f", it)} km", fontSize = 12.sp, color = Color.Gray)
                    }
                }
            }
            Icon(Icons.Default.ChevronRight, null, tint = Color.Gray)
        }
    }
}

@Composable
private fun CenterTestsView(
    center: DiagnosticCenterDto,
    tests: List<DiagnosticTestDto>,
    selectedTest: DiagnosticTestDto?,
    onTestSelect: (DiagnosticTestDto) -> Unit,
    onBookClick: () -> Unit,
    onBackToList: () -> Unit
) {
    Column(Modifier.fillMaxSize()) {
        // Center header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBackToList) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back to list")
            }
            Text(center.name, fontWeight = FontWeight.Bold, fontSize = 18.sp)
        }

        HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))

        if (tests.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No tests available", color = Color.Gray)
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.weight(1f)
            ) {
                items(tests) { test ->
                    TestCard(
                        test = test,
                        isSelected = selectedTest?.id == test.id,
                        onSelect = { onTestSelect(test) }
                    )
                }
            }

            // Book button
            if (selectedTest != null) {
                Button(
                    onClick = onBookClick,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                        .height(52.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.EventAvailable, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Book ${selectedTest.name}", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }
        }
    }
}

@Composable
private fun TestCard(
    test: DiagnosticTestDto,
    isSelected: Boolean,
    onSelect: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        border = if (isSelected) BorderStroke(2.dp, SwastikPurple) else null,
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) SwastikPurple.copy(alpha = 0.05f) else MaterialTheme.colorScheme.surface
        ),
        onClick = onSelect
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (isSelected) {
                Icon(Icons.Default.CheckCircle, null, tint = SwastikPurple, modifier = Modifier.size(24.dp))
            } else {
                Icon(Icons.Outlined.RadioButtonUnchecked, null, tint = Color.Gray, modifier = Modifier.size(24.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(test.name, fontWeight = FontWeight.SemiBold)
                test.category?.let { Text(it, color = Color.Gray, fontSize = 12.sp) }
                test.reportTime?.let { Text("Report in: $it", color = Color.Gray, fontSize = 12.sp) }
            }
            test.price?.let {
                Text("₹${it.toInt()}", fontWeight = FontWeight.Bold, color = SwastikPurple, fontSize = 16.sp)
            }
        }
    }
}
