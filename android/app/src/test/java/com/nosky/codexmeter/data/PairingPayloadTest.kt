package com.nosky.codexmeter.data

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Base64

class PairingPayloadTest {
    private val pin = ByteArray(32) { (it + 32).toByte() }
    private val key = ByteArray(32) { it.toByte() }

    @Test
    fun `accepts a versioned private-lan pairing payload`() {
        val payload = PairingPayload.parse(
            "codexmeter://pair?v=1&host=192.168.1.42&port=4317" +
                "&pin=${pin.base64Url()}&key=${key.base64Url()}",
        )

        assertEquals("192.168.1.42", payload.host)
        assertEquals(4317, payload.port)
        assertArrayEquals(pin, payload.certificatePin)
        assertArrayEquals(key, payload.authenticationKey)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rejects a public host`() {
        PairingPayload.parse(
            "codexmeter://pair?v=1&host=8.8.8.8&port=4317" +
                "&pin=${pin.base64Url()}&key=${key.base64Url()}",
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rejects duplicate parameters`() {
        PairingPayload.parse(
            "codexmeter://pair?v=1&host=192.168.1.42&host=192.168.1.43&port=4317" +
                "&pin=${pin.base64Url()}&key=${key.base64Url()}",
        )
    }

    private fun ByteArray.base64Url(): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(this)
}
