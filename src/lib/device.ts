export type DeviceEnv = {
  reducedMotion: boolean;
  saveData: boolean;
  deviceMemory?: number;
  cores?: number;
};

export function liteDefault({ reducedMotion, saveData, deviceMemory, cores }: DeviceEnv): boolean {
  return reducedMotion || saveData || (deviceMemory !== undefined && deviceMemory <= 4)
    || (cores !== undefined && cores <= 4);
}

export function readDeviceEnv(): DeviceEnv {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  return {
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: nav.connection?.saveData ?? false,
    deviceMemory: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
  };
}
