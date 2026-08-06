import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Copy,
  Keyboard,
  MousePointer,
  Pause,
  Play,
  Plus,
  Repeat,
  ShieldAlert,
  Timer,
  Trash2,
  X
} from 'lucide-react'

type MacroMode = 'press' | 'toggle' | 'hold'
type MacroStepType = 'keys' | 'mouse' | 'delay'
type MouseButton = 'LMB' | 'RMB' | 'MMB'

interface MacroStep {
  id: string
  type: MacroStepType
  keys: string
  mouseButton: MouseButton
  delayMs: number
  holdMs: number
  repeat: number
  delayAfterMs: number
}

interface MacroConfig {
  id: string
  name: string
  description: string
  trigger: string
  mode: MacroMode
  enabled: boolean
  startDelayMs: number
  repeatCount: number
  repeatIntervalMs: number
  globalDelayMs: number
  steps: MacroStep[]
  createdAt: string
}

const MODIFIER_ORDER = ['CTRL', 'ALT', 'SHIFT']
const SPECIAL_KEYS = ['SHIFT', 'CTRL', 'ALT', 'SPACE', 'TAB', 'ENTER', 'ESC', 'LMB', 'RMB', 'MMB']
const COMMON_KEYS = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F', 'Z', 'X', 'C', 'V', '1', '2', '3', '4', '5', 'F1', 'F2', 'F3', 'F4']

const EMPTY_STEP = (): MacroStep => ({
  id: crypto.randomUUID(),
  type: 'keys',
  keys: '',
  mouseButton: 'LMB',
  delayMs: 120,
  holdMs: 40,
  repeat: 1,
  delayAfterMs: 80
})

const EMPTY_MACRO = (): MacroConfig => ({
  id: crypto.randomUUID(),
  name: 'Nova macro',
  description: '',
  trigger: '',
  mode: 'press',
  enabled: false,
  startDelayMs: 0,
  repeatCount: 1,
  repeatIntervalMs: 250,
  globalDelayMs: 0,
  steps: [EMPTY_STEP()],
  createdAt: new Date().toISOString()
})

function codeToKeyName(code: string): string | null {
  const map: Record<string, string> = {
    ShiftLeft: 'SHIFT',
    ShiftRight: 'SHIFT',
    ControlLeft: 'CTRL',
    ControlRight: 'CTRL',
    AltLeft: 'ALT',
    AltRight: 'ALT',
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
    F1: 'F1',
    F2: 'F2',
    F3: 'F3',
    F4: 'F4',
    F5: 'F5',
    F6: 'F6',
    F7: 'F7',
    F8: 'F8',
    F9: 'F9',
    F10: 'F10',
    F11: 'F11',
    F12: 'F12'
  }
  if (map[code]) return map[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return `NUM${code.slice(6)}`
  return null
}

function orderKeys(keys: string[]): string[] {
  const mods = keys
    .filter((key) => MODIFIER_ORDER.includes(key))
    .sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b))
  const rest = keys.filter((key) => !MODIFIER_ORDER.includes(key)).sort()
  return [...mods, ...rest]
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

function normalizeMacro(raw: unknown): MacroConfig[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Partial<MacroConfig> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
      name: typeof item.name === 'string' && item.name.trim() ? item.name : 'Macro sem nome',
      description: typeof item.description === 'string' ? item.description : '',
      trigger: typeof item.trigger === 'string' ? item.trigger : '',
      mode: item.mode === 'toggle' || item.mode === 'hold' ? item.mode : 'press',
      enabled: item.enabled === true,
      startDelayMs: typeof item.startDelayMs === 'number' ? item.startDelayMs : 0,
      repeatCount: typeof item.repeatCount === 'number' ? item.repeatCount : 1,
      repeatIntervalMs: typeof item.repeatIntervalMs === 'number' ? item.repeatIntervalMs : 250,
      globalDelayMs: typeof item.globalDelayMs === 'number' ? item.globalDelayMs : 0,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      steps: Array.isArray(item.steps) && item.steps.length > 0
        ? item.steps.map((step) => ({ ...EMPTY_STEP(), ...(step as Partial<MacroStep>) }))
        : [EMPTY_STEP()]
    }))
}

function KeyCaptureInput({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }): React.ReactElement {
  const [captureMode, setCaptureMode] = useState(false)
  const [liveCombo, setLiveCombo] = useState('')
  const pressedRef = useRef(new Set<string>())

  const commitCombo = useCallback((combo: string) => {
    if (!combo) return
    onChange(combo)
    setCaptureMode(false)
    setLiveCombo('')
    pressedRef.current = new Set()
  }, [onChange])

  useEffect(() => {
    if (!captureMode) return

    const updateLive = (): void => {
      setLiveCombo(orderKeys([...pressedRef.current]).join('+'))
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setCaptureMode(false)
        setLiveCombo('')
        pressedRef.current = new Set()
        return
      }
      const key = codeToKeyName(event.code)
      if (!key) return
      pressedRef.current.add(key)
      updateLive()
    }

    const onKeyUp = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      const key = codeToKeyName(event.code)
      if (key) pressedRef.current.add(key)
      const combo = orderKeys([...pressedRef.current]).join('+')
      commitCombo(combo)
    }

    const onMouseDown = (event: MouseEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      const mouseKey = event.button === 0 ? 'LMB' : event.button === 2 ? 'RMB' : event.button === 1 ? 'MMB' : null
      if (!mouseKey) return
      pressedRef.current.add(mouseKey)
      commitCombo(orderKeys([...pressedRef.current]).join('+'))
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('mousedown', onMouseDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [captureMode, commitCombo])

  return (
    <div className={`macro-key-capture${captureMode ? ' capturing' : ''}`}>
      <button
        type="button"
        className="macro-key-capture-main"
        onClick={() => {
          pressedRef.current = new Set()
          setLiveCombo('')
          setCaptureMode(true)
        }}
        aria-label={label}
      >
        <Keyboard size={14} />
        <span>{captureMode ? liveCombo || 'Pressione as teclas...' : value || 'Clique para capturar'}</span>
      </button>
      {value && !captureMode && (
        <button type="button" className="macro-key-clear" onClick={() => onChange('')} aria-label="Limpar teclas">
          <X size={12} />
        </button>
      )}
    </div>
  )
}

function MacroSummary({ macro }: { macro: MacroConfig }): React.ReactElement {
  const totalMs = macro.steps.reduce((sum, step) => {
    if (step.type === 'delay') return sum + step.delayMs
    return sum + (step.holdMs + step.delayAfterMs + macro.globalDelayMs) * Math.max(1, step.repeat)
  }, macro.startDelayMs)
  const repeatTotal = Math.max(1, macro.repeatCount)
  const totalWithRepeats = totalMs * repeatTotal + Math.max(0, repeatTotal - 1) * macro.repeatIntervalMs

  return (
    <div className="macro-summary-grid">
      <div className="macro-summary-item">
        <Timer size={15} />
        <span>{Math.round(totalWithRepeats)} ms</span>
      </div>
      <div className="macro-summary-item">
        <Repeat size={15} />
        <span>{macro.repeatCount}x</span>
      </div>
      <div className="macro-summary-item">
        <Keyboard size={15} />
        <span>{macro.trigger || 'Sem gatilho'}</span>
      </div>
    </div>
  )
}

export default function MacroPage(): React.ReactElement {
  const [macros, setMacros] = useState<MacroConfig[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [runState, setRunState] = useState<'idle' | 'running'>('idle')
  const [runMessage, setRunMessage] = useState('')

  useEffect(() => {
    window.api.readJson('macros.json').then((raw) => {
      const loaded = normalizeMacro(raw)
      setMacros(loaded)
      setSelectedId(loaded[0]?.id ?? null)
    })
  }, [])

  const selected = useMemo(
    () => macros.find((macro) => macro.id === selectedId) ?? null,
    [macros, selectedId]
  )

  const persist = useCallback((next: MacroConfig[]) => {
    setMacros(next)
    setSaveState('saving')
    void window.api.writeJson('macros.json', next).then(() => {
      setSaveState('saved')
      window.setTimeout(() => setSaveState('idle'), 1200)
    })
  }, [])

  const updateSelected = useCallback((patch: Partial<MacroConfig>) => {
    if (!selected) return
    persist(macros.map((macro) => macro.id === selected.id ? { ...macro, ...patch } : macro))
  }, [macros, persist, selected])

  const updateStep = useCallback((stepId: string, patch: Partial<MacroStep>) => {
    if (!selected) return
    updateSelected({
      steps: selected.steps.map((step) => step.id === stepId ? { ...step, ...patch } : step)
    })
  }, [selected, updateSelected])

  const createMacro = useCallback(() => {
    const macro = EMPTY_MACRO()
    const next = [macro, ...macros]
    persist(next)
    setSelectedId(macro.id)
  }, [macros, persist])

  const duplicateMacro = useCallback((macro: MacroConfig) => {
    const copy = {
      ...macro,
      id: crypto.randomUUID(),
      name: `${macro.name} copia`,
      enabled: false,
      createdAt: new Date().toISOString(),
      steps: macro.steps.map((step) => ({ ...step, id: crypto.randomUUID() }))
    }
    persist([copy, ...macros])
    setSelectedId(copy.id)
  }, [macros, persist])

  const deleteMacro = useCallback((macroId: string) => {
    const next = macros.filter((macro) => macro.id !== macroId)
    persist(next)
    if (selectedId === macroId) setSelectedId(next[0]?.id ?? null)
  }, [macros, persist, selectedId])

  const moveStep = useCallback((stepId: string, direction: -1 | 1) => {
    if (!selected) return
    const index = selected.steps.findIndex((step) => step.id === stepId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= selected.steps.length) return
    const nextSteps = [...selected.steps]
    const [step] = nextSteps.splice(index, 1)
    nextSteps.splice(target, 0, step)
    updateSelected({ steps: nextSteps })
  }, [selected, updateSelected])

  const reasonLabel = useCallback((reason?: string): string => {
    const map: Record<string, string> = {
      'unsupported-platform': 'Executor disponivel apenas no Windows.',
      'already-running': 'Ja existe uma macro em execucao.',
      'invalid-macro': 'Macro invalida ou sem passos.',
      'blocked-window': 'Execucao bloqueada nesta janela.',
      'unsupported-key': 'A macro contem uma tecla nao suportada pelo executor.',
      'spawn-error': 'Nao foi possivel iniciar o executor.',
      stopped: 'Execucao interrompida.'
    }
    return map[reason ?? ''] ?? `Executor retornou erro: ${reason ?? 'desconhecido'}`
  }, [])

  const executeSelected = useCallback(() => {
    if (!selected || runState === 'running') return
    setRunState('running')
    setRunMessage('Executando na janela em foco...')
    void window.macroApi.execute(selected).then((result) => {
      setRunState('idle')
      setRunMessage(result.success ? 'Macro executada.' : reasonLabel(result.reason))
    })
  }, [reasonLabel, runState, selected])

  const stopExecution = useCallback(() => {
    void window.macroApi.stop().then((result) => {
      setRunState('idle')
      setRunMessage(result.success ? 'Parada solicitada.' : reasonLabel(result.reason))
    })
  }, [reasonLabel])

  return (
    <div className="page-container macro-page">
      <div className="page-header macro-page-header">
        <div className="page-title-row">
          <h2 className="page-title">Macros</h2>
          <button className="btn btn-primary" type="button" onClick={createMacro}>
            <Plus size={14} />
            Nova macro
          </button>
        </div>
        <p className="page-subtitle">
          Crie sequencias com teclas, cliques, delays, repeticoes e timers. A reproducao usa somente APIs user-mode do Windows.
        </p>
      </div>

      <div className="macro-safety-banner">
        <ShieldAlert size={18} />
        <span>
          O executor envia input apenas para a janela em foco, sem driver ou kernel mode, e bloqueia janelas de jogos/anti-cheat conhecidos.
        </span>
      </div>

      <div className="macro-workspace">
        <aside className="macro-list-panel">
          <div className="macro-list-header">
            <span>Macros salvas</span>
            <span>{macros.length}</span>
          </div>
          {macros.length === 0 ? (
            <div className="macro-empty">
              <Keyboard size={38} />
              <strong>Nenhuma macro criada</strong>
              <button className="btn btn-primary btn-sm" type="button" onClick={createMacro}>
                <Plus size={13} />
                Criar primeira
              </button>
            </div>
          ) : (
            <div className="macro-list">
              {macros.map((macro) => (
                <button
                  key={macro.id}
                  type="button"
                  className={`macro-list-card${selectedId === macro.id ? ' selected' : ''}`}
                  onClick={() => setSelectedId(macro.id)}
                >
                  <span className={`macro-status-dot${macro.enabled ? ' enabled' : ''}`} />
                  <span className="macro-list-card-main">
                    <strong>{macro.name}</strong>
                    <small>{macro.trigger || 'Sem gatilho'} · {macro.steps.length} passo(s)</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="macro-editor-panel">
          {!selected ? (
            <div className="macro-empty editor-empty">
              <Keyboard size={44} />
              <strong>Selecione ou crie uma macro</strong>
            </div>
          ) : (
            <>
              <div className="macro-editor-toolbar">
                <div>
                  <span className="macro-editor-kicker">Editor</span>
                  <h3>{selected.name}</h3>
                </div>
                <div className="macro-editor-actions">
                  <span className={`macro-save-state ${saveState}`}>{saveState === 'saving' ? 'Salvando...' : saveState === 'saved' ? 'Salvo' : ''}</span>
                  <button className="btn-icon-sm" type="button" onClick={() => duplicateMacro(selected)} title="Duplicar">
                    <Copy size={14} />
                  </button>
                  <button className="btn-icon-sm btn-danger" type="button" onClick={() => deleteMacro(selected.id)} title="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="macro-form-grid">
                <label className="macro-field wide">
                  <span>Nome</span>
                  <input className="form-input" value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} />
                </label>
                <label className="macro-field wide">
                  <span>Descricao</span>
                  <input className="form-input" value={selected.description} placeholder="Ex.: rotacao de buff, sequencia de inventario..." onChange={(event) => updateSelected({ description: event.target.value })} />
                </label>
                <label className="macro-field">
                  <span>Gatilho</span>
                  <KeyCaptureInput value={selected.trigger} onChange={(trigger) => updateSelected({ trigger })} label="Capturar gatilho da macro" />
                </label>
                <label className="macro-field">
                  <span>Modo</span>
                  <select className="form-select" value={selected.mode} onChange={(event) => updateSelected({ mode: event.target.value as MacroMode })}>
                    <option value="press">Pressionar uma vez</option>
                    <option value="toggle">Liga/desliga</option>
                    <option value="hold">Enquanto segurar</option>
                  </select>
                </label>
                <label className="macro-field">
                  <span>Atraso inicial (ms)</span>
                  <input className="form-input" type="number" min={0} max={60000} value={selected.startDelayMs} onChange={(event) => updateSelected({ startDelayMs: clampNumber(Number(event.target.value), 0, 60000) })} />
                </label>
                <label className="macro-field">
                  <span>Repeticoes</span>
                  <input className="form-input" type="number" min={1} max={999} value={selected.repeatCount} onChange={(event) => updateSelected({ repeatCount: clampNumber(Number(event.target.value), 1, 999) })} />
                </label>
                <label className="macro-field">
                  <span>Intervalo entre loops (ms)</span>
                  <input className="form-input" type="number" min={0} max={60000} value={selected.repeatIntervalMs} onChange={(event) => updateSelected({ repeatIntervalMs: clampNumber(Number(event.target.value), 0, 60000) })} />
                </label>
                <label className="macro-field">
                  <span>Delay global por passo (ms)</span>
                  <input className="form-input" type="number" min={0} max={10000} value={selected.globalDelayMs} onChange={(event) => updateSelected({ globalDelayMs: clampNumber(Number(event.target.value), 0, 10000) })} />
                </label>
              </div>

              <div className="macro-quick-keys">
                <span>Teclas especiais</span>
                {[...SPECIAL_KEYS, ...COMMON_KEYS].map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="macro-key-chip"
                    onClick={() => {
                      const step = selected.steps[selected.steps.length - 1]
                      if (!step || step.type === 'delay') return
                      const parts = step.type === 'mouse' ? [step.mouseButton] : step.keys ? step.keys.split('+') : []
                      const next = orderKeys([...new Set([...parts, key])]).join('+')
                      if (step.type === 'mouse') updateStep(step.id, { type: 'keys', keys: next })
                      else updateStep(step.id, { keys: next })
                    }}
                  >
                    {key}
                  </button>
                ))}
              </div>

              <div className="macro-step-header">
                <div>
                  <span className="macro-editor-kicker">Sequencia</span>
                  <h3>Passos da macro</h3>
                </div>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => updateSelected({ steps: [...selected.steps, EMPTY_STEP()] })}>
                  <Plus size={13} />
                  Passo
                </button>
              </div>

              <div className="macro-steps">
                {selected.steps.map((step, index) => (
                  <div className="macro-step-card" key={step.id}>
                    <div className="macro-step-index">{index + 1}</div>
                    <div className="macro-step-grid">
                      <label className="macro-field">
                        <span>Tipo</span>
                        <select className="form-select" value={step.type} onChange={(event) => updateStep(step.id, { type: event.target.value as MacroStepType })}>
                          <option value="keys">Teclas</option>
                          <option value="mouse">Mouse</option>
                          <option value="delay">Delay</option>
                        </select>
                      </label>

                      {step.type === 'keys' && (
                        <label className="macro-field macro-step-action">
                          <span>Teclas do passo</span>
                          <KeyCaptureInput value={step.keys} onChange={(keys) => updateStep(step.id, { keys })} label={`Capturar teclas do passo ${index + 1}`} />
                        </label>
                      )}

                      {step.type === 'mouse' && (
                        <label className="macro-field macro-step-action">
                          <span>Botao do mouse</span>
                          <select className="form-select" value={step.mouseButton} onChange={(event) => updateStep(step.id, { mouseButton: event.target.value as MouseButton })}>
                            <option value="LMB">Botao esquerdo</option>
                            <option value="RMB">Botao direito</option>
                            <option value="MMB">Botao do meio</option>
                          </select>
                        </label>
                      )}

                      {step.type === 'delay' && (
                        <label className="macro-field macro-step-action">
                          <span>Delay (ms)</span>
                          <input className="form-input" type="number" min={1} max={60000} value={step.delayMs} onChange={(event) => updateStep(step.id, { delayMs: clampNumber(Number(event.target.value), 1, 60000) })} />
                        </label>
                      )}

                      {step.type !== 'delay' && (
                        <>
                          <label className="macro-field compact">
                            <span>Hold (ms)</span>
                            <input className="form-input" type="number" min={1} max={10000} value={step.holdMs} onChange={(event) => updateStep(step.id, { holdMs: clampNumber(Number(event.target.value), 1, 10000) })} />
                          </label>
                          <label className="macro-field compact">
                            <span>Repetir</span>
                            <input className="form-input" type="number" min={1} max={99} value={step.repeat} onChange={(event) => updateStep(step.id, { repeat: clampNumber(Number(event.target.value), 1, 99) })} />
                          </label>
                          <label className="macro-field compact">
                            <span>Delay apos (ms)</span>
                            <input className="form-input" type="number" min={0} max={60000} value={step.delayAfterMs} onChange={(event) => updateStep(step.id, { delayAfterMs: clampNumber(Number(event.target.value), 0, 60000) })} />
                          </label>
                        </>
                      )}
                    </div>
                    <div className="macro-step-actions">
                      <button className="btn-icon-sm" type="button" onClick={() => moveStep(step.id, -1)} disabled={index === 0} title="Mover para cima">
                        <ArrowUp size={14} />
                      </button>
                      <button className="btn-icon-sm" type="button" onClick={() => moveStep(step.id, 1)} disabled={index === selected.steps.length - 1} title="Mover para baixo">
                        <ArrowDown size={14} />
                      </button>
                      <button className="btn-icon-sm btn-danger" type="button" onClick={() => updateSelected({ steps: selected.steps.filter((item) => item.id !== step.id) || [EMPTY_STEP()] })} disabled={selected.steps.length === 1} title="Remover passo">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="macro-preview-panel">
                <div className="macro-preview-header">
                  <span><Play size={14} /> Previa</span>
                  <MacroSummary macro={selected} />
                </div>
                <div className="macro-timeline">
                  {selected.startDelayMs > 0 && (
                    <span className="macro-timeline-token delay"><Clock size={12} /> {selected.startDelayMs}ms</span>
                  )}
                  {selected.steps.map((step) => (
                    <span key={step.id} className={`macro-timeline-token ${step.type}`}>
                      {step.type === 'delay' ? <Pause size={12} /> : step.type === 'mouse' ? <MousePointer size={12} /> : <Keyboard size={12} />}
                      {step.type === 'delay' ? `${step.delayMs}ms` : step.type === 'mouse' ? `${step.mouseButton} (${step.holdMs}ms)` : `${step.keys || 'teclas'} (${step.holdMs}ms)`}
                    </span>
                  ))}
                </div>
              </div>

              <div className="macro-enable-row">
                <label className="macro-toggle-label">
                  <input type="checkbox" checked={selected.enabled} onChange={(event) => updateSelected({ enabled: event.target.checked })} />
                  <span>{selected.enabled ? 'Macro marcada como ativa' : 'Macro inativa'}</span>
                </label>
                <div className="macro-run-actions">
                  {runMessage && <span className={`macro-run-message ${runState}`}>{runMessage}</span>}
                  {runState === 'running' ? (
                    <button className="btn btn-danger btn-sm" type="button" onClick={stopExecution}>
                      <Pause size={13} />
                      Parar
                    </button>
                  ) : (
                    <button className="btn btn-primary btn-sm" type="button" onClick={executeSelected}>
                      <Play size={13} />
                      Executar
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
