import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Pencil, Trash2, Plus, Bell, Swords, FolderOpen, X, Check, Save, Calendar, Timer } from 'lucide-react'
import { useDevMode } from '../context/DevModeContext'
import { MOCK_BOSSES } from '../context/DevModeContext'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BossSpawnSlot {
  day:  number   // 0 = Domingo … 6 = Sábado
  time: string   // "HH:MM"
}

export interface WorldBoss {
  id:        string
  name:      string
  imageFile: string | null
  color:     string
  spawns:    BossSpawnSlot[]
  createdAt: string
}

interface SpawnEvent {
  boss:    WorldBoss
  spawnAt: Date
  key:     string
}

interface SpawnGroup {
  spawnAt: Date
  spawns:  SpawnEvent[]
  key:     string
}

interface OverlayNotifBoss {
  boss:     WorldBoss
  imageUrl: string | null
}

interface OverlayNotif {
  id:          string
  bosses:      OverlayNotifBoss[]
  minutesLeft: number
  spawnAt:     Date
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DAYS_FULL  = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const PRESET_COLORS = [
  '#e8a020', '#c83030', '#2060c8', '#20a060',
  '#9930c8', '#c86020', '#208080', '#c02080',
]

// ─────────────────────────────────────────────────────────────────────────────
// Audio helpers
// ─────────────────────────────────────────────────────────────────────────────

let _audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new AudioContext()
  }
  if (_audioCtx.state === 'suspended') void _audioCtx.resume()
  return _audioCtx
}

function scheduleBeep(
  ctx:   AudioContext,
  freq:  number,
  start: number,
  dur:   number,
  vol:   number,
  type:  OscillatorType = 'sine',
): void {
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(vol, start + 0.015)
  gain.gain.linearRampToValueAtTime(0,   start + dur)
  osc.start(start)
  osc.stop(start + dur + 0.05)
}

function playAlert(type: '15min' | '5min' | '3min'): void {
  const ctx = getAudioCtx()
  const t   = ctx.currentTime
  if (type === '15min') {
    // Soft double beep — 440 Hz
    scheduleBeep(ctx, 440, t,       0.25, 0.22)
    scheduleBeep(ctx, 440, t + 0.4, 0.25, 0.22)
  } else if (type === '5min') {
    // Medium triple beep — 660 Hz
    scheduleBeep(ctx, 660, t,       0.22, 0.42)
    scheduleBeep(ctx, 660, t + 0.32, 0.22, 0.42)
    scheduleBeep(ctx, 660, t + 0.64, 0.22, 0.42)
  } else {
    // Urgent ascending burst — 880 → 1100 Hz
    scheduleBeep(ctx, 880,  t,       0.18, 0.70, 'square')
    scheduleBeep(ctx, 880,  t + 0.22, 0.18, 0.70, 'square')
    scheduleBeep(ctx, 1100, t + 0.44, 0.22, 0.85, 'square')
    scheduleBeep(ctx, 1100, t + 0.68, 0.30, 1.00, 'square')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getUpcomingSpawns(bosses: WorldBoss[], from: Date, count: number): SpawnEvent[] {
  const events: SpawnEvent[] = []
  for (const boss of bosses) {
    for (const slot of boss.spawns) {
      const [h, m]    = slot.time.split(':').map(Number)
      const curDay    = from.getDay()
      const daysUntil = (slot.day - curDay + 7) % 7

      const candidate = new Date(from)
      candidate.setDate(candidate.getDate() + daysUntil)
      candidate.setHours(h, m, 0, 0)

      // If candidate is in the past (same-day slot already gone), push to next week
      if (candidate <= from) candidate.setDate(candidate.getDate() + 7)

      events.push({ boss, spawnAt: candidate, key: `${boss.id}-${slot.day}-${slot.time}` })
    }
  }
  events.sort((a, b) => a.spawnAt.getTime() - b.spawnAt.getTime())
  return events.slice(0, count)
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const mi = Math.floor((s % 3600) / 60)
  const sc = s % 60
  return [h, mi, sc].map(n => String(n).padStart(2, '0')).join(':')
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDayTime(d: Date): string {
  return `${DAYS_SHORT[d.getDay()]} ${fmtTime(d)}`
}

function groupSpawns(spawns: SpawnEvent[]): SpawnGroup[] {
  const map = new Map<number, SpawnGroup>()
  for (const s of spawns) {
    const bucket = Math.floor(s.spawnAt.getTime() / 60000)
    if (!map.has(bucket)) map.set(bucket, { spawnAt: s.spawnAt, spawns: [], key: s.key })
    map.get(bucket)!.spawns.push(s)
  }
  return Array.from(map.values()).sort((a, b) => a.spawnAt.getTime() - b.spawnAt.getTime())
}

const MOCK_BOSS_15: WorldBoss = { id: 'mock', name: 'Boss Teste', imageFile: null, color: '#e8a020', spawns: [], createdAt: '' }
const MOCK_BOSS_5:  WorldBoss = { id: 'mock', name: 'Boss Teste', imageFile: null, color: '#c83030', spawns: [], createdAt: '' }
const MOCK_BOSS_3:  WorldBoss = { id: 'mock', name: 'Boss Teste', imageFile: null, color: '#9930c8', spawns: [], createdAt: '' }

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

function WorldBossPage(): React.ReactElement {
  const { devMode } = useDevMode()
  // ── Data ──────────────────────────────────────────────────────────────────
  const [bosses,     setBosses]     = useState<WorldBoss[]>([])
  const [imageCache, setImageCache] = useState<Record<string, string>>({})
  const [loaded,     setLoaded]     = useState(false)

  // ── Form ──────────────────────────────────────────────────────────────────
  const [showForm,     setShowForm]     = useState(false)
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [formName,     setFormName]     = useState('')
  const [formColor,    setFormColor]    = useState(PRESET_COLORS[0])
  const [formImage,    setFormImage]    = useState<string | null>(null)
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null)
  const [formSpawns,   setFormSpawns]   = useState<BossSpawnSlot[]>([{ day: 1, time: '09:00' }])
  const [formError,    setFormError]    = useState<string | null>(null)
  const [saving,       setSaving]       = useState(false)

  // ── Clock ─────────────────────────────────────────────────────────────────
  const [now, setNow] = useState(() => new Date())

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifs, setNotifs] = useState<OverlayNotif[]>([])
  const alertedRef = useRef(new Set<string>())

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load(): Promise<void> {
      if (devMode) {
        setBosses(MOCK_BOSSES)
        setLoaded(true)
        return
      }
      const data = (await window.api.readJson('bosses.json')) as WorldBoss[] | null
      const list = Array.isArray(data) ? data : []
      setBosses(list)
      const cache: Record<string, string> = {}
      for (const b of list) {
        if (b.imageFile && !cache[b.imageFile]) {
          const url = await window.api.getImageDataUrl(b.imageFile)
          if (url) cache[b.imageFile] = url
        }
      }
      setImageCache(cache)
      setLoaded(true)
    }
    load()
  }, [devMode])

  // ── Tick ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // ── Upcoming spawns ───────────────────────────────────────────────────────
  const upcomingSpawns = useMemo(
    () => getUpcomingSpawns(bosses, now, 12),
    // recompute every second — intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bosses, now],
  )

  // ── Add notification ──────────────────────────────────────────────────────
  const addNotif = useCallback((bosses: OverlayNotifBoss[], minutesLeft: number, spawnAt: Date) => {
    const item: OverlayNotif = {
      id: `${Date.now()}-${Math.random()}`,
      bosses,
      minutesLeft,
      spawnAt,
    }
    setNotifs(prev => [...prev, item])
    setTimeout(() => setNotifs(prev => prev.filter(n => n.id !== item.id)), 9000)
  }, [])

  // ── Upcoming groups (simultaneous spawns merged) ─────────────────────────
  const upcomingGroups = useMemo(() => groupSpawns(upcomingSpawns), [upcomingSpawns])

  // ── Alert checker ─────────────────────────────────────────────────────────
  useEffect(() => {
    for (const group of upcomingGroups) {
      const diffMin = (group.spawnAt.getTime() - now.getTime()) / 60000
      for (const [thresh, type] of [[15, '15min'], [5, '5min'], [3, '3min']] as const) {
        if (diffMin <= thresh && diffMin > thresh - 1) {
          const k = `group-${group.key}-${group.spawnAt.toISOString()}-${thresh}`
          if (!alertedRef.current.has(k)) {
            alertedRef.current.add(k)
            playAlert(type)
            const bossesForNotif: OverlayNotifBoss[] = group.spawns.map(s => ({
              boss:     s.boss,
              imageUrl: s.boss.imageFile ? (imageCache[s.boss.imageFile] ?? null) : null,
            }))
            addNotif(bossesForNotif, thresh, group.spawnAt)
          }
        }
      }
    }
  }, [now, upcomingGroups, imageCache, addNotif])

  // ── Persist ───────────────────────────────────────────────────────────────
  async function persist(list: WorldBoss[]): Promise<void> {
    if (!devMode) await window.api.writeJson('bosses.json', list)
    setBosses(list)
  }

  // ── Form helpers ──────────────────────────────────────────────────────────
  function resetForm(): void {
    setEditingId(null)
    setFormName('')
    setFormColor(PRESET_COLORS[0])
    setFormImage(null)
    setFormImageUrl(null)
    setFormSpawns([{ day: 1, time: '09:00' }])
    setFormError(null)
    setShowForm(false)
  }

  async function handlePickImage(): Promise<void> {
    const filename = await window.api.pickImage()
    if (!filename) return
    const url = await window.api.getImageDataUrl(filename)
    setFormImage(filename)
    setFormImageUrl(url)
  }

  function handleSpawnChange(idx: number, field: 'day' | 'time', val: string): void {
    setFormSpawns(prev =>
      prev.map((s, i) => i === idx ? { ...s, [field]: field === 'day' ? Number(val) : val } : s)
    )
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const trimmed = formName.trim()
    if (!trimmed) { setFormError('Nome do boss é obrigatório.'); return }
    if (formSpawns.length === 0) { setFormError('Adicione pelo menos um horário.'); return }
    setFormError(null)
    setSaving(true)
    try {
      if (editingId !== null) {
        const updated = bosses.map(b =>
          b.id === editingId
            ? { ...b, name: trimmed, color: formColor, imageFile: formImage, spawns: formSpawns }
            : b
        )
        if (formImage && formImageUrl) setImageCache(prev => ({ ...prev, [formImage]: formImageUrl! }))
        await persist(updated)
      } else {
        const nb: WorldBoss = {
          id: `boss_${Date.now()}`,
          name: trimmed,
          imageFile: formImage,
          color: formColor,
          spawns: formSpawns,
          createdAt: new Date().toISOString(),
        }
        if (formImage && formImageUrl) setImageCache(prev => ({ ...prev, [formImage]: formImageUrl! }))
        await persist([...bosses, nb])
      }
      resetForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(boss: WorldBoss): void {
    setEditingId(boss.id)
    setFormName(boss.name)
    setFormColor(boss.color)
    setFormImage(boss.imageFile)
    setFormImageUrl(boss.imageFile ? (imageCache[boss.imageFile] ?? null) : null)
    setFormSpawns(boss.spawns.length > 0 ? [...boss.spawns] : [{ day: 1, time: '09:00' }])
    setFormError(null)
    setShowForm(true)
    const area = document.querySelector('.content-area')
    if (area) area.scrollTop = 0
  }

  async function handleDelete(id: string): Promise<void> {
    await persist(bosses.filter(b => b.id !== id))
    if (editingId === id) resetForm()
  }

  // ── Calendar data ─────────────────────────────────────────────────────────
  const calByDay = useMemo(() => {
    const map = new Map<number, { boss: WorldBoss; time: string }[]>()
    for (let d = 0; d < 7; d++) map.set(d, [])
    for (const boss of bosses) {
      for (const slot of boss.spawns) {
        map.get(slot.day)!.push({ boss, time: slot.time })
      }
    }
    for (const [, list] of map) list.sort((a, b) => a.time.localeCompare(b.time))
    return map
  }, [bosses])

  const todayDay  = now.getDay()
  const nextGroup = upcomingGroups[0]

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">

      {/* ── Overlay notifications ── */}
      <div className="boss-notif-stack" aria-live="assertive" aria-atomic="false">
        {notifs.map(n => (
          <div
            key={n.id}
            className="boss-notif-card"
            style={n.bosses.length === 1 ? { '--boss-color': n.bosses[0].boss.color } as React.CSSProperties : undefined}
          >
            <div
              className="boss-notif-accent"
              style={n.bosses.length > 1
                ? { background: `linear-gradient(to bottom, ${n.bosses.map(b => b.boss.color).join(', ')})` }
                : undefined
              }
            />
            <div className="boss-notif-icons">
              {n.bosses.map(({ boss, imageUrl }, i) => (
                <div key={i} className="boss-notif-icon" style={{ borderColor: boss.color }}>
                  {imageUrl ? <img src={imageUrl} alt="" draggable={false} /> : <Swords size={16} aria-hidden="true" />}
                </div>
              ))}
            </div>
            <div className="boss-notif-body">
              <span className="boss-notif-title">
                {n.bosses.map(({ boss }, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="boss-sep"> &amp; </span>}
                    <span style={{ color: boss.color }}>{boss.name}</span>
                  </React.Fragment>
                ))}
              </span>
              <span className="boss-notif-sub">
                {n.minutesLeft <= 1 ? 'Spawnando agora!' : `Spawna em ${n.minutesLeft} min — ${fmtDayTime(n.spawnAt)}`}
              </span>
            </div>
            <button
              className="boss-notif-close"
              onClick={() => setNotifs(prev => prev.filter(x => x.id !== n.id))}
              aria-label="Fechar"
            ><X size={12} aria-hidden="true" /></button>
          </div>
        ))}
      </div>

      <h2 className="page-title">
        <span className="page-title-icon" aria-hidden="true"><Swords size={20} /></span>
        Bosses Mundiais
      </h2>

      {/* ── Countdown section ── */}
      <section className="boss-countdown-section">
        {/* Clock + next boss */}
        <div className="boss-clock-row">
          <div className="boss-clock-now">
            <span className="boss-clock-label">Horário atual</span>
            <span className="boss-clock-time">{now.toLocaleTimeString('pt-BR')}</span>
            <span className="boss-clock-date">
              {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </span>
          </div>

          {nextGroup ? (
            <div
              className="boss-next-card"
              style={nextGroup.spawns.length === 1 ? { '--boss-color': nextGroup.spawns[0].boss.color } as React.CSSProperties : undefined}
            >
              <div
                className="boss-next-accent"
                style={nextGroup.spawns.length > 1
                  ? { background: `linear-gradient(to bottom, ${nextGroup.spawns.map(s => s.boss.color).join(', ')})` }
                  : undefined
                }
              />
              <div className="boss-next-icons">
                {nextGroup.spawns.map(({ boss }, i) => (
                  <div key={i} className="boss-next-icon" style={{ borderColor: boss.color }}>
                    {boss.imageFile && imageCache[boss.imageFile]
                      ? <img src={imageCache[boss.imageFile]} alt="" draggable={false} />
                      : <Swords size={20} aria-hidden="true" />
                    }
                  </div>
                ))}
              </div>
              <div className="boss-next-info">
                <span className="boss-next-label">{nextGroup.spawns.length > 1 ? 'Próximos Bosses' : 'Próximo Boss'}</span>
                <div className="boss-next-names">
                  {nextGroup.spawns.map(({ boss }, i) => (
                    <span key={i} className="boss-next-name" style={{ color: boss.color }}>{boss.name}</span>
                  ))}
                </div>
                <span className="boss-next-when">{fmtDayTime(nextGroup.spawnAt)}</span>
              </div>
              <div className="boss-next-countdown">
                {formatCountdown(nextGroup.spawnAt.getTime() - now.getTime())}
              </div>
            </div>
          ) : (
            <div className="boss-no-next">
              <Swords size={16} aria-hidden="true" /> Nenhum boss registrado
            </div>
          )}
        </div>

        {/* Upcoming list */}
        {upcomingGroups.length > 1 && (
          <div className="boss-upcoming-list">
            {upcomingGroups.slice(1, 8).map((group, i) => (
              <div
                key={i}
                className="boss-upcoming-row"
                style={group.spawns.length === 1 ? { '--boss-color': group.spawns[0].boss.color } as React.CSSProperties : undefined}
              >
                <div className="boss-upcoming-dots">
                  {group.spawns.map(({ boss }, j) => (
                    <div key={j} className="boss-upcoming-dot" style={{ background: boss.color }} />
                  ))}
                </div>
                <div className="boss-upcoming-imgs">
                  {group.spawns.map(({ boss }, j) => (
                    <div key={j} className="boss-upcoming-img" style={{ borderColor: boss.color }}>
                      {boss.imageFile && imageCache[boss.imageFile]
                        ? <img src={imageCache[boss.imageFile]} alt="" draggable={false} />
                        : <Swords size={14} aria-hidden="true" />
                      }
                    </div>
                  ))}
                </div>
                <span className="boss-upcoming-name">
                  {group.spawns.map(({ boss }, j) => (
                    <React.Fragment key={j}>
                      {j > 0 && <span className="boss-sep"> &amp; </span>}
                      <span style={{ color: boss.color }}>{boss.name}</span>
                    </React.Fragment>
                  ))}
                </span>
                <span className="boss-upcoming-when">{fmtDayTime(group.spawnAt)}</span>
                <span className="boss-upcoming-cd">
                  {formatCountdown(group.spawnAt.getTime() - now.getTime())}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Weekly calendar ── */}
      {bosses.length > 0 && (
        <section className="wood-panel boss-calendar-section">
          <h3 className="panel-section-title">
            <Calendar size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} aria-hidden="true" />
            Calendário Semanal
          </h3>
          <div className="boss-cal-grid">
            {Array.from({ length: 7 }, (_, day) => {
              const daySpawns = calByDay.get(day) ?? []
              const isToday   = day === todayDay
              return (
                <div key={day} className={`boss-cal-col${isToday ? ' boss-cal-col-today' : ''}`}>
                  <div className="boss-cal-col-header">{DAYS_SHORT[day]}</div>
                  <div className="boss-cal-col-body">
                    {daySpawns.length === 0
                      ? <span className="boss-cal-empty">—</span>
                      : daySpawns.map((entry, i) => (
                          <div
                            key={i}
                            className="boss-cal-chip"
                            style={{ '--boss-color': entry.boss.color } as React.CSSProperties}
                            title={`${entry.boss.name} — ${entry.time}`}
                          >
                            <span className="boss-cal-chip-time">{entry.time}</span>
                            {entry.boss.imageFile && imageCache[entry.boss.imageFile]
                              ? <img className="boss-cal-chip-img" src={imageCache[entry.boss.imageFile]} alt="" draggable={false} />
                              : <Swords size={14} className="boss-cal-chip-icon" aria-hidden="true" />
                            }
                            <span className="boss-cal-chip-name">{entry.boss.name}</span>
                          </div>
                        ))
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Test alerts ── */}
      <section className="wood-panel boss-test-section">
        <h3 className="panel-section-title">
          <Bell size={15} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Testar Alertas
        </h3>
        <p className="boss-test-hint">Clique para ouvir o alerta sonoro e ver a notificação de cada limiar.</p>
        <div className="boss-test-row">
          <button
            className="btn boss-test-btn boss-test-15"
            onClick={() => { playAlert('15min'); addNotif([{ boss: MOCK_BOSS_15, imageUrl: null }], 15, new Date(Date.now() + 15 * 60000)) }}
          >
            <Bell size={14} />
            15 min — suave
          </button>
          <button
            className="btn boss-test-btn boss-test-5"
            onClick={() => { playAlert('5min'); addNotif([{ boss: MOCK_BOSS_5, imageUrl: null }], 5, new Date(Date.now() + 5 * 60000)) }}
          >
            <Bell size={14} />
            5 min — médio
          </button>
          <button
            className="btn boss-test-btn boss-test-3"
            onClick={() => { playAlert('3min'); addNotif([{ boss: MOCK_BOSS_3, imageUrl: null }], 3, new Date(Date.now() + 3 * 60000)) }}
          >
            <Bell size={14} />
            3 min — urgente
          </button>
        </div>
      </section>

      {/* ── Boss management ── */}
      <section className="boss-mgmt-section">
        <div className="items-list-heading">
          <span>Bosses Registrados</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="items-count">{bosses.length}</span>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { if (showForm && !editingId) { resetForm() } else { resetForm(); setShowForm(true) } }}
            >
              <Plus size={13} />
              {showForm && !editingId ? 'Cancelar' : 'Novo Boss'}
            </button>
          </div>
        </div>

        {/* Registration / edit form */}
        {showForm && (
          <div className="wood-panel boss-form-panel">
            <h3 className="panel-section-title">
              {editingId
              ? <><Pencil size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} aria-hidden="true" /> Editar Boss</>
              : '+ Novo Boss'
            }
            </h3>
            {formError && <p className="form-error" role="alert">{formError}</p>}

            <form onSubmit={handleSubmit} noValidate>
              <div className="boss-form-grid">

                {/* Name */}
                <div className="form-field">
                  <label className="form-label" htmlFor="boss-name">
                    Nome do Boss <span className="required-mark">*</span>
                  </label>
                  <input
                    id="boss-name"
                    className="form-input"
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Ex.: Kzarka"
                    maxLength={80}
                    required
                    autoComplete="off"
                  />
                </div>

                {/* Color */}
                <div className="form-field">
                  <span className="form-label">Cor de destaque</span>
                  <div className="boss-color-row">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        className={`boss-color-swatch${formColor === c ? ' boss-color-swatch-active' : ''}`}
                        style={{ background: c }}
                        onClick={() => setFormColor(c)}
                        aria-label={`Cor ${c}`}
                      />
                    ))}
                    <input
                      type="color"
                      className="boss-color-custom"
                      value={formColor}
                      onChange={e => setFormColor(e.target.value)}
                      title="Cor personalizada"
                    />
                  </div>
                </div>

                {/* Image */}
                <div className="form-field">
                  <span className="form-label">Imagem (PNG / WebP)</span>
                  <div className="pick-image-row">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handlePickImage}>
                      <FolderOpen size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} aria-hidden="true" /> Selecionar
                    </button>
                    {formImage
                      ? <span className="image-filename"><Check size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} aria-hidden="true" />Imagem selecionada</span>
                      : <span className="image-filename-empty">Nenhuma imagem</span>
                    }
                    {formImage && (
                      <button
                        type="button"
                        className="btn-icon-remove"
                        onClick={() => { setFormImage(null); setFormImageUrl(null) }}
                        aria-label="Remover imagem"
                      ><X size={12} aria-hidden="true" /></button>
                    )}
                  </div>
                  {formImageUrl && (
                    <div className="boss-img-preview" style={{ borderColor: formColor }}>
                      <img src={formImageUrl} alt="Prévia" draggable={false} />
                    </div>
                  )}
                </div>

              </div>{/* /boss-form-grid */}

              {/* Spawn schedule */}
              <div className="form-field" style={{ marginTop: 18 }}>
                <div className="boss-spawns-header">
                  <span className="form-label">Horários de Spawn</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setFormSpawns(prev => [...prev, { day: 1, time: '09:00' }])}
                  >
                    <Plus size={12} /> Adicionar horário
                  </button>
                </div>

                <div className="boss-spawn-list">
                  {formSpawns.map((slot, idx) => (
                    <div key={idx} className="boss-spawn-row">
                      <select
                        className="form-input boss-spawn-day"
                        value={slot.day}
                        onChange={e => handleSpawnChange(idx, 'day', e.target.value)}
                        aria-label="Dia da semana"
                      >
                        {DAYS_FULL.map((d, i) => (
                          <option key={i} value={i}>{d}</option>
                        ))}
                      </select>

                      <input
                        className="form-input boss-spawn-time"
                        type="time"
                        value={slot.time}
                        onChange={e => handleSpawnChange(idx, 'time', e.target.value)}
                        aria-label="Horário"
                      />

                      <button
                        type="button"
                        className="btn-icon-remove"
                        onClick={() => setFormSpawns(prev => prev.filter((_, i) => i !== idx))}
                        disabled={formSpawns.length <= 1}
                        aria-label="Remover este horário"
                      ><X size={12} aria-hidden="true" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: 18 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || !formName.trim()}
                >
                  {saving
                    ? 'Salvando…'
                    : editingId
                      ? <><Save size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} aria-hidden="true" /> Salvar Alterações</>
                      : <><Save size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} aria-hidden="true" /> Cadastrar Boss</>
                  }
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Boss list */}
        {!loaded ? (
          <p className="loading-text">Carregando…</p>
        ) : bosses.length === 0 && !showForm ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true"><Swords size={48} /></span>
            <span className="empty-state-text">Nenhum boss registrado ainda. Clique em "Novo Boss" para começar.</span>
          </div>
        ) : (
          <ul className="boss-list" role="list">
            {bosses.map(boss => {
              const img        = boss.imageFile ? imageCache[boss.imageFile] : null
              const nextForBoss = upcomingSpawns.find(s => s.boss.id === boss.id)
              return (
                <li
                  key={boss.id}
                  className={`boss-card${editingId === boss.id ? ' boss-card-editing' : ''}`}
                  style={{ '--boss-color': boss.color } as React.CSSProperties}
                >
                  <div className="boss-card-accent" />

                  <div className="boss-card-img">
                    {img
                      ? <img src={img} alt={boss.name} draggable={false} />
                      : <Swords size={24} aria-hidden="true" />
                    }
                  </div>

                  <div className="boss-card-info">
                    <span className="boss-card-name">{boss.name}</span>
                    <span className="boss-card-spawns">
                      {boss.spawns.length} horário{boss.spawns.length !== 1 ? 's' : ''} semanal{boss.spawns.length !== 1 ? 'is' : ''}
                    </span>
                    {nextForBoss && (
                      <span className="boss-card-next">
                        <Timer size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} aria-hidden="true" /> Próximo: {fmtDayTime(nextForBoss.spawnAt)}
                        &ensp;({formatCountdown(nextForBoss.spawnAt.getTime() - now.getTime())})
                      </span>
                    )}
                  </div>

                  <div className="item-row-actions">
                    <button
                      className="btn-labeled btn-labeled-edit"
                      aria-label={`Editar ${boss.name}`}
                      onClick={() => handleEdit(boss)}
                    >
                      <Pencil size={13} aria-hidden="true" /> Editar
                    </button>
                    <button
                      className="btn-labeled btn-labeled-delete"
                      aria-label={`Excluir ${boss.name}`}
                      onClick={() => handleDelete(boss.id)}
                    >
                      <Trash2 size={13} aria-hidden="true" /> Excluir
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default WorldBossPage
