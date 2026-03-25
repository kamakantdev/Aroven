package com.example.swastik.ui.screens.patient.profile

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.swastik.data.local.AppSettingsStore
import com.example.swastik.data.local.NotificationPreferences
import com.example.swastik.data.local.ThemePreference
import com.example.swastik.data.model.*
import com.example.swastik.data.remote.dto.UpdateProfileRequest
import com.example.swastik.ui.theme.*
import com.example.swastik.utils.ProfileValidation

// ==================== EDIT PROFILE DIALOG ====================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditProfileDialog(
    profile: PatientProfile?,
    onDismiss: () -> Unit,
    onSave: (UpdateProfileRequest) -> Unit
) {
    var name by remember { mutableStateOf(profile?.name ?: "") }
    var age by remember { mutableStateOf(if ((profile?.age ?: 0) > 0) profile?.age.toString() else "") }
    var gender by remember { mutableStateOf(profile?.gender ?: "") }
    var bloodGroup by remember { mutableStateOf(profile?.bloodGroup ?: "") }
    var weight by remember { mutableStateOf(if ((profile?.weight ?: 0f) > 0f) profile?.weight.toString() else "") }
    var height by remember { mutableStateOf(if ((profile?.height ?: 0f) > 0f) profile?.height.toString() else "") }
    var location by remember { mutableStateOf(profile?.location ?: "") }
    var genderExpanded by remember { mutableStateOf(false) }
    var bloodGroupExpanded by remember { mutableStateOf(false) }
    var validationError by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Edit, contentDescription = null, tint = SwastikPurple, modifier = Modifier.size(24.dp))
                Spacer(Modifier.width(8.dp))
                Text("Edit Profile", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (validationError != null) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFEBEE)),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Warning, null, tint = Color(0xFFD32F2F), modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(validationError!!, fontSize = 12.sp, color = Color(0xFFD32F2F))
                        }
                    }
                }
                OutlinedTextField(
                    value = name, onValueChange = { name = it },
                    label = { Text("Full Name") },
                    leadingIcon = { Icon(Icons.Outlined.Person, null, modifier = Modifier.size(20.dp)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = age, onValueChange = { age = it.filter { c -> c.isDigit() } },
                        label = { Text("Age") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true
                    )
                    ExposedDropdownMenuBox(
                        expanded = genderExpanded,
                        onExpandedChange = { genderExpanded = it },
                        modifier = Modifier.weight(1f)
                    ) {
                        OutlinedTextField(
                            value = gender.replaceFirstChar { it.uppercase() },
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Gender") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = genderExpanded) },
                            modifier = Modifier.menuAnchor(),
                            shape = RoundedCornerShape(12.dp),
                            singleLine = true
                        )
                        ExposedDropdownMenu(expanded = genderExpanded, onDismissRequest = { genderExpanded = false }) {
                            ProfileValidation.GENDER_OPTIONS.forEach { g ->
                                DropdownMenuItem(
                                    text = { Text(g.replaceFirstChar { it.uppercase() }) },
                                    onClick = { gender = g; genderExpanded = false }
                                )
                            }
                        }
                    }
                }
                ExposedDropdownMenuBox(
                    expanded = bloodGroupExpanded,
                    onExpandedChange = { bloodGroupExpanded = it }
                ) {
                    OutlinedTextField(
                        value = bloodGroup.ifEmpty { "Select Blood Group" },
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Blood Group") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = bloodGroupExpanded) },
                        modifier = Modifier.fillMaxWidth().menuAnchor(),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true
                    )
                    ExposedDropdownMenu(expanded = bloodGroupExpanded, onDismissRequest = { bloodGroupExpanded = false }) {
                        ProfileValidation.BLOOD_GROUP_OPTIONS.forEach { bg ->
                            DropdownMenuItem(
                                text = { Text(bg) },
                                onClick = { bloodGroup = bg; bloodGroupExpanded = false }
                            )
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = weight, onValueChange = { weight = it },
                        label = { Text("Weight (kg)") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = height, onValueChange = { height = it },
                        label = { Text("Height (cm)") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true
                    )
                }
                OutlinedTextField(
                    value = location, onValueChange = { location = it },
                    label = { Text("Location") },
                    leadingIcon = { Icon(Icons.Outlined.LocationOn, null, modifier = Modifier.size(20.dp)) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val parsedAge = age.toIntOrNull()
                    val parsedWeight = weight.toFloatOrNull()
                    val parsedHeight = height.toFloatOrNull()

                    validationError = ProfileValidation.validate(
                        name = name,
                        age = parsedAge,
                        weight = parsedWeight,
                        height = parsedHeight,
                        gender = gender.ifBlank { null },
                        bloodGroup = bloodGroup.ifBlank { null }
                    )
                    if (validationError != null) return@Button

                    onSave(
                        UpdateProfileRequest(
                            name = name.ifBlank { null },
                            age = parsedAge,
                            gender = gender.ifBlank { null },
                            bloodGroup = bloodGroup.ifBlank { null },
                            weight = parsedWeight,
                            height = parsedHeight,
                            location = location.ifBlank { null }
                        )
                    )
                },
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
            ) { Text("Save Changes") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
        shape = RoundedCornerShape(20.dp)
    )
}

// ==================== LANGUAGE PICKER DIALOG ====================

@Composable
fun LanguagePickerDialog(onDismiss: () -> Unit) {
    val appSettings by AppSettingsStore.settings.collectAsState()
    var selected by remember(appSettings.language) { mutableStateOf(appSettings.language) }
    val languages = listOf("English", "Hindi", "Bengali", "Telugu", "Tamil", "Kannada", "Marathi")
    val context = LocalContext.current

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Language, null, tint = SwastikPurple)
                Spacer(Modifier.width(8.dp))
                Text("Select Language", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column {
                languages.forEach { lang ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selected = lang }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = selected == lang,
                            onClick = { selected = lang },
                            colors = RadioButtonDefaults.colors(selectedColor = SwastikPurple)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(lang, fontSize = 15.sp, fontWeight = if (selected == lang) FontWeight.SemiBold else FontWeight.Normal)
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    AppSettingsStore.updateLanguage(selected)
                    Toast.makeText(context, "Language set to $selected", Toast.LENGTH_SHORT).show()
                    onDismiss()
                },
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
            ) { Text("Apply") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        shape = RoundedCornerShape(20.dp)
    )
}

// ==================== APPEARANCE DIALOG ====================

@Composable
fun AppearanceDialog(onDismiss: () -> Unit) {
    val appSettings by AppSettingsStore.settings.collectAsState()
    var selected by remember(appSettings.themePreference) { mutableStateOf(appSettings.themePreference) }
    val context = LocalContext.current

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.DarkMode, null, tint = SwastikPurple)
                Spacer(Modifier.width(8.dp))
                Text("Appearance", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    Triple(ThemePreference.LIGHT, "Light", Icons.Outlined.LightMode),
                    Triple(ThemePreference.DARK, "Dark", Icons.Outlined.DarkMode),
                    Triple(ThemePreference.SYSTEM, "System", Icons.Outlined.SettingsBrightness)
                ).forEach { (mode, label, icon) ->
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable { selected = mode },
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (selected == mode) SwastikPurple.copy(alpha = 0.1f) else Color(0xFFF5F5F5)
                        ),
                        border = if (selected == mode) BorderStroke(1.5.dp, SwastikPurple) else null
                    ) {
                        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(icon, null, tint = if (selected == mode) SwastikPurple else Color.Gray)
                            Spacer(Modifier.width(12.dp))
                            Text(label, fontWeight = if (selected == mode) FontWeight.SemiBold else FontWeight.Normal)
                            Spacer(Modifier.weight(1f))
                            if (selected == mode) {
                                Icon(Icons.Default.CheckCircle, null, tint = SwastikPurple)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    AppSettingsStore.updateTheme(selected)
                    Toast.makeText(context, "Theme set to ${selected.name.lowercase().replaceFirstChar { it.uppercase() }}", Toast.LENGTH_SHORT).show()
                    onDismiss()
                },
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
            ) { Text("Apply") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        shape = RoundedCornerShape(20.dp)
    )
}

// ==================== NOTIFICATION SETTINGS DIALOG ====================

@Composable
fun NotificationSettingsDialog(onDismiss: () -> Unit) {
    val appSettings by AppSettingsStore.settings.collectAsState()
    val storedPreferences = appSettings.notificationPreferences
    var appointments by remember(storedPreferences) { mutableStateOf(storedPreferences.appointments) }
    var medicines by remember(storedPreferences) { mutableStateOf(storedPreferences.medicines) }
    var reports by remember(storedPreferences) { mutableStateOf(storedPreferences.reports) }
    var promotions by remember(storedPreferences) { mutableStateOf(storedPreferences.promotions) }
    var sound by remember(storedPreferences) { mutableStateOf(storedPreferences.sound) }
    val context = LocalContext.current

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Notifications, null, tint = SwastikPurple)
                Spacer(Modifier.width(8.dp))
                Text("Notification Settings", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column {
                NotifToggleRow("Appointment Reminders", appointments) { appointments = it }
                NotifToggleRow("Medicine Reminders", medicines) { medicines = it }
                NotifToggleRow("Report Ready Alerts", reports) { reports = it }
                NotifToggleRow("Promotional Offers", promotions) { promotions = it }
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                NotifToggleRow("Sound", sound) { sound = it }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    AppSettingsStore.updateNotificationPreferences(
                        NotificationPreferences(
                            appointments = appointments,
                            medicines = medicines,
                            reports = reports,
                            promotions = promotions,
                            sound = sound
                        )
                    )
                    Toast.makeText(context, "Notification preferences saved", Toast.LENGTH_SHORT).show()
                    onDismiss()
                },
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
            ) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        shape = RoundedCornerShape(20.dp)
    )
}

@Composable
fun NotifToggleRow(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, fontSize = 14.sp)
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = SwastikPurple)
        )
    }
}

// ==================== PRIVACY & SECURITY DIALOG ====================

@Composable
fun PrivacySecurityDialog(onDismiss: () -> Unit, onChangePassword: () -> Unit) {
    var biometrics by remember { mutableStateOf(false) }
    var twoFactor by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Security, null, tint = SwastikPurple)
                Spacer(Modifier.width(8.dp))
                Text("Privacy & Security", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Card(
                    modifier = Modifier.fillMaxWidth().clickable { onChangePassword() },
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SwastikPurple.copy(alpha = 0.08f))
                ) {
                    Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Lock, null, tint = SwastikPurple, modifier = Modifier.size(22.dp))
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Change Password", fontSize = 14.sp, fontWeight = FontWeight.Medium)
                            Text("Update your account password", fontSize = 12.sp, color = Color.Gray)
                        }
                        Icon(Icons.Default.KeyboardArrowRight, null, tint = SwastikPurple)
                    }
                }
                Spacer(Modifier.height(4.dp))
                NotifToggleRow("Biometric Login", biometrics) { biometrics = it }
                NotifToggleRow("Two-Factor Auth (2FA)", twoFactor) { twoFactor = it }
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                Text("Data & Privacy", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color.Gray)
                Spacer(Modifier.height(4.dp))
                Text("Your health data is encrypted end-to-end", fontSize = 12.sp, color = Color.DarkGray)
                Text("ABDM/ABHA compliant storage", fontSize = 12.sp, color = Color.DarkGray)
                Text("Data is never shared without consent", fontSize = 12.sp, color = Color.DarkGray)
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple)
            ) { Text("Done") }
        },
        shape = RoundedCornerShape(20.dp)
    )
}

// ==================== CHANGE PASSWORD DIALOG ====================

@Composable
fun ChangePasswordDialog(
    onDismiss: () -> Unit,
    onSubmit: (String, String) -> Unit
) {
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var showCurrentPwd by remember { mutableStateOf(false) }
    var showNewPwd by remember { mutableStateOf(false) }
    var validationError by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Lock, null, tint = SwastikPurple)
                Spacer(Modifier.width(8.dp))
                Text("Change Password", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (validationError != null) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFEBEE)),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Warning, null, tint = Color(0xFFD32F2F), modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(validationError!!, fontSize = 12.sp, color = Color(0xFFD32F2F))
                        }
                    }
                }
                OutlinedTextField(
                    value = currentPassword,
                    onValueChange = { currentPassword = it; validationError = null },
                    label = { Text("Current Password") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true,
                    visualTransformation = if (showCurrentPwd) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { showCurrentPwd = !showCurrentPwd }) {
                            Icon(if (showCurrentPwd) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, null, modifier = Modifier.size(20.dp))
                        }
                    }
                )
                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { newPassword = it; validationError = null },
                    label = { Text("New Password") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true,
                    visualTransformation = if (showNewPwd) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { showNewPwd = !showNewPwd }) {
                            Icon(if (showNewPwd) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, null, modifier = Modifier.size(20.dp))
                        }
                    }
                )
                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it; validationError = null },
                    label = { Text("Confirm New Password") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation()
                )
                Text("Password must be at least 8 characters", fontSize = 11.sp, color = Color.Gray)
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    when {
                        currentPassword.isBlank() -> validationError = "Enter current password"
                        newPassword.length < 8 -> validationError = "New password must be at least 8 characters"
                        newPassword != confirmPassword -> validationError = "Passwords don't match"
                        currentPassword == newPassword -> validationError = "New password must be different"
                        else -> onSubmit(currentPassword, newPassword)
                    }
                },
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SwastikPurple),
                enabled = currentPassword.isNotBlank() && newPassword.isNotBlank() && confirmPassword.isNotBlank()
            ) { Text("Change Password") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        shape = RoundedCornerShape(20.dp)
    )
}
