package com.example.swastik.ambulance.data.remote

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.Response

class ApiErrorParserTest {

    @Test
    fun `returns message field when present`() {
        val response = Response.error<Any>(
            400,
            """{"message":"Invalid status transition"}""".toResponseBody("application/json".toMediaType())
        )

        val parsed = ApiErrorParser.from(response, "fallback")

        assertEquals("Invalid status transition", parsed)
    }

    @Test
    fun `returns error field when message missing`() {
        val response = Response.error<Any>(
            500,
            """{"error":"Internal dispatch failure"}""".toResponseBody("application/json".toMediaType())
        )

        val parsed = ApiErrorParser.from(response, "fallback")

        assertEquals("Internal dispatch failure", parsed)
    }

    @Test
    fun `returns fallback for invalid body`() {
        val response = Response.error<Any>(
            502,
            "<html>bad gateway</html>".toResponseBody("text/html".toMediaType())
        )

        val parsed = ApiErrorParser.from(response, "fallback")

        assertEquals("fallback", parsed)
    }
}
