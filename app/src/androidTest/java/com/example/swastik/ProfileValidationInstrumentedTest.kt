package com.example.swastik

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.example.swastik.data.remote.dto.PatientDto
import com.example.swastik.utils.ProfileValidation
import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ProfileValidationInstrumentedTest {

    @Test
    fun profileValidation_acceptsValidInput() {
        val error = ProfileValidation.validate(
            name = "Ravi Kumar",
            age = 28,
            weight = 68.5f,
            height = 173.0f,
            gender = "male",
            bloodGroup = "O+"
        )
        assertNull(error)
    }

    @Test
    fun profileValidation_rejectsInvalidGenderAndBloodGroup() {
        val genderError = ProfileValidation.validate(
            name = "Ravi Kumar",
            age = 28,
            weight = 68.5f,
            height = 173.0f,
            gender = "Male",
            bloodGroup = "O+"
        )
        assertNotNull(genderError)

        val bloodError = ProfileValidation.validate(
            name = "Ravi Kumar",
            age = 28,
            weight = 68.5f,
            height = 173.0f,
            gender = "male",
            bloodGroup = "o+"
        )
        assertNotNull(bloodError)
    }

    @Test
    fun patientDto_deserializesWhenPhoneIsNull() {
        val json = """
            {
              "id": "p1",
              "name": "Patient Test",
              "email": "patient@example.com",
              "phone": null,
              "age": 25,
              "gender": "male",
              "blood_group": "A+",
              "weight": 65.0,
              "height": 170.0,
              "location": "Mumbai",
              "abha_number": null,
              "profile_image_url": null,
              "is_verified": true
            }
        """.trimIndent()

        val dto = Gson().fromJson(json, PatientDto::class.java)
        assertEquals("p1", dto.id)
        assertNull(dto.phone)
        assertEquals("male", dto.gender)
    }
}
