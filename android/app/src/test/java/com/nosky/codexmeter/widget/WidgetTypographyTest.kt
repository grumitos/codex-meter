package com.nosky.codexmeter.widget

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetTypographyTest {
    @Test
    fun `allows 130 percent growth and caps larger font scales`() {
        assertEquals(20f, cappedFontSizeSp(20f, 1f) * 1f, 0.01f)
        assertEquals(26f, cappedFontSizeSp(20f, 1.3f) * 1.3f, 0.01f)
        assertEquals(26f, cappedFontSizeSp(20f, 2f) * 2f, 0.01f)
    }

    @Test
    fun `uses a compact number size for one hundred percent`() {
        assertTrue(numberTargetDp(100) < numberTargetDp(99))
    }
}
