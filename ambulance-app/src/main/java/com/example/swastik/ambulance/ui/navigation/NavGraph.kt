package com.example.swastik.ambulance.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.swastik.ambulance.ui.screens.dashboard.DashboardScreen
import com.example.swastik.ambulance.ui.screens.emergency.EmergencyDetailScreen
import com.example.swastik.ambulance.ui.screens.emergency.EmergencyListScreen
import com.example.swastik.ambulance.ui.screens.login.LoginScreen
import com.example.swastik.ambulance.ui.screens.login.RegisterScreen
import com.example.swastik.ambulance.ui.screens.profile.ProfileScreen
import com.example.swastik.ambulance.ui.viewmodel.AuthViewModel
import com.example.swastik.ambulance.ui.viewmodel.DashboardViewModel
import com.example.swastik.ambulance.ui.viewmodel.ProfileViewModel

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Register : Screen("register")
    object Dashboard : Screen("dashboard")
    object Emergencies : Screen("emergencies")
    object Profile : Screen("profile")
    object EmergencyDetail : Screen("emergency/{requestId}") {
        fun createRoute(requestId: String) = "emergency/$requestId"
    }
}

@Composable
fun AmbulanceNavGraph() {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = hiltViewModel()
    val authState by authViewModel.uiState.collectAsState()

    val startDestination = if (authState.isLoggedIn) Screen.Dashboard.route else Screen.Login.route

    // ── Session-expiry redirect ──────────────────────────
    // If we become logged-out while on a non-Login screen, bounce to Login.
    LaunchedEffect(authState.isLoggedIn) {
        if (!authState.isLoggedIn) {
            val current = navController.currentBackStackEntry?.destination?.route
            if (current != null && current != Screen.Login.route) {
                navController.navigate(Screen.Login.route) {
                    popUpTo(0) { inclusive = true }
                }
            }
        }
    }

    // ── Shared DashboardViewModel scoped to the nav graph ────
    // (ensures Dashboard, EmergencyList, and EmergencyDetail share
    // the same instance so status updates reflect everywhere.)
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                onNavigateToRegister = {
                    navController.navigate(Screen.Register.route)
                },
                onLoginSuccess = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Register.route) {
            RegisterScreen(
                onBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Dashboard.route) {
            // Create the shared ViewModel scoped to the navigation graph
            val parentEntry = navController.currentBackStackEntry ?: return@composable
            val dashboardViewModel: DashboardViewModel = hiltViewModel(parentEntry)

            LaunchedEffect(Unit) {
                dashboardViewModel.sessionExpired.collect {
                    authViewModel.logout()
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            }

            DashboardScreen(
                dashboardViewModel = dashboardViewModel,
                onNavigateToEmergencies = {
                    navController.navigate(Screen.Emergencies.route)
                },
                onNavigateToEmergencyDetail = { requestId ->
                    navController.navigate(Screen.EmergencyDetail.createRoute(requestId))
                },
                onNavigateToProfile = {
                    navController.navigate(Screen.Profile.route)
                },
                onLogout = {
                    authViewModel.logout()
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Emergencies.route) { backStackEntry ->
            // Share the Dashboard ViewModel from the back stack
            val dashboardEntry = remember(backStackEntry) {
                navController.getBackStackEntry(Screen.Dashboard.route)
            }
            val dashboardViewModel: DashboardViewModel = hiltViewModel(dashboardEntry)

            LaunchedEffect(Unit) {
                dashboardViewModel.sessionExpired.collect {
                    authViewModel.logout()
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            }

            EmergencyListScreen(
                viewModel = dashboardViewModel,
                onBack = { navController.popBackStack() },
                onEmergencyDetail = { requestId ->
                    navController.navigate(Screen.EmergencyDetail.createRoute(requestId))
                }
            )
        }

        composable(Screen.Profile.route) {
            val profileViewModel: ProfileViewModel = hiltViewModel()
            val profileState by profileViewModel.state.collectAsState()

            ProfileScreen(
                profileState = profileState,
                onBack = { navController.popBackStack() },
                onSelectVehicle = { profileViewModel.selectVehicle(it) },
                onChangePassword = { current, newPwd ->
                    profileViewModel.changePassword(current, newPwd)
                },
                onRefresh = { profileViewModel.loadProfile() }
            )
        }

        composable(
            route = Screen.EmergencyDetail.route,
            arguments = listOf(navArgument("requestId") { type = NavType.StringType })
        ) { backStackEntry ->
            val requestId = backStackEntry.arguments?.getString("requestId") ?: return@composable

            // Share the Dashboard ViewModel from the back stack
            val dashboardEntry = remember(backStackEntry) {
                navController.getBackStackEntry(Screen.Dashboard.route)
            }
            val viewModel: DashboardViewModel = hiltViewModel(dashboardEntry)
            val detailState by viewModel.emergencyDetailState.collectAsState()

            LaunchedEffect(Unit) {
                viewModel.sessionExpired.collect {
                    authViewModel.logout()
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            }

            LaunchedEffect(requestId) {
                viewModel.loadEmergencyDetail(requestId)
            }

            EmergencyDetailScreen(
                emergency = detailState.emergency,
                isLoading = detailState.isLoading,
                onBack = { navController.popBackStack() },
                onUpdateStatus = { status ->
                    viewModel.updateEmergencyStatus(requestId, status)
                }
            )
        }
    }
}
