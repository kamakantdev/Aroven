package com.example.swastik.ui.screens.patient.medicine

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.swastik.data.model.CartItem
import com.example.swastik.ui.viewmodel.MedicineViewModel
import com.example.swastik.ui.theme.SwastikPurple

/**
 * Medicine Cart & Order Screen — review cart, enter address, place order.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MedicineCartScreen(
    onBackClick: () -> Unit,
    onOrderComplete: () -> Unit = {},
    viewModel: MedicineViewModel = hiltViewModel()
) {
    val cartState by viewModel.cartState.collectAsState()

    // Order success dialog
    if (cartState.orderSuccess) {
        AlertDialog(
            onDismissRequest = {
                viewModel.resetOrderSuccess()
                onOrderComplete()
            },
            icon = { Icon(Icons.Default.CheckCircle, null, tint = Color(0xFF4CAF50), modifier = Modifier.size(48.dp)) },
            title = { Text("Order Placed!", fontWeight = FontWeight.Bold) },
            text = { Text("Your medicine order has been placed successfully. The pharmacy will prepare your order shortly.") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.resetOrderSuccess()
                        onOrderComplete()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
                ) { Text("Done") }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Medicine Cart", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SwastikPurple, titleContentColor = Color.White, navigationIconContentColor = Color.White)
            )
        }
    ) { padding ->
        if (cartState.items.isEmpty() && !cartState.orderSuccess) {
            // Empty cart
            Box(
                Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.ShoppingCart, null, tint = Color.Gray, modifier = Modifier.size(80.dp))
                    Spacer(Modifier.height(16.dp))
                    Text("Your cart is empty", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Color.Gray)
                    Spacer(Modifier.height(4.dp))
                    Text("Add medicines from the medicine finder", color = Color.Gray)
                    Spacer(Modifier.height(24.dp))
                    Button(
                        onClick = onBackClick,
                        colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
                    ) { Text("Browse Medicines") }
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                // Cart items
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Pharmacy info
                    item {
                        cartState.selectedPharmacyName?.let { name ->
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = SwastikPurple.copy(alpha = 0.05f))
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.LocalPharmacy, null, tint = SwastikPurple)
                                    Spacer(Modifier.width(8.dp))
                                    Text(name, fontWeight = FontWeight.SemiBold, color = SwastikPurple)
                                }
                            }
                            Spacer(Modifier.height(8.dp))
                        }
                        if (cartState.selectedPharmacyName.isNullOrBlank()) {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3E0))
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.Info, null, tint = Color(0xFFEF6C00))
                                    Spacer(Modifier.width(8.dp))
                                    Text(
                                        "Select medicines from a pharmacy inventory to place an order.",
                                        color = Color(0xFFEF6C00),
                                        fontSize = 13.sp
                                    )
                                }
                            }
                            Spacer(Modifier.height(8.dp))
                        }
                    }

                    items(cartState.items) { item ->
                        CartItemCard(
                            item = item,
                            onQuantityChange = { viewModel.updateCartQuantity(item.medicine.id, it) },
                            onRemove = { viewModel.removeFromCart(item.medicine.id) }
                        )
                    }

                    // Delivery address
                    item {
                        Spacer(Modifier.height(8.dp))
                        Text("Delivery Address", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = cartState.deliveryAddress,
                            onValueChange = { viewModel.setDeliveryAddress(it) },
                            placeholder = { Text("Enter your delivery address") },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 2,
                            shape = RoundedCornerShape(12.dp)
                        )
                    }
                }

                // Order summary & checkout
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
                    elevation = CardDefaults.cardElevation(8.dp)
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Items", color = Color.Gray)
                            Text("${cartState.totalItems}")
                        }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Total", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Text("₹${cartState.totalPrice.toInt()}", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = SwastikPurple)
                        }
                        Spacer(Modifier.height(12.dp))

                        cartState.orderError?.let {
                            Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                            Spacer(Modifier.height(4.dp))
                        }

                        Button(
                            onClick = { viewModel.placeOrder() },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            enabled = !cartState.isOrdering && cartState.items.isNotEmpty() && cartState.deliveryAddress.isNotBlank(),
                            colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            if (cartState.isOrdering) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.ShoppingCartCheckout, null)
                                Spacer(Modifier.width(8.dp))
                                Text("Place Order", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CartItemCard(
    item: CartItem,
    onQuantityChange: (Int) -> Unit,
    onRemove: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(SwastikPurple.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Medication, null, tint = SwastikPurple, modifier = Modifier.size(24.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(item.medicine.name, fontWeight = FontWeight.SemiBold, maxLines = 1)
                Text(item.medicine.price?.toInt()?.let { "₹$it each" } ?: "Price unavailable", color = Color.Gray, fontSize = 12.sp)
            }
            // Quantity controls
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = { onQuantityChange(item.quantity - 1) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(Icons.Default.Remove, null, modifier = Modifier.size(18.dp))
                }
                Text(
                    "${item.quantity}",
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 4.dp)
                )
                IconButton(
                    onClick = { onQuantityChange(item.quantity + 1) },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(Icons.Default.Add, null, modifier = Modifier.size(18.dp))
                }
            }
            Spacer(Modifier.width(4.dp))
            Text("₹${item.totalPrice.toInt()}", fontWeight = FontWeight.Bold, color = SwastikPurple)
            IconButton(onClick = onRemove, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Close, "Remove", tint = Color(0xFFE53935), modifier = Modifier.size(18.dp))
            }
        }
    }
}
