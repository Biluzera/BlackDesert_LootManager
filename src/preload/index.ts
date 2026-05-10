import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  readJson: (filename: string): Promise<unknown> =>
    ipcRenderer.invoke('read-json', filename),

  writeJson: (filename: string, data: unknown): Promise<boolean> =>
    ipcRenderer.invoke('write-json', filename, data),

  pickImage: (): Promise<string | null> =>
    ipcRenderer.invoke('pick-image'),

  getImageDataUrl: (filename: string): Promise<string | null> =>
    ipcRenderer.invoke('get-image-data-url', filename),

  exportData: (): Promise<{ success: boolean; reason?: string }> =>
    ipcRenderer.invoke('export-data'),

  importData: (): Promise<{ success: boolean; reason?: string }> =>
    ipcRenderer.invoke('import-data')
})
