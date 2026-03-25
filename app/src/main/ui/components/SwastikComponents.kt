package com.example.swastik.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.swastik.ui.theme.SwastikPurple

/**
 * Swastik branded primary button
 */
@Composable
fun SwastikButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isLoading: Boolean = false
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp),
        enabled = enabled && !isLoading,
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = SwastikPurple,
            disabledContainerColor = SwastikPurple.copy(alpha = 0.5f)
        )
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                color = Color.White,
                strokeWidth = 2.dp
            )
        } else {
            Text(
                text = text,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )
        }
    }
}

/**
 * Swastik branded top app bar with back navigation
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SwastikTopBar(
    title: String,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier,
    actions: @Composable RowScope.() -> Unit = {}
) {
    TopAppBar(
        title = {
            Text(
                text = title,
                fontWeight = FontWeight.SemiBold,
                fontSize = 20.sp
            )
        },
        navigationIcon = {
            IconButton(onClick = onBackClick) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back"
                )
            }
        },
        actions = actions,
        modifier = modifier,
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = Color.Transparent
        )
    )
}

/**
 * OTP input field with individual digit boxes
 */
@Composable
fun OtpInputField(
    onOtpComplete: (String) -> Unit,
    modifier: Modifier = Modifier,
    otpLength: Int = 6
) {
    var otpValues by remember { mutableStateOf(List(otpLength) { "" }) }
    val focusRequesters = remember { List(otpLength) { FocusRequester() } }

    LaunchedEffect(Unit) {
        focusRequesters.firstOrNull()?.requestFocus()
    }

    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)
    ) {
        otpValues.forEachIndexed { index, value ->
            BasicTextField(
                value = value,
                onValueChange = { newValue ->
                    if (newValue.length <= 1 && newValue.all { it.isDigit() }) {
                        val newOtp = otpValues.toMutableList()
                        newOtp[index] = newValue
                        otpValues = newOtp

                        if (newValue.isNotEmpty() && index < otpLength - 1) {
                            focusRequesters[index + 1].requestFocus()
                        }

                        val otp = newOtp.joinToString("")
                        if (otp.length == otpLength) {
                            onOtpComplete(otp)
                        }
                    }
                },
                modifier = Modifier
                    .size(48.dp)
                    .focusRequester(focusRequesters[index])
                    .border(
                        BorderStroke(
                            width = if (value.isNotEmpty()) 2.dp else 1.dp,
                            color = if (value.isNotEmpty()) SwastikPurple else Color.LightGray
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )
                    .background(Color.White, RoundedCornerShape(12.dp))
                    .onKeyEvent { event ->
                        if (event.key == Key.Backspace && value.isEmpty() && index > 0) {
                            val newOtp = otpValues.toMutableList()
                            newOtp[index - 1] = ""
                            otpValues = newOtp
                            focusRequesters[index - 1].requestFocus()
                            true
                        } else {
                            false
                        }
                    },
                textStyle = TextStyle(
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    color = Color.Black
                ),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                decorationBox = { innerTextField ->
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier.fillMaxSize()
                    ) {
                        innerTextField()
                    }
                }
            )
        }
    }
}
