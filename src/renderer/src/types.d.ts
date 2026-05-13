export {}

export interface WidgetVisualConfig {
  font: string
  fontColor: string
  boxColorReady: string
  boxColorCooldown: string
  borderColorReady: string
  borderColorCooldown: string
  hideOnCooldown: boolean
  showTimer: boolean
  showProgressBar: boolean
}

declare global {
  interface Window {
    api: {
      readJson: (filename: string) => Promise<unknown>
      writeJson: (filename: string, data: unknown) => Promise<boolean>
      pickImage: () => Promise<string | null>
      getImageDataUrl: (filename: string) => Promise<string | null>
      exportData: (scope?: string) => Promise<{ success: boolean; reason?: string }>
      importData: () => Promise<{ success: boolean; reason?: string }>
      marketSearch: (ids: string[]) => Promise<unknown>
      marketPriceDetail: (id: string) => Promise<unknown>
    }
    comboApi: {
      setConfigs: (configs: unknown) => Promise<void>
      getActiveSkills: () => Promise<unknown>
      onInit: (cb: (data: unknown) => void) => () => void
      onTriggered: (cb: (skillId: string) => void) => () => void
      setInteractive: (interactive: boolean) => void
      setDragMode: (configId: string | null) => void
      onDragMode: (cb: (configId: string | null) => void) => () => void
      setVisualConfig: (config: WidgetVisualConfig) => void
      onVisualConfig: (cb: (config: WidgetVisualConfig) => void) => () => void
    }
  }
}

