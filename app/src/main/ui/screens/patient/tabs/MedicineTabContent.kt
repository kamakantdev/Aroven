package com.example.swastik.ui.screens.patient.tabs

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.R
import com.example.swastik.data.model.*
import com.example.swastik.ui.viewmodel.MedicineViewModel
import com.example.swastik.ui.theme.SwastikPurple

import com.example.swastik.ui.components.MedicineListShimmer

import com.example.swastik.data.model.PatientProfile

/**
 * Medicine Tab Content
 * Provides medicine search and filtering functionality via ViewModel + API
 */
@Composable
fun MedicineTabContent(
    modifier: Modifier = Modifier,
    profile: PatientProfile?,
    unreadNotificationsCount: Int,
    onMedicineClick: (String) -> Unit = {},
    onNotificationClick: () -> Unit = {},
    onNavigateToCart: () -> Unit = {},
    viewModel: MedicineViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    var searchQuery by remember { mutableStateOf("") }

    val filteredMedicines = viewModel.getFilteredMedicines()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        // Header
        MedicineFinderHeader(profile, unreadNotificationsCount, onNotificationClick)

        // Main Content Card
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
                Text(
                    text = stringResource(R.string.medicine_finder),
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black,
                    modifier = Modifier.padding(horizontal = 20.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                MedicineSearchBar(
                    searchQuery = searchQuery,
                    onSearchChange = {
                        searchQuery = it
                        viewModel.searchMedicines(it)
                    }
                )

                Spacer(modifier = Modifier.height(16.dp))

                MedicineCategoryFilter(
                    selectedCategory = state.selectedCategory,
                    onCategorySelected = { viewModel.setCategory(it) }
                )

                Spacer(modifier = Modifier.height(8.dp))

                if (state.isLoading) {
                    MedicineListShimmer()
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
                                text = state.error ?: "Something went wrong",
                                fontSize = 14.sp,
                                color = Color.Gray
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(
                                onClick = { viewModel.loadPopularMedicines() },
                                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
                            ) {
                                Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(stringResource(R.string.retry))
                            }
                        }
                    }
                } else if (filteredMedicines.isEmpty()) {
                    EmptyMedicineState(
                        onClearFilters = {
                            searchQuery = ""
                            viewModel.setCategory(null)
                            viewModel.loadPopularMedicines()
                        }
                    )
                } else {
                    MedicineList(
                        medicines = filteredMedicines,
                        onMedicineClick = { medicine -> onMedicineClick(medicine.id) },
                        onPharmacyClick = { /* Open pharmacy info */ }
                    )
                }
            }
        }
    }
}

@Composable
private fun MedicineFinderHeader(
    profile: PatientProfile?,
    unreadCount: Int,
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
                text = profile?.name?.split(" ")?.firstOrNull()?.ifEmpty { "User" } ?: "User",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
            Text(
                text = "Patient",
                fontSize = 13.sp,
                color = Color.Gray
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        Box {
            IconButton(onClick = onNotificationClick) {
                Icon(
                    Icons.Outlined.Notifications,
                    contentDescription = "Notifications",
                    tint = Color.Black
                )
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
private fun MedicineSearchBar(
    searchQuery: String,
    onSearchChange: (String) -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    OutlinedTextField(
        value = searchQuery,
        onValueChange = onSearchChange,
        placeholder = { Text("Search for medicines", color = Color.Gray) },
        leadingIcon = {
            Icon(Icons.Default.Search, contentDescription = null, tint = Color.Gray)
        },
        trailingIcon = {
            if (searchQuery.isNotEmpty()) {
                IconButton(onClick = { onSearchChange("") }) {
                    Icon(Icons.Default.Close, contentDescription = "Clear", tint = Color.Gray)
                }
            } else {
                IconButton(onClick = {
                    android.widget.Toast.makeText(context, "Voice search is unavailable", android.widget.Toast.LENGTH_SHORT).show()
                }) {
                    Icon(Icons.Default.Mic, contentDescription = "Voice Search", tint = SwastikPurple)
                }
            }
        },
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .shadow(2.dp, RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp),
        colors = OutlinedTextFieldDefaults.colors(
            unfocusedBorderColor = Color.LightGray,
            focusedBorderColor = SwastikPurple,
            unfocusedContainerColor = Color.White,
            focusedContainerColor = Color.White
        ),
        singleLine = true
    )
}

@Composable
private fun MedicineCategoryFilter(
    selectedCategory: MedicineCategory?,
    onCategorySelected: (MedicineCategory?) -> Unit
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            FilterChip(
                selected = selectedCategory == null,
                onClick = { onCategorySelected(null) },
                label = { Text("All", fontSize = 12.sp) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = SwastikPurple,
                    selectedLabelColor = Color.White
                )
            )
        }
        items(MedicineCategory.entries.toTypedArray()) { category ->
            FilterChip(
                selected = selectedCategory == category,
                onClick = { onCategorySelected(if (selectedCategory == category) null else category) },
                label = {
                    Text(
                        category.name.lowercase().replaceFirstChar { it.uppercase() },
                        fontSize = 12.sp
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = SwastikPurple,
                    selectedLabelColor = Color.White
                )
            )
        }
    }
}

@Composable
private fun EmptyMedicineState(onClearFilters: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                Icons.Outlined.SearchOff,
                contentDescription = null,
                tint = Color.Gray,
                modifier = Modifier.size(64.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                "No medicines found",
                fontSize = 18.sp,
                fontWeight = FontWeight.Medium,
                color = Color.Gray
            )
            Spacer(modifier = Modifier.height(8.dp))
            TextButton(onClick = onClearFilters) {
                Text("Clear filters", color = SwastikPurple)
            }
        }
    }
}

@Composable
private fun MedicineList(
    medicines: List<Medicine>,
    onMedicineClick: (Medicine) -> Unit,
    onPharmacyClick: (Medicine) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        items(items = medicines, key = { it.id }) { medicine ->
            MedicineListItem(
                medicine = medicine,
                onClick = { onMedicineClick(medicine) },
                onPharmacyClick = { onPharmacyClick(medicine) }
            )
        }
        item { Spacer(modifier = Modifier.height(16.dp)) }
    }
}

@Composable
private fun MedicineListItem(
    medicine: Medicine,
    onClick: () -> Unit,
    onPharmacyClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(vertical = 12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = medicine.name,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.Black
                )
                Text(
                    text = "₹${medicine.price}",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )
                Text(
                    text = medicine.manufacturer ?: "",
                    fontSize = 14.sp,
                    color = Color.Gray
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = if (medicine.inStock) "In stock" else "Out of stock",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (medicine.inStock) Color(0xFF4CAF50) else Color(0xFFE53935)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable { onPharmacyClick() }
                ) {
                    Icon(
                        Icons.Default.LocationOn,
                        contentDescription = null,
                        tint = SwastikPurple,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = medicine.nearbyPharmacy ?: "",
                        fontSize = 13.sp,
                        color = SwastikPurple,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        HorizontalDivider(color = Color.LightGray.copy(alpha = 0.5f))
    }
}
