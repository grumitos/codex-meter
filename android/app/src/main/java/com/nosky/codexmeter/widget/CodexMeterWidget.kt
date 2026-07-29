package com.nosky.codexmeter.widget

import android.content.Context
import android.content.Intent
import android.icu.text.DateFormat
import android.icu.util.TimeZone
import androidx.compose.runtime.Composable
import androidx.glance.ColorFilter
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nosky.codexmeter.PairActivity
import com.nosky.codexmeter.R
import com.nosky.codexmeter.data.PairingStore
import com.nosky.codexmeter.data.StoredWidgetState
import com.nosky.codexmeter.data.UsageStore
import com.nosky.codexmeter.work.RefreshScheduler
import java.util.Date

class CodexMeterWidget : GlanceAppWidget() {
    override val sizeMode: SizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: androidx.glance.GlanceId) {
        val state = UsageStore(context).read()
        val paired = PairingStore(context).read() != null
        provideContent {
            GlanceTheme {
                WidgetSurface(state, paired)
            }
        }
    }
}

@Composable
private fun WidgetSurface(state: StoredWidgetState, paired: Boolean) {
    val context = LocalContext.current
    val widgetSize = LocalSize.current
    val squareEdge = maxOf(48.dp, minOf(widgetSize.width, widgetSize.height) - 4.dp)
    val fontScale = context.resources.configuration.fontScale
    val remaining = state.remainingPercent
    val resetDate = state.resetsAtEpochMillis?.let { formatResetDate(context, it) }
    val showUsage = paired && !state.offline && remaining != null && resetDate != null
    val stateDescription = when {
        !paired -> "Conectar PC"
        state.offline -> "Sin conexión"
        !showUsage -> "Sin datos"
        else -> "$remaining% restante, reinicia $resetDate"
    }

    Box(
        modifier = GlanceModifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = GlanceModifier
                .size(squareEdge)
                .background(GlanceTheme.colors.widgetBackground)
                .cornerRadius(R.dimen.widget_corner_radius)
                .semantics {
                    contentDescription = "$stateDescription. ${context.getString(
                        if (paired) R.string.refresh_description else R.string.pair_widget_action,
                    )}"
                }
                .clickable(
                    if (paired) {
                        actionRunCallback<RefreshAction>()
                    } else {
                        actionStartActivity(Intent(context, PairActivity::class.java))
                    },
                ),
            contentAlignment = Alignment.Center,
        ) {
            if (!showUsage) {
                Box(
                    modifier = GlanceModifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Image(
                        provider = ImageProvider(R.drawable.ic_cloud_off),
                        contentDescription = null,
                        modifier = GlanceModifier.size(40.dp),
                        colorFilter = ColorFilter.tint(GlanceTheme.colors.onSurfaceVariant),
                    )
                }
            } else {
                val activeRemaining = checkNotNull(remaining)
                val activeResetDate = checkNotNull(resetDate)
                Column(
                    modifier = GlanceModifier
                        .width(USAGE_BLOCK_WIDTH_DP.dp)
                        .height(USAGE_BLOCK_HEIGHT_DP.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        modifier = GlanceModifier
                            .width(USAGE_BLOCK_WIDTH_DP.dp)
                            .height(USAGE_VALUE_HEIGHT_DP.dp),
                        contentAlignment = Alignment.BottomCenter,
                    ) {
                        Row(verticalAlignment = Alignment.Bottom) {
                            Spacer(GlanceModifier.width(2.dp))
                            Text(
                                text = activeRemaining.toString(),
                                maxLines = 1,
                                style = TextStyle(
                                    color = GlanceTheme.colors.onSurface,
                                    fontSize = cappedFontSizeSp(
                                        numberTargetDp(activeRemaining),
                                        fontScale,
                                    ).sp,
                                    fontWeight = FontWeight.Bold,
                                ),
                            )
                            Spacer(GlanceModifier.width(1.dp))
                            Text(
                                text = "%",
                                maxLines = 1,
                                style = TextStyle(
                                    color = GlanceTheme.colors.onSurface,
                                    fontSize = cappedFontSizeSp(PERCENT_TEXT_DP, fontScale).sp,
                                    fontWeight = FontWeight.Medium,
                                ),
                            )
                        }
                    }
                    Box(
                        modifier = GlanceModifier
                            .width(USAGE_BLOCK_WIDTH_DP.dp)
                            .height(USAGE_DATE_HEIGHT_DP.dp),
                        contentAlignment = Alignment.TopCenter,
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = GlanceModifier
                                    .width(10.dp)
                                    .height(RESET_DATE_TEXT_DP.dp),
                                contentAlignment = Alignment.BottomCenter,
                            ) {
                                Image(
                                    provider = ImageProvider(R.drawable.ic_remote_mark),
                                    contentDescription = null,
                                    modifier = GlanceModifier.size(10.dp),
                                    colorFilter = ColorFilter.tint(
                                        GlanceTheme.colors.onSurface,
                                    ),
                                )
                            }
                            Spacer(GlanceModifier.width(3.dp))
                            Text(
                                text = activeResetDate,
                                maxLines = 1,
                                style = TextStyle(
                                    color = GlanceTheme.colors.onSurfaceVariant,
                                    fontSize = cappedFontSizeSp(
                                        RESET_DATE_TEXT_DP,
                                        fontScale,
                                    ).sp,
                                ),
                            )
                        }
                    }
                }
            }
        }
    }
}

internal fun cappedFontSizeSp(targetDp: Float, fontScale: Float): Float =
    targetDp * fontScale.coerceIn(1f, 1.3f) / fontScale.coerceAtLeast(1f)

internal fun numberTargetDp(remainingPercent: Int): Float =
    if (remainingPercent == 100) 23f else 30f

private const val PERCENT_TEXT_DP = 18f
private const val RESET_DATE_TEXT_DP = 12f
private const val USAGE_BLOCK_WIDTH_DP = 68f
private const val USAGE_BLOCK_HEIGHT_DP = 52f
private const val USAGE_VALUE_HEIGHT_DP = 34f
private const val USAGE_DATE_HEIGHT_DP = 18f

private fun formatResetDate(context: Context, epochMillis: Long): String {
    val locale = context.resources.configuration.locales[0]
    return DateFormat.getPatternInstance(DateFormat.ABBR_MONTH_DAY, locale).apply {
        timeZone = TimeZone.getDefault()
    }.format(Date(epochMillis))
}

class RefreshAction : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: androidx.glance.GlanceId,
        parameters: androidx.glance.action.ActionParameters,
    ) {
        RefreshScheduler.requestImmediate(context)
    }
}
