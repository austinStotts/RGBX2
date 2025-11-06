// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  saveCanvas: (data, fileType) => ipcRenderer.send('save-canvas', data, fileType),
  openDialog: () => ipcRenderer.invoke('open-dialog'),
})