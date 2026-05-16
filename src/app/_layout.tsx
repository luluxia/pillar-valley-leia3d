import FontAwesome from "@expo/vector-icons/FontAwesome";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Font from "expo-font";
import { Stack, usePathname } from "expo-router";
import Head from "expo-router/head";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Animated, StatusBar, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { Slate } from "../constants/Colors";

import AudioManager from "@/AudioManager";
// import Fire from "@/ExpoParty/Fire";
import { logEvent } from "@/lib/Analytics";
import { isGlassEffectAPIAvailable } from "expo-glass-effect";

const suppressMetroWarnings = (shouldSuppress = true) => {
  if (shouldSuppress) {
    global.__expo_three_oldWarn = global.__expo_three_oldWarn || console.warn;
    global.console.warn = (str) => {
      let tst = (str || "") + "";
      if (
        tst.startsWith("THREE.WebGLRenderer:") ||
        tst.startsWith("THREE.WebGLShader: gl.getShader") ||
        tst.startsWith("THREE.Matrix4: .getInverse()") ||
        tst.startsWith("THREE.Matrix3: .getInverse()")
      ) {
        // don't provide stack traces for warnspew from THREE
        console.log("Warning:", str);
        return;
      }
      return global.__expo_three_oldWarn.apply(console, [str]);
    };
  } else {
    console.warn = global.__expo_three_oldWarn;
  }
};
suppressMetroWarnings();

export const unstable_settings = {
  anchor: "index",
};

// TODO: Customize this
export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const loading = useLoadAssets();

  return (
    <>
      <Head>
        <meta property="og:title" content="幻柱峡谷 3D" />

        <meta name="msapplication-TileColor" content="#F09458" />
        <meta name="theme-color" content="#ffffff" />
      </Head>
      <AnimatedSplashScreen
        loading={loading}
        image={require("icons/splash.png")}
      >
        <InnerLayout />
      </AnimatedSplashScreen>
    </>
  );
}
function InnerLayout() {
  const pathname = usePathname();
  useEffect(() => {
    logEvent("screen_view", { currentScreen: pathname });
  }, [pathname]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: isGlassEffectAPIAvailable()
            ? "minimal"
            : "default",
          headerTintColor: "white",
          headerStyle: {
            backgroundColor: "#21222B",
            borderBottomWidth: 0,
          },
          headerBackTitleStyle: {
            fontFamily: "Inter_500Medium",
          },

          contentStyle: {
            backgroundColor: Slate[900],
          },

          headerTitleStyle: {
            color: "white",
            fontFamily: "Inter_500Medium",
          },
        }}
      >
        <Stack.Screen
          name="index"
          dangerouslySingular
          options={{ header: () => null }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: "设置",
            headerShown: false,
            presentation: "modal",
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

function useLoadAssets() {
  const [loading, setLoading] = React.useState(true);
  const [fonts, error] = Font.useFonts({
    ...FontAwesome.font,
    ...Ionicons.font,
    Inter_400Regular: require("@/assets/fonts/Inter_400Regular.ttf"),
    Inter_500Medium: require("@/assets/fonts/Inter_500Medium.ttf"),
  });

  React.useEffect(() => {
    if (error) {
      console.log("Error loading fonts");
      logEvent("error_loading_fonts", { error: error.message });
      console.error(error);
    }
  }, [error]);

  React.useEffect(() => {
    StatusBar.setBarStyle("light-content", true);
    // Fire.init();
    (async () => {
      const time = getNow();
      try {
        await AudioManager.setupAsync();
      } catch (error: any) {
        console.log("Error loading audio");
        logEvent("error_loading_assets", { error: error.message });
        console.error(error);
      } finally {
        const total = getNow() - time;
        logEvent("assets_loaded", { milliseconds: total });
        console.log("Setup:", total);
      }
      setLoading(false);
    })();
  }, []);

  return loading && fonts;
}

function AnimatedSplashScreen({ children, loading, image }) {
  const animation = React.useMemo(() => new Animated.Value(1), []);
  const [isAppReady, setAppReady] = React.useState(false);
  const [isSplashAnimationComplete, setAnimationComplete] =
    React.useState(false);

  useEffect(() => {
    if (isAppReady && !loading) {
      SplashScreen.hideAsync();

      Animated.timing(animation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setAnimationComplete(true));
    }
  }, [animation, isAppReady, loading]);

  const onImageLoaded = React.useCallback(async () => {
    setAppReady(true);
  }, []);

  if (process.env.EXPO_OS === "web") {
    return children;
  }

  return (
    <>
      {children}

      {!isSplashAnimationComplete && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              pointerEvents: "none",
              backgroundColor: "#F09458",
              opacity: animation,
            },
          ]}
        >
          <Animated.Image
            style={{
              width: "100%",
              height: "100%",
              resizeMode: "cover",
              transform: [
                {
                  scale: animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [2.5, 1],
                  }),
                },
              ],
            }}
            source={image}
            onLoadEnd={onImageLoaded}
            fadeDuration={0}
          />
        </Animated.View>
      )}
    </>
  );
}

// @ts-ignore
const getNow = global.nativePerformanceNow ?? Date.now;
