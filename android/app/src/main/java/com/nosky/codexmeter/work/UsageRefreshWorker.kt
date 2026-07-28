package com.nosky.codexmeter.work

import android.content.Context
import androidx.glance.appwidget.updateAll
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.nosky.codexmeter.data.UsageRepository
import com.nosky.codexmeter.data.UsageStore
import com.nosky.codexmeter.widget.CodexMeterWidget
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

private val refreshMutex = Mutex()

class UsageRefreshWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result = refreshMutex.withLock {
        val store = UsageStore(applicationContext)
        runCatching { UsageRepository(applicationContext).fetch() }
            .onSuccess(store::finishSuccess)
            .onFailure { store.finishFailure() }

        CodexMeterWidget().updateAll(applicationContext)
        Result.success()
    }
}
