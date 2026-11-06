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
  generateDiagram: (prompt, drawingId) =>
    ipcRenderer.invoke(IPC.generateDiagram, prompt, drawingId),
  redrawDiagram: (request) => ipcRenderer.invoke(IPC.redrawDiagram, request),
  approveDiagram: (png, drawingId, version) =>
    ipcRenderer.invoke(IPC.approveDiagram, png, drawingId, version),
  copyImage: (png) => ipcRenderer.invoke(IPC.copyImage, png),
  listDrawings: () => ipcRenderer.invoke(IPC.listDrawings),
  getDrawing: (id) => ipcRenderer.invoke(IPC.getDrawing, id),
  deleteDrawing: (id) => ipcRenderer.invoke(IPC.deleteDrawing, id),
  onDrawingsChanged: (callback) => {
    const listener = (): void => callback();
    ipcRenderer.on(IPC.drawingsChanged, listener);
    return () => ipcRenderer.removeListener(IPC.drawingsChanged, listener);
  },
};

contextBridge.exposeInMainWorld("picasso", api);
