package com.nosky.codexmeter.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class UsageJsonParserTest {
    @Test
    fun `reads the closed weekly usage contract`() {
        val result = UsageJsonParser.parse(
            """{"remainingPercent":65,"resetsAt":"2026-08-03T05:00:00.000Z","stale":false}""",
        )

        assertFalse(result.stale)
        assertEquals(65, result.remainingPercent)
        assertEquals(1_785_733_200_000L, result.resetsAtEpochMillis)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rejects an invalid percentage`() {
        UsageJsonParser.parse("""{"remainingPercent":101,"stale":false}""")
    }
}
