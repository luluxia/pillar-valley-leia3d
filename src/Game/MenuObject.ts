import { Easing } from "react-native";
import * as THREE from "three";
const UPNG = require("upng-js");

import GameObject from "./GameObject";
import { MENU_TEXTURE_BASE64, type MenuTextureKey } from "./menuTextureData";
import MotionObserver from "./MotionObserver";
import { RNAnimator } from "./utils/animator";

class FlatMaterial extends THREE.MeshPhongMaterial {
  constructor(props: any) {
    super({
      flatShading: true,
      ...props,
    });
  }
}

const MENU_TITLE_TARGET_X = -28;
const MENU_TITLE_TARGET_Y = -525;
const MENU_TITLE_Z = -200;
const MENU_TITLE_START_Y = -1100;

const PILLAR_FINAL_Y = -500;
const VALLEY_FINAL_Y = -530;
const BEGIN_FINAL_Y = -540;

function base64ToBytes(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * Android release builds were resolving menu PNGs to network-style asset URIs.
 * Decode embedded copies instead so the original English title art is always
 * available before the first frame.
 */
function loadEmbeddedTexture(textureKey: MenuTextureKey): THREE.Texture {
  const bytes = base64ToBytes(MENU_TEXTURE_BASE64[textureKey]);
  const png = UPNG.decode(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  );
  const rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);
  const texture = new THREE.DataTexture(
    rgba,
    png.width,
    png.height,
    THREE.RGBAFormat
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.needsUpdate = true;
  return texture;
}

function loadMenuMaterial(
  textureKey: MenuTextureKey,
  color: number
): THREE.Material[] {
  const material = new FlatMaterial({ color });
  try {
    const texture = loadEmbeddedTexture(textureKey);
    // Tint the unlit logo face down a touch so it sits in the same value
    // range as the lit pillar sides instead of glowing white.
    const image = new THREE.MeshBasicMaterial({ map: texture, color: 0xc8c8c8 });
    return [material, material, image, material, material, material];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Menu texture unavailable; continuing with flat material: ${message}`);
    return [material, material, material, material, material, material];
  }
}

function makeMenuPillar(textureKey: MenuTextureKey, color = 0xdb7048) {
  const width = 100;
  const depth = width * 0.33;

  const materials = loadMenuMaterial(textureKey, color);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(100, 1000, depth, 1, 1, 1),
    materials
  );
  mesh.position.y = -500;
  return mesh;
}

function centerMenuTitleGroup(titleGroup: THREE.Object3D) {
  titleGroup.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(titleGroup);
  const center = new THREE.Vector3();
  bounds.getCenter(center);
  titleGroup.position.x += MENU_TITLE_TARGET_X - center.x;
  titleGroup.position.y += MENU_TITLE_TARGET_Y - center.y;
}

export default class MenuObject extends GameObject {
  motionObserver = new MotionObserver();

  async loadAsync() {
    this.motionObserver.start();
    const titleGroup = new THREE.Object3D();
    titleGroup.position.z = MENU_TITLE_Z;

    const pillar = makeMenuPillar("pillar");
    titleGroup.add(pillar);

    const pillarB = makeMenuPillar("valley");
    titleGroup.add(pillarB);

    if (pillarB.position) {
      pillarB.position.y = VALLEY_FINAL_Y;
      pillarB.position.x = 55;
      pillarB.position.z = 55;
    }

    const pillarC = makeMenuPillar("begin", 0xedcbbf);
    titleGroup.add(pillarC);

    pillar.position.y = PILLAR_FINAL_Y;
    pillarC.position.y = BEGIN_FINAL_Y;
    pillarC.position.x = 30;
    pillarC.position.z = 105;

    centerMenuTitleGroup(titleGroup);

    pillar.position.y = MENU_TITLE_START_Y;
    RNAnimator.to(
      pillar.position,
      1000 * 1.1,
      {
        y: PILLAR_FINAL_Y,
      },
      {
        easing: Easing.out(Easing.back(1.7)),
      }
    );

    pillarB.position.y = MENU_TITLE_START_Y;
    RNAnimator.to(
      pillarB.position,
      1000,
      {
        y: VALLEY_FINAL_Y,
      },
      {
        easing: Easing.out(Easing.back(1.7)),
        delay: 100,
      }
    );

    pillarC.position.y = MENU_TITLE_START_Y;
    RNAnimator.to(
      pillarC.position,
      1000,
      {
        y: BEGIN_FINAL_Y,
      },
      {
        easing: Easing.out(Easing.exp),
        delay: 200,
      }
    );

    this.add(titleGroup);

    this.pillars = [pillar, pillarB, pillarC];
  }
  pillars: THREE.Mesh[] = [];

  animateHidden = (onComplete: () => void) => {
    RNAnimator.to(
      this.position,
      1000,
      {
        y: -1100,
      },
      {
        easing: Easing.out(Easing.exp),
        delay: 200,
        onComplete: async () => {
          this.motionObserver.stop();
          // Once the title has fully dropped, take it out of the render
          // tree entirely. The new height-based fog only goes fully opaque
          // around y ≈ -650, so without this the title pillars would still
          // poke through the warm cloud bank in the background.
          this.visible = false;
          onComplete();
        },
      }
    );
  };

  updateWithCamera = (camera: THREE.Camera) => {
    this.motionObserver.updateWithCamera(camera);
  };
}
