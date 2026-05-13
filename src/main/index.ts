import { app, shell, BrowserWindow, ipcMain, dialog, net, screen } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { execFileSync, spawn } from 'child_process'
import os from 'os'

// ── Windows privilege check ───────────────────────────────────────────────────
// uiohook WH_KEYBOARD_LL hooks are silently blocked by UIPI when a higher-
// privilege process (BDO + GameGuard as admin) has focus. Running as admin
// fixes this.

function isElevated(): boolean {
  if (process.platform !== 'win32') return true
  try {
    execFileSync('net', ['session'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// Boost process priority so the hook thread is not throttled by the scheduler
try {
  os.setPriority(process.pid, os.constants.priority.PRIORITY_HIGH)
} catch { /* may require admin — best effort */ }

// ── uiohook-napi (passive global keyboard listener) ───────────────────────────
// Wrapped in try/catch so the app still works if the native module fails.
let uIOhook: { on: Function; start: Function; stop: Function } | null = null
let UK: Record<string, number> = {}
try {
  const m = require('uiohook-napi') // eslint-disable-line @typescript-eslint/no-var-requires
  uIOhook = m.uIOhook
  UK = m.UiohookKey ?? {}
} catch (e) {
  console.warn('[combo] uiohook-napi not available:', e)
}

// Pseudo-codes for mouse buttons (outside uiohook keycode space)
const MB_LEFT  = 0xF001
const MB_RIGHT = 0xF002

// ── Combo overlay types ───────────────────────────────────────────────────────

interface ComboSkill {
  id: string
  label: string
  keys: string
  cooldown: number
  icon?: string
  displayText?: string
}

interface ComboConfig {
  id: string
  name: string
  description: string
  skills: ComboSkill[]
  enabled: boolean
  createdAt: string
}

/**
 * Maps a normalized key name to uiohook scan codes.
 * Uses UiohookKey constants (loaded at runtime) with hardcoded fallbacks.
 * Mouse buttons use pseudo-codes (MB_LEFT / MB_RIGHT) outside keyboard space.
 */
const KEY_CODES: Record<string, number[]> = {
  SHIFT:     [UK.Shift ?? 0x002A, UK.ShiftRight ?? 0x0036],
  CTRL:      [UK.Ctrl  ?? 0x001D, UK.CtrlRight  ?? 0x0E1D],
  ALT:       [UK.Alt   ?? 0x0038, UK.AltRight   ?? 0x0E38],
  A: [UK.A ?? 0x001E], B: [UK.B ?? 0x0030], C: [UK.C ?? 0x002E],
  D: [UK.D ?? 0x0020], E: [UK.E ?? 0x0012], F: [UK.F ?? 0x0021],
  G: [UK.G ?? 0x0022], H: [UK.H ?? 0x0023], I: [UK.I ?? 0x0017],
  J: [UK.J ?? 0x0024], K: [UK.K ?? 0x0025], L: [UK.L ?? 0x0026],
  M: [UK.M ?? 0x0032], N: [UK.N ?? 0x0031], O: [UK.O ?? 0x0018],
  P: [UK.P ?? 0x0019], Q: [UK.Q ?? 0x0010], R: [UK.R ?? 0x0013],
  S: [UK.S ?? 0x001F], T: [UK.T ?? 0x0014], U: [UK.U ?? 0x0016],
  V: [UK.V ?? 0x002F], W: [UK.W ?? 0x0011], X: [UK.X ?? 0x002D],
  Y: [UK.Y ?? 0x0015], Z: [UK.Z ?? 0x002C],
  '0': [UK[0] ?? 0x000B], '1': [UK[1] ?? 0x0002], '2': [UK[2] ?? 0x0003],
  '3': [UK[3] ?? 0x0004], '4': [UK[4] ?? 0x0005], '5': [UK[5] ?? 0x0006],
  '6': [UK[6] ?? 0x0007], '7': [UK[7] ?? 0x0008], '8': [UK[8] ?? 0x0009],
  '9': [UK[9] ?? 0x000A],
  F1:  [UK.F1  ?? 0x003B], F2:  [UK.F2  ?? 0x003C], F3:  [UK.F3  ?? 0x003D],
  F4:  [UK.F4  ?? 0x003E], F5:  [UK.F5  ?? 0x003F], F6:  [UK.F6  ?? 0x0040],
  F7:  [UK.F7  ?? 0x0041], F8:  [UK.F8  ?? 0x0042], F9:  [UK.F9  ?? 0x0043],
  F10: [UK.F10 ?? 0x0044], F11: [UK.F11 ?? 0x0057], F12: [UK.F12 ?? 0x0058],
  SPACE:     [UK.Space     ?? 0x0039],
  ENTER:     [UK.Enter     ?? 0x001C],
  ESC:       [UK.Escape    ?? 0x0001],
  TAB:       [UK.Tab       ?? 0x000F],
  BACKSPACE: [UK.Backspace ?? 0x000E],
  DELETE:    [UK.Delete    ?? 0x0E53],
  INSERT:    [UK.Insert    ?? 0x0E52],
  HOME:      [UK.Home      ?? 0x0E47],
  END:       [UK.End       ?? 0x0E4F],
  PAGEUP:    [UK.PageUp    ?? 0x0E49],
  PAGEDOWN:  [UK.PageDown  ?? 0x0E51],
  UP:        [UK.ArrowUp   ?? 0xE048],
  DOWN:      [UK.ArrowDown ?? 0xE050],
  LEFT:      [UK.ArrowLeft ?? 0xE04B],
  RIGHT:     [UK.ArrowRight ?? 0xE04D],
  // Mouse buttons (pseudo-codes, tracked via mousedown/mouseup events)
  LMB: [MB_LEFT],
  RMB: [MB_RIGHT],
}

/** Parse "SHIFT+Q" → [[0xA0,0xA1], [0x51]], returns null if unknown key */
function parseCombo(keys: string): number[][] | null {
  const parts = keys.toUpperCase().split('+').map(p => p.trim())
  const groups: number[][] = []
  for (const part of parts) {
    const codes = KEY_CODES[part]
    if (!codes) return null
    groups.push(codes)
  }
  return groups.length > 0 ? groups : null
}

/** Returns true when every key-group has at least one code in the pressed set */
function isComboActive(pressed: Set<number>, groups: number[][]): boolean {
  return groups.every(g => g.some(c => pressed.has(c)))
}

// ── Combo state ───────────────────────────────────────────────────────────────

interface ActiveSkillEntry {
  skillId: string
  configId: string
  keyGroups: number[][]
  cooldownMs: number
}

let activeSkills: ActiveSkillEntry[] = []
let overlayWin: BrowserWindow | null = null
let mainWin:    BrowserWindow | null = null
let activeDragConfigId: string | null = null  // track drag mode in main process

const pressedKeys     = new Set<number>()
const triggeredCombos = new Set<string>() // skill IDs currently held/triggered
const cooldownEnds    = new Map<string, number>() // skillId → timestamp when CD expires

/** Build the flat list of skills from all enabled configs */
function buildActiveSkills(configs: ComboConfig[]): { entry: ActiveSkillEntry; skill: ComboSkill; configId: string }[] {
  const result: { entry: ActiveSkillEntry; skill: ComboSkill; configId: string }[] = []
  for (const cfg of configs) {
    if (!cfg.enabled) continue
    for (const skill of cfg.skills) {
      const keyGroups = parseCombo(skill.keys)
      if (!keyGroups) continue
      result.push({
        entry: { skillId: skill.id, configId: cfg.id, keyGroups, cooldownMs: skill.cooldown * 1000 },
        skill,
        configId: cfg.id
      })
    }
  }
  return result
}

// ── Overlay window ────────────────────────────────────────────────────────────

function getOrCreateOverlayWin(): BrowserWindow {
  if (overlayWin && !overlayWin.isDestroyed()) return overlayWin

  const { width, height } = screen.getPrimaryDisplay().bounds

  overlayWin = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  overlayWin.setIgnoreMouseEvents(true, { forward: true })
  overlayWin.setAlwaysOnTop(true, 'screen-saver')

  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    void overlayWin.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#overlay')
  } else {
    void overlayWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'overlay' })
  }

  overlayWin.webContents.on('did-finish-load', () => {
    // Send current active skill list to the overlay once it finishes loading
    const skills = buildActiveSkills(
      (overlayWin as BrowserWindow).webContents ? _lastConfigs : []
    ).map(({ skill, configId }) => ({ ...skill, configId }))
    overlayWin?.webContents.send('combo:init', skills)
  })

  overlayWin.on('closed', () => { overlayWin = null })
  return overlayWin
}

let _lastConfigs: ComboConfig[] = []

/** Apply a new set of configs: update key listeners and overlay visibility */
function applyConfigs(configs: ComboConfig[]): void {
  _lastConfigs = configs

  const entries = buildActiveSkills(configs)
  activeSkills = entries.map(e => e.entry)

  // Clear cooldown state for skills that are no longer active
  const activeIds = new Set(activeSkills.map(e => e.skillId))
  for (const id of cooldownEnds.keys()) {
    if (!activeIds.has(id)) cooldownEnds.delete(id)
  }

  const hasEnabled = configs.some(c => c.enabled && c.skills.length > 0)

  if (hasEnabled) {
    const win = getOrCreateOverlayWin()
    if (win.isVisible() === false) win.show()
    // Push updated skill list to overlay
    const skills = entries.map(({ skill, configId }) => ({ ...skill, configId }))
    win.webContents.send('combo:init', skills)
  } else {
    // Hide but don't destroy so it loads fast next time
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.hide()
  }

  // Start uiohook if we have active skills, stop otherwise
  if (uIOhook) {
    if (hasEnabled) {
      try { uIOhook.start() } catch { /* already running */ }
    } else {
      try { uIOhook.stop() } catch { /* already stopped */ }
    }
  }
}

// ── Key listener setup ────────────────────────────────────────────────────────

function checkAndFireTriggers(): void {
  for (const entry of activeSkills) {
    if (triggeredCombos.has(entry.skillId)) continue
    // Block re-trigger while previous cooldown has not expired
    const cdEnd = cooldownEnds.get(entry.skillId)
    if (cdEnd !== undefined && Date.now() < cdEnd) continue
    if (isComboActive(pressedKeys, entry.keyGroups)) {
      triggeredCombos.add(entry.skillId)
      if (entry.cooldownMs > 0) {
        cooldownEnds.set(entry.skillId, Date.now() + entry.cooldownMs)
      }
      overlayWin?.webContents.send('combo:triggered', entry.skillId)
    }
  }
}

function checkAndReleaseTriggers(): void {
  for (const entry of activeSkills) {
    if (triggeredCombos.has(entry.skillId) && !isComboActive(pressedKeys, entry.keyGroups)) {
      triggeredCombos.delete(entry.skillId)
    }
  }
}

function setupKeyListener(): void {
  if (!uIOhook) return

  uIOhook.on('keydown', (e: { keycode: number }) => {
    // Enter (0x001C) while drag mode is active → stop drag mode globally
    const enterCode = UK.Enter ?? 0x001C
    if (e.keycode === enterCode && activeDragConfigId !== null) {
      activeDragConfigId = null
      overlayWin?.webContents.send('combo:drag-mode', null)
      mainWin?.webContents.send('combo:drag-mode', null)
      if (overlayWin && !overlayWin.isDestroyed()) {
        overlayWin.setIgnoreMouseEvents(true, { forward: true })
      }
      return
    }
    pressedKeys.add(e.keycode)
    checkAndFireTriggers()
  })

  uIOhook.on('keyup', (e: { keycode: number }) => {
    pressedKeys.delete(e.keycode)
    checkAndReleaseTriggers()
  })

  // Mouse buttons — treated as pseudo-keys so combos like "LMB+SHIFT" work
  uIOhook.on('mousedown', (e: { button: unknown }) => {
    const btn = e.button as number
    if (btn === 1) pressedKeys.add(MB_LEFT)
    else if (btn === 2) pressedKeys.add(MB_RIGHT)
    checkAndFireTriggers()
  })

  uIOhook.on('mouseup', (e: { button: unknown }) => {
    const btn = e.button as number
    if (btn === 1) pressedKeys.delete(MB_LEFT)
    else if (btn === 2) pressedKeys.delete(MB_RIGHT)
    checkAndReleaseTriggers()
  })
}

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow(): void {
  mainWin = new BrowserWindow({
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

  mainWin.on('ready-to-show', () => {
    mainWin!.show()
  })

  mainWin.on('closed', () => { mainWin = null })

  // Open external links in the default browser, not in the app
  mainWin.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    mainWin.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWin.loadFile(join(__dirname, '../renderer/index.html'))
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

ipcMain.handle('export-data', async (_event, scope: string = 'all') => {
  const [win] = BrowserWindow.getAllWindows()
  const result = await dialog.showSaveDialog(win, {
    title: 'Exportar dados — BDO Loot Log',
    defaultPath: `bdo-lootlog-${scope}-${new Date().toISOString().split('T')[0]}.json`,
    filters: [{ name: 'BDO Loot Log Export', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return { success: false, reason: 'cancelled' }

  const dataDir   = getDataDir()
  const imagesDir = getImagesDir()

  const readJsonFile = (filename: string): unknown => {
    const p = path.join(dataDir, filename)
    if (!fs.existsSync(p)) return null
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return null }
  }

  const includeAll       = scope === 'all'
  const includeItems     = includeAll || scope === 'items'
  const includeLocations = includeAll || scope === 'locations'
  const includeSessions  = includeAll || scope === 'sessions'
  const includeBosses    = includeAll || scope === 'bosses'
  const includeSettings  = includeAll || scope === 'settings'
  const includeCombo     = includeAll || scope === 'combo'
  const includeGoals     = includeAll || scope === 'goals'

  const payload: Record<string, unknown> = {
    version: 1,
    exportedAt: new Date().toISOString(),
    scope,
  }

  const imageFiles = new Set<string>()
  const collectImage = (obj: unknown): void => {
    if (obj && typeof obj === 'object' && 'imageFile' in obj) {
      const f = (obj as Record<string, unknown>).imageFile
      if (typeof f === 'string' && isValidImageFilename(f)) imageFiles.add(f)
    }
  }

  if (includeItems) {
    const items = readJsonFile('items.json')
    payload.items = items
    if (Array.isArray(items)) items.forEach(collectImage)
  }
  if (includeLocations) {
    const locations = readJsonFile('locations.json')
    payload.locations = locations
    if (Array.isArray(locations)) locations.forEach(collectImage)
  }
  if (includeSessions) {
    payload.sessions = readJsonFile('sessions.json')
  }
  if (includeBosses) {
    const bosses = readJsonFile('bosses.json')
    payload.bosses = bosses
    if (Array.isArray(bosses)) bosses.forEach(collectImage)
  }
  if (includeSettings) {
    payload.settings = readJsonFile('settings.json')
  }
  if (includeCombo) {
    payload.comboConfigs      = readJsonFile('combo-configs.json')
    payload.comboPositions    = readJsonFile('combo-positions.json')
    payload.comboVisualConfig = readJsonFile('combo-visual-config.json')
  }
  if (includeGoals) {
    payload.goals = readJsonFile('goals.json')
  }

  const images: Record<string, string> = {}
  for (const filename of imageFiles) {
    const imgPath = path.join(imagesDir, filename)
    if (fs.existsSync(imgPath)) {
      images[filename] = fs.readFileSync(imgPath).toString('base64')
    }
  }
  payload.images = images

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

  const {
    items, locations, bosses, sessions, settings,
    comboConfigs, comboPositions, comboVisualConfig, goals,
    images
  } = payload as Record<string, unknown>

  const dataDir   = getDataDir()
  const imagesDir = getImagesDir()

  if (Array.isArray(items)) {
    fs.writeFileSync(path.join(dataDir, 'items.json'), JSON.stringify(items, null, 2), 'utf-8')
  }
  if (Array.isArray(locations)) {
    fs.writeFileSync(path.join(dataDir, 'locations.json'), JSON.stringify(locations, null, 2), 'utf-8')
  }
  if (Array.isArray(bosses)) {
    fs.writeFileSync(path.join(dataDir, 'bosses.json'), JSON.stringify(bosses, null, 2), 'utf-8')
  }
  if (Array.isArray(sessions)) {
    fs.writeFileSync(path.join(dataDir, 'sessions.json'), JSON.stringify(sessions, null, 2), 'utf-8')
  }
  if (settings !== null && settings !== undefined && typeof settings === 'object' && !Array.isArray(settings)) {
    fs.writeFileSync(path.join(dataDir, 'settings.json'), JSON.stringify(settings, null, 2), 'utf-8')
  }
  if (Array.isArray(comboConfigs)) {
    fs.writeFileSync(path.join(dataDir, 'combo-configs.json'), JSON.stringify(comboConfigs, null, 2), 'utf-8')
  }
  if (comboPositions !== null && comboPositions !== undefined && typeof comboPositions === 'object' && !Array.isArray(comboPositions)) {
    fs.writeFileSync(path.join(dataDir, 'combo-positions.json'), JSON.stringify(comboPositions, null, 2), 'utf-8')
  }
  if (comboVisualConfig !== null && comboVisualConfig !== undefined && typeof comboVisualConfig === 'object' && !Array.isArray(comboVisualConfig)) {
    fs.writeFileSync(path.join(dataDir, 'combo-visual-config.json'), JSON.stringify(comboVisualConfig, null, 2), 'utf-8')
  }
  if (Array.isArray(goals)) {
    fs.writeFileSync(path.join(dataDir, 'goals.json'), JSON.stringify(goals, null, 2), 'utf-8')
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

// ── Market API (bypasses CORS — runs in main process via net.fetch) ───────────

ipcMain.handle('market-search', async (_event, ids: string[]) => {
  try {
    const url = `https://api.arsha.io/v1/sa/search?ids=${ids.join(',')}`
    const res = await net.fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
})

ipcMain.handle('market-price-detail', async (_event, id: string) => {
  try {
    const url = `https://api.arsha.io/v1/sa/price?sid=0&id=${id}&lang=pt`
    const res = await net.fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
})

// ── Combo IPC handlers ────────────────────────────────────────────────────────

ipcMain.handle('combo:set-configs', (_event, configs: unknown) => {
  if (!Array.isArray(configs)) return
  applyConfigs(configs as ComboConfig[])
})

ipcMain.handle('combo:get-active-skills', () => {
  return buildActiveSkills(_lastConfigs).map(({ skill, configId }) => ({ ...skill, configId }))
})

/** Renderer tells main to (un)set click-through on the overlay window */
ipcMain.on('combo:set-interactive', (_event, interactive: boolean) => {
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.setIgnoreMouseEvents(!interactive, { forward: true })
  }
})

/** Any renderer requests drag mode for a specific config (or null to exit) */
ipcMain.on('combo:set-drag-mode', (_event, configId: string | null) => {
  activeDragConfigId = configId
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.webContents.send('combo:drag-mode', configId)
    // Also update mouse capture directly so button click always resets it
    overlayWin.setIgnoreMouseEvents(configId === null, { forward: true })
  }
  // Relay back to main renderer so it can sync its draggingConfigId state
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('combo:drag-mode', configId)
  }
})

/** Main renderer pushes visual widget config to the overlay */
ipcMain.on('combo:set-visual-config', (_event, config: unknown) => {
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.webContents.send('combo:visual-config', config)
  }
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // If not elevated, prompt the user to relaunch as Administrator.
  // BDO/GameGuard run as admin; UIPI blocks low-level hooks from non-admin processes.
  if (!isElevated()) {
    const choice = dialog.showMessageBoxSync({
      type: 'warning',
      title: 'Administrador necessário',
      message:
        'O BDO Loot Manager precisa ser executado como Administrador para ' +
        'detectar teclas enquanto o jogo (BDO/GameGuard) está em foco.\n\n' +
        'Deseja reiniciar como Administrador agora?',
      buttons: ['Reiniciar como Admin', 'Continuar sem Admin'],
      defaultId: 0,
      cancelId: 1,
    })
    if (choice === 0) {
      const args = process.argv.slice(1).map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')
      spawn(
        'powershell',
        ['-Command', `Start-Process -FilePath "${process.execPath}" ${args ? `-ArgumentList ${args}` : ''} -Verb RunAs`],
        { detached: true, stdio: 'ignore' }
      ).unref()
      app.quit()
      return
    }
  }

  setupKeyListener()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  try { uIOhook?.stop() } catch { /* ignore */ }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
