// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  startDrag: (fileName) => ipcRenderer.send('ondragstart', fileName),
  getScope: () => ipcRenderer.send('getScope'),
  returnScope: (callback) => { ipcRenderer.on('returnScope', (event, scope) => callback(scope)) }
})