import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
    id("com.google.dagger.hilt.android")
    id("com.google.devtools.ksp")
}




android {
    namespace = "com.example.swastik"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.swastik"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }

        // Default API base URL (Android Emulator → host localhost)
        buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:5001/api/\"")


    }

    buildTypes {
        debug {
            // Override from local.properties if set (e.g. for physical device testing)
            val localProps = project.rootProject.file("local.properties")
            if (localProps.exists()) {
                val props = Properties().apply { load(localProps.inputStream()) }
                val apiUrl = props.getProperty("API_BASE_URL")
                if (apiUrl != null) {
                    buildConfigField("String", "API_BASE_URL", "\"$apiUrl\"")
                }
            }
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            buildConfigField("String", "API_BASE_URL", "\"https://api.swastik.health/api/\"")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {

    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.constraintlayout)

    // Compose
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    debugImplementation(libs.androidx.compose.ui.tooling)

    // Location & OpenStreetMap
    implementation(libs.play.services.location)
    implementation(libs.osmdroid.android)

    // Networking
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.gson)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.gson)

    // Coroutines
    implementation(libs.coroutines.core)
    implementation(libs.coroutines.android)

    // ViewModel
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.lifecycle.runtime.compose)

    // Room Database for offline caching
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
    
    // Hilt Dependency Injection
    implementation("com.google.dagger:hilt-android:2.51.1")
    ksp("com.google.dagger:hilt-android-compiler:2.51.1")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")
    
    // Security Crypto for encrypted shared preferences
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    
    // Navigation Compose
    implementation("androidx.navigation:navigation-compose:2.7.6")

    // Socket.IO for real-time communication
    implementation("io.socket:socket.io-client:2.1.0") {
        exclude(group = "org.json", module = "json")
    }
    
    // WebRTC for Video Calls
    implementation("io.getstream:stream-webrtc-android:1.1.1")

    // Coil for async image loading in Compose
    implementation("io.coil-kt:coil-compose:2.6.0")

    // ZXing for QR code generation
    implementation("com.google.zxing:core:3.5.3")

    // MediaPipe for Edge CV
    implementation("com.google.mediapipe:tasks-vision:0.10.0")

    // FFT math for rPPG calculations
    implementation("com.github.wendykierp:JTransforms:3.1")
    
    // CameraX
    implementation("androidx.camera:camera-camera2:1.3.0")
    implementation("androidx.camera:camera-lifecycle:1.3.0")
    implementation("androidx.camera:camera-view:1.3.0")

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}

configurations.all {
    resolutionStrategy {
        force("com.squareup:javapoet:1.13.0")
    }
}
