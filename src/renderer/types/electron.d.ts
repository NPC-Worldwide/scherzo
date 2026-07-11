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
  generateMusic: (prompt: string, provider: string, model: string, duration: number, currentPath: string | undefined, opts?: { workspacePath?: string; baseFilename?: string; apiKey?: string }) => Promise<any>;
  loadDemoTracks: () => Promise<any>;
  proxyFetch: (url: string, options?: any) => Promise<any>;
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
declare global {
  interface Window {
    api: IElectronAPI;
  }
}
export {};
