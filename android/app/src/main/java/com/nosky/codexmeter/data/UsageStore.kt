package com.nosky.codexmeter.data

import android.content.Context

data class StoredWidgetState(
    val remainingPercent: Int?,
    val resetsAtEpochMillis: Long?,
    val offline: Boolean,
)

class UsageStore(context: Context) {
    private val preferences = context.getSharedPreferences("codex_meter_usage", Context.MODE_PRIVATE)

    fun read() = StoredWidgetState(
        remainingPercent = if (preferences.contains(KEY_REMAINING)) {
            preferences.getInt(KEY_REMAINING, 0)
        } else null,
        resetsAtEpochMillis = if (preferences.contains(KEY_RESETS_AT)) {
            preferences.getLong(KEY_RESETS_AT, 0L)
        } else null,
        offline = preferences.getBoolean(KEY_OFFLINE, false),
    )

    fun finishSuccess(usage: Usage) {
        preferences.edit()
            .putInt(KEY_REMAINING, usage.remainingPercent)
            .putLong(KEY_RESETS_AT, usage.resetsAtEpochMillis)
            .putBoolean(KEY_OFFLINE, usage.stale)
            .apply()
    }

    fun finishFailure() {
        preferences.edit()
            .putBoolean(KEY_OFFLINE, true)
            .apply()
    }

    private companion object {
        const val KEY_REMAINING = "remaining"
        const val KEY_RESETS_AT = "resets_at"
        const val KEY_OFFLINE = "offline"
    }
}
