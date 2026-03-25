package com.example.swastik.ui.screens.patient.tabs

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.swastik.data.model.*
import com.example.swastik.ui.screens.patient.profile.*
import com.example.swastik.ui.theme.*
import com.example.swastik.ui.viewmodel.PatientDashboardViewModel
import com.example.swastik.ui.viewmodel.ProfileUpdateState
import com.example.swastik.utils.ImageCompressor
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

@Composable
fun ProfileTabContent(
    modifier: Modifier = Modifier,
    profile: PatientProfile? = null,
    stats: PatientStats? = null,
    onLogout: () -> Unit = {},
    viewModel: PatientDashboardViewModel? = null
) {
    var showEditProfileDialog by remember { mutableStateOf(false) }
    var showPersonalInfoDialog by remember { mutableStateOf(false) }
    var showLanguageDialog by remember { mutableStateOf(false) }
    var showAppearanceDialog by remember { mutableStateOf(false) }
    var showNotificationDialog by remember { mutableStateOf(false) }
    var showFeedbackDialog by remember { mutableStateOf(false) }
    var showEmergencyContactsDialog by remember { mutableStateOf(false) }
    var showFamilyMembersDialog by remember { mutableStateOf(false) }
    var showAddressesDialog by remember { mutableStateOf(false) }
    var showPrivacyDialog by remember { mutableStateOf(false) }
    var showHelpCenterDialog by remember { mutableStateOf(false) }
    var showQrDialog by remember { mutableStateOf(false) }
    var showChangePasswordDialog by remember { mutableStateOf(false) }
    var showLogoutDialog by remember { mutableStateOf(false) }

    val context = LocalContext.current

    // Image picker launcher — compresses image before upload
    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            try {
                val compressed = ImageCompressor.compressFromUri(context, it)
                if (compressed != null) {
                    val requestBody = compressed.bytes.toRequestBody(compressed.mimeType.toMediaTypeOrNull())
                    val imagePart = MultipartBody.Part.createFormData("file", "profile.jpg", requestBody)
                    viewModel?.uploadProfileImage(imagePart)
                } else {
                    val inputStream = context.contentResolver.openInputStream(it)
                    val bytes = inputStream?.readBytes() ?: return@let
                    inputStream.close()
                    val requestBody = bytes.toRequestBody("image/*".toMediaTypeOrNull())
                    val imagePart = MultipartBody.Part.createFormData("file", "profile.jpg", requestBody)
                    viewModel?.uploadProfileImage(imagePart)
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Failed to process image", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // ── Main UI ─────────────────────────────────────────────────
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        ProfileHeader(
            onQrClick = { showQrDialog = true },
            onSettingsClick = { showNotificationDialog = true }
        )

        Card(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 8.dp),
            shape = RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 24.dp),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    ProfileInfoCard(
                        profile = profile,
                        onEditClick = { showEditProfileDialog = true },
                        onShareClick = {
                            val shareText = buildString {
                                append("${profile?.name ?: "Swastik User"}\n")
                                if (profile?.phoneNumber?.isNotEmpty() == true) append("Phone: ${profile.phoneNumber}\n")
                                if (profile?.email?.isNotEmpty() == true) append("Email: ${profile.email}\n")
                                if (profile?.bloodGroup?.isNotEmpty() == true) append("Blood: ${profile.bloodGroup}\n")
                                append("\nShared via Swastik Health App")
                            }
                            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, shareText)
                            }
                            context.startActivity(Intent.createChooser(shareIntent, "Share Profile"))
                        },
                        onCameraClick = { imagePickerLauncher.launch("image/*") }
                    )
                }
                item { ProfileCompletionCard(profile = profile) }
                item { QuickStatsSection(stats = stats ?: PatientStats()) }
                item {
                    SectionTitleWithBadge(
                        "Health Identity",
                        if (profile?.isVerified == true) "Verified" else "Not Verified",
                        if (profile?.isVerified == true) Color(0xFF4CAF50) else Color.Gray
                    )
                }
                item { HealthIdCard(profile = profile) }
                item { Text("Account Settings", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Color.Black) }
                item {
                    SettingsCard(
                        onPersonalInfoClick = { showPersonalInfoDialog = true },
                        onAddressesClick = { showAddressesDialog = true },
                        onFamilyClick = { showFamilyMembersDialog = true },
                        onEmergencyClick = { showEmergencyContactsDialog = true }
                    )
                }
                item { Text("Preferences", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Color.Black) }
                item {
                    PreferencesCard(
                        onNotificationsClick = { showNotificationDialog = true },
                        onLanguageClick = { showLanguageDialog = true },
                        onAppearanceClick = { showAppearanceDialog = true },
                        onPrivacyClick = { showPrivacyDialog = true }
                    )
                }
                item { Text("Support & Legal", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Color.Black) }
                item {
                    SupportCard(
                        onSupportClick = {
                            Toast.makeText(context, "Connecting to support agent...", Toast.LENGTH_SHORT).show()
                        },
                        onHelpClick = { showHelpCenterDialog = true },
                        onFeedbackClick = { showFeedbackDialog = true },
                        onTermsClick = {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://swastik.health/terms"))
                            context.startActivity(intent)
                        },
                        onPrivacyPolicyClick = {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://swastik.health/privacy"))
                            context.startActivity(intent)
                        }
                    )
                }
                item { Spacer(modifier = Modifier.height(8.dp)) }
                item {
                    Button(
                        onClick = { showLogoutDialog = true },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFFFEBEE),
                            contentColor = Color(0xFFD32F2F)
                        )
                    ) {
                        Icon(Icons.Outlined.Logout, contentDescription = null, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Logout", fontWeight = FontWeight.Medium)
                    }
                }
                item { Spacer(modifier = Modifier.height(16.dp)) }
                item {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Swastik v1.0.0", fontSize = 12.sp, color = Color.Gray)
                        Text("Made with love in India", fontSize = 11.sp, color = Color.LightGray)
                    }
                }
                item { Spacer(modifier = Modifier.height(16.dp)) }
            }
        }
    }

    // ── DIALOGS ─────────────────────────────────────────────────

    if (showEditProfileDialog || showPersonalInfoDialog) {
        EditProfileDialog(
            profile = profile,
            onDismiss = { showEditProfileDialog = false; showPersonalInfoDialog = false },
            onSave = { request ->
                viewModel?.updateProfile(request)
                showEditProfileDialog = false
                showPersonalInfoDialog = false
            }
        )
    }

    if (showLanguageDialog) {
        LanguagePickerDialog(onDismiss = { showLanguageDialog = false })
    }

    if (showAppearanceDialog) {
        AppearanceDialog(onDismiss = { showAppearanceDialog = false })
    }

    if (showNotificationDialog) {
        NotificationSettingsDialog(onDismiss = { showNotificationDialog = false })
    }

    if (showFeedbackDialog) {
        FeedbackDialog(onDismiss = { showFeedbackDialog = false })
    }

    if (showEmergencyContactsDialog) {
        EmergencyContactsDialog(
            contacts = profile?.emergencyContacts ?: emptyList(),
            onDismiss = { showEmergencyContactsDialog = false },
            onAddContact = { name, phone, relation ->
                viewModel?.addEmergencyContact(name, phone, relation)
            },
            onDeleteContact = { contactId ->
                viewModel?.deleteEmergencyContact(contactId)
            }
        )
    }

    if (showFamilyMembersDialog) {
        FamilyMembersDialog(
            members = profile?.familyMembers ?: emptyList(),
            onDismiss = { showFamilyMembersDialog = false },
            onAddMember = { name, relation, phone ->
                viewModel?.addFamilyMember(name, relation, phone)
            },
            onDeleteMember = { memberId ->
                viewModel?.deleteFamilyMember(memberId)
            }
        )
    }

    if (showAddressesDialog) {
        SavedAddressesDialog(
            addresses = profile?.savedAddresses ?: emptyList(),
            onDismiss = { showAddressesDialog = false }
        )
    }

    if (showPrivacyDialog) {
        PrivacySecurityDialog(
            onDismiss = { showPrivacyDialog = false },
            onChangePassword = {
                showPrivacyDialog = false
                showChangePasswordDialog = true
            }
        )
    }

    if (showHelpCenterDialog) {
        HelpCenterDialog(onDismiss = { showHelpCenterDialog = false })
    }

    if (showQrDialog) {
        QrCodeDialog(
            profile = profile,
            viewModel = viewModel,
            onDismiss = { showQrDialog = false }
        )
    }

    if (showChangePasswordDialog) {
        ChangePasswordDialog(
            onDismiss = { showChangePasswordDialog = false },
            onSubmit = { currentPwd, newPwd ->
                viewModel?.changePassword(currentPwd, newPwd)
                showChangePasswordDialog = false
            }
        )
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Logout, null, tint = Color(0xFFD32F2F))
                    Spacer(Modifier.width(8.dp))
                    Text("Logout", fontWeight = FontWeight.Bold)
                }
            },
            text = {
                Text(
                    "Are you sure you want to logout? You will need to sign in again to access your account.",
                    fontSize = 14.sp,
                    color = Color.DarkGray
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showLogoutDialog = false
                        onLogout()
                    },
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD32F2F))
                ) { Text("Logout") }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) { Text("Cancel") }
            },
            shape = RoundedCornerShape(20.dp)
        )
    }

    // ── Toast observers for async operations ────────────────────
    val updateState = viewModel?.profileUpdateState?.collectAsState()
    LaunchedEffect(updateState?.value) {
        when (updateState?.value) {
            is ProfileUpdateState.Success -> {
                Toast.makeText(context, "Profile updated successfully!", Toast.LENGTH_SHORT).show()
                viewModel?.resetProfileUpdateState()
            }
            is ProfileUpdateState.Error -> {
                Toast.makeText(context, (updateState.value as ProfileUpdateState.Error).message, Toast.LENGTH_SHORT).show()
                viewModel?.resetProfileUpdateState()
            }
            else -> {}
        }
    }

    val imageUploadState = viewModel?.imageUploadState?.collectAsState()
    LaunchedEffect(imageUploadState?.value) {
        when (imageUploadState?.value) {
            is ProfileUpdateState.Success -> {
                Toast.makeText(context, "Profile photo updated!", Toast.LENGTH_SHORT).show()
                viewModel?.resetImageUploadState()
            }
            is ProfileUpdateState.Error -> {
                Toast.makeText(context, (imageUploadState?.value as ProfileUpdateState.Error).message, Toast.LENGTH_SHORT).show()
                viewModel?.resetImageUploadState()
            }
            else -> {}
        }
    }

    val changePwdState = viewModel?.changePasswordState?.collectAsState()
    LaunchedEffect(changePwdState?.value) {
        when (changePwdState?.value) {
            is ProfileUpdateState.Success -> {
                Toast.makeText(context, "Password changed successfully!", Toast.LENGTH_SHORT).show()
                viewModel?.resetChangePasswordState()
            }
            is ProfileUpdateState.Error -> {
                Toast.makeText(context, (changePwdState?.value as ProfileUpdateState.Error).message, Toast.LENGTH_SHORT).show()
                viewModel?.resetChangePasswordState()
            }
            else -> {}
        }
    }
}
