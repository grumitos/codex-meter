package com.nosky.codexmeter.data

import android.content.Context
import android.security.keystore.KeyProperties
import android.security.keystore.KeyProtection
import java.security.KeyStore
import java.util.Base64
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

data class BridgeConnection(
    val host: String,
    val port: Int,
    val certificatePin: ByteArray,
    val authenticationKey: SecretKey,
)

class PairingStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    fun save(payload: PairingPayload) {
        keyStore().setEntry(
            KEY_ALIAS,
            KeyStore.SecretKeyEntry(
                SecretKeySpec(payload.authenticationKey, BridgeAuthenticator.ALGORITHM),
            ),
            KeyProtection.Builder(KeyProperties.PURPOSE_SIGN)
                .setDigests(KeyProperties.DIGEST_SHA256)
                .build(),
        )
        check(
            preferences.edit()
                .putString(HOST, payload.host)
                .putInt(PORT, payload.port)
                .putString(PIN, payload.certificatePin.base64Url())
                .commit(),
        ) { "Could not persist pairing" }
    }

    fun read(): BridgeConnection? = runCatching {
        val host = requireNotNull(preferences.getString(HOST, null))
        val port = preferences.getInt(PORT, -1)
        val pin = Base64.getUrlDecoder().decode(requireNotNull(preferences.getString(PIN, null)))
        require(port in 1..65_535 && pin.size == 32)
        val key = keyStore().getKey(KEY_ALIAS, null) as SecretKey
        BridgeConnection(host, port, pin, key)
    }.getOrNull()

    private fun keyStore() = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    private fun ByteArray.base64Url(): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(this)

    private companion object {
        const val PREFERENCES = "codex_meter_pairing"
        const val KEY_ALIAS = "codex_meter_bridge_authentication"
        const val HOST = "host"
        const val PORT = "port"
        const val PIN = "certificate_pin"
    }
}
