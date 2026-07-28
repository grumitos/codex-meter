package com.nosky.codexmeter.data

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.util.Base64

data class PairingPayload(
    val host: String,
    val port: Int,
    val certificatePin: ByteArray,
    val authenticationKey: ByteArray,
) {
    companion object {
        fun parse(raw: String): PairingPayload {
            require(raw.length in 1..512) { "Invalid pairing payload" }
            val uri = URI(raw)
            require(uri.scheme.equals("codexmeter", ignoreCase = true)) { "Invalid pairing scheme" }
            require(uri.host.equals("pair", ignoreCase = true)) { "Invalid pairing target" }

            val parameters = linkedMapOf<String, String>()
            for (part in requireNotNull(uri.rawQuery).split('&')) {
                val pair = part.split('=', limit = 2)
                require(pair.size == 2) { "Invalid pairing parameter" }
                val name = pair[0].decode()
                require(parameters.put(name, pair[1].decode()) == null) {
                    "Duplicate pairing parameter"
                }
            }
            require(parameters.keys == setOf("v", "host", "port", "pin", "key")) {
                "Invalid pairing parameters"
            }
            require(parameters.getValue("v") == "1") { "Unsupported pairing version" }

            val host = parameters.getValue("host")
            require(host.isPrivateIpv4()) { "Pairing host must be a private IPv4 address" }
            val port = parameters.getValue("port").toIntOrNull()
            require(port != null && port in 1..65_535) { "Invalid pairing port" }

            return PairingPayload(
                host = host,
                port = port,
                certificatePin = parameters.getValue("pin").decodeKey(),
                authenticationKey = parameters.getValue("key").decodeKey(),
            )
        }

        private fun String.decode(): String =
            URLDecoder.decode(this, StandardCharsets.UTF_8.name())

        private fun String.decodeKey(): ByteArray = runCatching {
            Base64.getUrlDecoder().decode(this)
        }.getOrElse {
            throw IllegalArgumentException("Invalid pairing key", it)
        }.also {
            require(it.size == 32) { "Pairing keys must contain 32 bytes" }
        }

        private fun String.isPrivateIpv4(): Boolean {
            val octets = split('.').map { it.toIntOrNull() ?: return false }
            if (octets.size != 4 || octets.any { it !in 0..255 }) return false
            return octets[0] == 10 ||
                (octets[0] == 172 && octets[1] in 16..31) ||
                (octets[0] == 192 && octets[1] == 168)
        }
    }
}
