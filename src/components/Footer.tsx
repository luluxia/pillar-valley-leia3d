import * as Haptics from "@/lib/expo-haptics";
import { useNavigation } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import * as Animatable from "react-native-animatable";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PreferencesButton from "./Button/PreferencesButton";
import SoundButton from "./Button/Sound";
import GameStates from "../Game/GameStates";
import { useGameState } from "../zustand/models";

const delay = 100;
const initialDelay = 100;
const duration = 500;
const easing = "ease-out";

function Footer() {
  const { game } = useGameState();
  const { bottom } = useSafeAreaInsets();
  const animation = game === GameStates.Menu ? "zoomIn" : "zoomOut";

  const navigation = useNavigation();
  const onPreferencesPress = () => {
    Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
    navigation.push("settings");
  };
  const views = [];

  if (process.env.EXPO_OS !== "web") {
    views.push(<SoundButton />);
  }

  views.push(<PreferencesButton onPress={onPreferencesPress} />);

  return (
    <View style={[styles.container, { marginBottom: bottom }]}>
      {views.map((view, index) => {
        const _delay = index * delay;
        return (
          <Animatable.View
            useNativeDriver={Platform.select({ web: false, default: true })}
            key={index}
            duration={duration + _delay}
            delay={initialDelay + _delay}
            animation={animation}
            easing={easing}
            style={styles.button}
          >
            {view}
          </Animatable.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    height: 64,
    alignItems: "center",
    justifyContent: "space-around",
  },
  button: {
    height: 64,
  },
});

export default Footer;
