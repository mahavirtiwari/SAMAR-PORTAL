package org.qcin.samar.applicant

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.zoontek.rnbootsplash.RNBootSplash

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    RNBootSplash.init(this, R.style.BootTheme) // Initialize the splash screen
    // Pass null to prevent Android from restoring stale fragment/view state after
    // the OS kills the app in background — that restore path crashes RN on resume.
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "qciapplicantapp"

  override fun onResume() {
    super.onResume()
    // Second enforcement point — catches attackers who patched out the
    // Application.onCreate call but left MainActivity intact, and also
    // re-checks after returning from background (e.g. Frida attached mid-session).
    SecurityGuard.enforce(applicationContext)
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
