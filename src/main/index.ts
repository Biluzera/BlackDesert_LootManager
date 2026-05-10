import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'BDO Loot Log',
    backgroundColor: '#0f0a06',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Open external links in the default browser, not in the app
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── Data directory ────────────────────────────────────────────────────────────

let _dataDir: string | null = null

function getDataDir(): string {
  if (!_dataDir) {
    _dataDir = path.join(app.getPath('userData'), 'BDO_LootLog_Data')
    if (!fs.existsSync(_dataDir)) {
      fs.mkdirSync(_dataDir, { recursive: true })
    }
  }
  return _dataDir
}

/**
 * Validates that the filename is safe — only word chars, hyphens and .json.
 * Prevents path-traversal attacks (e.g. "../../etc/passwd").
 */
function isValidFilename(filename: string): boolean {
  return /^[\w-]+\.json$/.test(filename)
}

/** Returns (and creates) the images subdirectory inside the data folder. */
function getImagesDir(): string {
  const dir = path.join(getDataDir(), 'images')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** Validates a UUID-based .png or .webp filename to prevent path traversal. */
function isValidImageFilename(filename: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|webp)$/i.test(filename)
}

/** Returns the MIME type for a supported image filename. */
function imageMime(filename: string): string {
  return filename.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/png'
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('read-json', (_event, filename: string) => {
  if (!isValidFilename(filename)) throw new Error('Nome de arquivo inválido.')
  const filePath = path.join(getDataDir(), filename)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
})

ipcMain.handle('write-json', (_event, filename: string, data: unknown) => {
  if (!isValidFilename(filename)) throw new Error('Nome de arquivo inválido.')
  const filePath = path.join(getDataDir(), filename)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  return true
})

ipcMain.handle('pick-image', async () => {
  const [win] = BrowserWindow.getAllWindows()
  const result = await dialog.showOpenDialog(win, {
    title: 'Selecionar imagem do item',
    filters: [{ name: 'Imagem (PNG / WebP)', extensions: ['png', 'webp'] }],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const srcPath = result.filePaths[0]
  const ext     = path.extname(srcPath).toLowerCase() // '.png' or '.webp'

  // Validate magic bytes to prevent disguised files
  const header = Buffer.alloc(12)
  const fd = fs.openSync(srcPath, 'r')
  fs.readSync(fd, header, 0, 12, 0)
  fs.closeSync(fd)

  const isPng  = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47
  // WebP: bytes 0-3 = "RIFF", bytes 8-11 = "WEBP"
  const isWebp = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
                 header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50

  if (ext === '.png'  && !isPng)  throw new Error('O arquivo selecionado não é um PNG válido.')
  if (ext === '.webp' && !isWebp) throw new Error('O arquivo selecionado não é um WebP válido.')
  if (!isPng && !isWebp)          throw new Error('Formato de imagem não suportado.')

  // Enforce 2 MB size limit
  const { size } = fs.statSync(srcPath)
  if (size > 2 * 1024 * 1024) throw new Error('Imagem muito grande (máximo 2 MB).')

  const safeExt  = isWebp ? 'webp' : 'png'
  const filename = `${randomUUID()}.${safeExt}`
  fs.copyFileSync(srcPath, path.join(getImagesDir(), filename))
  return filename
})

ipcMain.handle('get-image-data-url', (_event, filename: string) => {
  if (!isValidImageFilename(filename)) throw new Error('Nome de arquivo inválido.')
  const filePath = path.join(getImagesDir(), filename)
  if (!fs.existsSync(filePath)) return null
  const buffer = fs.readFileSync(filePath)
  return `data:${imageMime(filename)};base64,${buffer.toString('base64')}`
})

ipcMain.handle('export-data', async () => {
  const [win] = BrowserWindow.getAllWindows()
  const result = await dialog.showSaveDialog(win, {
    title: 'Exportar dados — BDO Loot Log',
    defaultPath: `bdo-lootlog-${new Date().toISOString().split('T')[0]}.json`,
    filters: [{ name: 'BDO Loot Log Export', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return { success: false, reason: 'cancelled' }

  const dataDir   = getDataDir()
  const imagesDir = getImagesDir()

  const readOptional = (filename: string): unknown => {
    const p = path.join(dataDir, filename)
    if (!fs.existsSync(p)) return []
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  }

  const items     = readOptional('items.json')
  const locations = readOptional('locations.json')

  // Collect all PNG filenames referenced by items and locations
  const imageFiles = new Set<string>()
  const collectImage = (obj: unknown): void => {
    if (obj && typeof obj === 'object' && 'imageFile' in obj) {
      const f = (obj as Record<string, unknown>).imageFile
      if (typeof f === 'string' && isValidImageFilename(f)) imageFiles.add(f)
    }
  }
  if (Array.isArray(items))     items.forEach(collectImage)
  if (Array.isArray(locations)) locations.forEach(collectImage)

  const images: Record<string, string> = {}
  for (const filename of imageFiles) {
    const imgPath = path.join(imagesDir, filename)
    if (fs.existsSync(imgPath)) {
      images[filename] = fs.readFileSync(imgPath).toString('base64')
    }
  }

  const payload = { version: 1, exportedAt: new Date().toISOString(), items, locations, images }
  fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf-8')
  return { success: true }
})

ipcMain.handle('import-data', async () => {
  const [win] = BrowserWindow.getAllWindows()
  const result = await dialog.showOpenDialog(win, {
    title: 'Importar dados — BDO Loot Log',
    filters: [{ name: 'BDO Loot Log Export', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return { success: false, reason: 'cancelled' }

  const srcPath = result.filePaths[0]

  // 50 MB limit on the import file
  const { size } = fs.statSync(srcPath)
  if (size > 50 * 1024 * 1024) return { success: false, reason: 'size' }

  let payload: unknown
  try {
    payload = JSON.parse(fs.readFileSync(srcPath, 'utf-8'))
  } catch {
    return { success: false, reason: 'parse' }
  }

  if (typeof payload !== 'object' || payload === null || (payload as Record<string, unknown>).version !== 1) {
    return { success: false, reason: 'invalid' }
  }

  const { items, locations, images } = payload as Record<string, unknown>

  const dataDir   = getDataDir()
  const imagesDir = getImagesDir()

  if (Array.isArray(items)) {
    fs.writeFileSync(path.join(dataDir, 'items.json'), JSON.stringify(items, null, 2), 'utf-8')
  }
  if (Array.isArray(locations)) {
    fs.writeFileSync(path.join(dataDir, 'locations.json'), JSON.stringify(locations, null, 2), 'utf-8')
  }

  // Restore images — validate magic bytes before writing
  if (typeof images === 'object' && images !== null) {
    for (const [filename, b64] of Object.entries(images as Record<string, unknown>)) {
      if (!isValidImageFilename(filename) || typeof b64 !== 'string') continue
      const buf = Buffer.from(b64, 'base64')
      if (buf.length < 12) continue
      const isPng  = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
      const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
                     buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
      if (!isPng && !isWebp) continue
      fs.writeFileSync(path.join(imagesDir, filename), buf)
    }
  }

  return { success: true }
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
