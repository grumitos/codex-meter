package com.nosky.codexmeter.data

import android.annotation.SuppressLint
import android.content.Context
import java.io.ByteArrayOutputStream
import java.net.URL
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.util.Base64
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager

class UsageRepository(
    private val context: Context,
    private val clock: () -> Long = { System.currentTimeMillis() / 1_000 },
    private val random: SecureRandom = SecureRandom(),
) {
    fun fetch(): Usage {
        val pairing = requireNotNull(PairingStore(context).read()) { "Codex Meter is not paired" }
        val epochSeconds = clock()
        val nonce = ByteArray(16).also(random::nextBytes).base64Url()
        val authenticator = BridgeAuthenticator(pairing.authenticationKey)
        val connection = openPinnedConnection(pairing)
        return try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 10_000
            connection.readTimeout = 25_000
            connection.instanceFollowRedirects = false
            connection.useCaches = false
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty(TIME_HEADER, epochSeconds.toString())
            connection.setRequestProperty(NONCE_HEADER, nonce)
            connection.setRequestProperty(
                AUTH_HEADER,
                authenticator.signRequest(epochSeconds, nonce),
            )

            val statusCode = connection.responseCode
            val stream = if (statusCode >= 400) connection.errorStream else connection.inputStream
            val bytes = stream?.use(::readLimited) ?: ByteArray(0)
            require(statusCode == HttpsURLConnection.HTTP_OK) {
                "Bridge returned HTTP $statusCode"
            }
            UsageJsonParser.parse(bytes.toString(Charsets.UTF_8))
        } finally {
            connection.disconnect()
        }
    }

    @SuppressLint("CustomX509TrustManager")
    private fun openPinnedConnection(pairing: BridgeConnection): HttpsURLConnection {
        val trustManager = object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) =
                throw CertificateException("Client certificates are not accepted")

            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {
                val certificate = chain?.firstOrNull()
                    ?: throw CertificateException("Bridge certificate is missing")
                certificate.checkValidity()
                val actualPin = MessageDigest.getInstance("SHA-256").digest(certificate.encoded)
                if (!MessageDigest.isEqual(pairing.certificatePin, actualPin)) {
                    throw CertificateException("Bridge certificate does not match pairing")
                }
            }

            override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
        }
        val sslContext = SSLContext.getInstance("TLS").apply {
            init(null, arrayOf(trustManager), random)
        }
        return (URL("https", pairing.host, pairing.port, USAGE_PATH)
            .openConnection() as HttpsURLConnection).apply {
            sslSocketFactory = sslContext.socketFactory
            hostnameVerifier = HostnameVerifier { hostname, _ -> hostname == pairing.host }
        }
    }

    private fun readLimited(input: java.io.InputStream): ByteArray {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(4_096)
        var total = 0
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            total += read
            require(total <= MAX_RESPONSE_BYTES) { "Bridge response is too large" }
            output.write(buffer, 0, read)
        }
        return output.toByteArray()
    }

    private companion object {
        const val MAX_RESPONSE_BYTES = 64 * 1024
        const val USAGE_PATH = "/v1/usage"
        const val TIME_HEADER = "X-Codex-Meter-Time"
        const val NONCE_HEADER = "X-Codex-Meter-Nonce"
        const val AUTH_HEADER = "X-Codex-Meter-Auth"
    }

    private fun ByteArray.base64Url(): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(this)
}
