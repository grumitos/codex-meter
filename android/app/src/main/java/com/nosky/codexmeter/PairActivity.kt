package com.nosky.codexmeter

import android.app.Activity
import android.os.Bundle
import android.widget.TextView
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.nosky.codexmeter.data.PairingPayload
import com.nosky.codexmeter.data.PairingStore
import com.nosky.codexmeter.work.RefreshScheduler

class PairActivity : Activity() {
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_pair)

        status = findViewById(R.id.pair_status)
        showCurrentPairing()

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

    private fun save(rawPayload: String) {
        runCatching {
            val payload = PairingPayload.parse(rawPayload.trim())
            PairingStore(this).save(payload)
            payload.host
        }.onSuccess { host ->
            status.text = getString(R.string.pair_connected, host)
            RefreshScheduler.requestImmediate(this)
        }.onFailure {
            status.setText(R.string.pair_invalid)
        }
    }

    private fun showCurrentPairing() {
        val host = PairingStore(this).read()?.host
        status.text = if (host == null) {
            getString(R.string.pair_not_connected)
        } else {
            getString(R.string.pair_connected, host)
        }
    }
}
