import React, { useState, useCallback, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import * as LucideIcons from 'lucide-react'
import { Plus, Pencil, Trash2, Power, PowerOff, X, Check, GripVertical, Keyboard, Move, Save, RotateCcw, ImageIcon } from 'lucide-react'
import { useCombo, ComboConfig, ComboSkill } from '../context/ComboContext'
import type { WidgetVisualConfig } from '../types.d'

// ── Visual config defaults ────────────────────────────────────────────────────

const VISUAL_DEFAULTS: WidgetVisualConfig = {
  font: 'monospace',
  fontColor: '#50d050',
  boxColorReady: '#051605',
  boxColorCooldown: '#140c04',
  borderColorReady: '#50d050',
  borderColorCooldown: '#c9a030',
  hideOnCooldown: false,
  showTimer: true,
  showProgressBar: true,
}

const FONT_OPTIONS: { value: string; label: string }[] = [
  // ── Monospace ─────────────────────────────────────────────────────────────
  { value: 'monospace',                           label: 'Padrão (monospace)' },
  { value: "'Consolas', monospace",               label: 'Consolas' },
  { value: "'Courier New', monospace",            label: 'Courier New' },
  { value: "'Lucida Console', monospace",         label: 'Lucida Console' },
  { value: "'Cascadia Code', monospace",          label: 'Cascadia Code' },
  { value: "'Fira Code', monospace",              label: 'Fira Code' },
  { value: "'Source Code Pro', monospace",        label: 'Source Code Pro' },
  { value: "'Ubuntu Mono', monospace",            label: 'Ubuntu Mono' },
  // ── Sans-Serif ────────────────────────────────────────────────────────────
  { value: "Arial, sans-serif",                   label: 'Arial' },
  { value: "'Segoe UI', sans-serif",              label: 'Segoe UI' },
  { value: "Tahoma, sans-serif",                  label: 'Tahoma' },
  { value: "Verdana, sans-serif",                 label: 'Verdana' },
  { value: "Calibri, sans-serif",                 label: 'Calibri' },
  { value: "'Trebuchet MS', sans-serif",          label: 'Trebuchet MS' },
  { value: "'Rajdhani', sans-serif",              label: 'Rajdhani (Gaming)' },
  { value: "'Exo 2', sans-serif",                 label: 'Exo 2 (Gaming)' },
  { value: "'Russo One', sans-serif",             label: 'Russo One' },
  { value: "'Nunito', sans-serif",                label: 'Nunito' },
  // ── Serif ─────────────────────────────────────────────────────────────────
  { value: "Georgia, serif",                      label: 'Georgia' },
  { value: "'Times New Roman', serif",            label: 'Times New Roman' },
  { value: "'Palatino Linotype', serif",          label: 'Palatino' },
  // ── Display / Gaming ──────────────────────────────────────────────────────
  { value: "Impact, fantasy",                     label: 'Impact' },
  { value: "'Anton', sans-serif",                 label: 'Anton' },
  { value: "'Orbitron', sans-serif",              label: 'Orbitron (Sci-Fi)' },
  { value: "'Cinzel', serif",                     label: 'Cinzel (Medieval)' },
  { value: "'Press Start 2P', monospace",         label: 'Press Start 2P (Pixel)' },
]

// ── Lucide icon list for picker ───────────────────────────────────────────────

const LUCIDE_ICON_LIST: { name: string; label: string }[] = [
  // Combat
  { name: 'Swords',         label: 'Espadas' },
  { name: 'Sword',          label: 'Espada' },
  { name: 'Shield',         label: 'Escudo' },
  { name: 'ShieldCheck',    label: 'Escudo OK' },
  { name: 'ShieldAlert',    label: 'Escudo Alerta' },
  { name: 'ShieldBan',      label: 'Escudo Banido' },
  { name: 'ShieldOff',      label: 'Escudo Off' },
  { name: 'Axe',            label: 'Machado' },
  { name: 'Hammer',         label: 'Martelo' },
  { name: 'Crosshair',      label: 'Mira' },
  { name: 'Target',         label: 'Alvo' },
  { name: 'Bomb',           label: 'Bomba' },
  { name: 'Anchor',         label: 'Âncora' },
  // Magic / Effects
  { name: 'Wand',           label: 'Varinha' },
  { name: 'Wand2',          label: 'Varinha 2' },
  { name: 'Sparkles',       label: 'Brilhos' },
  { name: 'Zap',            label: 'Raio' },
  { name: 'Bolt',           label: 'Bolt' },
  { name: 'Flame',          label: 'Chama' },
  { name: 'FlameKindling',  label: 'Centelha' },
  { name: 'Radiation',      label: 'Radiação' },
  { name: 'Orbit',          label: 'Órbita' },
  { name: 'CloudLightning', label: 'Raio (Nuvem)' },
  { name: 'Snowflake',      label: 'Neve' },
  // Status / RPG
  { name: 'Crown',          label: 'Coroa' },
  { name: 'Trophy',         label: 'Troféu' },
  { name: 'Gem',            label: 'Gema' },
  { name: 'Diamond',        label: 'Diamante' },
  { name: 'Star',           label: 'Estrela' },
  { name: 'Heart',          label: 'Coração' },
  { name: 'HeartPulse',     label: 'Pulso' },
  { name: 'HeartCrack',     label: 'Coração Partido' },
  { name: 'Activity',       label: 'Atividade' },
  { name: 'Skull',          label: 'Caveira' },
  { name: 'Ghost',          label: 'Fantasma' },
  { name: 'Eye',            label: 'Olho' },
  { name: 'EyeOff',         label: 'Olho Off' },
  { name: 'Infinity',       label: 'Infinito' },
  { name: 'Award',          label: 'Prêmio' },
  // Time / Cooldown
  { name: 'Timer',          label: 'Timer' },
  { name: 'Hourglass',      label: 'Ampulheta' },
  { name: 'Clock',          label: 'Relógio' },
  // Navigation
  { name: 'Compass',        label: 'Bússola' },
  { name: 'MapPin',         label: 'Pin Mapa' },
  { name: 'Map',            label: 'Mapa' },
  { name: 'Route',          label: 'Rota' },
  { name: 'Navigation',     label: 'Navegação' },
  { name: 'Milestone',      label: 'Marco' },
  { name: 'Footprints',     label: 'Pegadas' },
  { name: 'PersonStanding', label: 'Pessoa' },
  // Nature
  { name: 'Leaf',           label: 'Folha' },
  { name: 'Mountain',       label: 'Montanha' },
  { name: 'Wind',           label: 'Vento' },
  { name: 'Waves',          label: 'Ondas' },
  { name: 'Tornado',        label: 'Tornado' },
  { name: 'Moon',           label: 'Lua' },
  { name: 'Sun',            label: 'Sol' },
  { name: 'Sunrise',        label: 'Amanhecer' },
  { name: 'Sunset',         label: 'Entardecer' },
  { name: 'Cloud',          label: 'Nuvem' },
  { name: 'CloudRain',      label: 'Chuva' },
  { name: 'Cloudy',         label: 'Nublado' },
  { name: 'Flower',         label: 'Flor' },
  { name: 'Feather',        label: 'Pena' },
  { name: 'Fish',           label: 'Peixe' },
  { name: 'Cat',            label: 'Gato' },
  { name: 'PawPrint',       label: 'Pata' },
  // Tech / Misc
  { name: 'Cpu',            label: 'CPU' },
  { name: 'Brain',          label: 'Cérebro' },
  { name: 'Terminal',       label: 'Terminal' },
  { name: 'Code',           label: 'Código' },
  { name: 'Joystick',       label: 'Joystick' },
  { name: 'Gamepad',        label: 'Gamepad' },
  { name: 'Gamepad2',       label: 'Gamepad 2' },
  { name: 'Keyboard',       label: 'Teclado' },
  { name: 'Monitor',        label: 'Monitor' },
  { name: 'Key',            label: 'Chave' },
  { name: 'Lock',           label: 'Cadeado' },
  { name: 'Unlock',         label: 'Desbloqueado' },
  { name: 'Bell',           label: 'Sino' },
  { name: 'Flag',           label: 'Bandeira' },
  { name: 'Pin',            label: 'Alfinete' },
  { name: 'Rocket',         label: 'Foguete' },
  { name: 'Dumbbell',       label: 'Halter' },
  { name: 'Bike',           label: 'Bicicleta' },
  { name: 'Puzzle',         label: 'Puzzle' },
  { name: 'Layers',         label: 'Camadas' },
  { name: 'Globe',          label: 'Globo' },
  { name: 'Music',          label: 'Música' },
  { name: 'Headphones',     label: 'Fones' },
  { name: 'Camera',         label: 'Câmera' },
  { name: 'Scissors',       label: 'Tesoura' },
  { name: 'Wrench',         label: 'Chave' },
  { name: 'Magnet',         label: 'Ímã' },
  { name: 'Dna',            label: 'DNA' },
  { name: 'Microscope',     label: 'Microscópio' },
  { name: 'Telescope',      label: 'Telescópio' },
  { name: 'Umbrella',       label: 'Guarda-chuva' },
  { name: 'Dice5',          label: 'Dado' },
  { name: 'Club',           label: 'Clobe' },
  { name: 'Spade',          label: 'Espada (Carta)' },
  { name: 'Clover',         label: 'Trevo' },
  { name: 'Rainbow',        label: 'Arco-íris' },
  { name: 'Siren',          label: 'Sirene' },
  { name: 'Lasso',          label: 'Laço' },
  { name: 'Fingerprint',    label: 'Digital' },
  { name: 'EarthLock',      label: 'Terra Lock' },
  { name: 'ScrollText',     label: 'Pergaminho' },
  { name: 'Castle',         label: 'Castelo' },
  { name: 'Building',       label: 'Construção' },
  { name: 'Bookmark',       label: 'Marcador' },
  { name: 'Glasses',        label: 'Óculos' },
  { name: 'Thermometer',    label: 'Termômetro' },
  { name: 'Aperture',       label: 'Abertura' },
  { name: 'BatteryCharging',label: 'Bateria' },
  { name: 'Power',          label: 'Power' },
  { name: 'Apple',          label: 'Maçã' },
  { name: 'Bug',            label: 'Bug' },
  { name: 'Candy',          label: 'Doce' },
  { name: 'Coffee',         label: 'Café' },
]

// ── Icon picker component ─────────────────────────────────────────────────────

function LucideIcon({ name, size = 14, color }: { name: string; size?: number; color?: string }): React.ReactElement | null {
  const Icon = (LucideIcons as Record<string, unknown>)[name] as React.ComponentType<{ size?: number; color?: string }> | undefined
  if (!Icon) return null
  return <Icon size={size} color={color} />
}

interface IconPickerProps {
  value?: string
  onChange: (icon: string | undefined) => void
}

function IconPicker({ value, onChange }: IconPickerProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // Position popup below button using page coordinates
  const openPopup = useCallback(() => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPopupPos({ top: r.bottom + 6, left: r.left })
    }
    setOpen(v => !v)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      const target = e.target as Node
      if (
        popupRef.current && !popupRef.current.contains(target) &&
        btnRef.current   && !btnRef.current.contains(target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const filtered = search.trim()
    ? LUCIDE_ICON_LIST.filter(i =>
        i.label.toLowerCase().includes(search.toLowerCase()) ||
        i.name.toLowerCase().includes(search.toLowerCase())
      )
    : LUCIDE_ICON_LIST

  const popup = open && ReactDOM.createPortal(
    <div
      ref={popupRef}
      className="icon-picker-popup"
      style={{ top: popupPos.top, left: popupPos.left }}
    >
      <input
        className="icon-picker-search"
        placeholder="Buscar ícone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        autoFocus
      />
      <div className="icon-picker-grid">
        {filtered.map(icon => (
          <button
            key={icon.name}
            type="button"
            className={`icon-picker-item ${value === icon.name ? 'selected' : ''}`}
            title={icon.label}
            onClick={() => { onChange(icon.name); setOpen(false); setSearch('') }}
          >
            <LucideIcon name={icon.name} size={16} />
          </button>
        ))}
      </div>
    </div>,
    document.body
  )

  return (
    <div className="icon-picker-wrap">
      <button
        ref={btnRef}
        type="button"
        className={`icon-picker-btn ${value ? 'has-icon' : ''}`}
        onClick={openPopup}
        title={value ? `Ícone: ${value}` : 'Adicionar ícone (opcional)'}
      >
        {value
          ? <LucideIcon name={value} size={14} />
          : <ImageIcon size={14} />
        }
      </button>

      <button
        type="button"
        className="icon-picker-clear"
        style={{ visibility: value ? 'visible' : 'hidden' }}
        onClick={() => onChange(undefined)}
        title="Remover ícone"
      >
        <X size={10} />
      </button>

      {popup}
    </div>
  )
}

// ── Key capture helpers ───────────────────────────────────────────────────────

const MODIFIER_ORDER = ['CTRL', 'ALT', 'SHIFT']

function codeToKeyName(code: string): string | null {
  const MAP: Record<string, string> = {
    ShiftLeft: 'SHIFT',   ShiftRight: 'SHIFT',
    ControlLeft: 'CTRL',  ControlRight: 'CTRL',
    AltLeft: 'ALT',       AltRight: 'ALT',
    Space: 'SPACE',
    Enter: 'ENTER',
    Escape: 'ESC',
    Tab: 'TAB',
    Backspace: 'BACKSPACE',
    Delete: 'DELETE',
    Insert: 'INSERT',
    Home: 'HOME',
    End: 'END',
    PageUp: 'PAGEUP',
    PageDown: 'PAGEDOWN',
    ArrowUp: 'UP',
    ArrowDown: 'DOWN',
    ArrowLeft: 'LEFT',
    ArrowRight: 'RIGHT',
    F1: 'F1',   F2: 'F2',   F3: 'F3',   F4: 'F4',
    F5: 'F5',   F6: 'F6',   F7: 'F7',   F8: 'F8',
    F9: 'F9',   F10: 'F10', F11: 'F11', F12: 'F12',
    NumpadEnter: 'NUM_ENTER',
  }
  if (MAP[code]) return MAP[code]
  if (code.startsWith('Key')) return code.slice(3)       // KeyQ → Q
  if (code.startsWith('Digit')) return code.slice(5)     // Digit1 → 1
  if (code.startsWith('Numpad')) return 'NUM' + code.slice(6) // Numpad0 → NUM0
  return null
}

function orderKeys(keys: string[]): string[] {
  const mods = keys.filter(k => MODIFIER_ORDER.includes(k))
    .sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b))
  const rest = keys.filter(k => !MODIFIER_ORDER.includes(k)).sort()
  return [...mods, ...rest]
}

// ── Key capture input component ───────────────────────────────────────────────

interface KeyCaptureInputProps {
  value: string
  onChange: (v: string) => void
}

function KeyCaptureInput({ value, onChange }: KeyCaptureInputProps): React.ReactElement {
  const [captureMode, setCaptureMode] = useState(false)
  const [liveCombo, setLiveCombo] = useState('')
  const pressedRef = useRef(new Set<string>())
  const containerRef = useRef<HTMLDivElement>(null)

  const startCapture = useCallback(() => {
    pressedRef.current = new Set()
    setLiveCombo('')
    setCaptureMode(true)
  }, [])

  const commitCombo = useCallback((combo: string) => {
    if (!combo) return
    onChange(combo)
    setCaptureMode(false)
    pressedRef.current = new Set()
    setLiveCombo('')
  }, [onChange])

  useEffect(() => {
    if (!captureMode) return

    const updateLive = (): void => {
      const ordered = orderKeys([...pressedRef.current])
      setLiveCombo(ordered.join('+'))
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const name = codeToKeyName(e.code)
      if (!name) return
      pressedRef.current.add(name)
      updateLive()
    }

    const onKeyUp = (e: KeyboardEvent): void => {
      e.preventDefault()
      const name = codeToKeyName(e.code)
      if (name) pressedRef.current.delete(name)
      if (pressedRef.current.size === 0) {
        const current = orderKeys([...pressedRef.current]).join('+') || liveCombo
        commitCombo(current)
      }
    }

    // Mouse button capture — prevents accidental clicks committing empty combos
    const onMouseDown = (e: MouseEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.button === 0) pressedRef.current.add('LMB')
      else if (e.button === 2) pressedRef.current.add('RMB')
      else return
      updateLive()
    }

    const onMouseUp = (e: MouseEvent): void => {
      e.preventDefault()
      if (e.button === 0) pressedRef.current.delete('LMB')
      else if (e.button === 2) pressedRef.current.delete('RMB')
      else return
      if (pressedRef.current.size === 0) {
        commitCombo(liveCombo)
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('mouseup', onMouseUp, true)
    window.addEventListener('contextmenu', (e) => e.preventDefault(), true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('mouseup', onMouseUp, true)
    }
  }, [captureMode, liveCombo, commitCombo])

  const cancel = useCallback(() => {
    pressedRef.current = new Set()
    setLiveCombo('')
    setCaptureMode(false)
  }, [])

  return (
    <div className="key-capture-wrapper" ref={containerRef}>
      <div
        className={`key-capture-input ${captureMode ? 'capturing' : ''} ${value ? 'has-value' : ''}`}
        onClick={startCapture}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.code === 'Space' || e.code === 'Enter') startCapture() }}
        aria-label="Clique para capturar teclas"
      >
        <Keyboard size={13} className="key-capture-icon" aria-hidden="true" />
        <span className="key-capture-text">
          {captureMode
            ? (liveCombo || 'Pressione as teclas...')
            : (value || 'Clique para capturar')}
        </span>
        {captureMode && (
          <span className="key-capture-blink" aria-hidden="true" />
        )}
      </div>
      {captureMode && (
        <button className="key-capture-cancel" onClick={cancel} type="button" aria-label="Cancelar captura">
          <X size={12} />
        </button>
      )}
      {!captureMode && value && (
        <button
          className="key-capture-clear"
          onClick={(e) => { e.stopPropagation(); onChange('') }}
          type="button"
          aria-label="Limpar teclas"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

// ── Skill row editor ──────────────────────────────────────────────────────────

interface SkillRowProps {
  skill: ComboSkill
  index: number
  onChange: (updated: ComboSkill) => void
  onRemove: () => void
}

function SkillRow({ skill, index, onChange, onRemove }: SkillRowProps): React.ReactElement {
  return (
    <div className="combo-skill-row">
      <span className="skill-drag-handle" aria-hidden="true">
        <GripVertical size={14} />
      </span>
      <span className="skill-index">{index + 1}</span>

      <input
        className="form-input skill-label-input"
        placeholder="Nome (ex: Grab)"
        value={skill.label}
        onChange={(e) => onChange({ ...skill, label: e.target.value })}
        maxLength={24}
      />

      <IconPicker
        value={skill.icon}
        onChange={(icon) => onChange({ ...skill, icon })}
      />

      {/* Texto customizado */}
      <div className="skill-texto-field">
        <input
          className="form-input skill-texto-input"
          placeholder={skill.keys || 'Texto no widget'}
          value={skill.displayText ?? ''}
          onChange={(e) => onChange({ ...skill, displayText: e.target.value || undefined })}
          maxLength={32}
          title="Texto exibido no widget (padrão: igual às teclas)"
        />
        <button
          type="button"
          className="btn-icon-sm"
          style={{ visibility: skill.displayText !== undefined ? 'visible' : 'hidden' }}
          onClick={() => onChange({ ...skill, displayText: undefined })}
          title="Restaurar padrão (igual às teclas)"
        >
          <RotateCcw size={11} />
        </button>
      </div>

      <KeyCaptureInput
        value={skill.keys}
        onChange={(keys) => onChange({ ...skill, keys })}
      />

      <div className="skill-cooldown-field">
        <input
          className="form-input skill-cd-input"
          type="number"
          min={0}
          max={3600}
          step={0.5}
          placeholder="0"
          value={skill.cooldown || ''}
          onChange={(e) => onChange({ ...skill, cooldown: parseFloat(e.target.value) || 0 })}
        />
        <span className="skill-cd-unit">s</span>
      </div>

      <button className="btn-icon-sm btn-danger" onClick={onRemove} type="button" aria-label="Remover habilidade">
        <X size={14} />
      </button>
    </div>
  )
}

// ── Config modal ──────────────────────────────────────────────────────────────

interface ConfigModalProps {
  initial?: ComboConfig | null
  onSave: (cfg: Omit<ComboConfig, 'id' | 'createdAt' | 'enabled'>) => void
  onClose: () => void
}

function ConfigModal({ initial, onSave, onClose }: ConfigModalProps): React.ReactElement {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [skills, setSkills] = useState<ComboSkill[]>(
    initial?.skills ?? []
  )

  const addSkill = useCallback(() => {
    setSkills(prev => [
      ...prev,
      { id: crypto.randomUUID(), label: '', keys: '', cooldown: 5 }
    ])
  }, [])

  const updateSkill = useCallback((idx: number, updated: ComboSkill) => {
    setSkills(prev => prev.map((s, i) => i === idx ? updated : s))
  }, [])

  const removeSkill = useCallback((idx: number) => {
    setSkills(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const handleSave = useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({ name: trimmed, description: description.trim(), skills })
  }, [name, description, skills, onSave])

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Configuração de combo">
      <div className="modal-box combo-config-modal">
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">
            {initial ? 'Editar Configuração' : 'Nova Configuração'}
          </span>
          <button className="modal-close" onClick={onClose} type="button">ESC</button>
        </div>

        {/* Body */}
        <div className="modal-body combo-modal-body">
          {/* Name */}
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input
              className="form-input"
              placeholder="Ex: Warrior Burst, Guardian PvP..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={48}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Descrição <span className="label-optional">(opcional)</span></label>
            <input
              className="form-input"
              placeholder="Ex: Combo de burst para PvP"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Skills */}
          <div className="form-group">
            <label className="form-label">Habilidades</label>
            <div className="combo-skills-col-labels" aria-hidden="true">
              <span className="cscl-handle" />
              <span className="cscl-index" />
              <span className="cscl-nome">Nome</span>
              <span className="cscl-icone">Ícone</span>
              <span className="cscl-texto">Texto</span>
              <span className="cscl-teclas">Teclas</span>
              <span className="cscl-cd">CD</span>
              <span className="cscl-del" />
            </div>

            <div className="combo-skills-list">
              {skills.length === 0 && (
                <div className="combo-skills-empty">
                  Nenhuma habilidade adicionada. Clique em "+ Habilidade" abaixo.
                </div>
              )}
              {skills.map((skill, idx) => (
                <SkillRow
                  key={skill.id}
                  skill={skill}
                  index={idx}
                  onChange={(updated) => updateSkill(idx, updated)}
                  onRemove={() => removeSkill(idx)}
                />
              ))}
            </div>

            <button className="btn-add-skill" onClick={addSkill} type="button">
              <Plus size={13} />
              Habilidade
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!name.trim()}
            type="button"
          >
            <Check size={14} />
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirm ────────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  name: string
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirm({ name, onConfirm, onCancel }: DeleteConfirmProps): React.ReactElement {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box confirm-box">
        <p className="confirm-message">
          Remover a configuração <strong style={{ color: 'var(--gold)' }}>{name}</strong>?
          <br />
          <span style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>Esta ação não pode ser desfeita.</span>
        </p>
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={onCancel} type="button">Cancelar</button>
          <button className="btn btn-danger" onClick={onConfirm} type="button">
            <Trash2 size={13} /> Remover
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Config card ───────────────────────────────────────────────────────────────

interface ConfigCardProps {
  config: ComboConfig
  isDragging: boolean
  onEdit: () => void
  onRemove: () => void
  onToggle: () => void
  onToggleDrag: () => void
}

function ConfigCard({ config, isDragging, onEdit, onRemove, onToggle, onToggleDrag }: ConfigCardProps): React.ReactElement {
  return (
    <div className={`combo-config-card ${config.enabled ? 'card-enabled' : ''} ${isDragging ? 'card-dragging' : ''}`}>
      <div className="card-main">
        <div className="card-info">
          <div className="card-name">{config.name}</div>
          {config.description && (
            <div className="card-description">{config.description}</div>
          )}
          {config.skills.length > 0 ? (
            <div className="card-skills-preview">
              {config.skills.map((s) => (
                <span key={s.id} className="skill-badge" title={`CD: ${s.cooldown}s`}>
                  {s.label ? `${s.label} (${s.keys})` : s.keys}
                </span>
              ))}
            </div>
          ) : (
            <div className="card-no-skills">Nenhuma habilidade configurada</div>
          )}
        </div>

        <div className="card-actions">
          <button
            className="btn-icon-sm"
            onClick={onEdit}
            type="button"
            title="Editar configuração"
            aria-label="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            className="btn-icon-sm btn-danger"
            onClick={onRemove}
            type="button"
            title="Remover configuração"
            aria-label="Remover"
          >
            <Trash2 size={14} />
          </button>
          <button
            className={`btn-toggle ${config.enabled ? 'toggle-on' : 'toggle-off'}`}
            onClick={onToggle}
            type="button"
            title={config.enabled ? 'Desativar overlay' : 'Ativar overlay'}
            aria-label={config.enabled ? 'Desativar' : 'Ativar'}
            aria-pressed={config.enabled}
          >
            {config.enabled ? <Power size={14} /> : <PowerOff size={14} />}
            {config.enabled ? 'Ativo' : 'Inativo'}
          </button>
        </div>
      </div>

      {config.enabled && (
        <div className="card-active-badge" aria-label="Overlay ativo">
          <span className="active-dot" aria-hidden="true" />
          Overlay exibindo {config.skills.length} habilidade{config.skills.length !== 1 ? 's' : ''}

          <button
            className={`btn-move-widgets ${isDragging ? 'move-active' : ''}`}
            onClick={onToggleDrag}
            type="button"
            disabled={config.skills.length === 0}
            title={isDragging ? 'Clique para parar de mover os widgets' : 'Clique para mover os widgets na tela'}
            aria-pressed={isDragging}
          >
            <Move size={12} />
            {isDragging ? 'Parar de mover' : 'Mover widgets'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────────────────────────

export default function ComboOverlayPage(): React.ReactElement {
  const { configs, saveConfigs } = useCombo()
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; target?: ComboConfig } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ComboConfig | null>(null)
  const [draggingConfigId, setDraggingConfigId] = useState<string | null>(null)

  // Exit drag mode when the page unmounts or the config is disabled/deleted
  useEffect(() => {
    if (!draggingConfigId) return
    const cfg = configs.find(c => c.id === draggingConfigId)
    if (!cfg || !cfg.enabled) {
      setDraggingConfigId(null)
      window.comboApi.setDragMode(null)
    }
  }, [configs, draggingConfigId])

  const handleToggleDrag = useCallback((id: string) => {
    const next = draggingConfigId === id ? null : id
    setDraggingConfigId(next)
    window.comboApi.setDragMode(next)
  }, [draggingConfigId])

  // Sync drag state relayed back from main process (e.g. stopped via Enter in overlay)
  useEffect(() => {
    const unsub = window.comboApi.onDragMode((configId) => {
      setDraggingConfigId(configId)
    })
    return unsub
  }, [])

  // Press Enter to stop drag mode (main window retains keyboard focus; overlay is focusable:false)
  useEffect(() => {
    if (!draggingConfigId) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        setDraggingConfigId(null)
        window.comboApi.setDragMode(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [draggingConfigId])

  const handleCreate = useCallback(
    (data: Omit<ComboConfig, 'id' | 'createdAt' | 'enabled'>) => {
      const next: ComboConfig = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        enabled: false
      }
      saveConfigs([...configs, next])
      setModal(null)
    },
    [configs, saveConfigs]
  )

  const handleEdit = useCallback(
    (data: Omit<ComboConfig, 'id' | 'createdAt' | 'enabled'>) => {
      if (!modal?.target) return
      const next = configs.map(c =>
        c.id === modal.target!.id ? { ...c, ...data } : c
      )
      saveConfigs(next)
      setModal(null)
    },
    [configs, modal, saveConfigs]
  )

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return
    saveConfigs(configs.filter(c => c.id !== deleteTarget.id))
    setDeleteTarget(null)
  }, [configs, deleteTarget, saveConfigs])

  const handleToggle = useCallback(
    (id: string) => {
      const next = configs.map(c =>
        c.id === id ? { ...c, enabled: !c.enabled } : c
      )
      saveConfigs(next)
    },
    [configs, saveConfigs]
  )

  const activeCount = configs.filter(c => c.enabled).length

  // ── Visual config state ──
  const [savedVisual, setSavedVisual]   = useState<WidgetVisualConfig>(VISUAL_DEFAULTS)
  const [draftVisual, setDraftVisual]   = useState<WidgetVisualConfig>(VISUAL_DEFAULTS)
  const isVisualDirty = JSON.stringify(draftVisual) !== JSON.stringify(savedVisual)

  useEffect(() => {
    window.api.readJson('combo-visual-config.json').then((raw) => {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const loaded = { ...VISUAL_DEFAULTS, ...(raw as Partial<WidgetVisualConfig>) }
        setSavedVisual(loaded)
        setDraftVisual(loaded)
      }
    })
  }, [])

  const handleVisualSave = useCallback(() => {
    void window.api.writeJson('combo-visual-config.json', draftVisual)
    window.comboApi.setVisualConfig(draftVisual)
    setSavedVisual(draftVisual)
  }, [draftVisual])

  const handleVisualDiscard = useCallback(() => {
    setDraftVisual(savedVisual)
  }, [savedVisual])

  return (
    <div className="page-container combo-overlay-page">
      {/* ── Page header ── */}
      <div className="page-header">
        <div className="page-title-row">
          <h2 className="page-title">Overlay de Combo</h2>
          <button
            className="btn btn-primary"
            onClick={() => setModal({ mode: 'create' })}
            type="button"
          >
            <Plus size={14} />
            Nova Configuração
          </button>
        </div>
        <p className="page-subtitle">
          Configure habilidades com teclas e cooldowns. Ative o overlay para monitorar em tempo real durante o jogo.
        </p>
        {activeCount > 0 && (
          <div className="overlay-status-bar">
            <span className="status-dot active" aria-hidden="true" />
            Overlay ativo com {activeCount} configuração{activeCount !== 1 ? 'ões' : ''} habilitada{activeCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* ── Visual config panel ── */}
      <div className="combo-visual-config-panel">
        <div className="visual-config-header">
          <span className="visual-config-title">Configurações Visuais</span>
          {isVisualDirty && (
            <div className="visual-config-actions">
              <button className="btn btn-secondary btn-sm" type="button" onClick={handleVisualDiscard}>
                <RotateCcw size={13} /> Descartar
              </button>
              <button className="btn btn-primary btn-sm" type="button" onClick={handleVisualSave}>
                <Save size={13} /> Salvar
              </button>
            </div>
          )}
        </div>

        <div className="visual-config-body">
          {/* Fonte */}
          <div className="visual-config-row">
            <label className="visual-config-label" htmlFor="vc-font">Fonte</label>
            <select
              id="vc-font"
              className="visual-config-select"
              value={draftVisual.font}
              onChange={e => setDraftVisual(prev => ({ ...prev, font: e.target.value }))}
            >
              {FONT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Font color */}
          <div className="visual-config-row">
            <label className="visual-config-label" htmlFor="vc-font-color">Cor da fonte</label>
            <input
              id="vc-font-color"
              type="color"
              className="visual-config-color"
              value={draftVisual.fontColor}
              onChange={e => setDraftVisual(prev => ({ ...prev, fontColor: e.target.value }))}
            />
            <span className="visual-config-color-swatch" style={{ background: draftVisual.fontColor }} />
          </div>

          {/* Box colors */}
          <div className="visual-config-row">
            <label className="visual-config-label" htmlFor="vc-color-ready">Cor da box (utilizável)</label>
            <input
              id="vc-color-ready"
              type="color"
              className="visual-config-color"
              value={draftVisual.boxColorReady}
              onChange={e => setDraftVisual(prev => ({ ...prev, boxColorReady: e.target.value }))}
            />
            <span className="visual-config-color-swatch" style={{ background: draftVisual.boxColorReady }} />
          </div>

          <div className="visual-config-row">
            <label className="visual-config-label" htmlFor="vc-color-cd">Cor da box (cooldown)</label>
            <input
              id="vc-color-cd"
              type="color"
              className="visual-config-color"
              value={draftVisual.boxColorCooldown}
              onChange={e => setDraftVisual(prev => ({ ...prev, boxColorCooldown: e.target.value }))}
            />
            <span className="visual-config-color-swatch" style={{ background: draftVisual.boxColorCooldown }} />
          </div>

          {/* Border colors */}
          <div className="visual-config-row">
            <label className="visual-config-label" htmlFor="vc-border-ready">Cor da borda (utilizável)</label>
            <input
              id="vc-border-ready"
              type="color"
              className="visual-config-color"
              value={draftVisual.borderColorReady}
              onChange={e => setDraftVisual(prev => ({ ...prev, borderColorReady: e.target.value }))}
            />
            <span className="visual-config-color-swatch" style={{ background: draftVisual.borderColorReady }} />
          </div>

          <div className="visual-config-row">
            <label className="visual-config-label" htmlFor="vc-border-cd">Cor da borda (cooldown)</label>
            <input
              id="vc-border-cd"
              type="color"
              className="visual-config-color"
              value={draftVisual.borderColorCooldown}
              onChange={e => setDraftVisual(prev => ({ ...prev, borderColorCooldown: e.target.value }))}
            />
            <span className="visual-config-color-swatch" style={{ background: draftVisual.borderColorCooldown }} />
          </div>

          {/* Hide on cooldown */}
          <div className="visual-config-row">
            <label className="visual-config-label visual-config-label-check" htmlFor="vc-hide-cd">
              <input
                id="vc-hide-cd"
                type="checkbox"
                className="visual-config-check"
                checked={draftVisual.hideOnCooldown}
                onChange={e => setDraftVisual(prev => ({ ...prev, hideOnCooldown: e.target.checked }))}
              />
              Esconder widget enquanto estiver em cooldown
            </label>
          </div>

          {/* Show timer */}
          <div className="visual-config-row">
            <label className="visual-config-label visual-config-label-check" htmlFor="vc-show-timer">
              <input
                id="vc-show-timer"
                type="checkbox"
                className="visual-config-check"
                checked={draftVisual.showTimer}
                onChange={e => setDraftVisual(prev => ({ ...prev, showTimer: e.target.checked }))}
              />
              Mostrar contador de tempo abaixo do widget
            </label>
          </div>

          {/* Show progress bar */}
          <div className="visual-config-row">
            <label className="visual-config-label visual-config-label-check" htmlFor="vc-show-progress">
              <input
                id="vc-show-progress"
                type="checkbox"
                className="visual-config-check"
                checked={draftVisual.showProgressBar}
                onChange={e => setDraftVisual(prev => ({ ...prev, showProgressBar: e.target.checked }))}
              />
              Mostrar barra de progresso no widget
            </label>
          </div>

          {/* Preview */}
          <div className="visual-config-preview-section">
            <span className="visual-config-preview-label">Exemplo:</span>
            <div className="visual-config-preview-widgets">
              {/* Ready state */}
              <div className="vcpw-slot">
                <span className="vcpw-label">Utilizável</span>
                <div className="visual-config-widget-preview" style={{
                  background: `${draftVisual.boxColorReady}e0`,
                  border: `1px solid ${draftVisual.borderColorReady}`,
                  boxShadow: `0 0 8px ${draftVisual.borderColorReady}30`,
                }}>
                  <span style={{ fontFamily: draftVisual.font, color: draftVisual.fontColor }}>SHIFT+Q</span>
                </div>
              </div>
              {/* Cooldown state */}
              <div className="vcpw-slot">
                <span className="vcpw-label">Cooldown</span>
                <div className="visual-config-widget-preview" style={{
                  background: `${draftVisual.boxColorCooldown}e0`,
                  border: `1px solid ${draftVisual.borderColorCooldown}`,
                  boxShadow: `0 0 8px ${draftVisual.borderColorCooldown}30`,
                }}>
                  <span style={{ fontFamily: draftVisual.font, color: draftVisual.fontColor }}>SHIFT+Q</span>
                </div>
                {draftVisual.showTimer && (
                  <span style={{ fontFamily: draftVisual.font, color: draftVisual.fontColor }} className="vcpw-timer">3.2s</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Config list ── */}
      <div className="combo-config-list">
        {configs.length === 0 ? (
          <div className="combo-empty-state">
            <Keyboard size={48} className="empty-icon" aria-hidden="true" />
            <p className="empty-title">Nenhuma configuração criada</p>
            <p className="empty-subtitle">
              Crie uma configuração com suas habilidades e teclas de atalho para monitorar os cooldowns em overlay durante o jogo.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => setModal({ mode: 'create' })}
              type="button"
            >
              <Plus size={14} />
              Criar primeira configuração
            </button>
          </div>
        ) : (
          configs.map(cfg => (
            <ConfigCard
              key={cfg.id}
              config={cfg}
              isDragging={draggingConfigId === cfg.id}
              onEdit={() => setModal({ mode: 'edit', target: cfg })}
              onRemove={() => setDeleteTarget(cfg)}
              onToggle={() => handleToggle(cfg.id)}
              onToggleDrag={() => handleToggleDrag(cfg.id)}
            />
          ))
        )}
      </div>

      {/* ── Modals ── */}
      {modal && (
        <ConfigModal
          initial={modal.mode === 'edit' ? modal.target : null}
          onSave={modal.mode === 'create' ? handleCreate : handleEdit}
          onClose={() => setModal(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
