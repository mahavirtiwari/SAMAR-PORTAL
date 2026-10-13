package org.qcin.samar.assessor

import android.content.Context
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response

/**
 * Decorates React Native's default OkHttp client with a third enforcement
 * point (see SecurityGuard.enforce) so an attacker who patches out the
 * MainApplication.onCreate and MainActivity.onResume checks still has to
 * defeat this one before any network traffic reaches the backend.
 *
 * Uses enforceThrottled, not enforce: the full check shells out twice and stats
 * dozens of paths, and this app drains an offline outbox in bursts, so a
 * per-request full check would spawn two processes per API call.
 *
 * No CertificatePinner here: android/app/src/main/res/xml/network_security_config.xml
 * already pins these domains app-wide (covers WebViews too), so a second
 * pinning mechanism here would just be a redundant place to get wrong on
 * cert rotation.
 */
class SecurityInterceptorFactory(private val appContext: Context) : OkHttpClientFactory {
    override fun createNewNetworkModuleClient(): OkHttpClient {
        return OkHttpClientProvider.createClientBuilder()
            .addInterceptor(SecurityEnforcementInterceptor(appContext))
            .build()
    }
}

private class SecurityEnforcementInterceptor(private val context: Context) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        SecurityGuard.enforceThrottled(context)
        return chain.proceed(chain.request())
    }
}
