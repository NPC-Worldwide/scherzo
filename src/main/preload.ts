import { contextBridge, ipcRenderer } from 'electron';

export interface IElectronAPI {
  readDirectory: (dirPath: string) => Promise<any>;
  ensureDir: (dirPath: string) => Promise<any>;
  getHomeDir: () => Promise<string>;
  showOpenDialog: (options: any) => Promise<any>;
  showSaveDialog: (options: any) => Promise<any>;
  readFileContent: (filePath: string) => Promise<any>;
  writeFileContent: (filePath: string, content: string) => Promise<any>;
  repertoireList: () => Promise<any>;
  repertoireGet: (id: number) => Promise<any>;
  repertoireGetSheetXml: (sheetId: number) => Promise<any>;
  repertoireCreate: (args: any) => Promise<any>;
  repertoireUpdate: (args: any) => Promise<any>;
  repertoireDelete: (id: number) => Promise<any>;
  repertoireAttachSheet: (args: any) => Promise<any>;
  repertoireDeleteSheet: (sheetId: number) => Promise<any>;
  generateMusic: (prompt: string, provider: string, model: string, duration: number, currentPath: string | undefined, opts?: { workspacePath?: string; baseFilename?: string; apiKey?: string }) => Promise<any>;
  loadDemoTracks: () => Promise<any>;
  proxyFetch: (url: string, options?: any) => Promise<any>;
}

contextBridge.exposeInMainWorld('api', {
  readDirectory: (dirPath: string) => ipcRenderer.invoke('readDirectory', dirPath),
  ensureDir: (dirPath: string) => ipcRenderer.invoke('ensureDirectory', dirPath),
  getHomeDir: () => ipcRenderer.invoke('getHomeDir'),
  showOpenDialog: (options: any) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options: any) => ipcRenderer.invoke('show-save-dialog', options),
  readFileContent: (filePath: string) => ipcRenderer.invoke('read-file-content', filePath),
  writeFileContent: (filePath: string, content: string) => ipcRenderer.invoke('write-file-content', filePath, content),
  repertoireList: () => ipcRenderer.invoke('repertoire:list'),
  repertoireGet: (id: number) => ipcRenderer.invoke('repertoire:get', id),
  repertoireGetSheetXml: (sheetId: number) => ipcRenderer.invoke('repertoire:getSheetXml', sheetId),
  repertoireCreate: (args: any) => ipcRenderer.invoke('repertoire:create', args),
  repertoireUpdate: (args: any) => ipcRenderer.invoke('repertoire:update', args),
  repertoireDelete: (id: number) => ipcRenderer.invoke('repertoire:delete', id),
  repertoireAttachSheet: (args: any) => ipcRenderer.invoke('repertoire:attachSheet', args),
  repertoireDeleteSheet: (sheetId: number) => ipcRenderer.invoke('repertoire:deleteSheet', sheetId),
  generateMusic: (prompt: string, provider: string, model: string, duration: number, currentPath: string | undefined, opts = {}) =>
    ipcRenderer.invoke('generate_music', { prompt, provider, model, duration, currentPath, workspacePath: opts.workspacePath, baseFilename: opts.baseFilename, apiKey: opts.apiKey }),
  loadDemoTracks: () => ipcRenderer.invoke('load_demo_tracks'),
  proxyFetch: (url: string, options?: any) => ipcRenderer.invoke('proxy-fetch', url, options),
} as IElectronAPI);

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
