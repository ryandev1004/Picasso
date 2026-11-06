import { contextBridge, ipcRenderer } from "electron";
import { IPC, type PicassoAPI } from "@shared/ipc";

// The only bridge between the Vue windows and Node/Electron. Vue code never touches
// ipcRenderer directly; it calls `window.picasso.*`, which is exactly this object.
const api: PicassoAPI = {
  getAppInfo: () => ipcRenderer.invoke(IPC.getAppInfo),
  togglePanel: () => ipcRenderer.send(IPC.togglePanel),
  hidePanel: () => ipcRenderer.send(IPC.hidePanel),
  onPanelShown: (callback) => {
    const listener = (): void => callback();
    ipcRenderer.on(IPC.panelShown, listener);
    return () => ipcRenderer.removeListener(IPC.panelShown, listener);
  },
  hasApiKey: () => ipcRenderer.invoke(IPC.hasApiKey),
  saveApiKey: (key) => ipcRenderer.invoke(IPC.saveApiKey, key),
  clearApiKey: () => ipcRenderer.invoke(IPC.clearApiKey),
  generateDiagram: (prompt) => ipcRenderer.invoke(IPC.generateDiagram, prompt),
  approveDiagram: (png) => ipcRenderer.invoke(IPC.approveDiagram, png),
};

contextBridge.exposeInMainWorld("picasso", api);
