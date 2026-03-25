package com.example.swastik.ui.screens.patient.medicine

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.R
import com.example.swastik.data.model.Medicine
import com.example.swastik.ui.viewmodel.MedicineViewModel
import com.example.swastik.ui.theme.SwastikPurple
import java.util.Locale

/**
 * Medicine Detail Screen
 * Shows detailed information about a specific medicine from API
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MedicineDetailScreen(
    medicineId: String,
    onBackClick: () -> Unit,
    onNavigateToCart: () -> Unit = {},
    viewModel: MedicineViewModel = hiltViewModel()
) {
    // Load medicine detail + availability from API
    LaunchedEffect(medicineId) {
        viewModel.loadMedicineDetail(medicineId)
    }

    val detailState by viewModel.detailState.collectAsState()
    val medicine = detailState.medicine

    // Map API availability to PharmacyInfo for display
    val pharmacies = detailState.availability.map { avail ->
        PharmacyInfo(
            id = avail.pharmacyId,
            name = avail.pharmacyName,
            distance = avail.distance?.let { "${String.format(Locale.US, "%.1f", it)} km" } ?: "N/A",
            available = avail.inStock,
            price = avail.price?.toInt()?.let { "₹$it" } ?: medicine?.price?.toInt()?.let { "₹$it" } ?: "Price unavailable"
        )
    }

    // Loading or error state when medicine not yet loaded
    if (medicine == null) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text(stringResource(R.string.medicine_details), fontWeight = FontWeight.SemiBold) },
                    navigationIcon = {
                        IconButton(onClick = onBackClick) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
                )
            },
            containerColor = Color(0xFFF5F5F5)
        ) { paddingValues ->
            Box(
                modifier = Modifier.fillMaxSize().padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                if (detailState.isLoading) {
                    CircularProgressIndicator(color = SwastikPurple)
                } else {
                    Text(stringResource(R.string.medicine_not_found), color = Color.Gray)
                }
            }
        }
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stringResource(R.string.medicine_details),
                        fontWeight = FontWeight.SemiBold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.White
                )
            )
        },
        bottomBar = {
            MedicineDetailBottomBar(
                price = medicine.price?.toInt(),
                inStock = medicine.inStock,
                onViewCart = onNavigateToCart
            )
        },
        containerColor = Color(0xFFF5F5F5)
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
        ) {
            // Medicine Header Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Medicine Icon
                    Box(
                        modifier = Modifier
                            .size(100.dp)
                            .background(SwastikPurple.copy(alpha = 0.1f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = getMedicineCategoryEmoji(medicine.category.name),
                            fontSize = 48.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Medicine Name
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = medicine.name,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.Black
                        )
                        if (medicine.requiresPrescription) {
                            Spacer(modifier = Modifier.width(8.dp))
                            Box(
                                modifier = Modifier
                                    .background(
                                        Color(0xFFFF9800).copy(alpha = 0.1f),
                                        RoundedCornerShape(6.dp)
                                    )
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    "Rx Required",
                                    fontSize = 12.sp,
                                    color = Color(0xFFFF9800),
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Manufacturer
                    Text(
                        text = "by ${medicine.manufacturer}",
                        fontSize = 14.sp,
                        color = Color.Gray
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Category and Stock Status
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        InfoChip(
                            icon = Icons.Outlined.Category,
                            label = medicine.category.name.lowercase().replaceFirstChar { it.uppercase() },
                            color = SwastikPurple
                        )
                        InfoChip(
                            icon = if (medicine.inStock) Icons.Default.CheckCircle else Icons.Default.Cancel,
                            label = if (medicine.inStock) "In Stock" else "Out of Stock",
                            color = if (medicine.inStock) Color(0xFF4CAF50) else Color(0xFFE53935)
                        )
                    }
                }
            }

            // Description Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        stringResource(R.string.description),
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = Color.Black
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        medicine.description ?: stringResource(R.string.no_description),
                        fontSize = 14.sp,
                        color = Color.DarkGray,
                        lineHeight = 22.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Available at Pharmacies Header
            Text(
                stringResource(R.string.select_pharmacy_to_order),
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = SwastikPurple,
                modifier = Modifier.padding(horizontal = 16.dp)
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Pharmacy List
            if (detailState.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = SwastikPurple, modifier = Modifier.size(24.dp))
                }
            } else if (pharmacies.isEmpty()) {
                Text(
                    stringResource(R.string.no_pharmacy_data),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    fontSize = 14.sp,
                    color = Color.Gray
                )
            } else {
                pharmacies.forEach { pharmacy ->
                    PharmacyAvailabilityCard(
                        pharmacy = pharmacy,
                        onClick = {
                            if (pharmacy.available) {
                                viewModel.addToCart(medicine, pharmacy.id, pharmacy.name)
                                onNavigateToCart()
                            }
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(100.dp))
        }
    }
}

@Composable
private fun InfoChip(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    color: Color
) {
    Row(
        modifier = Modifier
            .background(color.copy(alpha = 0.1f), RoundedCornerShape(20.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = color,
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            label,
            fontSize = 13.sp,
            color = color,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun PharmacyAvailabilityCard(
    pharmacy: PharmacyInfo,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Pharmacy Icon
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(Color(0xFF4CAF50).copy(alpha = 0.1f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.LocalPharmacy,
                    contentDescription = null,
                    tint = Color(0xFF4CAF50),
                    modifier = Modifier.size(28.dp)
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Pharmacy Info
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    pharmacy.name,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                    color = Color.Black
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.LocationOn,
                        contentDescription = null,
                        tint = Color.Gray,
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        " ${pharmacy.distance}",
                        fontSize = 13.sp,
                        color = Color.Gray
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .background(
                                if (pharmacy.available) Color(0xFF4CAF50) else Color(0xFFE53935),
                                CircleShape
                            )
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        if (pharmacy.available) "Available" else "Out of Stock",
                        fontSize = 12.sp,
                        color = if (pharmacy.available) Color(0xFF4CAF50) else Color(0xFFE53935)
                    )
                }
            }

            // Price
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    pharmacy.price,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = SwastikPurple
                )
                Icon(
                    Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = Color.Gray
                )
            }
        }
    }
}

@Composable
private fun MedicineDetailBottomBar(
    price: Int?,
    inStock: Boolean,
    onViewCart: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White,
        shadowElevation = 16.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    stringResource(R.string.price),
                    fontSize = 12.sp,
                    color = Color.Gray
                )
                Text(
                    price?.let { "₹$it" } ?: stringResource(R.string.price_unavailable),
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = SwastikPurple
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            Button(
                onClick = onViewCart,
                enabled = true,
                modifier = Modifier
                    .height(50.dp)
                    .width(180.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (inStock) SwastikPurple else Color.Gray
                )
            ) {
                Icon(
                    Icons.Default.ShoppingCart,
                    contentDescription = null
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    stringResource(R.string.view_cart),
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

// Helper data class
private data class PharmacyInfo(
    val id: String,
    val name: String,
    val distance: String,
    val available: Boolean,
    val price: String
)

// Helper function to get emoji based on category
private fun getMedicineCategoryEmoji(category: String): String {
    return when (category.uppercase()) {
        "TABLET" -> "💊"
        "CAPSULE" -> "💊"
        "SYRUP" -> "🧴"
        "INJECTION" -> "💉"
        "OINTMENT" -> "🧴"
        "DROPS" -> "💧"
        "POWDER" -> "🥄"
        else -> "💊"
    }
}
