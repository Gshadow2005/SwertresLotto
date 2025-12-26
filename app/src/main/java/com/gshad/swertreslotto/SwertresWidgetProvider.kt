package com.gshad.swertreslotto

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import android.content.Intent
import android.app.PendingIntent
import android.content.SharedPreferences

class SwertresWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_layout)
            
            // Read results from SharedPreferences
            val prefs = context.getSharedPreferences("RCTAsyncLocalStorage_V1", Context.MODE_PRIVATE)
            val resultsJson = prefs.getString("@swertres_results", null)
            
            if (resultsJson != null) {
                try {
                    // Parse the JSON manually (simple parsing)
                    val result2pm = extractResult(resultsJson, "2:00 PM")
                    val result5pm = extractResult(resultsJson, "5:00 PM")
                    val result9pm = extractResult(resultsJson, "9:00 PM")
                    
                    views.setTextViewText(R.id.result_2pm, result2pm)
                    views.setTextViewText(R.id.result_5pm, result5pm)
                    views.setTextViewText(R.id.result_9pm, result9pm)
                } catch (e: Exception) {
                    // Keep default values on error
                }
            }
            
            // Set click listener to open app
            val intent = Intent(context, MainActivity::class.java)
            val pendingIntent = PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_container, pendingIntent)
            
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
    
    private fun extractResult(json: String, time: String): String {
        return try {
            // Find the time in JSON and extract the numbers after it
            val timeIndex = json.indexOf("\"time\":\"$time\"")
            if (timeIndex == -1) return "_-_-_"
            
            val numbersIndex = json.indexOf("\"numbers\":\"", timeIndex)
            if (numbersIndex == -1) return "_-_-_"
            
            val start = numbersIndex + 11 // Length of "numbers":""
            val end = json.indexOf("\"", start)
            if (end == -1) return "_-_-_"
            
            json.substring(start, end)
        } catch (e: Exception) {
            "_-_-_"
        }
    }
}