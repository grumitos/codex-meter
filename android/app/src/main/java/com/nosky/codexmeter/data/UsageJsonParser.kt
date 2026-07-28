package com.nosky.codexmeter.data

import org.json.JSONObject
import java.time.Instant
import kotlin.math.roundToInt

data class Usage(
    val remainingPercent: Int,
    val resetsAtEpochMillis: Long,
    val stale: Boolean,
)

object UsageJsonParser {
    fun parse(json: String): Usage {
        val root = JSONObject(json)
        val remaining = root.getDouble("remainingPercent")
        require(remaining.isFinite() && remaining in 0.0..100.0) {
            "remainingPercent must be between 0 and 100"
        }

        return Usage(
            remainingPercent = remaining.roundToInt(),
            resetsAtEpochMillis = Instant.parse(root.getString("resetsAt")).toEpochMilli(),
            stale = root.getBoolean("stale"),
        )
    }
}
