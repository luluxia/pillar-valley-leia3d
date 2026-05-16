import Head from "expo-router/head";
import React from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CustomList } from "@/components/CustomList";
import { SF } from "@/components/sf-symbol";
import { Slate } from "@/constants/Colors";
import {
  useRounds,
  useScore,
  useStereoDepthSettings,
} from "@/zustand/models";

function confirmResetAsync(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "确认重置统计？",
      "该操作会清空本机保存的分数和局数记录，无法撤销。",
      [
        {
          text: "重置",
          style: "destructive",
          onPress: () => {
            resolve(true);
          },
        },
        {
          text: "取消",
          style: "cancel",
          onPress: () => {
            resolve(false);
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

const STEREO_DEPTH_STEP = 0.1;
const STEREO_DEPTH_PRESETS = [0, 0.5, 1, 1.5, 2];

function StereoDepthControl() {
  const depthScale = useStereoDepthSettings((state) => state.depthScale);
  const setDepthScale = useStereoDepthSettings((state) => state.setDepthScale);
  const percent = Math.round(depthScale * 100);

  const updateDepth = React.useCallback(
    (value: number) => {
      setDepthScale(Math.round(value * 10) / 10);
    },
    [setDepthScale]
  );

  return (
    <View style={styles.depthControl}>
      <Text style={styles.depthValue}>{percent}%</Text>
      <Pressable
        accessibilityLabel="降低 3D 景深"
        hitSlop={8}
        onPress={() => updateDepth(depthScale - STEREO_DEPTH_STEP)}
        style={styles.depthButton}
      >
        <SF size={18} color={Slate[100]} name="minus" fallback="remove" />
      </Pressable>
      <View style={styles.depthTrack}>
        {STEREO_DEPTH_PRESETS.map((value) => {
          const active = depthScale >= value;
          return (
            <Pressable
              accessibilityLabel={`设置 3D 景深为 ${Math.round(value * 100)}%`}
              key={value}
              onPress={() => updateDepth(value)}
              style={[
                styles.depthSegment,
                active && styles.depthSegmentActive,
              ]}
            />
          );
        })}
      </View>
      <Pressable
        accessibilityLabel="提高 3D 景深"
        hitSlop={8}
        onPress={() => updateDepth(depthScale + STEREO_DEPTH_STEP)}
        style={styles.depthButton}
      >
        <SF size={18} color={Slate[100]} name="plus" fallback="add" />
      </Pressable>
    </View>
  );
}

export default function PreferencesScreen() {
  const { score, hardResetScore } = useScore();
  const { rounds, bestRounds, resetBestRounds, resetRounds } = useRounds();
  const data = [
    {
      title: "裸眼 3D",
      data: [
        {
          title: "景深强度",
          accessory: <StereoDepthControl />,
        },
      ],
    },
    {
      title: "统计",
      data: [
        { title: "累计通过", value: score.total },
        { title: "游戏次数", value: rounds },
        { title: "最高分", value: score.best },
        { title: "刷新最高分", value: bestRounds },
        {
          title: "重置统计",
          value: "不可撤销",
          onPress: async () => {
            if (await confirmResetAsync()) {
              hardResetScore();
              resetBestRounds();
              resetRounds();
            }
          },
        },
      ],
    },
  ];

  return (
    <>
      <Head>
        <title>设置</title>
        <meta property="og:title" content="设置 | 幻柱峡谷 3D" />
      </Head>
      <CustomList sections={data} />
    </>
  );
}

const styles = StyleSheet.create({
  depthControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  depthValue: {
    color: Slate[500],
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    minWidth: 42,
    textAlign: "right",
  },
  depthButton: {
    alignItems: "center",
    backgroundColor: Slate[400],
    borderRadius: 8,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  depthTrack: {
    flexDirection: "row",
    gap: 4,
  },
  depthSegment: {
    backgroundColor: Slate[400],
    borderRadius: 3,
    height: 8,
    width: 18,
  },
  depthSegmentActive: {
    backgroundColor: "#F09458",
  },
});
