package com.nosky.codexmeter.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import com.nosky.codexmeter.data.UsageStore
import com.nosky.codexmeter.work.RefreshScheduler

class CodexMeterWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = CodexMeterWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        RefreshScheduler.ensurePeriodic(context)
        RefreshScheduler.requestImmediate(context)
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        RefreshScheduler.ensurePeriodic(context)
        val state = UsageStore(context).read()
        if (state.remainingPercent == null || state.resetsAtEpochMillis == null) {
            RefreshScheduler.requestImmediate(context)
        }
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        RefreshScheduler.cancel(context)
    }
}
