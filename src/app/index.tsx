import Head from "expo-router/head";
import { useNavigation } from "expo-router";
import React from "react";
import {
  LogBox,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  View,
} from "react-native";

import GameState from "@/Game/GameState";
import Footer from "@/components/Footer";
import GraphicsView from "@/components/GraphicsView";
import Paused from "@/components/Paused";
import ScoreMeta from "@/components/ScoreMeta";
import Song from "@/components/Song";
import TouchableView from "@/components/TouchableView";
import useAppState from "@/hooks/useAppState";
import Cnsdk3DModule from "local:cnsdk-3d/src/Cnsdk3DModule";

const TARGET_CNSDK_FPS = 144;

LogBox.ignoreLogs([
  "Deep imports from the 'react-native' package are deprecated",
  "Settings is not yet supported on this platform.",
]);
LogBox.ignoreAllLogs(true);

async function requestAndroidCameraPermissionAsync() {
  if (Platform.OS !== "android") {
    return false;
  }
  const permission = PermissionsAndroid.PERMISSIONS.CAMERA;
  const current = await PermissionsAndroid.check(permission);
  if (current) {
    return true;
  }
  const result = await PermissionsAndroid.request(permission);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export default function GameScreen() {
  const machine = React.useMemo(() => new GameState(), []);
  const navigation = useNavigation();
  const appState = useAppState();
  const [isRouteFocused, setIsRouteFocused] = React.useState(true);
  const [graphicsKey, setGraphicsKey] = React.useState(0);
  const hasSeenInitialFocus = React.useRef(false);
  const isPaused = appState !== "active" || !isRouteFocused;

  React.useEffect(() => {
    const unsubscribeFocus = navigation.addListener("focus", () => {
      setIsRouteFocused(true);
      if (!hasSeenInitialFocus.current) {
        hasSeenInitialFocus.current = true;
        return;
      }
      machine.prepareForCnsdkResume();
      setGraphicsKey((key) => key + 1);
    });
    const unsubscribeBlur = navigation.addListener("blur", () => {
      setIsRouteFocused(false);
      machine.setCnsdkStereoEnabled(false);
      if (Platform.OS === "android" && Cnsdk3DModule.isAndroidCnsdkAvailable) {
        Cnsdk3DModule.disable().catch(() => null);
      }
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
      machine.destroy();
    };
  }, [machine, navigation]);

  React.useEffect(() => {
    let mounted = true;

    async function syncCnsdk3D() {
      if (
        Platform.OS !== "android" ||
        !Cnsdk3DModule.isAndroidCnsdkAvailable
      ) {
        machine.setCnsdkStereoEnabled(false);
        return;
      }

      if (isPaused) {
        machine.setCnsdkStereoEnabled(false);
        await Cnsdk3DModule.disable().catch(() => null);
        return;
      }

      const hasCameraPermission = await requestAndroidCameraPermissionAsync();
      if (!mounted || !hasCameraPermission) {
        machine.setCnsdkStereoEnabled(false);
        return;
      }

      const result = await Cnsdk3DModule.enable({
        desiredFps: TARGET_CNSDK_FPS,
      }).catch(() => null);
      if (mounted) {
        machine.setCnsdkStereoEnabled(Boolean(result?.stereoRender));
      }
    }

    syncCnsdk3D();

    return () => {
      mounted = false;
      machine.setCnsdkStereoEnabled(false);
      if (Platform.OS === "android" && Cnsdk3DModule.isAndroidCnsdkAvailable) {
        Cnsdk3DModule.disable().catch(() => null);
      }
    };
  }, [isPaused, machine]);

  return (
    <>
      <Head>
        <title>幻柱峡谷 3D</title>
      </Head>
      <View style={styles.container}>
        <Song />
        <TouchableView
          style={styles.canvas}
          onTouchesBegan={machine.onTouchesBegan}
        >
          <GraphicsView
            key={graphicsKey}
            isPaused={isPaused}
            onContextCreate={machine.onContextCreateAsync}
            onRender={machine.onRender}
            onResize={machine.onResize}
          />
        </TouchableView>
        <ScoreMeta />
        <Footer />
        {isPaused && <Paused />}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F09458",
    pointerEvents: "box-none",
  },
  canvas: {
    flex: 1,
    overflow: "hidden",
  },
});
