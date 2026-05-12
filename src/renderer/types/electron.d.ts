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
  generateMusic: (args: any) => Promise<any>;
  loadDemoTracks: () => Promise<any>;
}
declare global {
  interface Window {
    api: IElectronAPI;
  }
}
export {};
