package com.nosky.codexmeter.data

import java.nio.charset.StandardCharsets
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.SecretKey

class BridgeAuthenticator(private val key: SecretKey) {
    fun signRequest(epochSeconds: Long, nonce: String): String =
        sign("v1\nGET\n/v1/usage\n$epochSeconds\n$nonce".toByteArray(StandardCharsets.UTF_8))

    private fun sign(message: ByteArray): String = newMac().doFinal(message).base64Url()

    private fun newMac() = Mac.getInstance(ALGORITHM).apply { init(key) }

    private fun ByteArray.base64Url(): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(this)

    companion object {
        const val ALGORITHM = "HmacSHA256"
    }
}
