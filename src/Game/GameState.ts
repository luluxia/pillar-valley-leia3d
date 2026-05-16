import * as THREE from "three";
import type { Renderer } from "three/webgpu";

import { RendererEvent, ResizeEvent } from "../components/GraphicsView";
import { useStereoDepthSettings } from "../zustand/models";
import Game from "./Game";

const CNSDK_EYE_SEPARATION = 6.4;
const CNSDK_EYE_ASPECT_SCALE = 1;

export default class GameState {
  game: Game | null = null;
  renderer: Renderer | null = null;
  private stereoCamera = new THREE.StereoCamera();
  private readonly rendererSize = new THREE.Vector2();
  private readonly drawingBufferSize = new THREE.Vector2();
  private cnsdkStereoEnabled = false;
  private frameCount = 0;
  private fpsWindowStart = 0;
  private stereoDepthScale = useStereoDepthSettings.getState().depthScale;
  private unsubscribeStereoDepth?: () => void;

  constructor() {
    this.rebuildStereoCamera();
    this.unsubscribeStereoDepth = useStereoDepthSettings.subscribe((state) => {
      this.stereoDepthScale = state.depthScale;
      if (this.cnsdkStereoEnabled) {
        this.rebuildStereoCamera();
      }
    });
  }

  destroy = () => {
    this.unsubscribeStereoDepth?.();
    this.unsubscribeStereoDepth = undefined;
  };

  private applyStereoDepth = (depthScale: number) => {
    this.stereoDepthScale = depthScale;
    this.stereoCamera.eyeSep = CNSDK_EYE_SEPARATION * depthScale;
  };

  private rebuildStereoCamera = () => {
    this.stereoCamera = new THREE.StereoCamera();
    this.stereoCamera.aspect = CNSDK_EYE_ASPECT_SCALE;
    this.applyStereoDepth(useStereoDepthSettings.getState().depthScale);
  };

  prepareForCnsdkResume = () => {
    this.rebuildStereoCamera();
    this.frameCount = 0;
    this.fpsWindowStart = 0;
    if (this.game?.camera) {
      this.game.camera.updateProjectionMatrix();
      this.game.camera.updateMatrixWorld(true);
    }
  };

  onContextCreateAsync = async ({
    renderer,
    width,
    height,
  }: RendererEvent) => {
    this.renderer = renderer;
    this.game = new Game(width, height, renderer);
    await this.game.loadAsync();
  };

  setCnsdkStereoEnabled = (enabled: boolean) => {
    if (enabled) {
      this.prepareForCnsdkResume();
    }
    this.cnsdkStereoEnabled = enabled;
  };

  onTouchesBegan = () => {
    if (this.game) {
      this.game.onTouchesBegan();
    }
  };

  onResize = (layout: ResizeEvent) => {
    const width = layout.width;
    const height = layout.height;

    if (this.renderer) {
      this.renderer.setSize(width, height, false);
    }
    if (this.game?.camera) {
      this.game.camera.aspect = width / height;
      this.game.camera.updateProjectionMatrix();
    }
  };

  onRender = (delta: number, time: number) => {
    if (this.game) {
      this.game.update(delta, time);
      this.logFrameRate(time);
      if (this.renderer) {
        if (this.cnsdkStereoEnabled) {
          this.renderCnsdkPackedStereo();
        } else {
          this.renderMono();
        }
      }
    }
  };

  private logFrameRate = (time: number) => {
    this.frameCount += 1;
    if (this.fpsWindowStart === 0) {
      this.fpsWindowStart = time;
      return;
    }

    const elapsed = time - this.fpsWindowStart;
    if (elapsed < 1) return;

    const fps = this.frameCount / elapsed;
    let buffer = "unknown";
    if (this.renderer) {
      this.renderer.getSize(this.rendererSize);
      this.renderer.getDrawingBufferSize(this.drawingBufferSize);
      buffer = `${this.rendererSize.x}x${this.rendererSize.y}/${this.drawingBufferSize.x}x${this.drawingBufferSize.y}`;
    }
    console.info(
      `ThreeFrame mode=${this.cnsdkStereoEnabled ? "three-packed-stereo" : "mono"} fps=${fps.toFixed(1)} eyeAspectScale=${this.stereoCamera.aspect} depthScale=${this.stereoDepthScale.toFixed(2)} eyeSep=${this.stereoCamera.eyeSep.toFixed(2)} size=${buffer}`
    );
    this.frameCount = 0;
    this.fpsWindowStart = time;
  };

  private renderMono = () => {
    if (!this.renderer || !this.game?.scene || !this.game.camera) return;
    this.renderer.setScissorTest(false);
    this.renderer.render(this.game.scene, this.game.camera);
  };

  private renderCnsdkPackedStereo = () => {
    if (!this.renderer || !this.game?.scene || !this.game.camera) return;

    const renderer = this.renderer;
    const scene = this.game.scene;
    const camera = this.game.camera;

    camera.updateMatrixWorld(true);
    this.stereoCamera.update(camera);

    renderer.getSize(this.rendererSize);
    const width = this.rendererSize.x;
    const height = this.rendererSize.y;
    const halfWidth = Math.floor(width / 2);
    const previousAutoClear = renderer.autoClear;

    renderer.autoClear = false;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
    renderer.clear();

    try {
      renderer.setScissorTest(true);

      renderer.setViewport(0, 0, halfWidth, height);
      renderer.setScissor(0, 0, halfWidth, height);
      renderer.render(scene, this.stereoCamera.cameraL);

      renderer.setViewport(halfWidth, 0, width - halfWidth, height);
      renderer.setScissor(halfWidth, 0, width - halfWidth, height);
      renderer.render(scene, this.stereoCamera.cameraR);
    } finally {
      renderer.autoClear = previousAutoClear;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
    }
  };
}
