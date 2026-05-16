package expo.modules.cnsdk3d

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Parcel
import android.os.SystemClock
import android.system.Os
import android.util.Log
import com.leia.sdk.FaceTrackingRuntime
import com.leia.sdk.LeiaSDK
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicReference

class Cnsdk3DModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var sdk: LeiaSDK? = null
  private var fpsUnlockGeneration = 0

  override fun definition() = ModuleDefinition {
    Name("Cnsdk3D")

    Constants(
      "isAndroidCnsdkAvailable" to true
    )

    OnDestroy {
      disable3D()
      runCatching { LeiaSDK.shutdownSDK() }
      sdk = null
    }

    AsyncFunction("enable") { options: Map<String, Any?>? ->
      val desiredFps = (options?.get("desiredFps") as? Number)?.toInt() ?: TARGET_REFRESH_RATE.toInt()
      onMainThread {
        enable3D(desiredFps)
      }
    }

    AsyncFunction("disable") {
      onMainThread {
        disable3D()
      }
    }

    AsyncFunction("unlockFps") { desiredFps: Int? ->
      val activity = appContext.currentActivity
      if (activity == null) {
        "No current Android activity"
      } else {
        VendorFrameTuning.requestSurfaceFpsUnlock(
          activity.packageName,
          desiredFps ?: TARGET_REFRESH_RATE.toInt()
        )
      }
    }
  }

  private fun enable3D(desiredFps: Int): Map<String, Any> {
    val activity = appContext.currentActivity
      ?: return result(false, "No current Android activity")

    requestCameraPermissionIfNeeded(activity)
    Os.setenv("CNSDK_IN_APP_FORCE_TRACKING_FPS", desiredFps.toString(), true)
    preferRefreshRate(activity, desiredFps.toFloat())

    val messages = mutableListOf<String>()
    val packageName = activity.packageName

    return try {
      Log.i(TAG, "enable3D requested at ${SystemClock.elapsedRealtime()}ms")
      val instance = getSdk(activity, desiredFps)
      instance.enableBacklight(true)
      instance.setFaceTrackingRuntime(FaceTrackingRuntime.InApp)
      instance.setFaceTrackingCaptureLux(false)
      instance.enable3D(true)
      instance.enableFaceTracking(true)
      instance.startFaceTracking(true)

      messages += VendorFrameTuning.acquirePerformanceLock(activity)
      messages += VendorFrameTuning.setFrameRateByApp(desiredFps.toFloat())
      messages += VendorFrameTuning.setMindSyncFps(packageName, desiredFps)
      messages += VendorFrameTuning.setMindSyncAppFps(packageName, desiredFps)

      val generation = ++fpsUnlockGeneration
      scheduleFpsUnlockRetries(packageName, desiredFps, generation)

      result(true, "CNSDK 3D enabled; ${messages.joinToString("; ")}")
    } catch (error: Throwable) {
      Log.e(TAG, "enable3D failed", error)
      result(false, "CNSDK enable failed: ${error.message ?: error.javaClass.simpleName}")
    }
  }

  private fun disable3D(): Map<String, Any> {
    fpsUnlockGeneration++
    return try {
      sdk?.apply {
        startFaceTracking(false)
        enableFaceTracking(false)
        enable3D(false)
        enableBacklight(false)
        enableNoFaceMode(false)
        onPause()
      }
      VendorFrameTuning.releasePerformanceLock()
      result(false, "CNSDK 3D disabled")
    } catch (error: Throwable) {
      Log.e(TAG, "disable3D failed", error)
      result(false, "CNSDK disable failed: ${error.message ?: error.javaClass.simpleName}")
    }
  }

  private fun getSdk(activity: Activity, desiredFps: Int): LeiaSDK {
    sdk?.let {
      it.onResume()
      return it
    }
    LeiaSDK.getInstance()?.let {
      sdk = it
      it.onResume()
      return it
    }

    val initArgs = LeiaSDK.InitArgs().apply {
      platform.context = activity.applicationContext
      platform.activity = activity
      enableFaceTracking = true
      startFaceTracking = false
      faceTrackingRuntime = FaceTrackingRuntime.InApp
      faceTrackingPreferredFps = desiredFps
      requiresFaceTrackingPermissionCheck = false
    }
    return LeiaSDK.createSDK(initArgs).also { sdk = it }
  }

  private fun scheduleFpsUnlockRetries(packageName: String, desiredFps: Int, generation: Int) {
    FPS_UNLOCK_RETRY_DELAYS_MS.forEachIndexed { index, delayMs ->
      mainHandler.postDelayed({
        if (generation != fpsUnlockGeneration) return@postDelayed
        val unlockResult = VendorFrameTuning.requestSurfaceFpsUnlock(packageName, desiredFps)
        Log.i(TAG, "fps unlock ${index + 1}/${FPS_UNLOCK_RETRY_DELAYS_MS.size}: $unlockResult")
      }, delayMs)
    }
  }

  private fun preferRefreshRate(activity: Activity, targetFps: Float) {
    runCatching {
      val mode = activity.windowManager.defaultDisplay.supportedModes.minByOrNull {
        kotlin.math.abs(it.refreshRate - targetFps)
      }
      activity.window.attributes = activity.window.attributes.apply {
        preferredRefreshRate = targetFps
        if (mode != null) {
          preferredDisplayModeId = mode.modeId
        }
      }
      Log.i(TAG, "Preferred display mode=${mode?.modeId}, refresh=${mode?.refreshRate}, target=$targetFps")
    }.onFailure {
      Log.w(TAG, "preferRefreshRate($targetFps) failed", it)
    }
  }

  private fun requestCameraPermissionIfNeeded(activity: Activity) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    if (activity.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) return
    activity.requestPermissions(arrayOf(Manifest.permission.CAMERA), CAMERA_REQUEST_CODE)
  }

  private fun result(enabled: Boolean, message: String): Map<String, Any> {
    return mapOf(
      "enabled" to enabled,
      "stereoRender" to enabled,
      "message" to message
    )
  }

  private fun <T> onMainThread(block: () -> T): T {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      return block()
    }
    val result = AtomicReference<T>()
    val error = AtomicReference<Throwable>()
    val latch = CountDownLatch(1)
    mainHandler.post {
      try {
        result.set(block())
      } catch (throwable: Throwable) {
        error.set(throwable)
      } finally {
        latch.countDown()
      }
    }
    latch.await()
    error.get()?.let { throw it }
    return result.get()
  }

  companion object {
    private const val TAG = "Cnsdk3D"
    private const val CAMERA_REQUEST_CODE = 7331
    private const val TARGET_REFRESH_RATE = 144f
    private val FPS_UNLOCK_RETRY_DELAYS_MS = longArrayOf(1200L, 2200L, 3400L, 4800L)
  }
}

private object NativeFpsControl {
  private const val TAG = "Cnsdk3DNativeFps"

  private val loaded = runCatching {
    System.loadLibrary("cnsdk3d_fpscontrol_jni")
  }.onFailure {
    Log.w(TAG, "cnsdk3d_fpscontrol_jni load failed", it)
  }.isSuccess

  fun fpsControlBinder(binder: IBinder, name: String, code: Int, value: Int): String {
    check(loaded) { "cnsdk3d_fpscontrol_jni unavailable" }
    return fpsControlBinderNative(binder, name, code, value)
  }

  private external fun fpsControlBinderNative(
    binder: IBinder,
    name: String,
    code: Int,
    value: Int
  ): String
}

private object VendorFrameTuning {
  private const val TAG = "Cnsdk3DTuning"
  private const val LOCK_TYPE_UNITY_3D = 7
  private const val LOCK_DURATION_MS = 10 * 60 * 1000L
  private const val MINDSYNC_SERVICE = "mindsyncservice"
  private const val MINDSYNC_DESCRIPTOR = "com.zte.performance.mindsync.IMindSyncManager"
  private const val TRANSACTION_ACQUIRE_PERFORMANCE_LOCK = 27
  private const val TRANSACTION_RELEASE_PERFORMANCE_LOCK = 28
  private const val TRANSACTION_SET_FPS = 63
  private const val TRANSACTION_SET_APP_FPS = 64
  private const val REFRESH_RATE_SERVICE = "ZteScreenRefreshRate"
  private const val REFRESH_RATE_DESCRIPTOR = "com.zte.performance.refreshrate.IScreenRefreshRate"
  private const val TRANSACTION_SET_FRAME_RATE_BY_APP = 1
  private const val SURFACE_FLINGER_SERVICE = "SurfaceFlinger"

  private var perfToken: Binder? = null

  fun acquirePerformanceLock(context: Context): String {
    return runCatching {
      val token = perfToken ?: Binder().also { perfToken = it }
      transactMindSync(TRANSACTION_ACQUIRE_PERFORMANCE_LOCK) { data ->
        data.writeStrongBinder(token)
        data.writeString(context.packageName)
        data.writeInt(LOCK_TYPE_UNITY_3D)
        data.writeLong(LOCK_DURATION_MS)
      }
      "MindSync binder lock type=$LOCK_TYPE_UNITY_3D ${LOCK_DURATION_MS}ms"
    }.logResult("MindSync binder lock failed")
  }

  fun releasePerformanceLock(): String {
    val token = perfToken ?: return "MindSync lock not held"
    return runCatching {
      transactMindSync(TRANSACTION_RELEASE_PERFORMANCE_LOCK) { data ->
        data.writeStrongBinder(token)
      }
      perfToken = null
      "MindSync binder lock released"
    }.logResult("MindSync binder release failed")
  }

  fun setFrameRateByApp(frameRate: Float): String {
    return runCatching {
      transactRefreshRate(TRANSACTION_SET_FRAME_RATE_BY_APP) { data ->
        data.writeFloat(frameRate)
        data.writeInt(0)
        data.writeInt(0)
      }
      "ZteScreenRefreshRate setFrameRateByApp fps=$frameRate"
    }.logResult("ZteScreenRefreshRate setFrameRateByApp failed")
  }

  fun setMindSyncFps(packageName: String, fps: Int): String {
    return runCatching {
      transactMindSync(TRANSACTION_SET_FPS) { data ->
        data.writeString("tgpa")
        data.writeString(packageName)
        data.writeInt(fps)
        data.writeString("")
      }
      "MindSync binder setFps pkg=$packageName fps=$fps"
    }.logResult("MindSync binder setFps failed")
  }

  fun setMindSyncAppFps(packageName: String, fps: Int): String {
    return runCatching {
      transactMindSync(TRANSACTION_SET_APP_FPS) { data ->
        data.writeString(packageName)
        data.writeInt(fps)
      }
      "MindSync binder setAppFps pkg=$packageName fps=$fps"
    }.logResult("MindSync binder setAppFps failed")
  }

  fun requestSurfaceFpsUnlock(packageName: String, desiredFps: Int): String {
    val appResult = surfaceFlingerFpsControl(packageName, 8000, desiredFps)
    val commitResult = surfaceFlingerFpsControl("", 10000, 0)
    return "SurfaceFlinger fpsControl unlock: $appResult; $commitResult"
  }

  private fun surfaceFlingerFpsControl(packageName: String, policy: Int, desiredFps: Int): String {
    return runCatching {
      val binder = getService(SURFACE_FLINGER_SERVICE) ?: error("$SURFACE_FLINGER_SERVICE unavailable")
      NativeFpsControl.fpsControlBinder(binder, packageName, policy, desiredFps).also {
        check(it.contains("called")) { it }
      }
    }.logResult("SurfaceFlinger.fpsControl failed")
  }

  private fun transactMindSync(code: Int, writeArgs: (Parcel) -> Unit) {
    val binder = getService(MINDSYNC_SERVICE) ?: error("$MINDSYNC_SERVICE unavailable")
    val data = Parcel.obtain()
    val reply = Parcel.obtain()
    try {
      data.writeInterfaceToken(MINDSYNC_DESCRIPTOR)
      writeArgs(data)
      binder.transact(code, data, reply, 0)
      reply.readException()
    } finally {
      reply.recycle()
      data.recycle()
    }
  }

  private fun transactRefreshRate(code: Int, writeArgs: (Parcel) -> Unit) {
    val binder = getService(REFRESH_RATE_SERVICE) ?: error("$REFRESH_RATE_SERVICE unavailable")
    val data = Parcel.obtain()
    try {
      data.writeInterfaceToken(REFRESH_RATE_DESCRIPTOR)
      writeArgs(data)
      if (!binder.transact(code, data, null, IBinder.FLAG_ONEWAY)) {
        error("$REFRESH_RATE_SERVICE transaction $code failed")
      }
    } finally {
      data.recycle()
    }
  }

  private fun getService(name: String): IBinder? {
    val serviceManager = Class.forName("android.os.ServiceManager")
    val method = serviceManager.getDeclaredMethod("getService", String::class.java)
    method.isAccessible = true
    return method.invoke(null, name) as? IBinder
  }

  private fun Result<String>.logResult(failureMessage: String): String {
    return onSuccess {
      Log.i(TAG, it)
    }.onFailure {
      Log.w(TAG, failureMessage, it)
    }.getOrElse {
      "$failureMessage: ${it.javaClass.simpleName}"
    }
  }
}
