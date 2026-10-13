package org.qcin.samar.assessor

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.util.Base64
import android.util.Log
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.scottyab.rootbeer.RootBeer
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.security.MessageDigest

/**
 * Layered security checks. Each layer is independently sufficient to kill
 * the app, so an attacker must neutralise every layer — Kotlin checks,
 * RootBeer (with its bundled native .so), and Talsec — to bypass.
 */
object SecurityGuard {
  private const val TAG = "SecurityGuard"

  // SHA-256 of trusted signing certs (base64 NO_WRAP). These are CONSTANTS by
  // design: deriving them at runtime from the installed package makes the check
  // worthless, because a re-signed APK then satisfies its own derived hash.
  //
  // RELEASE = the upload keystore in this repo (android/app/release.jks, CN=QCI, O=Quality Council of India).
  // DEBUG   = the standard Android debug keystore (accepted in debug builds only).
  // Both computed from the keystores themselves on 20-Aug-2026 as
  // base64(SHA-256(DER cert)) — the exact value the runtime derives from
  // PackageManager, so they compare like-for-like.
  //
  // ⚠️ PLAY is still UNSET, and that is what keeps enforcement OFF. Play App
  // Signing re-signs distributed builds with GOOGLE's key, not our upload key —
  // so on a Play install the runtime sees the PLAY hash, never RELEASE. Turning
  // enforcement on with PLAY unknown would make every Play install fail its own
  // signature check and kill itself. Fill it from
  // Play Console → Setup → App signing → "App signing key certificate" once the
  // listing exists; that is the pre-submission gate in
  // docs/40-release/store-release.md.
  private const val UNSET = "UNSET"
  private const val RELEASE_CERT_SHA256 = "bZF07PmLG7MIc7oPpmIQRbkmCViFuCOuxeiEwQQmI+o="
  private const val PLAY_CERT_SHA256 = UNSET
  private const val DEBUG_CERT_SHA256 = "+sYXRdwJA3hvue3mKpYrOZ9zSPC7b4mbgzJmdZEDO5w="

  /** Both are required: a Play install presents the PLAY cert, a sideloaded
   *  release APK presents RELEASE. Enforcing with either missing would reject
   *  legitimate installs of that kind. */
  private fun certHashesConfigured(): Boolean =
    RELEASE_CERT_SHA256 != UNSET && PLAY_CERT_SHA256 != UNSET

  fun expectedCertHashes(): Array<String> =
    if (certHashesConfigured()) arrayOf(RELEASE_CERT_SHA256, PLAY_CERT_SHA256) else arrayOf()

  fun isSignatureTampered(context: Context): Boolean {
    if (!certHashesConfigured()) {
      Log.e(TAG, "PLAY_CERT_SHA256 is UNSET — signature verification is DISABLED. " +
        "Fill it from Play Console > Setup > App signing before any store submission.")
      return false
    }
    return try {
      val trusted = if (BuildConfig.DEBUG) {
        setOf(RELEASE_CERT_SHA256, PLAY_CERT_SHA256, DEBUG_CERT_SHA256)
      } else {
        setOf(RELEASE_CERT_SHA256, PLAY_CERT_SHA256)
      }
      val actualHashes = currentSigningCertHashes(context)
      if (actualHashes.isEmpty()) return true
      actualHashes.none { it in trusted }
    } catch (e: Exception) {
      Log.e(TAG, "Signature check failed: ${e.message}")
      true
    }
  }

  private fun currentSigningCertHashes(context: Context): List<String> {
    val pm = context.packageManager
    val pkg = context.packageName
    val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      pm.getPackageInfo(pkg, PackageManager.GET_SIGNING_CERTIFICATES)
    } else {
      @Suppress("DEPRECATION")
      pm.getPackageInfo(pkg, PackageManager.GET_SIGNATURES)
    }
    val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      info.signingInfo?.apkContentsSigners
    } else {
      @Suppress("DEPRECATION")
      info.signatures
    } ?: return emptyList()

    val md = MessageDigest.getInstance("SHA-256")
    return signatures.map { sig ->
      Base64.encodeToString(md.digest(sig.toByteArray()), Base64.NO_WRAP)
    }
  }

  /**
   * Returns true if the device shows any reliable sign of being rooted,
   * hooked, or otherwise compromised. Combines four independent layers.
   */
  fun isDeviceRooted(context: Context): Boolean {
    // Layer 1: our Kotlin checks (baseline, always runs)
    if (kotlinRootChecks(context)) return true
    // Layer 2: RootBeer — bundled native .so, broader coverage
    try {
      val rb = RootBeer(context)
      if (rb.isRooted) return true
      if (rb.detectRootManagementApps()) return true
      if (rb.detectPotentiallyDangerousApps()) return true
      if (rb.checkForBinary("su")) return true
      if (rb.checkForBinary("busybox")) return true
      if (rb.checkForBinary("magisk")) return true
      if (rb.checkForDangerousProps()) return true
      if (rb.checkForRWPaths()) return true
      if (rb.detectTestKeys()) return true
      if (rb.checkSuExists()) return true
      if (rb.checkForRootNative()) return true
      if (rb.checkForMagiskBinary()) return true
    } catch (e: Throwable) {
      // Fail-closed: if RootBeer crashes, assume device is compromised
      Log.e(TAG, "RootBeer failed — assuming rooted: ${e.message}")
      return true
    }
    return false
  }

  private fun kotlinRootChecks(context: Context): Boolean {
    return checkBuildTags() ||
      checkSuBinary() ||
      checkRootPaths() ||
      checkWritableSystemPaths() ||
      checkRootManagementApps(context) ||
      checkSuCommand() ||
      checkSelinuxPermissive() ||
      checkDebuggableProp()
  }

  private fun checkBuildTags(): Boolean {
    val tags = Build.TAGS ?: return false
    return tags.contains("test-keys")
  }

  private fun checkSuBinary(): Boolean {
    val paths = arrayOf(
      "/system/bin/su", "/system/xbin/su", "/sbin/su",
      "/system/sd/xbin/su", "/system/bin/failsafe/su",
      "/data/local/su", "/data/local/xbin/su", "/data/local/bin/su",
      "/su/bin/su", "/su/xbin/su",
      "/odm/bin/su", "/vendor/bin/su", "/vendor/xbin/su"
    )
    return paths.any { File(it).exists() }
  }

  private fun checkRootPaths(): Boolean {
    val paths = arrayOf(
      "/system/app/Superuser.apk",
      "/system/etc/init.d/99SuperSUDaemon",
      "/system/xbin/daemonsu",
      "/sbin/.magisk",
      "/sbin/.core/mirror",
      "/sbin/.core/img",
      "/data/adb/magisk",
      "/data/adb/magisk.img",
      "/data/adb/magisk.db",
      "/data/adb/modules",
      "/cache/magisk.log",
      "/cache/.disable_magisk",
      "/dev/.magisk.unblock",
      "/dev/com.koushikdutta.superuser.daemon",
      "/system/xbin/busybox",
      "/data/local/tmp/frida-server"
    )
    return paths.any { File(it).exists() }
  }

  private fun checkWritableSystemPaths(): Boolean {
    val paths = arrayOf("/system", "/system/bin", "/system/sbin", "/system/xbin", "/vendor/bin", "/sbin", "/etc")
    return paths.any { File(it).canWrite() }
  }

  private fun checkRootManagementApps(context: Context): Boolean {
    val packages = arrayOf(
      "com.topjohnwu.magisk",
      "com.noshufou.android.su",
      "com.noshufou.android.su.elite",
      "eu.chainfire.supersu",
      "com.koushikdutta.superuser",
      "com.thirdparty.superuser",
      "com.yellowes.su",
      "com.kingroot.kinguser",
      "com.kingo.root",
      "com.smedialink.oneclickroot",
      "com.zhiqupk.root.global",
      "com.alephzain.framaroot"
    )
    val pm = context.packageManager
    for (name in packages) {
      try {
        pm.getPackageInfo(name, 0)
        return true
      } catch (_: PackageManager.NameNotFoundException) { /* not installed */ }
    }
    return false
  }

  /** Magisk commonly sets SELinux to Permissive — strong root signal. */
  private fun checkSelinuxPermissive(): Boolean {
    var process: java.lang.Process? = null
    return try {
      process = Runtime.getRuntime().exec(arrayOf("getenforce"))
      val reader = BufferedReader(InputStreamReader(process.inputStream))
      val line = reader.readLine()?.trim()
      line != null && line.equals("Permissive", ignoreCase = true)
    } catch (_: Exception) {
      false
    } finally {
      try { process?.destroy() } catch (_: Exception) {}
    }
  }

  /** ro.debuggable=1 on production devices indicates tampered firmware. */
  private fun checkDebuggableProp(): Boolean {
    return try {
      val clazz = Class.forName("android.os.SystemProperties")
      val get = clazz.getMethod("get", String::class.java, String::class.java)
      val value = get.invoke(null, "ro.debuggable", "0") as String
      value == "1"
    } catch (_: Exception) {
      false
    }
  }

  private fun checkSuCommand(): Boolean {
    var process: java.lang.Process? = null
    return try {
      process = Runtime.getRuntime().exec(arrayOf("which", "su"))
      val reader = BufferedReader(InputStreamReader(process.inputStream))
      val line = reader.readLine()
      line != null && line.isNotBlank()
    } catch (_: Exception) {
      false
    } finally {
      try { process?.destroy() } catch (_: Exception) {}
    }
  }

  /**
   * Run all eligible checks. Called from multiple enforcement points
   * (onCreate, MainActivity.onResume, network interceptor) so an attacker
   * must neutralise every site.
   */
  /**
   * Only the PRODUCTION flavour kills the process. Development and staging
   * builds run every check and log violations, but survive.
   *
   * This is not a softening of the posture — it is what makes the posture
   * testable. `assembleStagingRelease` / `assembleDevelopmentRelease` (and the
   * Fastlane tester APKs) are release builds, so `!BuildConfig.DEBUG` alone
   * would arm the full kill path for them. Every Android EMULATOR reports
   * `test-keys` in Build.TAGS, usually runs SELinux permissive, and sets
   * ro.debuggable=1 — so a tester's staging APK would be killed on launch, and
   * on the first network call after that. Testers would be pushed onto physical
   * devices only, for no security benefit: these builds are internal and point
   * at internal backends.
   *
   * The production flavour — the only one that reaches a store — is unchanged
   * and fully fatal.
   */
  private fun isHardenedBuild(): Boolean =
    !BuildConfig.DEBUG && BuildConfig.FLAVOR == "production"

  fun enforce(context: Context) {
    if (isSignatureTampered(context)) {
      if (isHardenedBuild()) {
        reportAndKill("Signature mismatch")
      } else {
        Log.w(TAG, "Signature mismatch (non-production build — logged, not enforced)")
      }
    }
    if (!BuildConfig.DEBUG && isDeviceRooted(context)) {
      if (isHardenedBuild()) {
        reportAndKill("Root detected")
      } else {
        Log.w(TAG, "Root/tamper indicators present (non-production build — logged, not enforced)")
      }
    }
  }

  /**
   * Throttled variant for the per-request network interceptor.
   *
   * enforce() is not cheap: it stats dozens of paths and shells out twice
   * (`getenforce`, `which su`). Running that on every outbound request would
   * spawn two processes per API call — and this app drains an offline outbox,
   * so requests come in bursts. Re-checking at most once every 30s keeps the
   * enforcement point (an attacker still cannot get a sustained session without
   * defeating it) without the per-request cost.
   */
  @Volatile private var lastNetworkCheckMs: Long = 0L

  fun enforceThrottled(context: Context) {
    val now = System.currentTimeMillis()
    if (now - lastNetworkCheckMs < NETWORK_CHECK_INTERVAL_MS) return
    lastNetworkCheckMs = now
    enforce(context)
  }

  private const val NETWORK_CHECK_INTERVAL_MS = 30_000L

  /**
   * Log to logcat AND record the violation to Crashlytics, then kill the
   * process. Crashlytics persists the report locally and uploads it on the
   * next successful launch, so the team learns about tamper attempts in the
   * field even though the offending session is terminated.
   */
  private fun reportAndKill(reason: String) {
    Log.e(TAG, reason)
    try {
      val crashlytics = FirebaseCrashlytics.getInstance()
      crashlytics.setCustomKey("securityViolation", reason)
      crashlytics.recordException(SecurityViolationException(reason))
    } catch (t: Throwable) {
      // Never let Crashlytics failures block the kill — defence in depth.
      Log.e(TAG, "Failed to record security violation: ${t.message}")
    }
    killNow()
  }

  fun killNow() {
    Process.killProcess(Process.myPid())
    kotlin.system.exitProcess(10)
  }
}

/**
 * Marker exception class so security violations are easy to filter for in
 * the Crashlytics console. Not thrown — only recorded via recordException.
 */
class SecurityViolationException(message: String) : RuntimeException(message)
