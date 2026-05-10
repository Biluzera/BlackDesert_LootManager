export {}

declare global {
  interface Window {
    api: {
      readJson: (filename: string) => Promise<unknown>
      writeJson: (filename: string, data: unknown) => Promise<boolean>
      pickImage: () => Promise<string | null>
      getImageDataUrl: (filename: string) => Promise<string | null>
      exportData: () => Promise<{ success: boolean; reason?: string }>
      importData: () => Promise<{ success: boolean; reason?: string }>
      marketSearch: (ids: string[]) => Promise<unknown>
      marketPriceDetail: (id: string) => Promise<unknown>
    }
  }
}
