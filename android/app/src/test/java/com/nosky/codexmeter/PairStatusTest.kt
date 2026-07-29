package com.nosky.codexmeter

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PairStatusTest {
    @Test
    fun `shows checking only before the first confirmed result`() {
        assertTrue(shouldShowChecking(null))
        assertFalse(shouldShowChecking(true))
        assertFalse(shouldShowChecking(false))
    }
}
