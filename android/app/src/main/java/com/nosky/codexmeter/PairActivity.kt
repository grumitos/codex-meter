package com.nosky.codexmeter

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.TextView
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.nosky.codexmeter.data.PairingPayload
import com.nosky.codexmeter.data.PairingStore
import com.nosky.codexmeter.data.UsageRepository
import com.nosky.codexmeter.work.RefreshScheduler

internal fun shouldShowChecking(lastConnectionSucceeded: Boolean?) =
    lastConnectionSucceeded == null

class PairActivity : Activity() {
    private lateinit var status: TextView
    private val handler = Handler(Looper.getMainLooper())
    private var statusCheck = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_pair)

        status = findViewById(R.id.pair_status)

        val scanner = GmsBarcodeScanning.getClient(
            this,
            GmsBarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                .enableAutoZoom()
                .build(),
        )
        findViewById<android.view.View>(R.id.pair_scan).setOnClickListener {
            scanner.startScan()
                .addOnSuccessListener { result -> save(result.rawValue.orEmpty()) }
                .addOnFailureListener { status.setText(R.string.pair_scan_failed) }
        }
    }

    override fun onResume() {
        super.onResume()
        updateConnectionStatus()
    }

    override fun onPause() {
        statusCheck += 1
        handler.removeCallbacksAndMessages(null)
        super.onPause()
    }

    private fun save(rawPayload: String) {
        runCatching {
            val payload = PairingPayload.parse(rawPayload.trim())
            PairingStore(this).save(payload)
            payload.host
        }.onSuccess {
            RefreshScheduler.requestImmediate(this)
            updateConnectionStatus()
        }.onFailure {
            showStatus(R.string.pair_invalid, R.color.pair_status_error)
        }
    }

    private fun updateConnectionStatus() {
        handler.removeCallbacksAndMessages(null)
        val pairingStore = PairingStore(this)
        if (pairingStore.read() == null) {
            statusCheck += 1
            showStatus(R.string.pair_not_connected, R.color.pair_text_secondary)
            return
        }
        val lastConnectionSucceeded = pairingStore.lastConnectionSucceeded()
        if (shouldShowChecking(lastConnectionSucceeded)) {
            showStatus(R.string.pair_checking, R.color.pair_text_secondary)
        } else {
            showStatus(
                if (lastConnectionSucceeded == true) R.string.pair_connected else R.string.pair_connection_error,
                if (lastConnectionSucceeded == true) R.color.pair_status_connected else R.color.pair_status_error,
            )
        }
        val check = ++statusCheck
        Thread({
            val connected = runCatching {
                UsageRepository(applicationContext).fetch()
            }.isSuccess
            runOnUiThread {
                if (check != statusCheck || isFinishing || isDestroyed) return@runOnUiThread
                pairingStore.recordConnectionResult(connected)
                showStatus(
                    if (connected) R.string.pair_connected else R.string.pair_connection_error,
                    if (connected) R.color.pair_status_connected else R.color.pair_status_error,
                )
                handler.postDelayed(::updateConnectionStatus, STATUS_REFRESH_MILLIS)
            }
        }, "CodexMeterStatus").start()
    }

    private fun showStatus(text: Int, color: Int) {
        status.setText(text)
        status.setTextColor(getColor(color))
    }

    private companion object {
        const val STATUS_REFRESH_MILLIS = 30_000L
    }
}
