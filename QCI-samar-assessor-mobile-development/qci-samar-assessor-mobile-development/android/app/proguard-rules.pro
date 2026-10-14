# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Keep Talsec RASP classes
-keep class com.aheaditec.talsec_security.** { *; }
-dontwarn com.aheaditec.talsec_security.**
-keep class com.aheaditec.talsec.** { *; }
-dontwarn com.aheaditec.talsec.**

# Keep React Native classes
-keep class com.facebook.react.** { *; }
-dontwarn com.facebook.react.**
-keep class com.facebook.hermes.** { *; }
-dontwarn com.facebook.hermes.**
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.jni.**

# Keep Firebase Crashlytics
-keep class com.google.firebase.crashlytics.** { *; }
-dontwarn com.google.firebase.crashlytics.**
-dontwarn com.google.android.gms.**

# RootBeer — native bridge must stay intact
-keep class com.scottyab.rootbeer.** { *; }
-dontwarn com.scottyab.rootbeer.**

# Keep Annotations (needed by Gson + RN)
-keepattributes *Annotation*

# Keep Parcelable & Serializable
-keepclassmembers class * implements android.os.Parcelable {
  static ** CREATOR;
}
-keepclassmembers class * implements java.io.Serializable { *; }

# 16KB page size support - Keep native methods
-keepclassmembers class * {
    native <methods>;
}
-keepclasseswithmembernames,includedescriptorclasses class * {
    native <methods>;
}

# AGP 9 requires proguard-android-optimize.txt as the default config. Keep R8
# optimizations off, as they were with the old proguard-android.txt, until
# release builds have been verified with them enabled.
-dontoptimize
