package com.example.swastik.ui.screens.patient.medicine

import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.R
import com.example.swastik.data.model.Medicine
import com.example.swastik.data.remote.dto.NearbyMedicineDto
import com.example.swastik.data.model.MedicineCategory
import com.example.swastik.ui.viewmodel.MedicineViewModel
import com.example.swastik.ui.theme.SwastikPurple
import java.util.Locale

/**
 * Main Medicine Screen accessible from bottom navigation
 * Shows medicine finder with location-based pharmacy availability via ViewModel + API
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MedicineScreen(
    userName: String = "User",
    onBackClick: () -> Unit = {},
    onMedicineClick: (String) -> Unit = {},
    onPharmacyClick: (String) -> Unit = {},
    onNavigateToHome: () -> Unit = {},
    onNavigateToRecords: () -> Unit = {},
    onNavigateToProfile: () -> Unit = {},
    onNavigateToCart: () -> Unit = {},
    viewModel: MedicineViewModel = hiltViewModel()
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedTab by remember { mutableIntStateOf(1) } // Medicine tab selected

    val state by viewModel.uiState.collectAsState()
    val filteredMedicines = viewModel.getFilteredMedicines()
    val cartState by viewModel.cartState.collectAsState()
    val isDarkMode = isSystemInDarkTheme()
    val bgColor = if (isDarkMode) Color(0xFF121212) else Color.White
    val cardColor = if (isDarkMode) Color(0xFF1E1E1E) else Color.White

    cartState.pharmacyConflict?.let { conflict ->
        AlertDialog(
            onDismissRequest = { viewModel.resolvePharmacyConflict(false) },
            title = { Text("Change Pharmacy?", fontWeight = FontWeight.Bold) },
            text = { Text("Your cart contains items from another pharmacy. Would you like to clear your cart and add this item from ${conflict.newPharmacyName ?: "the new pharmacy"}?") },
            confirmButton = {
                Button(
                    onClick = { viewModel.resolvePharmacyConflict(true) },
                    colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
                ) { Text("Clear & Add") }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.resolvePharmacyConflict(false) }) { Text("Cancel") }
            }
        )
    }

    Scaffold(
        containerColor = bgColor,
        bottomBar = {
            MedicineBottomNavBar(
                selectedTab = selectedTab,
                onTabSelected = { tab ->
                    selectedTab = tab
                    when (tab) {
                        0 -> onNavigateToHome()
                        2 -> { /* FAB action */ }
                        3 -> onNavigateToRecords()
                        4 -> onNavigateToProfile()
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Header with User Profile
            MedicineScreenHeader(
                userName = userName,
                onBackClick = onBackClick,
                onCartClick = onNavigateToCart,
                cartItemCount = viewModel.cartState.collectAsState().value.totalItems
            )

            // Main Content Card
            Card(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 8.dp),
                shape = RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp),
                colors = CardDefaults.cardColors(containerColor = cardColor),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(top = 24.dp)
                ) {
                    // Title
                    Text(
                        text = stringResource(id = R.string.medicine_finder),
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Black,
                        modifier = Modifier.padding(horizontal = 20.dp)
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Voice search launcher
                    val speechLauncher = rememberLauncherForActivityResult(
                        contract = ActivityResultContracts.StartActivityForResult()
                    ) { result ->
                        if (result.resultCode == Activity.RESULT_OK) {
                            val spokenText = result.data
                                ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                                ?.firstOrNull() ?: ""
                            if (spokenText.isNotBlank()) {
                                searchQuery = spokenText
                                viewModel.searchMedicines(spokenText)
                            }
                        }
                    }

                    // Search Bar
                    MedicineSearchBar(
                        searchQuery = searchQuery,
                        onSearchChange = {
                            searchQuery = it
                            viewModel.searchMedicines(it)
                        },
                        onVoiceSearch = {
                            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                                putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
                                putExtra(RecognizerIntent.EXTRA_PROMPT, "Say a medicine name...")
                            }
                            try { speechLauncher.launch(intent) } catch (_: Exception) { }
                        }
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Category Filter
                    MedicineCategoryFilter(
                        selectedCategory = state.selectedCategory,
                        onCategorySelected = { viewModel.setCategory(it) }
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // Medicine List
                    if (state.isLoading) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = SwastikPurple)
                        }
                    } else if (filteredMedicines.isEmpty()) {
                        MedicineEmptyState(
                            onResetFilters = {
                                searchQuery = ""
                                viewModel.setCategory(null)
                                viewModel.loadPopularMedicines()
                            }
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            if (searchQuery.isBlank() && state.nearbyMedicines.isNotEmpty()) {
                                item {
                                    Text(
                                        stringResource(id = R.string.available_near_you),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 18.sp,
                                        color = SwastikPurple,
                                        modifier = Modifier.padding(bottom = 8.dp, top = 8.dp)
                                    )
                                }
                                item {
                                    LazyRow(
                                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                                        contentPadding = PaddingValues(bottom = 16.dp)
                                    ) {
                                        items(state.nearbyMedicines) { nearbyMed ->
                                            NearbyMedicineCard(
                                                nearbyMed = nearbyMed,
                                                onClick = { onMedicineClick(nearbyMed.medicineId ?: "") }
                                            )
                                        }
                                    }
                                }
                                item {
                                    Text(
                                        stringResource(id = R.string.global_catalog_popular),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 18.sp,
                                        modifier = Modifier.padding(bottom = 8.dp)
                                    )
                                }
                            }

                            items(
                                items = filteredMedicines,
                                key = { it.id }
                            ) { med ->
                                MedicineListItem(
                                    medicine = med,
                                    onClick = { onMedicineClick(med.id) },
                                    onPharmacyClick = { onPharmacyClick(med.nearbyPharmacy ?: "") }
                                )
                            }

                            item {
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

// ==================== HEADER ====================
@Composable
private fun MedicineScreenHeader(
    userName: String,
    onBackClick: () -> Unit,
    onCartClick: () -> Unit = {},
    cartItemCount: Int = 0
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onBackClick) {
            Icon(
                Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
                tint = Color.Black
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        // User Avatar
        Box(
            modifier = Modifier
                .size(45.dp)
                .clip(CircleShape)
                .background(SwastikPurple.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center
        ) {
            Text("👳", fontSize = 24.sp)
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
                text = "Patient",
                fontSize = 13.sp,
                color = Color.Gray
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        // Cart Icon
        Box {
            IconButton(onClick = onCartClick) {
                Icon(
                    Icons.Outlined.ShoppingCart,
                    contentDescription = "Cart",
                    tint = Color.Black
                )
            }
            if (cartItemCount > 0) {
                Box(
                    modifier = Modifier
                        .size(18.dp)
                        .background(Color.Red, CircleShape)
                        .align(Alignment.TopEnd)
                        .offset(x = (-4).dp, y = 4.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "$cartItemCount",
                        color = Color.White,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // Notification Icon
        Box {
            IconButton(onClick = onCartClick) {
                Icon(
                    Icons.Outlined.Notifications,
                    contentDescription = "Notifications",
                    tint = Color.Black
                )
            }
            // Only show badge when there are cart items (something actionable)
            if (cartItemCount > 0) {
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

// ==================== SEARCH BAR ====================
@Composable
private fun MedicineSearchBar(
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    onVoiceSearch: () -> Unit = {}
) {
    OutlinedTextField(
        value = searchQuery,
        onValueChange = onSearchChange,
        placeholder = {
            Text(
                "Search for medicines",
                color = Color.Gray
            )
        },
        leadingIcon = {
            Icon(
                Icons.Default.Search,
                contentDescription = null,
                tint = Color.Gray
            )
        },
        trailingIcon = {
            if (searchQuery.isNotEmpty()) {
                IconButton(onClick = { onSearchChange("") }) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Clear",
                        tint = Color.Gray
                    )
                }
            } else {
                IconButton(onClick = onVoiceSearch) {
                    Icon(
                        Icons.Default.Mic,
                        contentDescription = "Voice Search",
                        tint = SwastikPurple
                    )
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

// ==================== CATEGORY FILTER ====================
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

// ==================== MEDICINE LIST ITEM ====================
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
                // Medicine Name with Rx badge if needed
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = medicine.name,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.Black
                    )
                    if (medicine.requiresPrescription) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .background(
                                    Color(0xFFFF9800).copy(alpha = 0.1f),
                                    RoundedCornerShape(4.dp)
                                )
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                "Rx",
                                fontSize = 10.sp,
                                color = Color(0xFFFF9800),
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                // Price
                Text(
                    text = "₹${medicine.price}",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )

                // Manufacturer
                Text(
                    text = medicine.manufacturer ?: "",
                    fontSize = 14.sp,
                    color = Color.Gray
                )
            }

            // Right side - Stock status and pharmacy
            Column(horizontalAlignment = Alignment.End) {
                // Stock Status
                Text(
                    text = if (medicine.inStock) "In stock" else "Out of stock",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = if (medicine.inStock) Color(0xFF4CAF50) else Color(0xFFE53935)
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Medical Store with Location
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
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Divider
        HorizontalDivider(modifier = Modifier.padding(top = 12.dp), color = Color(0xFFF5F5F5))
    }
}

// ==================== NEARBY MEDICINE CARD (HYBRID) ====================
@Composable
private fun NearbyMedicineCard(
    nearbyMed: NearbyMedicineDto,
    onClick: () -> Unit
) {
    val cardColor = if (isSystemInDarkTheme()) Color(0xFF1E1E1E) else Color.White
    Card(
        modifier = Modifier
            .width(260.dp)
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = cardColor),
        border = BorderStroke(1.dp, Color(0xFFEEEEEE))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = nearbyMed.name,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    color = Color.Black,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text = "₹${nearbyMed.price}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = SwastikPurple
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Store, contentDescription = null, modifier = Modifier.size(14.dp), tint = Color.Gray)
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = nearbyMed.pharmacyName ?: "Local Pharmacy",
                    fontSize = 13.sp,
                    color = Color.Gray
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .background(Color(0xFFE8F5E9), RoundedCornerShape(4.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = "${nearbyMed.quantity} Left in Stock",
                        fontSize = 11.sp,
                        color = Color(0xFF2E7D32),
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}
// ==================== EMPTY STATE ====================
@Composable
private fun MedicineEmptyState(
    onResetFilters: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(120.dp)
                .background(SwastikPurple.copy(alpha = 0.1f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text("💊", fontSize = 50.sp)
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            "No medicines found",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = Color.DarkGray
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            "Try searching with different keywords or reset filters",
            fontSize = 14.sp,
            color = Color.Gray
        )

        Spacer(modifier = Modifier.height(24.dp))

        OutlinedButton(
            onClick = onResetFilters,
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(
                Icons.Default.Refresh,
                contentDescription = null,
                tint = SwastikPurple
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text("Reset Filters", color = SwastikPurple)
        }
    }
}

// ==================== BOTTOM NAVIGATION ====================
@Composable
private fun MedicineBottomNavBar(
    selectedTab: Int,
    onTabSelected: (Int) -> Unit
) {
    NavigationBar(
        containerColor = Color.White,
        modifier = Modifier
            .shadow(8.dp)
            .clip(RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp))
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
                unselectedIconColor = Color.Gray,
                unselectedTextColor = Color.Gray,
                indicatorColor = Color.White
            )
        )

        NavigationBarItem(
            selected = selectedTab == 1,
            onClick = { onTabSelected(1) },
            icon = {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(
                            if (selectedTab == 1) SwastikPurple.copy(alpha = 0.1f) else Color.Transparent,
                            RoundedCornerShape(10.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Filled.Medication,
                        contentDescription = "Medicine",
                        tint = if (selectedTab == 1) SwastikPurple else Color.Gray
                    )
                }
            },
            label = {
                Text(
                    "Medicine",
                    fontSize = 11.sp,
                    color = if (selectedTab == 1) SwastikPurple else Color.Gray
                )
            },
            colors = NavigationBarItemDefaults.colors(
                indicatorColor = Color.Transparent
            )
        )

        // Center FAB placeholder
        NavigationBarItem(
            selected = false,
            onClick = { onTabSelected(2) },
            icon = {
                Box(
                    modifier = Modifier
                        .size(50.dp)
                        .offset(y = (-10).dp)
                        .background(SwastikPurple, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Add,
                        contentDescription = "Add",
                        tint = Color.White,
                        modifier = Modifier.size(28.dp)
                    )
                }
            },
            label = { },
            colors = NavigationBarItemDefaults.colors(
                indicatorColor = Color.Transparent
            )
        )

        NavigationBarItem(
            selected = selectedTab == 3,
            onClick = { onTabSelected(3) },
            icon = {
                Icon(
                    if (selectedTab == 3) Icons.Filled.Description else Icons.Outlined.Description,
                    contentDescription = "Records"
                )
            },
            label = { Text("Records", fontSize = 11.sp) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = SwastikPurple,
                selectedTextColor = SwastikPurple,
                unselectedIconColor = Color.Gray,
                unselectedTextColor = Color.Gray,
                indicatorColor = Color.White
            )
        )

        NavigationBarItem(
            selected = selectedTab == 4,
            onClick = { onTabSelected(4) },
            icon = {
                Icon(
                    if (selectedTab == 4) Icons.Filled.Person else Icons.Outlined.Person,
                    contentDescription = "Profile"
                )
            },
            label = { Text("Profile", fontSize = 11.sp) },
            colors = NavigationBarItemDefaults.colors(
                selectedIconColor = SwastikPurple,
                selectedTextColor = SwastikPurple,
                unselectedIconColor = Color.Gray,
                unselectedTextColor = Color.Gray,
                indicatorColor = Color.White
            )
        )
    }
}
