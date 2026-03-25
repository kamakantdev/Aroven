# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ── Swastik DTOs & Models ──
-keepclassmembers class com.example.swastik.data.remote.dto.** { *; }
-keep class com.example.swastik.data.remote.dto.** { *; }
-keepclassmembers class com.example.swastik.data.model.** { *; }
-keep class com.example.swastik.data.model.** { *; }

# ── Gson ──
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**
-keep class com.google.gson.** { *; }
-keep class * extends com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer
-keepclassmembers,allowobfuscation class * {
  @com.google.gson.annotations.SerializedName <fields>;
}

# ── Retrofit ──
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepattributes Exceptions
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# ── OkHttp ──
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# ── Socket.IO ──
-keep class io.socket.** { *; }
-dontwarn io.socket.**

# ── Room ──
-keep class * extends androidx.room.RoomDatabase
-keepclassmembers class * extends androidx.room.RoomDatabase { *; }

# ── WebRTC ──
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# ── EncryptedSharedPreferences ──
-keep class androidx.security.crypto.** { *; }

# Preserve line numbers for debugging stack traces
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile