package com.example.swastik.ui.screens.patient.booking

import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
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
import com.example.swastik.data.model.Doctor
import com.example.swastik.data.model.TimeSlot
import com.example.swastik.ui.theme.SwastikPurple
import com.example.swastik.ui.theme.SwastikPurpleLight
import com.example.swastik.ui.viewmodel.AppointmentViewModel
import com.example.swastik.ui.viewmodel.AppointmentUiState
import com.example.swastik.ui.viewmodel.DoctorSearchViewModel
import com.example.swastik.ui.viewmodel.DoctorSearchUiState
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.*

/**
 * Multi-step Appointment Booking Screen:
 * Step 1 → Search & select a doctor
 * Step 2 → Pick date & time slot
 * Step 3 → Choose type, add notes, confirm & book
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppointmentBookingScreen(
    onBackClick: () -> Unit,
    onBookingComplete: () -> Unit,
    preselectedDoctorId: String? = null,
    preselectedHospitalId: String? = null,
    preselectedClinicId: String? = null,
    doctorSearchViewModel: DoctorSearchViewModel = hiltViewModel(),
    appointmentViewModel: AppointmentViewModel = hiltViewModel()
) {
    // booking wizard state
    var currentStep by remember { mutableIntStateOf(1) }
    var selectedDoctor by remember { mutableStateOf<Doctor?>(null) }
    var selectedDate by remember { mutableStateOf<LocalDate?>(null) }
    var selectedTimeSlot by remember { mutableStateOf<String?>(null) }
    var selectedType by remember { mutableStateOf("video") }
    var notes by remember { mutableStateOf("") }

    LaunchedEffect(preselectedHospitalId, preselectedClinicId) {
        if (!preselectedHospitalId.isNullOrBlank() || !preselectedClinicId.isNullOrBlank()) {
            doctorSearchViewModel.updateFilters(
                hospitalId = preselectedHospitalId,
                clinicId = preselectedClinicId
            )
        } else {
            doctorSearchViewModel.searchDoctors(resetList = true)
        }
    }

    LaunchedEffect(preselectedDoctorId) {
        if (!preselectedDoctorId.isNullOrBlank()) {
            doctorSearchViewModel.selectDoctor(preselectedDoctorId)
        }
    }

    val doctorState by doctorSearchViewModel.uiState.collectAsState()
    val appointmentState = appointmentViewModel.uiState

    LaunchedEffect(preselectedDoctorId, doctorState.selectedDoctor?.doctor?.id) {
        val preselected = preselectedDoctorId ?: return@LaunchedEffect
        val doctor = doctorState.selectedDoctor?.doctor ?: return@LaunchedEffect
        if (doctor.id == preselected && selectedDoctor?.id != doctor.id) {
            selectedDoctor = doctor
            currentStep = 2
        }
    }

    // Handle successful booking
    LaunchedEffect(appointmentState.bookingSuccess) {
        if (appointmentState.bookingSuccess) {
            appointmentViewModel.resetBookingState()
            onBookingComplete()
        }
    }

    val stepTitle = when (currentStep) {
        1 -> "Select Doctor"
        2 -> "Pick Date & Time"
        3 -> "Confirm Booking"
        else -> "Book Appointment"
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(stepTitle, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                        Text(
                            "Step $currentStep of 3",
                            fontSize = 12.sp,
                            color = Color.Gray
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = {
                        when (currentStep) {
                            1 -> onBackClick()
                            2 -> {
                                currentStep = 1
                                selectedDate = null
                                selectedTimeSlot = null
                            }
                            3 -> currentStep = 2
                        }
                    }) {
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
        ) {
            // Step indicator bar
            StepIndicator(currentStep = currentStep)

            // Error banner
            appointmentState.error?.let { error ->
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    color = MaterialTheme.colorScheme.errorContainer,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = error,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.weight(1f),
                            fontSize = 13.sp
                        )
                        TextButton(onClick = { appointmentViewModel.clearError() }) {
                            Text("Dismiss")
                        }
                    }
                }
            }

            AnimatedContent(
                targetState = currentStep,
                transitionSpec = {
                    slideInHorizontally { if (targetState > initialState) it else -it } + fadeIn() togetherWith
                            slideOutHorizontally { if (targetState > initialState) -it else it } + fadeOut()
                },
                label = "step_animation"
            ) { step ->
                when (step) {
                    1 -> DoctorSelectionStep(
                        doctorSearchViewModel = doctorSearchViewModel,
                        uiState = doctorState,
                        onDoctorSelected = { doctor ->
                            selectedDoctor = doctor
                            currentStep = 2
                        }
                    )
                    2 -> DateTimeSelectionStep(
                        doctor = selectedDoctor!!,
                        appointmentViewModel = appointmentViewModel,
                        appointmentState = appointmentState,
                        selectedDate = selectedDate,
                        selectedTimeSlot = selectedTimeSlot,
                        onDateSelected = { date ->
                            selectedDate = date
                            selectedTimeSlot = null
                            val formatted =
                                date.format(DateTimeFormatter.ISO_LOCAL_DATE)
                            appointmentViewModel.loadTimeSlots(
                                selectedDoctor!!.id,
                                formatted
                            )
                        },
                        onTimeSlotSelected = { slot -> selectedTimeSlot = slot },
                        onContinue = { currentStep = 3 }
                    )
                    3 -> ConfirmationStep(
                        doctor = selectedDoctor!!,
                        date = selectedDate!!,
                        timeSlot = selectedTimeSlot!!,
                        selectedType = selectedType,
                        notes = notes,
                        isBooking = appointmentState.isBooking,
                        onTypeChanged = { selectedType = it },
                        onNotesChanged = { notes = it },
                        onConfirm = {
                            val formatted =
                                selectedDate!!.format(DateTimeFormatter.ISO_LOCAL_DATE)
                            appointmentViewModel.bookAppointment(
                                doctorId = selectedDoctor!!.id,
                                date = formatted,
                                timeSlot = selectedTimeSlot!!,
                                type = selectedType,
                                notes = notes.ifBlank { null },
                                hospitalId = preselectedHospitalId,
                                clinicId = preselectedClinicId
                            )
                        }
                    )
                }
            }
        }
    }
}

// ────────────────────────────────────────────────────────────────
// Step Indicator
// ────────────────────────────────────────────────────────────────
@Composable
private fun StepIndicator(currentStep: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        for (step in 1..3) {
            val isActive = step <= currentStep
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(
                        if (isActive) SwastikPurple
                        else Color.LightGray.copy(alpha = 0.5f)
                    ),
                contentAlignment = Alignment.Center
            ) {
                if (step < currentStep) {
                    Icon(
                        Icons.Outlined.Check,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                } else {
                    Text(
                        "$step",
                        color = if (isActive) Color.White else Color.Gray,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                }
            }
            if (step < 3) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(3.dp)
                        .padding(horizontal = 4.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(
                            if (step < currentStep) SwastikPurple
                            else Color.LightGray.copy(alpha = 0.3f)
                        )
                )
            }
        }
    }
}

// ────────────────────────────────────────────────────────────────
// STEP 1 — Doctor Search & Selection
// ────────────────────────────────────────────────────────────────
@Composable
private fun DoctorSelectionStep(
    doctorSearchViewModel: DoctorSearchViewModel,
    uiState: DoctorSearchUiState,
    onDoctorSelected: (Doctor) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedSpecialization by remember { mutableStateOf<String?>(null) }

    Column(modifier = Modifier.fillMaxSize()) {
        // Search bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = {
                searchQuery = it
                doctorSearchViewModel.updateFilters(search = it.ifBlank { null })
            },
            placeholder = { Text("Search doctors by name or specialty") },
            leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            shape = RoundedCornerShape(16.dp),
            singleLine = true
        )

        // Specialization chips
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            val specializations = doctorSearchViewModel.getSpecializations()
            items(specializations) { spec ->
                FilterChip(
                    selected = selectedSpecialization == spec,
                    onClick = {
                        selectedSpecialization =
                            if (selectedSpecialization == spec) null else spec
                        doctorSearchViewModel.updateFilters(
                            search = searchQuery.ifBlank { null },
                            specialization = selectedSpecialization
                        )
                    },
                    label = { Text(spec, fontSize = 13.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = SwastikPurple,
                        selectedLabelColor = Color.White
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        when {
            uiState.isLoading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = SwastikPurple)
                }
            }
            uiState.error != null -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            uiState.error ?: "Error",
                            color = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(
                            onClick = {
                                doctorSearchViewModel.searchDoctors(resetList = true)
                            }
                        ) {
                            Text("Retry")
                        }
                    }
                }
            }
            uiState.doctors.isEmpty() -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Outlined.PersonSearch,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = Color.Gray
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("No doctors found", color = Color.Gray, fontSize = 16.sp)
                        Text(
                            "Try a different search",
                            color = Color.LightGray,
                            fontSize = 14.sp
                        )
                    }
                }
            }
            else -> {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(uiState.doctors) { doctor ->
                        DoctorBookingCard(
                            doctor = doctor,
                            onSelect = { onDoctorSelected(doctor) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DoctorBookingCard(
    doctor: Doctor,
    onSelect: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onSelect),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(SwastikPurpleLight),
                    contentAlignment = Alignment.Center
                ) {
                    Text("👨‍⚕️", fontSize = 28.sp)
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = doctor.name,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                    Text(
                        text = doctor.specialization,
                        fontSize = 14.sp,
                        color = SwastikPurple
                    )
                    doctor.experienceYears?.let {
                        Text(
                            text = "$it yrs experience",
                            fontSize = 13.sp,
                            color = Color.Gray
                        )
                    }
                }
                Column(horizontalAlignment = Alignment.End) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Outlined.Star,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = Color(0xFFFFB800)
                        )
                        Text(
                            text = doctor.averageRating?.let {
                                String.format(Locale.US, "%.1f", it)
                            } ?: "N/A",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                    doctor.consultationFee?.let {
                        Text(
                            "₹$it",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = SwastikPurple
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = onSelect,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
            ) {
                Text("Select Doctor")
            }
        }
    }
}

// ────────────────────────────────────────────────────────────────
// STEP 2 — Date & Time Slot Selection
// ────────────────────────────────────────────────────────────────
@Composable
private fun DateTimeSelectionStep(
    doctor: Doctor,
    appointmentViewModel: AppointmentViewModel,
    appointmentState: AppointmentUiState,
    selectedDate: LocalDate?,
    selectedTimeSlot: String?,
    onDateSelected: (LocalDate) -> Unit,
    onTimeSlotSelected: (String) -> Unit,
    onContinue: () -> Unit
) {
    val today = LocalDate.now()
    val dates = remember { (0..13).map { today.plusDays(it.toLong()) } }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Doctor summary header
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = SwastikPurpleLight.copy(alpha = 0.3f)
                )
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(SwastikPurple),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("👨‍⚕️", fontSize = 22.sp)
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            doctor.name,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        )
                        Text(
                            doctor.specialization,
                            fontSize = 13.sp,
                            color = SwastikPurple
                        )
                    }
                }
            }
        }

        // Date selector
        item {
            Text(
                "📅 Select Date",
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp
            )
            Spacer(modifier = Modifier.height(8.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                items(dates) { date ->
                    val isSelected = date == selectedDate
                    val isToday = date == today
                    Surface(
                        modifier = Modifier
                            .width(68.dp)
                            .clickable { onDateSelected(date) },
                        shape = RoundedCornerShape(14.dp),
                        color = if (isSelected) SwastikPurple
                        else if (isToday) SwastikPurpleLight.copy(alpha = 0.3f)
                        else MaterialTheme.colorScheme.surfaceVariant,
                        border = if (isToday && !isSelected)
                            BorderStroke(1.dp, SwastikPurple)
                        else null
                    ) {
                        Column(
                            modifier = Modifier.padding(vertical = 12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = date.dayOfWeek.getDisplayName(
                                    TextStyle.SHORT,
                                    Locale.getDefault()
                                ),
                                fontSize = 12.sp,
                                color = if (isSelected) Color.White else Color.Gray
                            )
                            Text(
                                text = "${date.dayOfMonth}",
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isSelected) Color.White
                                else MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = date.month.getDisplayName(
                                    TextStyle.SHORT,
                                    Locale.getDefault()
                                ),
                                fontSize = 11.sp,
                                color = if (isSelected) Color.White.copy(alpha = 0.8f)
                                else Color.Gray
                            )
                        }
                    }
                }
            }
        }

        // Time slot grid
        item {
            if (selectedDate != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    "🕐 Available Time Slots",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp
                )
                Spacer(modifier = Modifier.height(8.dp))

                when {
                    appointmentState.isLoadingSlots -> {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(120.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(
                                color = SwastikPurple,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                    }
                    appointmentState.timeSlots.isEmpty() -> {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = Color(0xFFFFF3E0)
                            )
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text("😔", fontSize = 32.sp)
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    "No slots available",
                                    fontWeight = FontWeight.Medium,
                                    fontSize = 15.sp
                                )
                                Text(
                                    "Try another date",
                                    fontSize = 13.sp,
                                    color = Color.Gray
                                )
                            }
                        }
                    }
                    else -> {
                        TimeSlotGrid(
                            slots = appointmentState.timeSlots,
                            selectedSlot = selectedTimeSlot,
                            onSlotSelected = onTimeSlotSelected
                        )
                    }
                }
            } else {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                            .copy(alpha = 0.5f)
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("☝️", fontSize = 32.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Select a date above to see available slots",
                            fontSize = 14.sp,
                            color = Color.Gray,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }

        // Continue button
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = onContinue,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                enabled = selectedDate != null && selectedTimeSlot != null,
                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
            ) {
                Text(
                    "Continue",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp
                )
            }
        }
    }
}

@Composable
private fun TimeSlotGrid(
    slots: List<TimeSlot>,
    selectedSlot: String?,
    onSlotSelected: (String) -> Unit
) {
    val availableSlots = slots.filter { it.isAvailable }
    val unavailableSlots = slots.filter { !it.isAvailable }

    Column {
        if (availableSlots.isNotEmpty()) {
            SlotChunkRows(
                slots = availableSlots,
                selectedSlot = selectedSlot,
                enabled = true,
                onSlotSelected = onSlotSelected
            )
        }
        if (unavailableSlots.isNotEmpty()) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "Booked",
                fontSize = 12.sp,
                color = Color.Gray,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            SlotChunkRows(
                slots = unavailableSlots,
                selectedSlot = null,
                enabled = false,
                onSlotSelected = {}
            )
        }
    }
}

@Composable
private fun SlotChunkRows(
    slots: List<TimeSlot>,
    selectedSlot: String?,
    enabled: Boolean,
    onSlotSelected: (String) -> Unit
) {
    val chunked = slots.chunked(4)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        chunked.forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                row.forEach { slot ->
                    val isSelected = slot.time == selectedSlot
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .then(
                                if (enabled) Modifier.clickable {
                                    onSlotSelected(slot.time)
                                } else Modifier
                            ),
                        shape = RoundedCornerShape(10.dp),
                        color = when {
                            isSelected -> SwastikPurple
                            !enabled -> Color.LightGray.copy(alpha = 0.3f)
                            else -> MaterialTheme.colorScheme.surfaceVariant
                        },
                        border = if (isSelected) null
                        else BorderStroke(
                            1.dp,
                            if (enabled) SwastikPurple.copy(alpha = 0.3f)
                            else Color.LightGray.copy(alpha = 0.2f)
                        )
                    ) {
                        Text(
                            text = slot.time,
                            modifier = Modifier.padding(
                                vertical = 10.dp,
                                horizontal = 4.dp
                            ),
                            fontSize = 13.sp,
                            fontWeight = if (isSelected) FontWeight.SemiBold
                            else FontWeight.Normal,
                            color = when {
                                isSelected -> Color.White
                                !enabled -> Color.Gray.copy(alpha = 0.5f)
                                else -> MaterialTheme.colorScheme.onSurface
                            },
                            textAlign = TextAlign.Center,
                            maxLines = 1
                        )
                    }
                }
                // Fill remaining weight if row < 4
                repeat(4 - row.size) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

// ────────────────────────────────────────────────────────────────
// STEP 3 — Confirmation
// ────────────────────────────────────────────────────────────────
@Composable
private fun ConfirmationStep(
    doctor: Doctor,
    date: LocalDate,
    timeSlot: String,
    selectedType: String,
    notes: String,
    isBooking: Boolean,
    onTypeChanged: (String) -> Unit,
    onNotesChanged: (String) -> Unit,
    onConfirm: () -> Unit
) {
    val types = listOf(
        Triple("video", "📹", "Video Call"),
        Triple("clinic", "🏥", "Clinic Visit"),
        Triple("home_visit", "🏠", "Home Visit"),
        Triple("in_person", "👤", "In Person")
    )

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Summary card
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text(
                        "Booking Summary",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    SummaryRow(
                        icon = "👨‍⚕️",
                        label = "Doctor",
                        value = doctor.name
                    )
                    SummaryRow(
                        icon = "🏷️",
                        label = "Specialty",
                        value = doctor.specialization
                    )
                    SummaryRow(
                        icon = "📅",
                        label = "Date",
                        value = date.format(
                            DateTimeFormatter.ofPattern("EEE, dd MMM yyyy")
                        )
                    )
                    SummaryRow(icon = "🕐", label = "Time", value = timeSlot)
                    doctor.consultationFee?.let {
                        SummaryRow(icon = "💰", label = "Fee", value = "₹$it")
                    }
                }
            }
        }

        // Appointment type selector
        item {
            Text(
                "Consultation Type",
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                types.forEach { (type, emoji, label) ->
                    val isSelected = selectedType == type
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { onTypeChanged(type) },
                        shape = RoundedCornerShape(12.dp),
                        color = if (isSelected) SwastikPurple
                        else MaterialTheme.colorScheme.surfaceVariant,
                        border = if (!isSelected) BorderStroke(
                            1.dp,
                            SwastikPurple.copy(alpha = 0.2f)
                        ) else null
                    ) {
                        Column(
                            modifier = Modifier.padding(
                                vertical = 12.dp,
                                horizontal = 4.dp
                            ),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(emoji, fontSize = 22.sp)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = label,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.SemiBold
                                else FontWeight.Normal,
                                color = if (isSelected) Color.White
                                else MaterialTheme.colorScheme.onSurface,
                                textAlign = TextAlign.Center,
                                maxLines = 1
                            )
                        }
                    }
                }
            }
        }

        // Notes
        item {
            Text(
                "Notes (optional)",
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = notes,
                onValueChange = onNotesChanged,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(100.dp),
                placeholder = {
                    Text("Describe your symptoms or reason for visit...")
                },
                shape = RoundedCornerShape(12.dp),
                maxLines = 4
            )
        }

        // Confirm button
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = onConfirm,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(14.dp),
                enabled = !isBooking,
                colors = ButtonDefaults.buttonColors(
                    containerColor = SwastikPurple
                )
            ) {
                if (isBooking) {
                    CircularProgressIndicator(
                        color = Color.White,
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "Booking...",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                } else {
                    Icon(Icons.Outlined.CheckCircle, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "Confirm Booking",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp
                    )
                }
            }
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SummaryRow(icon: String, label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(icon, fontSize = 18.sp)
        Spacer(modifier = Modifier.width(10.dp))
        Text(
            label,
            fontSize = 14.sp,
            color = Color.Gray,
            modifier = Modifier.width(80.dp)
        )
        Text(value, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}
