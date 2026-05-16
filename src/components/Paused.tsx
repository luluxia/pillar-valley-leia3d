import { BlurView } from "expo-blur";
import React from "react";
import { StyleSheet, View, Text } from "react-native";
import * as Animatable from "react-native-animatable";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFont } from "../hooks/useFont";
import { SF } from "./sf-symbol";

export default function Paused() {
  const color = "white";
  const { left } = useSafeAreaInsets();

  // TODO: Remove with RN 72
  const gothamNarrowBook = useFont("Inter_400Regular");
  return (
    <BlurView
      intensity={95}
      style={[
        StyleSheet.absoluteFill,
        { justifyContent: "center", alignItems: "center" },
      ]}
    >
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text
          style={{
            fontFamily: gothamNarrowBook,
            textAlign: "center",
            color,
            fontSize: 48,
          }}
        >
          <SF size={48} color="white" fallback="pause" name="pause" /> 已暂停
        </Text>
        <Animatable.Text
          animation="fadeIn"
          delay={1000}
          style={{
            fontFamily: gothamNarrowBook,
            textAlign: "center",
            color,
            fontSize: 18,
          }}
        >
          游戏切到后台时会暂停
        </Animatable.Text>
      </View>
      <Animatable.Text
        animation="fadeIn"
        delay={1500}
        style={{
          fontFamily: gothamNarrowBook,
          color,
          fontSize: 18,
          textAlign: "center",
          paddingHorizontal: left,
          width: "75%",
          marginBottom: 24,
        }}
      >
        返回游戏后继续挑战
      </Animatable.Text>
    </BlurView>
  );
}
