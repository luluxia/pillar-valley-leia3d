import { requireNativeModule } from "expo-modules-core";

import type { Cnsdk3DEnableOptions, Cnsdk3DResult } from "./Cnsdk3D.types";

type Cnsdk3DNativeModule = {
  isAndroidCnsdkAvailable: boolean;
  enable(options?: Cnsdk3DEnableOptions): Promise<Cnsdk3DResult>;
  disable(): Promise<Cnsdk3DResult>;
  unlockFps(desiredFps?: number): Promise<string>;
};

export default requireNativeModule<Cnsdk3DNativeModule>("Cnsdk3D");
