package com.example.swastik.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.swastik.ui.theme.SwastikPurple

// SwastikTopBar is defined in SwastikComponents.kt — use that version

@Composable
fun OtpInputField(
    otpLength: Int = 4,
    otp: String,
    onOtpChange: (String) -> Unit
) {
    val focusRequesters = remember { List(otpLength) { FocusRequester() } }

    Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Spacer(modifier = Modifier.weight(1f))
        for (i in 0 until otpLength) {
            val char = otp.getOrNull(i)?.toString() ?: ""

            Box(
                modifier = Modifier
                    .size(65.dp)
                    .border(
                        width = 1.5.dp,
                        color = if (char.isNotEmpty()) SwastikPurple else Color.LightGray,
                        shape = RoundedCornerShape(12.dp)
                    )
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White),
                contentAlignment = Alignment.Center
            ) {
                BasicTextField(
                    value = char,
                    onValueChange = { newValue ->
                        if (newValue.length <= 1 && newValue.all { it.isDigit() }) {
                            val newOtp = StringBuilder(otp)
                            if (newValue.isEmpty()) {
                                if (i < otp.length) {
                                    newOtp.deleteCharAt(i)
                                }
                                if (i > 0) {
                                    focusRequesters[i - 1].requestFocus()
                                }
                            } else {
                                if (i < otp.length) {
                                    newOtp.setCharAt(i, newValue[0])
                                } else {
                                    newOtp.append(newValue)
                                }
                                if (i < otpLength - 1) {
                                    focusRequesters[i + 1].requestFocus()
                                }
                            }
                            onOtpChange(newOtp.toString())
                        }
                    },
                    modifier = Modifier
                        .focusRequester(focusRequesters[i])
                        .fillMaxSize()
                        .wrapContentSize(Alignment.Center),
                    textStyle = LocalTextStyle.current.copy(
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        color = SwastikPurple
                    ),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true
                )
            }
        }
        Spacer(modifier = Modifier.weight(1f))
    }

    LaunchedEffect(Unit) {
        focusRequesters[0].requestFocus()
    }
}

// SwastikButton is defined in SwastikComponents.kt — use that version

@Composable
fun QuickActionItem(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    iconTint: Color = SwastikPurple
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clickable { onClick() }
    ) {
        Box(
            modifier = Modifier
                .size(56.dp)
                .background(Color(0xFFF5F5F5), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = iconTint,
                modifier = Modifier.size(28.dp)
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = label,
            fontSize = 12.sp,
            color = Color.Gray
        )
    }
}
