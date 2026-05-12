import React, { useState, useEffect, useCallback, useRef } from 'react'
import * as LucideIcons from 'lucide-react'
import type { WidgetVisualConfig } from '../types.d'

// ── Types ──────────────────────────────────────────────────────────────────────────

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

interface OverlaySkill {
  id: string
  label: string
  keys: string
  cooldown: number  // seconds
  configId: string
  icon?: string
  displayText?: string
}

interface SkillCooldown {
  startedAt: number
  durationMs: number
}

interface Pos { x: number; y: number; scale?: number }
// Positions keyed by configId → skillId → Pos
type Positions = Record<string, Record<string, Pos>>

const WIDGET_W  = 130  // approximate width to clamp right edge
const WIDGET_H  = 46   // approximate height to clamp bottom edge
const MIN_SCALE = 0.6
const MAX_SCALE = 3.0

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRemaining(ms: number): string {
  const s = ms / 1000
  if (s >= 10) return `${Math.ceil(s)}s`
  return `${s.toFixed(1)}s`
}

function cdColor(progress: number): string {
  // progress: 0 = just triggered, 1 = ready
  if (progress >= 1) return '#50d050'        // ready — green
  if (progress >= 0.5) return '#c9a030'      // first half — gold
  if (progress >= 0.25) return '#d05810'     // 25-50% remaining — orange
  return '#c83030'                            // last 25% — red
}

function defaultPos(index: number): Pos {
  const x = typeof window !== 'undefined' ? window.innerWidth - WIDGET_W - 20 : 1100
  const y = 20 + index * (WIDGET_H + 10)
  return { x, y }
}

// ── Single skill widget ───────────────────────────────────────────────────────

interface SkillWidgetProps {
  skill: OverlaySkill
  cooldown: SkillCooldown | undefined
  now: number
  pos: Pos
  draggable: boolean
  visualConfig: WidgetVisualConfig
  onPosChange: (id: string, configId: string, pos: Pos) => void
}

function SkillWidget({
  skill, cooldown, now, pos, draggable, visualConfig, onPosChange
}: SkillWidgetProps): React.ReactElement | null {
  const elapsed   = cooldown ? now - cooldown.startedAt : 0
  const remaining = cooldown ? Math.max(0, cooldown.durationMs - elapsed) : 0
  const isOnCD    = !!cooldown && elapsed < cooldown.durationMs
  const progress  = isOnCD ? elapsed / cooldown.durationMs : 1
  const scale     = pos.scale ?? 1

  // Hide while on cooldown if configured
  if (visualConfig.hideOnCooldown && isOnCD) return null

  const dragging     = useRef(false)
  const resizing     = useRef(false)
  const dragStart    = useRef({ mx: 0, my: 0, wx: 0, wy: 0 })
  const resizeStart  = useRef({ my: 0, startScale: 1 })

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!draggable || e.button !== 0) return
    e.preventDefault()
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, wx: pos.x, wy: pos.y }
  }, [draggable, pos])

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (!draggable || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    resizing.current = true
    resizeStart.current = { my: e.clientY, startScale: scale }
  }, [draggable, scale])

  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      if (resizing.current) {
        const delta = (e.clientY - resizeStart.current.my) / 80
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, resizeStart.current.startScale + delta))
        onPosChange(skill.id, skill.configId, { x: pos.x, y: pos.y, scale: newScale })
        return
      }
      if (!dragging.current) return
      const nx = Math.max(0, Math.min(window.innerWidth  - WIDGET_W, dragStart.current.wx + e.clientX - dragStart.current.mx))
      const ny = Math.max(0, Math.min(window.innerHeight - WIDGET_H, dragStart.current.wy + e.clientY - dragStart.current.my))
      onPosChange(skill.id, skill.configId, { x: nx, y: ny, scale })
    }
    const onUp = (e: MouseEvent): void => {
      if (e.button !== 0) return
      dragging.current  = false
      resizing.current  = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [skill.id, skill.configId, onPosChange, pos.x, pos.y, scale])

  const bgColor     = isOnCD ? `${visualConfig.boxColorCooldown}e0` : `${visualConfig.boxColorReady}e0`
  const borderColor = isOnCD ? visualConfig.borderColorCooldown : visualConfig.borderColorReady

  // Dynamic icon lookup
  const IconComponent = skill.icon
    ? (LucideIcons as Record<string, unknown>)[skill.icon] as React.ComponentType<{ size?: number; color?: string }> | undefined
    : undefined

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top:  pos.y,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        userSelect: 'none',
        pointerEvents: draggable ? 'auto' : 'none',
        cursor: draggable ? 'grab' : 'default',
        transformOrigin: 'top left',
        transform: scale !== 1 ? `scale(${scale})` : undefined,
      }}
      onMouseDown={onMouseDown}
    >
      {/* Box — icon + keys + progress bar */}
      <div style={{
        position: 'relative',
        minWidth: 80,
        maxWidth: 180,
        background: bgColor,
        border: draggable ? `1px dashed ${borderColor}` : `1px solid ${borderColor}`,
        borderRadius: 5,
        padding: '5px 10px',
        backdropFilter: 'blur(6px)',
        boxShadow: draggable
          ? `0 0 12px ${borderColor}60, 0 2px 16px rgba(0,0,0,0.8)`
          : `0 0 8px ${borderColor}30, 0 2px 12px rgba(0,0,0,0.7)`,
        transition: 'border-color 0.3s, box-shadow 0.3s',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
      }}>
        {/* Icon (if set) */}
        {IconComponent && (
          <IconComponent size={12} color={visualConfig.fontColor} />
        )}

        {/* Combo keys — main content */}
        <div style={{
          fontFamily: visualConfig.font,
          fontWeight: 700,
          fontSize: '0.82rem',
          color: visualConfig.fontColor,
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
        }}>
          {skill.displayText || skill.keys}
        </div>

        {/* Thin progress bar at bottom */}
        {visualConfig.showProgressBar && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            borderRadius: '0 0 4px 4px',
            background: `rgba(255,255,255,0.06)`,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress * 100}%`,
              background: borderColor,
              transition: 'width 0.1s linear',
            }} />
          </div>
        )}

        {/* Resize handle — bottom-right corner, only in drag mode */}
        {draggable && (
          <div
            onMouseDown={onResizeMouseDown}
            style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              width: 10,
              height: 10,
              cursor: 'nwse-resize',
              opacity: 0.6,
              borderRight: `2px solid ${borderColor}`,
              borderBottom: `2px solid ${borderColor}`,
              borderRadius: '0 0 3px 0',
            }}
            title="Redimensionar"
          />
        )}
      </div>

      {/* Timer — below the box */}
      {visualConfig.showTimer && (
        <div style={{
          fontFamily: visualConfig.font,
          fontSize: '0.65rem',
          color: visualConfig.fontColor,
          opacity: isOnCD ? 0.85 : 0,
          transition: 'opacity 0.2s',
          lineHeight: 1,
          height: '0.75rem',
          textAlign: 'center',
        }}>
          {isOnCD ? formatRemaining(remaining) : ''}
        </div>
      )}
    </div>
  )
}

// ── Overlay app ───────────────────────────────────────────────────────────────

export default function OverlayApp(): React.ReactElement {
  const [skills, setSkills]           = useState<OverlaySkill[]>([])
  const [cooldowns, setCooldowns]     = useState<Record<string, SkillCooldown>>({})
  const [positions, setPositions]     = useState<Positions>({})
  const [dragConfigId, setDragConfigId] = useState<string | null>(null)
  const [visualConfig, setVisualConfig] = useState<WidgetVisualConfig>(VISUAL_DEFAULTS)
  const [now, setNow]                 = useState(Date.now())

  // 20 fps timer for smooth cooldown display
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50)
    return () => clearInterval(id)
  }, [])

  // Load saved positions (nested: configId → skillId → Pos)
  useEffect(() => {
    window.api.readJson('combo-positions.json').then((raw) => {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        setPositions(raw as Positions)
      }
    })
  }, [])

  // Load saved visual config
  useEffect(() => {
    window.api.readJson('combo-visual-config.json').then((raw) => {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        setVisualConfig({ ...VISUAL_DEFAULTS, ...(raw as Partial<WidgetVisualConfig>) })
      }
    })
  }, [])

  // Subscribe to live visual config updates from the main renderer
  useEffect(() => {
    const unsub = window.comboApi.onVisualConfig((cfg) => {
      setVisualConfig({ ...VISUAL_DEFAULTS, ...(cfg as Partial<WidgetVisualConfig>) })
    })
    return unsub
  }, [])

  // Listen for drag mode changes from main renderer
  useEffect(() => {
    const unsub = window.comboApi.onDragMode((configId) => {
      setDragConfigId(configId)
      window.comboApi.setInteractive(configId !== null)
    })
    return unsub
  }, [])

  // Pull initial active skills
  useEffect(() => {
    window.comboApi.getActiveSkills().then((data) => {
      if (Array.isArray(data)) setSkills(data as OverlaySkill[])
    })
  }, [])

  // Listen for config updates from main process
  useEffect(() => {
    const unsub = window.comboApi.onInit((data: unknown) => {
      if (!Array.isArray(data)) return
      const next = data as OverlaySkill[]
      setSkills(next)
      setCooldowns(prev => {
        const ids = new Set(next.map(s => s.id))
        const cleaned: Record<string, SkillCooldown> = {}
        for (const k of Object.keys(prev)) {
          if (ids.has(k)) cleaned[k] = prev[k]
        }
        return cleaned
      })
    })
    return unsub
  }, [])

  // Listen for skill triggers
  const skillsRef = useRef(skills)
  skillsRef.current = skills

  const handleTriggered = useCallback((skillId: string) => {
    const skill = skillsRef.current.find(s => s.id === skillId)
    if (!skill || skill.cooldown <= 0) return
    setCooldowns(prev => ({
      ...prev,
      [skillId]: { startedAt: Date.now(), durationMs: skill.cooldown * 1000 }
    }))
  }, [])

  useEffect(() => {
    const unsub = window.comboApi.onTriggered(handleTriggered)
    return unsub
  }, [handleTriggered])

  // Position change — update state (per-config bucket) and debounce-save to disk
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const positionsRef  = useRef<Positions>({})
  positionsRef.current = positions

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    void window.api.writeJson('combo-positions.json', positionsRef.current)
  }, [])

  const onPosChange = useCallback((id: string, configId: string, pos: Pos) => {
    setPositions(prev => {
      const configBucket = { ...(prev[configId] ?? {}), [id]: pos }
      const next = { ...prev, [configId]: configBucket }
      positionsRef.current = next
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        void window.api.writeJson('combo-positions.json', next)
      }, 400)
      return next
    })
  }, [])

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }, [])

  // Flush save immediately when drag mode ends
  const prevDragConfigId = useRef<string | null>(null)
  useEffect(() => {
    if (prevDragConfigId.current !== null && dragConfigId === null) {
      flushSave()
    }
    prevDragConfigId.current = dragConfigId
  }, [dragConfigId, flushSave])

  if (skills.length === 0 && !dragConfigId) return <></>

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
      {skills.map((skill, idx) => (
        <SkillWidget
          key={skill.id}
          skill={skill}
          cooldown={cooldowns[skill.id]}
          now={now}
          pos={(positions[skill.configId] ?? {})[skill.id] ?? defaultPos(idx)}
          draggable={dragConfigId === skill.configId}
          visualConfig={visualConfig}
          onPosChange={onPosChange}
        />
      ))}

      {/* Stop-drag button — only visible while drag mode is active */}
      {dragConfigId !== null && (
        <button
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'auto',
            background: 'rgba(20,12,4,0.92)',
            border: '1px solid #c9a030',
            borderRadius: 6,
            color: '#c9a030',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            padding: '6px 18px',
            cursor: 'pointer',
            backdropFilter: 'blur(6px)',
            boxShadow: '0 0 12px #c9a03040',
            letterSpacing: '0.06em',
          }}
          onClick={() => window.comboApi.setDragMode(null)}
        >
          ✕ Parar de mover  (Enter)
        </button>
      )}
    </div>
  )
}

