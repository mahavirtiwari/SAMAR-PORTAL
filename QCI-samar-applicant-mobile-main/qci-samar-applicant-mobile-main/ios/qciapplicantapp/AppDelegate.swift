import UIKit
import React
import FirebaseCore
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNBootSplash
import TrustKit
import MachO

// Declare ptrace function from Darwin
@_silgen_name("ptrace")
private func ptrace(_ request: Int32, _ pid: pid_t, _ addr: UnsafeMutableRawPointer?, _ data: Int32) -> Int32

// ptrace constant
private let PT_DENY_ATTACH: Int32 = 31

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  private var integrityTimer: Timer?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Firebase first, always — Crashlytics must be able to capture a crash that
    // happens during React Native startup, which is when the worst ones happen.
    FirebaseApp.configure()

    // CWE-693: Anti-debug and jailbreak detection — runs before React Native loads
    #if !DEBUG
    // Deny debugger attachment via ptrace
    _ = ptrace(PT_DENY_ATTACH, 0, nil, 0)

    if isDeviceCompromised() {
      showBlockScreen()
      return true
    }

    // Start periodic runtime integrity checks (every 30s)
    startRuntimeIntegrityMonitor()
    #endif

    // TLS pinning. Pin the ISRG ROOTS, not the leaf: Let's Encrypt renews the
    // leaf every ~60 days and rotates intermediates, so a leaf/intermediate pin
    // causes a hard outage on every routine renewal, unfixable server-side. The
    // roots are stable for years. Values copied verbatim from
    // qci-samar-assessor-mobile — both SAMAR apps pin the same hosts, and a
    // typo'd pin bricks the app in the field with nothing at build time to catch it.
    let trustKitConfig: [String: Any] = [
      kTSKSwizzleNetworkDelegates: true,
      kTSKPinnedDomains: [
        // Development (samar-api.webority.dev) — served directly (not via Cloudflare
        // proxy) with a Let's Encrypt cert, same ISRG-root pin set as staging.
        "samar-api.webority.dev": [
          kTSKEnforcePinning: true,
          kTSKIncludeSubdomains: true,
          kTSKPublicKeyHashes: [
            // ISRG Root X2 (anchors LE ECDSA chain currently served)
            "diGVwiVYbubAI3RW4hB9xU8e/CH2GnkuvVFZE8zmgzI=",
            // ISRG Root X1 (backup for LE RSA chain)
            "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=",
            // ISRG Root YE — LE now serves leaf -> YE1/YE2 -> Root YE -> X2, so a
            // client whose trust store gains Root YE builds a shorter chain that
            // never reaches X2. Pinning X2 alone would brick installs with no
            // server-side fix. Verified served by both hosts 20-Aug-2026.
            "sCkq5UWXjg+7mKu9lMhhYF5bGLsy7VI/UNW3tccdR7w=",
          ],
          kTSKExpirationDate: "2027-06-01",
        ],
        // Staging environment (Let's Encrypt) — also the backend the store build
        // talks to during the D-007 pilot.
        "samar-staging1.qci.org.in": [
          kTSKEnforcePinning: true,
          kTSKIncludeSubdomains: true,
          kTSKPublicKeyHashes: [
            // ISRG Root X2 (anchors LE ECDSA chain currently served)
            "diGVwiVYbubAI3RW4hB9xU8e/CH2GnkuvVFZE8zmgzI=",
            // ISRG Root X1 (backup for LE RSA chain)
            "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=",
            // ISRG Root YE — LE now serves leaf -> YE1/YE2 -> Root YE -> X2, so a
            // client whose trust store gains Root YE builds a shorter chain that
            // never reaches X2. Pinning X2 alone would brick installs with no
            // server-side fix. Verified served by both hosts 20-Aug-2026.
            "sCkq5UWXjg+7mKu9lMhhYF5bGLsy7VI/UNW3tccdR7w=",
          ],
          kTSKExpirationDate: "2027-06-01",
        ],
        // Production domain — to be added when one exists (D-007 reversal step 2).
      ],
    ]
    TrustKit.initSharedInstance(withConfiguration: trustKitConfig)

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "qciapplicantapp",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  // MARK: - Native Jailbreak/Integrity Detection

  private func isDeviceCompromised() -> Bool {
    return isJailbroken() || isFridaRunning() || isReverseEngineered() || isDebuggerAttached()
  }

  private func isDebuggerAttached() -> Bool {
    var info = kinfo_proc()
    var size = MemoryLayout<kinfo_proc>.stride
    var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
    let result = sysctl(&mib, UInt32(mib.count), &info, &size, nil, 0)
    if result == 0 {
      return (info.kp_proc.p_flag & P_TRACED) != 0
    }
    return false
  }

  private func startRuntimeIntegrityMonitor() {
    integrityTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
      guard let self = self else { return }
      if self.isFridaRunning() || self.isReverseEngineered() || self.isDebuggerAttached() {
        DispatchQueue.main.async {
          self.showBlockScreen()
        }
      }
    }
  }

  private func isJailbroken() -> Bool {
    // Check for common jailbreak indicators (files, directories, apps)
    let jailbreakPaths = [
      // Classic jailbreak apps
      "/Applications/Cydia.app",
      "/Applications/Sileo.app",
      "/Applications/Zebra.app",
      "/Applications/Substitute.app",
      "/Applications/Installer.app",
      // Substrate/hooking libraries
      "/Library/MobileSubstrate/MobileSubstrate.dylib",
      "/usr/lib/TweakInject",
      "/usr/lib/substitute-inserter.dylib",
      "/usr/lib/libhooker.dylib",
      "/usr/lib/libhooker",
      "/usr/lib/substrate",
      "/usr/share/jailbreak",
      // Shell binaries
      "/bin/bash",
      "/bin/sh",
      "/usr/sbin/sshd",
      "/usr/bin/ssh",
      "/usr/bin/sshd",
      // Package managers
      "/etc/apt",
      "/etc/apt/sources.list.d",
      "/private/var/lib/apt",
      "/private/var/lib/cydia",
      "/var/cache/apt",
      "/var/lib/dpkg",
      // Rootless jailbreak paths (Dopamine, Fugu15, palera1n)
      "/var/jb",
      "/var/jb/usr/lib/TweakInject",
      "/var/jb/usr/lib/substitute-inserter.dylib",
      "/var/jb/usr/lib/libhooker.dylib",
      "/var/jb/usr/bin/ssh",
      "/var/jb/usr/sbin/sshd",
      "/var/jb/Library/MobileSubstrate",
      "/var/jb/Applications/Sileo.app",
      "/var/jb/Applications/Zebra.app",
      "/var/jb/bin/bash",
      "/var/jb/bin/sh",
      "/var/jb/etc/apt",
      // Other indicators
      "/private/var/mobile/Library/SBSettings/Themes",
      "/private/var/stash",
      "/private/var/tmp/cydia.log",
      "/var/log/syslog",
      "/private/preboot/jb",
    ]

    for path in jailbreakPaths {
      if FileManager.default.fileExists(atPath: path) {
        return true
      }
    }

    // Check if we can write to restricted system paths (sandbox escape)
    let testPath = "/private/jbtest_\(UUID().uuidString)"
    do {
      try "jb".write(toFile: testPath, atomically: true, encoding: .utf8)
      try FileManager.default.removeItem(atPath: testPath)
      return true // Should not be able to write here
    } catch {
      // Expected on non-jailbroken devices
    }

    // Check for suspicious URL schemes
    let suspiciousSchemes = ["cydia://", "sileo://", "zbra://", "filza://", "undecimus://"]
    for scheme in suspiciousSchemes {
      if let url = URL(string: scheme), UIApplication.shared.canOpenURL(url) {
        return true
      }
    }

    // Check for suspicious environment variables
    if let _ = getenv("DYLD_INSERT_LIBRARIES") {
      return true
    }

    return false
  }

  private func isFridaRunning() -> Bool {
    // Check for Frida's default ports
    let fridaPorts: [UInt16] = [27042, 27043]
    for port in fridaPorts {
      let sock = socket(AF_INET, SOCK_STREAM, 0)
      guard sock >= 0 else { continue }
      defer { close(sock) }

      var addr = sockaddr_in()
      addr.sin_family = sa_family_t(AF_INET)
      addr.sin_port = port.bigEndian
      addr.sin_addr.s_addr = inet_addr("127.0.0.1")

      let result = withUnsafePointer(to: &addr) {
        $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
          connect(sock, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
        }
      }
      if result == 0 {
        return true // Frida server is listening
      }
    }

    // Check for Frida-related dylibs in loaded libraries
    let count = _dyld_image_count()
    for i in 0..<count {
      if let name = _dyld_get_image_name(i) {
        let imageName = String(cString: name).lowercased()
        if imageName.contains("frida") || imageName.contains("fridaserver") {
          return true
        }
      }
    }

    return false
  }

  private func isReverseEngineered() -> Bool {
    // Check for common reverse engineering tools in loaded dylibs
    let suspiciousLibraries = [
      "FridaGadget",
      "frida-agent",
      "libcycript",
      "MobileSubstrate",
      "SubstrateInserter",
      "SubstrateBootstrap",
      "SubstrateLoader",
      "TweakInject",
      "SSLKillSwitch",
      "SSLKillSwitch2",
      "ssl-kill-switch2",
    ]

    let count = _dyld_image_count()
    for i in 0..<count {
      if let name = _dyld_get_image_name(i) {
        let imageName = String(cString: name)
        for lib in suspiciousLibraries {
          if imageName.contains(lib) {
            return true
          }
        }
      }
    }

    return false
  }

  private func showBlockScreen() {
    let blockWindow = UIWindow(frame: UIScreen.main.bounds)
    blockWindow.windowLevel = .alert + 1

    let vc = UIViewController()
    vc.view.backgroundColor = .white

    let stack = UIStackView()
    stack.axis = .vertical
    stack.spacing = 16
    stack.alignment = .center
    stack.translatesAutoresizingMaskIntoConstraints = false

    let titleLabel = UILabel()
    titleLabel.text = "Security Violation"
    titleLabel.font = .boldSystemFont(ofSize: 22)
    titleLabel.textColor = .red

    let messageLabel = UILabel()
    messageLabel.text = "This device is compromised.\nThe app cannot run on jailbroken devices or in tampered environments."
    messageLabel.numberOfLines = 0
    messageLabel.textAlignment = .center
    messageLabel.font = .systemFont(ofSize: 16)
    messageLabel.textColor = .darkGray

    stack.addArrangedSubview(titleLabel)
    stack.addArrangedSubview(messageLabel)
    vc.view.addSubview(stack)

    NSLayoutConstraint.activate([
      stack.centerXAnchor.constraint(equalTo: vc.view.centerXAnchor),
      stack.centerYAnchor.constraint(equalTo: vc.view.centerYAnchor),
      stack.leadingAnchor.constraint(greaterThanOrEqualTo: vc.view.leadingAnchor, constant: 32),
      stack.trailingAnchor.constraint(lessThanOrEqualTo: vc.view.trailingAnchor, constant: -32),
    ])

    blockWindow.rootViewController = vc
    blockWindow.makeKeyAndVisible()
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func customize(_ rootView: RCTRootView) {
    super.customize(rootView)
    RNBootSplash.initWithStoryboard("LaunchScreen", rootView: rootView) // ⬅️ initialize the splash screen
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
