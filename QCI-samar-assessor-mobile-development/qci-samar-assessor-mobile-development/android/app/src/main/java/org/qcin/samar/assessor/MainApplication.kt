package org.qcin.samar.assessor

import android.app.Activity
import android.app.AlertDialog
import android.app.Application
import android.os.Bundle
import android.os.Process
import android.webkit.WebView
import com.aheaditec.talsec_security.security.api.SuspiciousAppInfo
import com.aheaditec.talsec_security.security.api.Talsec
import com.aheaditec.talsec_security.security.api.TalsecConfig
import com.aheaditec.talsec_security.security.api.TalsecMode
import com.aheaditec.talsec_security.security.api.ThreatListener
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.modules.network.OkHttpClientProvider

class MainApplication : Application(), ReactApplication {

  // React Native 0.87 removed the legacy ReactNativeHost; the ReactHost is
  // built directly from the autolinked package list (same as the RN template).
  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  // Track current foreground activity for showing security dialogs
  private var currentActivity: Activity? = null
  private var pendingBlock: Pair<String, String>? = null

  override fun onCreate() {
    super.onCreate()

    // Track activity lifecycle for blockApp dialog
    registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
      override fun onActivityResumed(activity: Activity) {
        currentActivity = activity
        // Show pending security block if Talsec fired before any activity was available
        pendingBlock?.let { (title, message) ->
          pendingBlock = null
          blockApp(title, message)
        }
      }
      override fun onActivityPaused(activity: Activity) { if (currentActivity == activity) currentActivity = null }
      override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
      override fun onActivityStarted(activity: Activity) {}
      override fun onActivityStopped(activity: Activity) {}
      override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
      override fun onActivityDestroyed(activity: Activity) {}
    })

    // CWE-489: Explicitly disable WebView debugging in all builds
    WebView.setWebContentsDebuggingEnabled(false)

    // CWE-693: Native root/tamper detection — runs before React Native loads.
    // SecurityGuard first: its Kotlin baseline + RootBeer layers are synchronous
    // and kill immediately, so a compromised device never reaches RN startup.
    SecurityGuard.enforce(this)

    try {
      initTalsec()
    } catch (e: Exception) {
      android.util.Log.e("QCIApp", "Talsec init failed: ${e.message}")
    }

    // CWE-693: third enforcement point — runs SecurityGuard.enforce on every
    // outbound API call, so a patched-out onCreate/onResume check still has
    // to be bypassed here too before any network traffic reaches the backend.
    OkHttpClientProvider.setOkHttpClientFactory(SecurityInterceptorFactory(applicationContext))

    // Loads React Native (SoLoader + New Architecture entry point), after the
    // security checks above.
    loadReactNative(this)
  }

  private fun initTalsec() {
    // Use actual applicationId (includes flavor suffix like .staging, .development)
    val appId = applicationContext.packageName

    // Cert hashes come from SecurityGuard's CONSTANTS, never from the installed
    // package. Deriving them at runtime made this check worthless: a re-signed
    // APK produces its own hash and satisfies its own comparison, so Talsec's
    // integrity layer passed for an attacker's rebuild.
    val certHashes = SecurityGuard.expectedCertHashes()

    val config = TalsecConfig.Builder(appId, certHashes)
      .watcherMail("Navneet@webority.com")
      .prod(!BuildConfig.DEBUG)
      .build()

    val threatDetected = object : ThreatListener.ThreatDetected() {
      override fun onRootDetected() {
        blockApp("Security Violation", "This device is rooted. The app cannot run on compromised devices.")
      }

      override fun onHookDetected() {
        blockApp("Security Violation", "Hooking framework detected. The app cannot run in this environment.")
      }

      override fun onTamperDetected() {
        blockApp("Security Violation", "App integrity check failed. Please install the app from an official source.")
      }

      override fun onDebuggerDetected() {
        if (!BuildConfig.DEBUG) {
          blockApp("Security Violation", "Debugger detected. The app cannot run while being debugged.")
        }
      }

      override fun onUntrustedInstallationSourceDetected() {}
      override fun onEmulatorDetected() {}
      override fun onDeviceBindingDetected() {}
      override fun onObfuscationIssuesDetected() {}
      override fun onMalwareDetected(p0: MutableList<SuspiciousAppInfo>) {}
      override fun onScreenshotDetected() {}
      override fun onScreenRecordingDetected() {}
      override fun onMultiInstanceDetected() {}
      override fun onUnsecureWifiDetected() {}
      override fun onTimeSpoofingDetected() {}
      override fun onLocationSpoofingDetected() {}
      override fun onAutomationDetected() {}
    }

    val deviceState = object : ThreatListener.DeviceState() {
      override fun onUnlockedDeviceDetected() {}
      override fun onHardwareBackedKeystoreNotAvailableDetected() {}
      override fun onDeveloperModeDetected() {}
      override fun onADBEnabledDetected() {}
      override fun onSystemVPNDetected() {}
    }

    ThreatListener(threatDetected, deviceState).registerListener(this)
    Talsec.start(this, config, TalsecMode.BACKGROUND)
  }

  private fun blockApp(title: String, message: String) {
    val activity = currentActivity
    if (activity != null && !activity.isFinishing) {
      activity.runOnUiThread {
        AlertDialog.Builder(activity)
          .setTitle(title)
          .setMessage(message)
          .setCancelable(false)
          .setPositiveButton("Exit") { _, _ ->
            Process.killProcess(Process.myPid())
          }
          .show()
      }
    } else {
      // No activity yet — queue the block for when activity resumes
      pendingBlock = Pair(title, message)
    }
  }
}
