package com.example.swastik.ui.screens.patient

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.data.model.*
import com.example.swastik.ui.viewmodel.HospitalDetailViewModel
import com.example.swastik.ui.theme.SwastikPurple
import com.example.swastik.utils.NavigationHelper
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun HospitalDetailScreen(
    hospitalId: String,
    onBackClick: () -> Unit,
    onDoctorBookClick: (HospitalDoctor, MedicalFacility) -> Unit = { _, _ -> },
    isLoggedIn: Boolean = true,
    viewModel: HospitalDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(hospitalId) {
        viewModel.loadHospitalDetails(hospitalId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        uiState.facility?.name ?: "Hospital Details",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 18.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        when {
            uiState.isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = SwastikPurple)
                }
            }

            uiState.error != null -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        Icons.Default.Error,
                        contentDescription = null,
                        tint = Color(0xFFE53935),
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(uiState.error!!, textAlign = TextAlign.Center)
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { viewModel.loadHospitalDetails(hospitalId) }) {
                        Text("Retry")
                    }
                }
            }

            uiState.facility != null -> {
                val facility = uiState.facility!!

                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Header Card
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        ) {
                            Column(modifier = Modifier.padding(20.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(56.dp)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(facility.type.getMarkerColor().copy(alpha = 0.1f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = facility.type.getMarkerIcon(),
                                            contentDescription = null,
                                            tint = facility.type.getMarkerColor(),
                                            modifier = Modifier.size(28.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(16.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = facility.name,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 20.sp,
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        if (facility.hospitalSubType != null) {
                                            Text(
                                                text = facility.hospitalSubType!!,
                                                fontSize = 14.sp,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant
                                            )
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(12.dp))

                                Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            Icons.Default.Star,
                                            contentDescription = null,
                                            tint = Color(0xFFFFC107),
                                            modifier = Modifier.size(20.dp)
                                        )
                                        Text(
                                            " ${facility.rating} (${facility.reviewCount} reviews)",
                                            fontSize = 14.sp
                                        )
                                    }
                                    if (facility.distanceKm > 0) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Icon(
                                                Icons.Outlined.LocationOn,
                                                contentDescription = null,
                                                tint = SwastikPurple,
                                                modifier = Modifier.size(20.dp)
                                            )
                                            Text(" ${facility.distance}", fontSize = 14.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Quick Actions
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    if (facility.phone.isNotBlank()) NavigationHelper.openDialer(context, facility.phone)
                                },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.Call, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Call", fontSize = 13.sp)
                            }
                            OutlinedButton(
                                onClick = {
                                    NavigationHelper.openDirections(context, facility.latitude, facility.longitude, facility.name)
                                },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.Directions, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Directions", fontSize = 13.sp)
                            }
                            if (facility.isEmergencyAvailable) {
                                Button(
                                    onClick = { NavigationHelper.openDialer(context, "108") },
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE53935))
                                ) {
                                    Icon(Icons.Default.LocalHospital, contentDescription = null, modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("SOS", fontSize = 13.sp)
                                }
                            }
                        }
                    }

                    // Info Section
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = when (facility.type) {
                                        FacilityType.CLINIC -> "Clinic Information"
                                        FacilityType.DIAGNOSTIC_CENTER -> "Diagnostic Center Information"
                                        FacilityType.MEDICAL_STORE -> "Medical Store Information"
                                        else -> "Hospital Information"
                                    },
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 16.sp
                                )
                                Spacer(modifier = Modifier.height(12.dp))

                                // Address
                                Row(modifier = Modifier.fillMaxWidth()) {
                                    Icon(Icons.Outlined.Place, contentDescription = null, tint = SwastikPurple, modifier = Modifier.size(20.dp))
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Text(facility.address, fontSize = 14.sp, modifier = Modifier.weight(1f))
                                }

                                if (facility.phone.isNotBlank()) {
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Row(modifier = Modifier.fillMaxWidth()) {
                                        Icon(Icons.Outlined.Phone, contentDescription = null, tint = SwastikPurple, modifier = Modifier.size(20.dp))
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Text(facility.phone, fontSize = 14.sp)
                                    }
                                }

                                if (facility.specializations.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Text("Specializations", fontWeight = FontWeight.Medium, fontSize = 14.sp)
                                    Spacer(modifier = Modifier.height(6.dp))
                                    FlowRow(
                                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                                        verticalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        facility.specializations.forEach { spec ->
                                            AssistChip(
                                                onClick = {},
                                                label = { Text(spec, fontSize = 12.sp) },
                                                shape = RoundedCornerShape(8.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Features
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            if (facility.isEmergencyAvailable) {
                                Card(
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFFE53935).copy(alpha = 0.1f))
                                ) {
                                    Column(
                                        modifier = Modifier.padding(12.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Icon(Icons.Default.LocalHospital, contentDescription = null, tint = Color(0xFFE53935))
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text("Emergency\n24/7", fontSize = 12.sp, textAlign = TextAlign.Center, fontWeight = FontWeight.Medium)
                                    }
                                }
                            }
                            if (facility.isOpen) {
                                Card(
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(12.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFF4CAF50).copy(alpha = 0.1f))
                                ) {
                                    Column(
                                        modifier = Modifier.padding(12.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF4CAF50))
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text("Open Now", fontSize = 12.sp, textAlign = TextAlign.Center, fontWeight = FontWeight.Medium)
                                    }
                                }
                            }
                        }
                    }

                    // Review Section
                    item {
                        HospitalReviewSection(
                            hospitalId = facility.id,
                            rating = facility.rating,
                            reviewCount = facility.reviewCount,
                            viewModel = viewModel,
                            isLoggedIn = isLoggedIn
                        )
                    }

                    // Doctors
                    if (facility.doctors.isNotEmpty()) {
                        item {
                            Text(
                                "Available Doctors",
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                        }
                        items(facility.doctors) { doctor ->
                            DoctorDetailCard(
                                doctor = doctor,
                                onBook = { onDoctorBookClick(doctor, facility) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HospitalReviewSection(
    hospitalId: String,
    rating: Float,
    reviewCount: Int,
    viewModel: HospitalDetailViewModel,
    isLoggedIn: Boolean = true
) {
    val uiState by viewModel.uiState.collectAsState()
    var showReviewForm by remember { mutableStateOf(false) }
    var userRating by remember { mutableIntStateOf(0) }
    var userComment by remember { mutableStateOf("") }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Reviews", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    Text(
                        "$reviewCount reviews • ${String.format(Locale.US, "%.1f", rating)} avg",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (!showReviewForm) {
                    if (isLoggedIn) {
                        OutlinedButton(
                            onClick = { showReviewForm = true },
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(Icons.Default.RateReview, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Write Review", fontSize = 13.sp)
                        }
                    } else {
                        Text(
                            "Login to write a review",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            if (showReviewForm) {
                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(12.dp))

                Text("Your Rating", fontWeight = FontWeight.Medium, fontSize = 14.sp)
                Spacer(modifier = Modifier.height(8.dp))

                // Star rating
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    for (i in 1..5) {
                        IconButton(
                            onClick = { userRating = i },
                            modifier = Modifier.size(40.dp)
                        ) {
                            Icon(
                                if (i <= userRating) Icons.Default.Star else Icons.Outlined.StarOutline,
                                contentDescription = "Rate $i stars",
                                tint = if (i <= userRating) Color(0xFFFFC107) else Color.Gray,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = userComment,
                    onValueChange = { userComment = it },
                    label = { Text("Your review (optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 3,
                    shape = RoundedCornerShape(12.dp)
                )

                Spacer(modifier = Modifier.height(12.dp))

                if (uiState.reviewError != null) {
                    Text(
                        uiState.reviewError!!,
                        color = Color(0xFFE53935),
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                if (uiState.reviewSuccess) {
                    Text(
                        "✅ Review submitted successfully!",
                        color = Color(0xFF4CAF50),
                        fontWeight = FontWeight.Medium,
                        fontSize = 14.sp
                    )
                    LaunchedEffect(Unit) {
                        kotlinx.coroutines.delay(2000)
                        showReviewForm = false
                        viewModel.clearReviewState()
                    }
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = {
                                showReviewForm = false
                                userRating = 0
                                userComment = ""
                                viewModel.clearReviewState()
                            },
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("Cancel")
                        }
                        Button(
                            onClick = {
                                if (userRating > 0) {
                                    viewModel.submitHospitalReview(
                                        hospitalId,
                                        userRating,
                                        userComment.ifBlank { null }
                                    )
                                }
                            },
                            enabled = userRating > 0 && !uiState.reviewSubmitting,
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            if (uiState.reviewSubmitting) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp,
                                    color = Color.White
                                )
                            } else {
                                Text("Submit")
                            }
                        }
                    }
                }
            }

            // ==================== Existing Reviews List ====================
            if (uiState.reviews.isNotEmpty() || uiState.reviewsLoading) {
                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(12.dp))

                Text("Patient Reviews", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Spacer(modifier = Modifier.height(8.dp))

                if (uiState.reviewsLoading) {
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                    }
                } else {
                    uiState.reviews.forEach { review ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp),
                            verticalAlignment = Alignment.Top
                        ) {
                            // Avatar
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(SwastikPurple.copy(alpha = 0.1f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    (review.patientName?.firstOrNull() ?: 'A').uppercase(),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = SwastikPurple
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        review.patientName ?: "Anonymous",
                                        fontWeight = FontWeight.Medium,
                                        fontSize = 13.sp
                                    )
                                    // Star rating
                                    Row {
                                        repeat(5) { i ->
                                            Icon(
                                                if (i < review.rating) Icons.Default.Star else Icons.Default.StarBorder,
                                                contentDescription = null,
                                                tint = Color(0xFFFFC107),
                                                modifier = Modifier.size(14.dp)
                                            )
                                        }
                                    }
                                }
                                if (!review.comment.isNullOrBlank()) {
                                    Text(
                                        review.comment,
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(top = 2.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            } else if (!uiState.reviewsLoading && uiState.reviews.isEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    "No reviews yet. Be the first to review!",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun DoctorDetailCard(
    doctor: HospitalDoctor,
    onBook: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
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
                    .clip(CircleShape)
                    .background(SwastikPurple.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Text(doctor.imageEmoji, fontSize = 24.sp)
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(doctor.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(doctor.specialization, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Star, contentDescription = null, tint = Color(0xFFFFC107), modifier = Modifier.size(14.dp))
                    Text(" ${doctor.rating}", fontSize = 12.sp)
                    Text(" • ₹${doctor.consultationFee}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Button(
                onClick = onBook,
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text("Book", fontSize = 13.sp)
            }
        }
    }
}
