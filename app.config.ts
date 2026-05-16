import "ts-node/register";

import { withMainActivity, withProjectBuildGradle } from "@expo/config-plugins";
import { ConfigContext, ExpoConfig } from "expo/config";

function withCnsdkAndroidMaven(config: ExpoConfig): ExpoConfig {
  return withProjectBuildGradle(config, (config) => {
    const mavenRepo = "maven { url \"$rootDir/../modules/cnsdk-3d/android/maven\" }";
    if (!config.modResults.contents.includes("modules/cnsdk-3d/android/maven")) {
      config.modResults.contents = config.modResults.contents.replace(
        "    mavenCentral()\n    maven { url 'https://www.jitpack.io' }",
        `    mavenCentral()\n    ${mavenRepo}\n    maven { url 'https://www.jitpack.io' }`
      );
    }
    return config;
  });
}

function withAndroidImmersiveFullscreen(config: ExpoConfig): ExpoConfig {
  return withMainActivity(config, (config) => {
    if (config.modResults.language !== "kt") {
      return config;
    }

    let contents = config.modResults.contents;
    const imports = [
      "import android.view.View",
      "import android.view.WindowInsets",
      "import android.view.WindowInsetsController",
      "import android.view.WindowManager",
    ];

    for (const importLine of imports) {
      if (!contents.includes(importLine)) {
        contents = contents.replace(
          "import android.os.Bundle\n",
          `import android.os.Bundle\n${importLine}\n`
        );
      }
    }

    if (!contents.includes("enableImmersiveFullscreen()")) {
      contents = contents.replace(
        "    super.onCreate(null)\n",
        "    super.onCreate(null)\n    enableImmersiveFullscreen()\n"
      );
    }

    if (!contents.includes("private fun enableImmersiveFullscreen()")) {
      contents = contents.replace(
        "  /**\n   * Returns the name of the main component registered from JavaScript.",
        `  override fun onResume() {
    super.onResume()
    enableImmersiveFullscreen()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      enableImmersiveFullscreen()
    }
  }

  private fun enableImmersiveFullscreen() {
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    @Suppress("DEPRECATION")
    window.decorView.systemUiVisibility =
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
        View.SYSTEM_UI_FLAG_FULLSCREEN or
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
        View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_LAYOUT_STABLE

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.setDecorFitsSystemWindows(false)
      window.insetsController?.let { controller ->
        controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
        controller.systemBarsBehavior =
          WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      }
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript.`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = ({ config }: ConfigContext): Partial<ExpoConfig> => {
  if (!config.plugins) config.plugins = [];

  config = withCnsdkAndroidMaven(config as ExpoConfig);
  config = withAndroidImmersiveFullscreen(config as ExpoConfig);

  return config;
};
