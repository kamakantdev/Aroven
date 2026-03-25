package com.example.swastik.cv

data class HealthMetrics(
    val heartRate: Double? = null,
    val respirationRate: Double? = null,
    val drowsinessScore: Double = 0.0,
    val asymmetryScore: Double = 0.0,
    val posture: String = "normal",
    val spineAngle: Double = 0.0,
    val fallDetected: Boolean = false,
    val tremorSeverity: Double = 0.0,
    val tremorFrequency: Double = 0.0,
    val spo2: Double? = null
)
