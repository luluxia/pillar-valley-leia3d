import type { Cnsdk3DEnableOptions, Cnsdk3DResult } from "./Cnsdk3D.types";

const unavailable: Cnsdk3DResult = {
  enabled: false,
  stereoRender: false,
  message: "CNSDK 3D is only available in the Android native build.",
};

export default {
  isAndroidCnsdkAvailable: false,
  async enable(_options?: Cnsdk3DEnableOptions): Promise<Cnsdk3DResult> {
    return unavailable;
  },
  async disable(): Promise<Cnsdk3DResult> {
    return unavailable;
  },
  async unlockFps(_desiredFps?: number): Promise<string> {
    return unavailable.message;
  },
};
