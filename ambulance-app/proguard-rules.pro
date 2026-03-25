# Add project specific ProGuard rules here.

# ── Swastik Ambulance DTOs & Models ──
-keepclassmembers class com.example.swastik.ambulance.data.remote.dto.** { *; }
-keep class com.example.swastik.ambulance.data.remote.dto.** { *; }

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

# ── EncryptedSharedPreferences ──
-keep class androidx.security.crypto.** { *; }

# ── OSMDroid ──
-keep class org.osmdroid.** { *; }
-dontwarn org.osmdroid.**

# Preserve line numbers for debugging stack traces
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
