package com.gshad.swertreslotto

import android.content.Context
import android.content.Intent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class WidgetUpdateModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "WidgetUpdateModule"
    }

    @ReactMethod
    fun updateWidget() {
        val context = reactApplicationContext
        val intent = Intent(context, SwertresWidgetProvider::class.java)
        intent.action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        
        val ids = AppWidgetManager.getInstance(context)
            .getAppWidgetIds(ComponentName(context, SwertresWidgetProvider::class.java))
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        
        context.sendBroadcast(intent)
    }
}