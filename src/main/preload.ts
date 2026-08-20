import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export interface IElectronAPI {
  readDirectory: (dirPath: string) => Promise<any>;
  ensureDir: (dirPath: string) => Promise<any>;
  getHomeDir: () => Promise<string>;
  showOpenDialog: (options: any) => Promise<any>;
  showSaveDialog: (options: any) => Promise<any>;
  readFileContent: (filePath: string) => Promise<any>;
  writeFileContent: (filePath: string, content: string) => Promise<any>;
  readFileBuffer: (filePath: string) => Promise<any>;
  writeFileBuffer: (filePath: string, data: Uint8Array) => Promise<any>;
  repertoireList: () => Promise<any>;
  repertoireGet: (id: number) => Promise<any>;
  repertoireGetSheetXml: (sheetId: number) => Promise<any>;
  repertoireCreate: (args: any) => Promise<any>;
  repertoireUpdate: (args: any) => Promise<any>;
  repertoireDelete: (id: number) => Promise<any>;
  repertoireAttachSheet: (args: any) => Promise<any>;
  repertoireDeleteSheet: (sheetId: number) => Promise<any>;
  loadDemoTracks: () => Promise<any>;
  libraryIndexFolder: (folderPath: string) => Promise<any>;
  libraryRemoveIndexedFolder: (folderId: number) => Promise<any>;
  libraryListIndexedFolders: () => Promise<any>;
  libraryListTracks: (opts?: { search?: string; sort?: string; offset?: number; limit?: number }) => Promise<any>;
  libraryGetTrack: (id: number) => Promise<any>;
  libraryLikeTrack: (id: number, liked: boolean) => Promise<any>;
  libraryLikedTracks: () => Promise<any>;
  libraryYoutubeSearch: (query: string) => Promise<any>;
  libraryYoutubeDownload: (videoUrl: string, outputDir?: string) => Promise<any>;
  libraryRadioRecommendations: (seedId: string) => Promise<any>;
  playlistList: () => Promise<any>;
  playlistCreate: (name: string) => Promise<any>;
  playlistDelete: (id: number) => Promise<any>;
  playlistRename: (id: number, name: string) => Promise<any>;
  playlistGetTracks: (playlistId: number) => Promise<any>;
  playlistAddTrack: (playlistId: number, trackId: number) => Promise<any>;
  playlistRemoveTrack: (ptId: number) => Promise<any>;
  playlistReorder: (playlistId: number, trackIds: number[]) => Promise<any>;
  checkForUpdates: () => Promise<any>;
  getAppVersion: () => Promise<string>;
  downloadAndInstallUpdate: (opts: { releaseUrl: string }) => Promise<any>;
  onUpdateDownloadProgress: (cb: (data: { progress: number; receivedBytes: number; totalBytes: number }) => void) => () => void;
  openExternal: (url: string) => Promise<any>;
  closeWindow: () => void;
}

contextBridge.exposeInMainWorld('api', {
  readDirectory: (dirPath: string) => ipcRenderer.invoke('readDirectory', dirPath),
  ensureDir: (dirPath: string) => ipcRenderer.invoke('ensureDirectory', dirPath),
  getHomeDir: () => ipcRenderer.invoke('getHomeDir'),
  showOpenDialog: (options: any) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options: any) => ipcRenderer.invoke('show-save-dialog', options),
  readFileContent: (filePath: string) => ipcRenderer.invoke('read-file-content', filePath),
  writeFileContent: (filePath: string, content: string) => ipcRenderer.invoke('write-file-content', filePath, content),
  readFileBuffer: (filePath: string) => ipcRenderer.invoke('read-file-buffer', filePath),
  writeFileBuffer: (filePath: string, data: Uint8Array) => ipcRenderer.invoke('write-file-buffer', filePath, data),
  repertoireList: () => ipcRenderer.invoke('repertoire:list'),
  repertoireGet: (id: number) => ipcRenderer.invoke('repertoire:get', id),
  repertoireGetSheetXml: (sheetId: number) => ipcRenderer.invoke('repertoire:getSheetXml', sheetId),
  repertoireCreate: (args: any) => ipcRenderer.invoke('repertoire:create', args),
  repertoireUpdate: (args: any) => ipcRenderer.invoke('repertoire:update', args),
  repertoireDelete: (id: number) => ipcRenderer.invoke('repertoire:delete', id),
  repertoireAttachSheet: (args: any) => ipcRenderer.invoke('repertoire:attachSheet', args),
  repertoireDeleteSheet: (sheetId: number) => ipcRenderer.invoke('repertoire:deleteSheet', sheetId),
  loadDemoTracks: () => ipcRenderer.invoke('load_demo_tracks'),
  libraryIndexFolder: (folderPath: string) => ipcRenderer.invoke('library:indexFolder', folderPath),
  libraryRemoveIndexedFolder: (folderId: number) => ipcRenderer.invoke('library:removeIndexedFolder', folderId),
  libraryListIndexedFolders: () => ipcRenderer.invoke('library:listIndexedFolders'),
  libraryListTracks: (opts?: any) => ipcRenderer.invoke('library:listTracks', opts),
  libraryGetTrack: (id: number) => ipcRenderer.invoke('library:getTrack', id),
  libraryLikeTrack: (id: number, liked: boolean) => ipcRenderer.invoke('library:likeTrack', id, liked),
  libraryLikedTracks: () => ipcRenderer.invoke('library:likedTracks'),
  libraryYoutubeSearch: (query: string) => ipcRenderer.invoke('library:youtubeSearch', query),
  libraryYoutubeDownload: (videoUrl: string, outputDir?: string) => ipcRenderer.invoke('library:youtubeDownload', videoUrl, outputDir),
  libraryRadioRecommendations: (seedId: string) => ipcRenderer.invoke('library:radioRecommendations', seedId),
  playlistList: () => ipcRenderer.invoke('playlist:list'),
  playlistCreate: (name: string) => ipcRenderer.invoke('playlist:create', name),
  playlistDelete: (id: number) => ipcRenderer.invoke('playlist:delete', id),
  playlistRename: (id: number, name: string) => ipcRenderer.invoke('playlist:rename', id, name),
  playlistGetTracks: (playlistId: number) => ipcRenderer.invoke('playlist:getTracks', playlistId),
  playlistAddTrack: (playlistId: number, trackId: number) => ipcRenderer.invoke('playlist:addTrack', playlistId, trackId),
  playlistRemoveTrack: (ptId: number) => ipcRenderer.invoke('playlist:removeTrack', ptId),
  playlistReorder: (playlistId: number, trackIds: number[]) => ipcRenderer.invoke('playlist:reorder', playlistId, trackIds),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  downloadAndInstallUpdate: (opts: any) => ipcRenderer.invoke('download-and-install-update', opts),
  onUpdateDownloadProgress: (cb: any) => {
    const handler = (_event: IpcRendererEvent, data: any) => cb(data);
    ipcRenderer.on('update-download-progress', handler);
    return () => ipcRenderer.removeListener('update-download-progress', handler);
  },
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  closeWindow: () => ipcRenderer.send('window-close'),
} as IElectronAPI);

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
