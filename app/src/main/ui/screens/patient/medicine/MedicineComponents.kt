package com.example.swastik.ui.screens.patient.medicine

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.swastik.data.model.Medicine
import com.example.swastik.ui.theme.SwastikPurple

/**
 * Reusable components for Medicine screens
 */

// ==================== MEDICINE CARD ====================
/**
 * Card component for displaying medicine in a grid/list
 */
@Composable
fun MedicineCard(
    medicine: Medicine,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Medicine Icon and Name
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(50.dp)
                        .background(SwastikPurple.copy(alpha = 0.1f), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(getMedicineEmoji(medicine.category.name), fontSize = 24.sp)
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            medicine.name,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = Color.Black,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        if (medicine.requiresPrescription) {
                            Spacer(modifier = Modifier.width(6.dp))
                            PrescriptionBadge()
                        }
                    }
                    Text(
                        medicine.manufacturer ?: "",
                        fontSize = 13.sp,
                        color = Color.Gray
                    )
                }

                // Stock Status
                StockStatusBadge(inStock = medicine.inStock)
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Price and Pharmacy
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "₹${medicine.price}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = SwastikPurple
                )

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.LocationOn,
                        contentDescription = null,
                        tint = Color(0xFF4CAF50),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        medicine.nearbyPharmacy ?: "",
                        fontSize = 12.sp,
                        color = Color(0xFF4CAF50),
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

// ==================== COMPACT MEDICINE ITEM ====================
/**
 * Compact medicine item for list view
 */
@Composable
fun CompactMedicineItem(
    medicine: Medicine,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(vertical = 12.dp, horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Medicine Icon
        Box(
            modifier = Modifier
                .size(44.dp)
                .background(SwastikPurple.copy(alpha = 0.1f), RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text(getMedicineEmoji(medicine.category.name), fontSize = 20.sp)
        }

        Spacer(modifier = Modifier.width(12.dp))

        // Medicine Info
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    medicine.name,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                    color = Color.Black
                )
                if (medicine.requiresPrescription) {
                    Spacer(modifier = Modifier.width(6.dp))
                    PrescriptionBadge(small = true)
                }
            }
            Text(
                "₹${medicine.price} • ${medicine.manufacturer ?: ""}",
                fontSize = 13.sp,
                color = Color.Gray
            )
        }

        // Stock and Pharmacy
        Column(horizontalAlignment = Alignment.End) {
            StockStatusBadge(inStock = medicine.inStock, small = true)
            Spacer(modifier = Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.LocationOn,
                    contentDescription = null,
                    tint = SwastikPurple,
                    modifier = Modifier.size(12.dp)
                )
                Text(
                    medicine.nearbyPharmacy ?: "",
                    fontSize = 11.sp,
                    color = SwastikPurple,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

// ==================== BADGES ====================
/**
 * Prescription required badge
 */
@Composable
fun PrescriptionBadge(
    small: Boolean = false
) {
    Box(
        modifier = Modifier
            .background(
                Color(0xFFFF9800).copy(alpha = 0.1f),
                RoundedCornerShape(if (small) 4.dp else 6.dp)
            )
            .padding(
                horizontal = if (small) 4.dp else 6.dp,
                vertical = if (small) 1.dp else 2.dp
            )
    ) {
        Text(
            "Rx",
            fontSize = if (small) 8.sp else 10.sp,
            color = Color(0xFFFF9800),
            fontWeight = FontWeight.Bold
        )
    }
}

/**
 * Stock status badge
 */
@Composable
fun StockStatusBadge(
    inStock: Boolean,
    small: Boolean = false
) {
    Box(
        modifier = Modifier
            .background(
                if (inStock) Color(0xFFE8F5E9) else Color(0xFFFFEBEE),
                RoundedCornerShape(if (small) 4.dp else 6.dp)
            )
            .padding(
                horizontal = if (small) 6.dp else 8.dp,
                vertical = if (small) 2.dp else 4.dp
            )
    ) {
        Text(
            text = if (inStock) "In Stock" else "Out of Stock",
            fontSize = if (small) 10.sp else 11.sp,
            color = if (inStock) Color(0xFF4CAF50) else Color(0xFFE53935),
            fontWeight = FontWeight.Medium
        )
    }
}

// ==================== PHARMACY CHIP ====================
/**
 * Pharmacy location chip
 */
@Composable
fun PharmacyChip(
    pharmacyName: String,
    distance: String? = null,
    onClick: () -> Unit = {}
) {
    Row(
        modifier = Modifier
            .background(SwastikPurple.copy(alpha = 0.1f), RoundedCornerShape(20.dp))
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            Icons.Default.LocationOn,
            contentDescription = null,
            tint = SwastikPurple,
            modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            pharmacyName,
            fontSize = 13.sp,
            color = SwastikPurple,
            fontWeight = FontWeight.Medium
        )
        if (distance != null) {
            Text(
                " • $distance",
                fontSize = 12.sp,
                color = SwastikPurple.copy(alpha = 0.7f)
            )
        }
    }
}

// ==================== CATEGORY CHIP ====================
/**
 * Medicine category filter chip
 */
@Composable
fun CategoryFilterChip(
    category: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    FilterChip(
        selected = isSelected,
        onClick = onClick,
        label = {
            Text(
                category,
                fontSize = 13.sp
            )
        },
        leadingIcon = if (isSelected) {
            {
                Icon(
                    Icons.Default.Check,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
            }
        } else null,
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = SwastikPurple,
            selectedLabelColor = Color.White,
            selectedLeadingIconColor = Color.White
        )
    )
}

// ==================== QUANTITY SELECTOR ====================
/**
 * Quantity selector component
 */
@Composable
fun QuantitySelector(
    quantity: Int,
    onQuantityChange: (Int) -> Unit,
    minQuantity: Int = 1,
    maxQuantity: Int = 10
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .border(1.dp, Color.LightGray, RoundedCornerShape(8.dp))
            .padding(4.dp)
    ) {
        IconButton(
            onClick = { if (quantity > minQuantity) onQuantityChange(quantity - 1) },
            enabled = quantity > minQuantity,
            modifier = Modifier.size(32.dp)
        ) {
            Icon(
                Icons.Default.Remove,
                contentDescription = "Decrease",
                tint = if (quantity > minQuantity) SwastikPurple else Color.Gray
            )
        }

        Text(
            text = quantity.toString(),
            modifier = Modifier.width(40.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp
        )

        IconButton(
            onClick = { if (quantity < maxQuantity) onQuantityChange(quantity + 1) },
            enabled = quantity < maxQuantity,
            modifier = Modifier.size(32.dp)
        ) {
            Icon(
                Icons.Default.Add,
                contentDescription = "Increase",
                tint = if (quantity < maxQuantity) SwastikPurple else Color.Gray
            )
        }
    }
}

// ==================== PRICE DISPLAY ====================
/**
 * Price display with optional original price for discounts
 */
@Composable
fun PriceDisplay(
    price: Int,
    modifier: Modifier = Modifier,
    originalPrice: Int? = null
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            "₹$price",
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp,
            color = SwastikPurple
        )
        if (originalPrice != null && originalPrice > price) {
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                "₹$originalPrice",
                fontSize = 14.sp,
                color = Color.Gray,
                style = androidx.compose.ui.text.TextStyle(
                    textDecoration = androidx.compose.ui.text.style.TextDecoration.LineThrough
                )
            )
            Spacer(modifier = Modifier.width(8.dp))
            val discount = ((originalPrice - price) * 100 / originalPrice)
            Box(
                modifier = Modifier
                    .background(Color(0xFF4CAF50), RoundedCornerShape(4.dp))
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text(
                    "$discount% OFF",
                    fontSize = 10.sp,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

// ==================== HELPER FUNCTIONS ====================
/**
 * Get emoji based on medicine category
 */
fun getMedicineEmoji(category: String): String {
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

/**
 * Get color based on medicine category
 */
fun getMedicineCategoryColor(category: String): Color {
    return when (category.uppercase()) {
        "TABLET" -> Color(0xFF6C63FF)
        "CAPSULE" -> Color(0xFF4CAF50)
        "SYRUP" -> Color(0xFFFF9800)
        "INJECTION" -> Color(0xFFE53935)
        "OINTMENT" -> Color(0xFF2196F3)
        "DROPS" -> Color(0xFF00BCD4)
        "POWDER" -> Color(0xFF9C27B0)
        else -> Color(0xFF6C63FF)
    }
}
