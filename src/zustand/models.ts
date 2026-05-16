import "@/runtime/local-storage";

import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import GameStates from "@/Game/GameStates";
import { logEvent } from "@/lib/Analytics";
import { Settings } from "@/lib/Settings";

export type ScoreShape = {
  current: number;
  best: number;
  total: number;
  last: number | null;
  isBest: boolean;
};

const initialScoreState: ScoreShape = {
  current: 0,
  best: 0,
  total: 0,
  last: null,
  isBest: false,
};

// TODO: Upstream this for web compat.
if (typeof expo === "undefined") {
  globalThis.expo = {};
}

export function useSyncGlobalAudioWithSettings() {
  const glob = useGlobalAudio();
  const key = "p_inapp_audio";
  useEffect(() => {
    if (process.env.EXPO_OS === "ios") {
      let isMounted = true;
      const callback = Settings.watchKeys(key, () => {
        if (isMounted) {
          glob._syncEnabled(!!Settings.get(key));
        }
      });
      return () => {
        Settings.clearWatch(callback);
        isMounted = false;
      };
    }
  }, [glob]);
}

export const useGlobalAudio = create(
  persist<{
    enabled: boolean;
    toggleMuted(): void;
    _syncEnabled(enabled: boolean): void;
  }>(
    (set) => ({
      enabled: true,
      _syncEnabled: (enabled) => set((state) => ({ ...state, enabled })),
      toggleMuted: () =>
        set((state) => {
          logEvent("toggle_music", { on: state.enabled });
          return { ...state, enabled: !state.enabled };
        }),
    }),
    {
      name: "p_inapp_audio",
      storage: createJSONStorage(() => {
        return {
          getItem(name) {
            if (process.env.EXPO_OS === "ios") {
              return JSON.stringify({
                state: { enabled: Boolean(Settings.get(name)) },
                version: 0,
              });
            } else {
              return localStorage.getItem(name);
            }
          },
          setItem(name, value) {
            if (process.env.EXPO_OS === "ios") {
              const enabled = Boolean(JSON.parse(value).state.enabled);
              Settings.set({
                [name]: enabled,
              });
            } else {
              return localStorage.setItem(name, value);
            }
          },
          removeItem(name) {
            if (process.env.EXPO_OS === "ios") {
              Settings.set({ [name]: undefined });
            } else {
              return localStorage.removeItem(name);
            }
          },
        };
      }),
    }
  )
);

const LocalStorageObj = {
  getItem: (name: string): string | null | Promise<string | null> => {
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string): unknown | Promise<unknown> => {
    return localStorage.setItem(name, value);
  },
  removeItem: (name: string): unknown | Promise<unknown> => {
    return localStorage.removeItem(name);
  },
};

const clampStereoDepthScale = (value: number) => {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(Math.max(value, 0), 2);
};

export const useStereoDepthSettings = create(
  persist<{
    depthScale: number;
    setDepthScale(value: number): void;
  }>(
    (set) => ({
      depthScale: 1,
      setDepthScale: (value) =>
        set((state) => ({
          ...state,
          depthScale: clampStereoDepthScale(value),
        })),
    }),
    {
      name: "useStereoDepthSettings",
      version: 1,
      migrate: (persistedState) => {
        const state = persistedState as { depthScale?: number } | undefined;
        return {
          depthScale: clampStereoDepthScale(state?.depthScale ?? 1),
        };
      },
      storage: createJSONStorage(() => LocalStorageObj),
    }
  )
);

export const useCurrency = create(
  persist<{
    currency: number;
    resetCurrency(): void;
    changeCurrency(val: number): void;
  }>(
    (set) => ({
      currency: 0,

      // For `currency`
      changeCurrency: (value) =>
        set((state) => ({
          ...state,
          currency: state.currency + value,
        })),
      resetCurrency: () =>
        set((state) => ({
          ...state,
          currency: 0,
        })),
    }),
    {
      name: "useCurrency", // unique name
      storage: createJSONStorage(() => LocalStorageObj),
    }
  )
);

export const useGameState = create<{
  game: GameStates;
  playGame(): void;
  menuGame(): void;
}>((set) => ({
  game: GameStates.Menu,
  playGame: () => set(() => ({ game: GameStates.Playing })),
  menuGame: () => set(() => ({ game: GameStates.Menu })),
}));

export const useGameScreenshot = create<{
  screenshot: null | string;
  updateScreenshot(uri: string): void;
}>((set) => ({
  screenshot: null,
  updateScreenshot: (uri) =>
    set(() => {
      // const { width, height } = Dimensions.get("window");
      // const uri = await captureRef(ref, {
      //   format: "jpg",
      //   quality: 0.3,
      //   result: "tmpfile",
      //   // result: "file",
      //   height,
      //   width,
      // });
      // dispatch.screenshot.update(uri);

      return { screenshot: uri };
    }),
}));

export const useScore = create(
  persist<{
    score: {
      current: number;
      best: number;
      total: number;
      last: number | null;
      isBest: boolean;
    };
    hardResetScore(): void;
    incrementScore(): void;
    resetScore(): void;
    updateTotal(current: number): void;
    setHighScore(score: number): void;
  }>(
    (set) => ({
      score: {
        current: 0,
        best: 0,
        total: 0,
        last: null,
        isBest: false,
      },

      setHighScore(score: number) {
        useRounds.getState().incrementBestRounds();
      },

      // For `score`
      hardResetScore: () =>
        set((state) => ({
          ...state,
          score: { ...initialScoreState },
        })),

      incrementScore: () =>
        set((state) => {
          const nextScore = state.score.current + 1;

          return {
            ...state,
            score: {
              ...state.score,
              current: nextScore,
              best: Math.max(nextScore, state.score.best),
              isBest: nextScore > state.score.best,
            },
          };
        }),
      resetScore: () =>
        set((state) => ({
          ...state,
          score: {
            ...state.score,
            current: 0,
            last: state.score.current,
            isBest: false,
          },
        })),

      updateTotal(current: number) {
        set((state) => {
          const total = state.score.total + current;

          return { ...state, score: { ...state.score, total } };
        });
      },
    }),
    {
      name: "useScore", // unique name
      storage: createJSONStorage(() => LocalStorageObj),
    }
  )
);

export const useRounds = create(
  persist<{
    bestRounds: number;
    rounds: number;

    resetBestRounds(): void;
    setBestRounds(val: number): void;
    resetRounds(): void;
    setRounds(value: any): void;

    incrementRounds(): void;
    incrementBestRounds(): void;
  }>(
    (set) => ({
      bestRounds: 0,
      rounds: 0,

      // Reducers

      incrementBestRounds: () => {
        set((state) => {
          const next = state.bestRounds + 1;

          logEvent("had_best_round", {
            count: state.bestRounds,
            score: useScore.getState().score.total,
          });

          // if the user ever beats their highscore twice after the first day of using the app, prompt them to rate the app.
          if (state.bestRounds > 1) {
            // dispatch.storeReview.promptAsync();
          }

          return {
            ...state,
            bestRounds: next,
          };
        });
      },

      // For `bestRounds`
      resetBestRounds: () => set((state) => ({ ...state, bestRounds: 0 })),
      setBestRounds: (val) => set((state) => ({ ...state, bestRounds: val })),

      // For `rounds`
      resetRounds: () => set((state) => ({ ...state, rounds: 0 })),
      setRounds: (val) => set((state) => ({ ...state, rounds: val })),

      incrementRounds: () =>
        set((state) => {
          const next = state.rounds + 1;
          return { ...state, rounds: next };
        }),
    }),
    {
      name: "useRounds", // unique name
      storage: createJSONStorage(() => LocalStorageObj),
    }
  )
);
