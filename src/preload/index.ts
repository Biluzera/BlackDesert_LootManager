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

  downloadImageFromUrl: (url: string): Promise<string | null> =>
    ipcRenderer.invoke('download-image-from-url', url),

  exportData: (scope?: string): Promise<{ success: boolean; reason?: string }> =>
    ipcRenderer.invoke('export-data', scope ?? 'all'),

  importData: (): Promise<{ success: boolean; reason?: string }> =>
    ipcRenderer.invoke('import-data'),

  marketSearch: (ids: string[]): Promise<unknown> =>
    ipcRenderer.invoke('market-search', ids),

  marketPriceDetail: (id: string): Promise<unknown> =>
    ipcRenderer.invoke('market-price-detail', id)
})

// ── Combo overlay API ─────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('comboApi', {
  /** Send updated configs to the main process (updates overlay + key listener) */
  setConfigs: (configs: unknown): Promise<void> =>
    ipcRenderer.invoke('combo:set-configs', configs),

  /** Pull the current list of active skills (used by the overlay on load) */
  getActiveSkills: (): Promise<unknown> =>
    ipcRenderer.invoke('combo:get-active-skills'),

  /** Subscribe to active skill list updates pushed from the main process */
  onInit: (cb: (data: unknown) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown): void => cb(data)
    ipcRenderer.on('combo:init', handler)
    return () => ipcRenderer.off('combo:init', handler)
  },

  /** Subscribe to skill-triggered events (a key combo was detected) */
  onTriggered: (cb: (skillId: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, skillId: string): void => cb(skillId)
    ipcRenderer.on('combo:triggered', handler)
    return () => ipcRenderer.off('combo:triggered', handler)
  },

  /** Toggle the overlay window between click-through and interactive mode */
  setInteractive: (interactive: boolean): void => {
    ipcRenderer.send('combo:set-interactive', interactive)
  },

  /** Tell the overlay which config is in drag mode (null = exit drag mode) */
  setDragMode: (configId: string | null): void => {
    ipcRenderer.send('combo:set-drag-mode', configId)
  },

  /** Subscribe to drag mode changes pushed from the main process (overlay side) */
  onDragMode: (cb: (configId: string | null) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, configId: string | null): void => cb(configId)
    ipcRenderer.on('combo:drag-mode', handler)
    return () => ipcRenderer.off('combo:drag-mode', handler)
  },

  /** Push updated visual widget config to the overlay window */
  setVisualConfig: (config: unknown): void => {
    ipcRenderer.send('combo:set-visual-config', config)
  },

  /** Subscribe to visual config updates (overlay side) */
  onVisualConfig: (cb: (config: unknown) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, config: unknown): void => cb(config)
    ipcRenderer.on('combo:visual-config', handler)
    return () => ipcRenderer.off('combo:visual-config', handler)
  },

  /** Tell main process to enable/disable the BDO window focus filter */
  setBdoFocusFilter: (enabled: boolean): void => {
    ipcRenderer.send('combo:set-bdo-focus-filter', enabled)
  }
})

