import { Animated, Easing } from "react-native";
import * as THREE from "three";
import {
  fog,
  mix,
  positionWorld,
  screenUV,
  smoothstep,
  uniform,
} from "three/tsl";

export default class GameScene extends THREE.Scene {
  private static readonly HEIGHT_FOG_STRENGTH = 0.62;

  // 0 = deep purple, 1 = deep blue. Slowly cycled by `animateBackgroundColor`
  // so the night sky drifts between two moody tones as you play.
  private _skyMixValue = new Animated.Value(0);

  // Pre-allocated colors so the per-frame uniform update doesn't allocate.
  // `_purpleTop` is historical — it now holds a bright golden yellow that
  // the sky ping-pongs toward alongside the deep blue endpoint.
  private readonly _purpleTop = new THREE.Color(0x8dc8f5);
  private readonly _blueTop = new THREE.Color(0x7877b4);
  private readonly _warmHorizon = new THREE.Color(0xffb6df);

  // The animated top-of-sky color, exposed to the TSL graph as a uniform so
  // we can mutate it in place from JS without rebuilding shaders.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private topColorUniform: any;

  constructor() {
    super();

    this.topColorUniform = uniform(this._purpleTop.clone());
    const horizonUniform = uniform(this._warmHorizon.clone());

    // Vertical screen-space gradient: deep night-sky tone up top, fading
    // into a warm orange "cloud bank" along the bottom edge. In three/webgpu
    // `screenUV.y` is 0 at the *top* of the screen and 1 at the bottom, so
    // mixing from topColor → horizon as y grows puts the warm band low.
    // We share this same expression with the fog node below so pillars fade
    // into *exactly* the same color the sky shows at that pixel — there's
    // no visible seam between fogged geometry and the backdrop.
    const skyGradient = mix(
      this.topColorUniform,
      horizonUniform,
      smoothstep(0.4, 1.0, screenUV.y),
    );

    // @ts-ignore - `backgroundNode` is a three/webgpu Scene property the
    // shipped types don't yet declare.
    this.backgroundNode = skyGradient;

    // Height-based fog: fully opaque below y ≈ -350 and clear above y ≈ 50,
    // so the cloud bank rises noticeably higher up the screen and only the
    // tops of the pillars poke through. This makes the pillars appear to
    // recede into a cloud bank rather than just being color-tinted by camera
    // distance — and it also hides the menu/title objects sitting low in
    // the scene. The fog *color* is sampled from the same screen-space
    // gradient as the background so the transition is seamless.
    const heightFactor = smoothstep(-350, 50, positionWorld.y)
      .oneMinus()
      .mul(GameScene.HEIGHT_FOG_STRENGTH);
    // @ts-ignore - `fogNode` is also webgpu-only on Scene.
    this.fogNode = fog(skyGradient, heightFactor);

    this._skyMixValue.addListener(({ value }) => {
      const top = this.topColorUniform.value as THREE.Color;
      top.copy(this._purpleTop).lerp(this._blueTop, value);
    });
  }

  animateBackgroundColor = (input: number) => {
    // Ping-pong between purple (0) and blue (1) endpoints each tap so the
    // backdrop stays alive without drifting into garish hues.
    const next = input % 2 === 0 ? 1 : 0;

    Animated.timing(this._skyMixValue, {
      toValue: next,
      duration: 2000,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false, // animating a non-native uniform value
    }).start();
  };
}
