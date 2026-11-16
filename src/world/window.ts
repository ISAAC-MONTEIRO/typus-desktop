import { contextBridge, ipcRenderer } from "electron";

import { version } from "../../package.json";

contextBridge.exposeInMainWorld("native", {
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    desktop: () => version,
  },

  minimise: () => ipcRenderer.send("minimise"),
  maximise: () => ipcRenderer.send("maximise"),
  close: () => ipcRenderer.send("close"),

  setBadgeCount: (count: number) => ipcRenderer.send("setBadgeCount", count),

  onceScreenPicker: (
    onScreenPick: (
      sources: {
        idx: number;
        name: string;
        isFullScreen: boolean;
        image?: string;
      }[],
    ) => void,
  ) => {
    const eventName = "screenPicker";
    ipcRenderer.removeAllListeners(eventName);
    ipcRenderer.once(eventName, (_, sources) => onScreenPick(sources));
  },
  screenPickerCallback: (idx: number, audio: boolean) =>
    ipcRenderer.send("screenPickerCallback", idx, audio),

  isWayland: () => ipcRenderer.invoke("getIsWayland"),

  // TYPUS: which of the known apps/games is running (opt-in in the app)
  detectActivity: (known: string[]) =>
    ipcRenderer.invoke("activity:detect", known),
  // TYPUS: name of a running program as Windows reports it
  describeActivity: (exe: string) =>
    ipcRenderer.invoke("activity:describe", exe),
  // TYPUS: the app is quitting; the callback clears the activity and the
  // app waits for it (up to 1.5 s)
  onActivityClear: (callback: () => Promise<unknown> | unknown) => {
    ipcRenderer.removeAllListeners("activity:clear");
    ipcRenderer.on("activity:clear", async () => {
      try {
        await callback();
      } finally {
        ipcRenderer.send("activity:cleared");
      }
    });
  },

  // TYPUS: Developer mode metrics
  devMetrics: () => ipcRenderer.invoke("dev:metrics"),
  devDiagnostics: () => ipcRenderer.invoke("dev:diagnostics"),
  gameMetrics: (exe: string) => ipcRenderer.invoke("dev:game", exe),
});
