package com.nosky.codexmeter.data

import org.junit.Assert.assertEquals
import org.junit.Test
import javax.crypto.spec.SecretKeySpec

class BridgeAuthenticatorTest {
    private val authenticator = BridgeAuthenticator(
        SecretKeySpec(ByteArray(32) { it.toByte() }, "HmacSHA256"),
    )
    private val time = 1_700_000_000L
    private val nonce = "AQIDBAUGBwgJCgsMDQ4PEA"

    @Test
    fun `matches the bridge request signature vector`() {
        assertEquals(
            "_BwjULNtqOlbSnY32BrkXIJREF-Ab_XXSr1gft6m8bY",
            authenticator.signRequest(time, nonce),
        )
    }
}
