import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Target, Plus, Pencil, Trash2, Coins, X, CheckCircle2, Mountain, BarChart2 } from 'lucide-react'
import { useDevMode } from '../context/DevModeContext'
import { MOCK_ITEMS, MOCK_LOCATIONS, MOCK_SESSIONS } from '../context/DevModeContext'
import type { Item } from '../pages/ItemRegistrationPage'
import type { FarmLocation } from '../pages/FarmLocationPage'
import type { FarmSession } from '../pages/FarmSessionPage'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GoalContribution {
  id:               string
  amount:           number
  linkedSessionIds: string[]
  addedAt:          string // ISO
}

export interface FarmGoal {
  id:            string
  name:          string
  targetAmount:  number
  currentAmount: number
  targetDate:    string // YYYY-MM-DD
  createdAt:     string // ISO
  contributions?: GoalContribution[]
}

type DialogMode = 'create' | 'edit' | 'contribute' | 'stats' | null

interface GoalDialogState {
  mode:    DialogMode
  goalId:  string | null
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_GOALS: FarmGoal[] = [
  {
    id:            'mock-1',
    name:          'Comprar Laila\'s Petal',
    targetAmount:  500_000_000,
    currentAmount: 210_000_000,
    targetDate:    '2026-06-30',
    createdAt:     '2026-05-01T12:00:00.000Z',
    contributions: [
      { id: 'mc-1', amount: 210_000_000, linkedSessionIds: ['mock_sess_1', 'mock_sess_2'], addedAt: '2026-05-01T12:00:00.000Z' }
    ]
  },
  {
    id:            'mock-2',
    name:          'Meta #2',
    targetAmount:  1_000_000_000,
    currentAmount: 0,
    targetDate:    '2026-12-31',
    createdAt:     '2026-05-05T08:00:00.000Z',
    contributions: []
  }
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomId(): string {
  return `goal-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function daysLeft(targetDate: string): number | null {
  if (!targetDate) return null
  const today  = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${targetDate}T00:00:00`)
  const diff   = Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
  return diff
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val))
}

function sessionTotal(session: FarmSession, itemMap: Map<string, Item>): number {
  let sum = 0
  for (const e of session.loot) {
    const item = itemMap.get(e.itemId)
    if (!item) continue
    const qty = Math.max(0, e.qtyAfter - e.qtyBefore)
    sum += qty * (e.priceSnapshot ?? item.price)
  }
  return sum
}

function formatDateTime(iso: string): string {
  if (!iso) return '—'
  const d   = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const mon = String(d.getMonth() + 1).padStart(2, '0')
  const yr  = d.getFullYear()
  const hr  = String(d.getHours()).padStart(2, '0')
  const mn  = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${mon}/${yr} às ${hr}:${mn}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ProgressBarProps {
  pct: number // 0–100
}

function ProgressBar({ pct }: ProgressBarProps): React.ReactElement {
  const clamped = clamp(pct, 0, 100)
  const done    = clamped >= 100
  return (
    <div className="fgoal-progress-track" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`fgoal-progress-fill${done ? ' fgoal-progress-fill--done' : ''}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

interface GoalCardProps {
  goal:        FarmGoal
  onEdit:      (goal: FarmGoal) => void
  onDelete:    (goal: FarmGoal) => void
  onContribute:(goal: FarmGoal) => void
  onStats:     (goal: FarmGoal) => void
}

function GoalCard({ goal, onEdit, onDelete, onContribute, onStats }: GoalCardProps): React.ReactElement {
  const pct       = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
  const remaining = goal.targetAmount - goal.currentAmount
  const days      = daysLeft(goal.targetDate)
  const done      = pct >= 100

  let daysLabel = ''
  if (days === null)      daysLabel = ''
  else if (days < 0)      daysLabel = `${Math.abs(days)} dia${Math.abs(days) !== 1 ? 's' : ''} atrasado`
  else if (days === 0)    daysLabel = 'Vence hoje'
  else                    daysLabel = `${days} dia${days !== 1 ? 's' : ''} restante${days !== 1 ? 's' : ''}`

  return (
    <div className={`fgoal-card${done ? ' fgoal-card--done' : ''}`}>
      {/* Header */}
      <div className="fgoal-card-header">
        <div className="fgoal-card-title-row">
          {done
            ? <CheckCircle2 size={15} className="fgoal-done-icon" aria-hidden="true" />
            : <Target size={15} className="fgoal-target-icon" aria-hidden="true" />
          }
          <span className="fgoal-card-name">{goal.name}</span>
        </div>
        <div className="fgoal-card-actions">
          <button
            className="btn btn-sm btn-secondary fgoal-action-btn"
            onClick={() => onContribute(goal)}
            disabled={done}
            title="Adicionar prata"
            aria-label="Adicionar prata à meta"
          >
            <Coins size={13} />
            Adicionar
          </button>
          <button
            className="btn btn-sm btn-secondary fgoal-action-btn"
            onClick={() => onStats(goal)}
            title="Estatísticas de sessões vinculadas"
            aria-label="Estatísticas da meta"
          >
            <BarChart2 size={13} />
            Estatísticas
          </button>
          <button
            className="btn btn-sm btn-secondary fgoal-action-btn"
            onClick={() => onEdit(goal)}
            title="Editar meta"
            aria-label="Editar meta"
          >
            <Pencil size={12} />
          </button>
          <button
            className="btn btn-sm btn-secondary fgoal-action-btn fgoal-delete-btn"
            onClick={() => onDelete(goal)}
            title="Excluir meta"
            aria-label="Excluir meta"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar pct={pct} />

      {/* Amounts row */}
      <div className="fgoal-amounts-row">
        <div className="fgoal-amounts-left">
          <span className="fgoal-current">{goal.currentAmount.toLocaleString('pt-BR')}</span>
          <span className="fgoal-sep"> / </span>
          <span className="fgoal-target">{goal.targetAmount.toLocaleString('pt-BR')}</span>
          <span className="fgoal-prata"> prata</span>
        </div>
        <div className="fgoal-amounts-right">
          <span className="fgoal-pct">{Math.min(100, Math.round(pct))}%</span>
        </div>
      </div>

      {/* Date + remaining */}
      <div className="fgoal-meta-row">
        <span className="fgoal-meta-dates">
          Hoje: <strong>{formatDate(new Date().toISOString().slice(0, 10))}</strong>
          <span className="fgoal-date-sep">·</span>
          Limite: <strong>{formatDate(goal.targetDate)}</strong>
          {daysLabel && (
            <>
              <span className="fgoal-date-sep">·</span>
              <span className={days !== null && days < 0 ? 'fgoal-overdue' : ''}>{daysLabel}</span>
            </>
          )}
        </span>
        {!done && remaining > 0 && (
          <span className="fgoal-remaining">
            Faltam <strong>{remaining.toLocaleString('pt-BR')}</strong> prata
          </span>
        )}
        {done && (
          <span className="fgoal-done-label">Meta concluída!</span>
        )}
      </div>
    </div>
  )
}

// ── Goal Stats Dialog ────────────────────────────────────────────────────────

interface GoalStatsDialogProps {
  goal:            FarmGoal
  sessions:        FarmSession[]
  locations:       FarmLocation[]
  items:           Item[]
  imageCache:      Record<string, string>
  onRemoveSession: (sessionId: string) => void
  onClose:         () => void
}

function GoalStatsDialog({ goal, sessions, locations, items, imageCache, onRemoveSession, onClose }: GoalStatsDialogProps): React.ReactElement {
  const itemMap     = useMemo(() => new Map(items.map(i    => [i.id,    i])), [items])
  const locationMap = useMemo(() => new Map(locations.map(l => [l.id,   l])), [locations])
  const sessionMap  = useMemo(() => new Map(sessions.map(s  => [s.id,   s])), [sessions])

  // Collect all uniquely linked session IDs from contributions
  const linkedEntries = useMemo(() => {
    const seen   = new Set<string>()
    const result: Array<{ session: FarmSession; contribution: GoalContribution; total: number }> = []
    for (const contrib of (goal.contributions ?? [])) {
      for (const sid of contrib.linkedSessionIds) {
        if (seen.has(sid)) continue
        seen.add(sid)
        const sess = sessionMap.get(sid)
        if (!sess) continue
        result.push({ session: sess, contribution: contrib, total: sessionTotal(sess, itemMap) })
      }
    }
    return result.sort((a, b) => new Date(b.session.createdAt).getTime() - new Date(a.session.createdAt).getTime())
  }, [goal.contributions, sessionMap, itemMap])

  const grandTotal = useMemo(() =>
    linkedEntries.reduce((sum, e) => sum + e.total, 0),
    [linkedEntries]
  )

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Estatísticas da meta">
      <div className="modal-box fgoal-dialog-box fgoal-dialog-box--wide">
        <div className="modal-header">
          <span className="modal-title">
            <BarChart2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} aria-hidden="true" />
            Sessões Vinculadas · {goal.name}
          </span>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <div className="modal-body">
          {linkedEntries.length === 0 ? (
            <div className="fgoal-stats-empty">
              <Mountain size={26} className="fgoal-empty-icon" aria-hidden="true" />
              <p className="fgoal-empty-text">Nenhuma sessão vinculada a esta meta ainda.</p>
              <p className="fgoal-empty-hint">Ao adicionar prata, selecione uma ou mais sessões para vinculá-las.</p>
            </div>
          ) : (
            <>
              {/* Summary bar */}
              <div className="fgoal-stats-summary">
                <div className="fgoal-stats-summary-item">
                  <span className="fgoal-stats-summary-label">Sessões vinculadas</span>
                  <span className="fgoal-stats-summary-value">{linkedEntries.length}</span>
                </div>
                <div className="fgoal-stats-summary-sep" aria-hidden="true" />
                <div className="fgoal-stats-summary-item">
                  <span className="fgoal-stats-summary-label">Total gerado nas sessões</span>
                  <span className="fgoal-stats-summary-value fgoal-stats-summary-value--gold">
                    {grandTotal.toLocaleString('pt-BR')} prata
                  </span>
                </div>
              </div>

              {/* Session list */}
              <ul className="fgoal-stats-list" aria-label="Sessões vinculadas">
                {linkedEntries.map(({ session, total }) => {
                  const loc = locationMap.get(session.locationId) ?? null
                  return (
                    <li key={session.id} className="fgoal-stats-row">
                      <div className="fgoal-stats-loc-icon">
                        {loc?.imageFile && imageCache[loc.imageFile]
                          ? <img src={imageCache[loc.imageFile]} alt="" draggable={false} />
                          : <Mountain size={16} aria-hidden="true" />
                        }
                      </div>
                      <div className="fgoal-stats-info">
                        <span className="fgoal-stats-loc-name">
                          {loc?.name ?? 'Local desconhecido'}
                        </span>
                        <span className="fgoal-stats-meta">
                          {formatDateTime(session.createdAt)}
                          {session.duration ? ` · ${session.duration}` : ''}
                        </span>
                      </div>
                      <div className="fgoal-stats-total">
                        {total.toLocaleString('pt-BR')}
                        <span className="fgoal-sess-prata"> prata</span>
                      </div>
                      <button
                        className="fgoal-stats-remove-btn"
                        onClick={() => onRemoveSession(session.id)}
                        title="Remover sessão da meta"
                        aria-label="Remover sessão vinculada"
                        type="button"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Goal Dialog ───────────────────────────────────────────────────────────────

interface GoalDialogProps {
  mode:      'create' | 'edit'
  initial:   Partial<FarmGoal>
  goalCount: number
  onSave:    (data: { name: string; targetAmount: number; targetDate: string }) => void
  onClose:   () => void
}

function GoalDialog({ mode, initial, goalCount, onSave, onClose }: GoalDialogProps): React.ReactElement {
  const defaultName  = initial.name  ?? `Meta #${goalCount + 1}`
  const [name,       setName]       = useState(defaultName)
  const [amount,     setAmount]     = useState(initial.targetAmount  ? String(initial.targetAmount)  : '')
  const [targetDate, setTargetDate] = useState(initial.targetDate    ?? '')
  const [error,      setError]      = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    const parsed = Number(amount.replace(/\D/g, ''))
    if (!parsed || parsed <= 0) {
      setError('Informe um valor válido maior que zero.')
      return
    }
    if (!targetDate) {
      setError('Informe a data alvo.')
      return
    }
    setError(null)
    onSave({
      name:         name.trim() || defaultName,
      targetAmount: parsed,
      targetDate
    })
  }

  function handleAmountChange(raw: string): void {
    // Only allow digits
    const digits = raw.replace(/\D/g, '')
    setAmount(digits)
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={mode === 'create' ? 'Criar meta de farm' : 'Editar meta de farm'}>
      <div className="modal-box fgoal-dialog-box">
        <div className="modal-header">
          <span className="modal-title">
            {mode === 'create' ? 'Nova Meta de Farm' : 'Editar Meta'}
          </span>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit} id="fgoal-form">
            <div className="fgoal-dialog-fields">
              {/* Name */}
              <div className="form-field">
                <label className="form-label" htmlFor="fgoal-name">
                  Nome <span className="fgoal-optional">(opcional)</span>
                </label>
                <input
                  id="fgoal-name"
                  className="form-input"
                  type="text"
                  placeholder={`Meta #${goalCount + 1}`}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={60}
                  autoComplete="off"
                />
              </div>

              {/* Target Amount */}
              <div className="form-field">
                <label className="form-label" htmlFor="fgoal-amount">
                  Valor alvo <span className="fgoal-required">*</span>
                </label>
                <div className="fgoal-amount-wrap">
                  <Coins size={15} className="fgoal-amount-icon" aria-hidden="true" />
                  <input
                    id="fgoal-amount"
                    className="form-input fgoal-amount-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="Ex: 500000000"
                    value={amount ? Number(amount).toLocaleString('pt-BR') : ''}
                    onChange={e => handleAmountChange(e.target.value.replace(/\./g, ''))}
                    autoComplete="off"
                  />
                  <span className="fgoal-amount-suffix">prata</span>
                </div>
              </div>

              {/* Target Date */}
              <div className="form-field">
                <label className="form-label" htmlFor="fgoal-date">
                  Data alvo <span className="fgoal-required">*</span>
                </label>
                <input
                  id="fgoal-date"
                  className="form-input"
                  type="date"
                  min={today}
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="form-error fgoal-dialog-error">{error}</p>}

            <div className="form-actions fgoal-dialog-actions">
              <button type="submit" className="btn btn-primary">
                {mode === 'create' ? <><Plus size={14} /> Criar Meta</> : <><Pencil size={14} /> Salvar</>}
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Contribute Dialog ─────────────────────────────────────────────────────────

interface ContributeDialogProps {
  goal:       FarmGoal
  sessions:   FarmSession[]
  locations:  FarmLocation[]
  items:      Item[]
  imageCache: Record<string, string>
  onSave:     (amount: number, linkedSessionIds: string[]) => void
  onClose:    () => void
}

function ContributeDialog({ goal, sessions, locations, items, imageCache, onSave, onClose }: ContributeDialogProps): React.ReactElement {
  const [amount,           setAmount]           = useState('')
  const [error,            setError]            = useState<string | null>(null)
  const [linkedSessionIds, setLinkedSessionIds] = useState<string[]>([])

  const itemMap     = useMemo(() => new Map(items.map(i    => [i.id, i])),    [items])
  const locationMap = useMemo(() => new Map(locations.map(l => [l.id, l])), [locations])

  const sortedSessions = useMemo(() =>
    [...sessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [sessions]
  )

  const alreadyLinkedIds = useMemo(() =>
    new Set((goal.contributions ?? []).flatMap(c => c.linkedSessionIds)),
    [goal.contributions]
  )

  const selectedTotal = useMemo(() =>
    linkedSessionIds.reduce((sum, id) => {
      const sess = sessions.find(s => s.id === id)
      return sess ? sum + sessionTotal(sess, itemMap) : sum
    }, 0),
    [linkedSessionIds, sessions, itemMap]
  )

  function toggleSession(id: string): void {
    setLinkedSessionIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  function fillFromSessions(): void {
    setAmount(String(Math.round(selectedTotal)))
  }

  function handleAmountChange(raw: string): void {
    setAmount(raw.replace(/\./g, '').replace(/\D/g, ''))
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    const parsed = Number(amount)
    if (!parsed || parsed <= 0) {
      setError('Informe um valor válido maior que zero.')
      return
    }
    setError(null)
    onSave(parsed, linkedSessionIds)
  }

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Adicionar prata à meta">
      <div className="modal-box fgoal-dialog-box fgoal-dialog-box--wide">
        <div className="modal-header">
          <span className="modal-title">Adicionar Prata · {goal.name}</span>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <div className="modal-body">
          {/* Progress info */}
          <div className="fgoal-contribute-info">
            <span className="fgoal-contribute-stat">
              Progresso: <strong>{goal.currentAmount.toLocaleString('pt-BR')}</strong> prata
            </span>
            <span className="fgoal-contribute-stat">
              Meta: <strong>{goal.targetAmount.toLocaleString('pt-BR')}</strong> prata
            </span>
            {remaining > 0 && (
              <span className="fgoal-contribute-stat fgoal-contribute-remaining">
                Faltam: <strong>{remaining.toLocaleString('pt-BR')}</strong> prata
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Session picker */}
            <div className="fgoal-sess-picker">
              <div className="fgoal-sess-picker-label">
                Vincular a sessões <span className="fgoal-optional">(opcional)</span>
              </div>
              {sortedSessions.length === 0 ? (
                <div className="fgoal-sess-picker-empty">
                  Nenhuma sessão cadastrada. Insira o valor manualmente abaixo.
                </div>
              ) : (
                <>
                  <div className="fgoal-sess-list">
                    {sortedSessions.map(sess => {
                      const loc     = locationMap.get(sess.locationId) ?? null
                      const total   = sessionTotal(sess, itemMap)
                      const checked = linkedSessionIds.includes(sess.id)
                      const linked  = alreadyLinkedIds.has(sess.id)
                      return (
                        <label
                          key={sess.id}
                          className={`fgoal-sess-row${checked ? ' fgoal-sess-row--checked' : ''}`}
                        >
                          <input
                            type="checkbox"
                            className="fgoal-sess-checkbox"
                            checked={checked}
                            onChange={() => toggleSession(sess.id)}
                          />
                          <div className="fgoal-sess-loc-icon">
                            {loc?.imageFile && imageCache[loc.imageFile]
                              ? <img src={imageCache[loc.imageFile]} alt="" draggable={false} />
                              : <Mountain size={14} aria-hidden="true" />
                            }
                          </div>
                          <div className="fgoal-sess-info">
                            <span className="fgoal-sess-loc-name">
                              {loc?.name ?? 'Local desconhecido'}
                              {linked && !checked && (
                                <span className="fgoal-sess-linked-badge">já vinculada</span>
                              )}
                            </span>
                            <span className="fgoal-sess-meta">
                              {formatDateTime(sess.createdAt)}
                              {sess.duration ? ` · ${sess.duration}` : ''}
                            </span>
                          </div>
                          <div className="fgoal-sess-total">
                            {total.toLocaleString('pt-BR')}
                            <span className="fgoal-sess-prata"> prata</span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  {linkedSessionIds.length > 0 && (
                    <div className="fgoal-sess-summary">
                      <span className="fgoal-sess-summary-text">
                        {linkedSessionIds.length} sessão{linkedSessionIds.length !== 1 ? 'ões' : ''} selecionada{linkedSessionIds.length !== 1 ? 's' : ''}
                        <span className="fgoal-date-sep">·</span>
                        Total: <strong>{Math.round(selectedTotal).toLocaleString('pt-BR')} prata</strong>
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={fillFromSessions}
                      >
                        Usar este valor
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Amount field */}
            <div className="form-field" style={{ marginTop: '14px' }}>
              <label className="form-label" htmlFor="fgoal-contribute-amount">
                Prata a adicionar <span className="fgoal-required">*</span>
              </label>
              <div className="fgoal-amount-wrap">
                <Coins size={15} className="fgoal-amount-icon" aria-hidden="true" />
                <input
                  id="fgoal-contribute-amount"
                  className="form-input fgoal-amount-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 50000000"
                  value={amount ? Number(amount).toLocaleString('pt-BR') : ''}
                  onChange={e => handleAmountChange(e.target.value)}
                  autoComplete="off"
                />
                <span className="fgoal-amount-suffix">prata</span>
              </div>
            </div>
            {error && <p className="form-error fgoal-dialog-error">{error}</p>}
            <div className="form-actions fgoal-dialog-actions">
              <button type="submit" className="btn btn-primary">
                <Coins size={14} /> Adicionar
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Confirm Delete Dialog ─────────────────────────────────────────────────────

interface ConfirmDeleteProps {
  goal:     FarmGoal
  onDelete: () => void
  onClose:  () => void
}

function ConfirmDeleteDialog({ goal, onDelete, onClose }: ConfirmDeleteProps): React.ReactElement {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirmar exclusão">
      <div className="modal-box confirm-box">
        <p className="confirm-message">
          Excluir a meta <strong>"{goal.name}"</strong>?<br />
          <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Esta ação não pode ser desfeita.</span>
        </p>
        <div className="confirm-actions">
          <button className="btn btn-primary fgoal-delete-confirm-btn" onClick={onDelete}>
            <Trash2 size={14} /> Excluir
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FarmGoalSection(): React.ReactElement {
  const { devMode } = useDevMode()
  const [goals,      setGoals]      = useState<FarmGoal[]>([])
  const [sessions,   setSessions]   = useState<FarmSession[]>([])
  const [locations,  setLocations]  = useState<FarmLocation[]>([])
  const [items,      setItems]      = useState<Item[]>([])
  const [imageCache, setImageCache] = useState<Record<string, string>>({})
  const [loaded,     setLoaded]     = useState(false)
  const [dialog,     setDialog]     = useState<GoalDialogState>({ mode: null, goalId: null })
  const [deleteGoal, setDeleteGoal] = useState<FarmGoal | null>(null)

  // ── Persistence ──────────────────────────────────────────────────────────

  const saveGoals = useCallback(async (next: FarmGoal[]): Promise<void> => {
    setGoals(next)
    if (!devMode) {
      await window.api.writeJson('goals.json', next)
    }
  }, [devMode])

  useEffect(() => {
    async function load(): Promise<void> {
      if (devMode) {
        setGoals(MOCK_GOALS)
        setSessions(MOCK_SESSIONS)
        setLocations(MOCK_LOCATIONS)
        setItems(MOCK_ITEMS)
        setLoaded(true)
        return
      }
      const [goalsData, sessData, locData, itemData] = await Promise.all([
        window.api.readJson('goals.json')     as Promise<FarmGoal[]     | null>,
        window.api.readJson('sessions.json')  as Promise<FarmSession[]  | null>,
        window.api.readJson('locations.json') as Promise<FarmLocation[] | null>,
        window.api.readJson('items.json')     as Promise<Item[]         | null>,
      ])
      const goalsArr = Array.isArray(goalsData) ? goalsData : []
      const sessArr  = Array.isArray(sessData)  ? sessData  : []
      const locArr   = Array.isArray(locData)   ? locData   : []
      const itemArr  = Array.isArray(itemData)  ? itemData  : []
      setGoals(goalsArr)
      setSessions(sessArr)
      setLocations(locArr)
      setItems(itemArr)
      const cache: Record<string, string> = {}
      for (const loc of locArr) {
        if (loc.imageFile && !cache[loc.imageFile]) {
          const url = await window.api.getImageDataUrl(loc.imageFile)
          if (url) cache[loc.imageFile] = url
        }
      }
      setImageCache(cache)
      setLoaded(true)
    }
    load()
  }, [devMode])

  // ── Actions ───────────────────────────────────────────────────────────────

  function openCreate(): void  { setDialog({ mode: 'create',     goalId: null }) }
  function openEdit(g: FarmGoal): void { setDialog({ mode: 'edit', goalId: g.id }) }
  function openContribute(g: FarmGoal): void { setDialog({ mode: 'contribute', goalId: g.id }) }
  function openStats(g: FarmGoal): void      { setDialog({ mode: 'stats',      goalId: g.id }) }
  function closeDialog(): void { setDialog({ mode: null, goalId: null }) }

  function handleSaveGoal(data: { name: string; targetAmount: number; targetDate: string }): void {
    if (dialog.mode === 'create') {
      const next: FarmGoal = {
        id:            randomId(),
        name:          data.name,
        targetAmount:  data.targetAmount,
        currentAmount: 0,
        targetDate:    data.targetDate,
        createdAt:     new Date().toISOString(),
        contributions: []
      }
      saveGoals([...goals, next])
    } else if (dialog.mode === 'edit' && dialog.goalId) {
      const next = goals.map(g =>
        g.id === dialog.goalId
          ? { ...g, name: data.name, targetAmount: data.targetAmount, targetDate: data.targetDate }
          : g
      )
      saveGoals(next)
    }
    closeDialog()
  }

  function handleContribute(addAmount: number, linkedSessionIds: string[]): void {
    if (!dialog.goalId) return
    const contribution: GoalContribution = {
      id:               randomId(),
      amount:           addAmount,
      linkedSessionIds,
      addedAt:          new Date().toISOString()
    }
    const next = goals.map(g =>
      g.id === dialog.goalId
        ? {
            ...g,
            currentAmount: g.currentAmount + addAmount,
            contributions: [...(g.contributions ?? []), contribution]
          }
        : g
    )
    saveGoals(next)
    closeDialog()
  }

  function handleDelete(): void {
    if (!deleteGoal) return
    saveGoals(goals.filter(g => g.id !== deleteGoal.id))
    setDeleteGoal(null)
  }

  function handleRemoveSession(goalId: string, sessionId: string): void {
    const sess      = sessions.find(s => s.id === sessionId)
    const itemMap   = new Map(items.map(i => [i.id, i]))
    const sessValue = sess ? sessionTotal(sess, itemMap) : 0
    const next = goals.map(g => {
      if (g.id !== goalId) return g
      const updatedContributions = (g.contributions ?? []).map(c => ({
        ...c,
        linkedSessionIds: c.linkedSessionIds.filter(id => id !== sessionId)
      }))
      return {
        ...g,
        currentAmount: Math.max(0, g.currentAmount - sessValue),
        contributions: updatedContributions
      }
    })
    saveGoals(next)
  }

  const editingGoal     = dialog.goalId ? goals.find(g => g.id === dialog.goalId) ?? null : null
  const contributeGoal  = dialog.mode === 'contribute' && editingGoal ? editingGoal : null
  const statsGoal       = dialog.mode === 'stats'      && editingGoal ? editingGoal : null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="fgoal-section" aria-label="Metas de Farm">
      {/* Section heading */}
      <div className="fgoal-heading-row">
        <div className="fgoal-heading">
          <Target size={18} className="fgoal-heading-icon" aria-hidden="true" />
          Metas de Farm
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={openCreate}
          aria-label="Criar nova meta de farm"
        >
          <Plus size={14} /> Criar Meta
        </button>
      </div>

      {/* Content */}
      {!loaded ? (
        <p className="loading-text">Carregando metas…</p>
      ) : goals.length === 0 ? (
        <div className="fgoal-empty">
          <X size={28} className="fgoal-empty-icon" aria-hidden="true" />
          <p className="fgoal-empty-text">Nenhuma meta estabelecida</p>
          <p className="fgoal-empty-hint">Crie uma meta para acompanhar seu progresso de prata.</p>
        </div>
      ) : (
        <ul className="fgoal-list" aria-label="Lista de metas de farm">
          {goals.map(goal => (
            <li key={goal.id}>
              <GoalCard
                goal={goal}
                onEdit={openEdit}
                onDelete={setDeleteGoal}
                onContribute={openContribute}
                onStats={openStats}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Dialogs */}
      {(dialog.mode === 'create' || dialog.mode === 'edit') && (
        <GoalDialog
          mode={dialog.mode}
          initial={editingGoal ?? {}}
          goalCount={goals.length}
          onSave={handleSaveGoal}
          onClose={closeDialog}
        />
      )}

      {dialog.mode === 'contribute' && contributeGoal && (
        <ContributeDialog
          goal={contributeGoal}
          sessions={sessions}
          locations={locations}
          items={items}
          imageCache={imageCache}
          onSave={handleContribute}
          onClose={closeDialog}
        />
      )}

      {deleteGoal && (
        <ConfirmDeleteDialog
          goal={deleteGoal}
          onDelete={handleDelete}
          onClose={() => setDeleteGoal(null)}
        />
      )}

      {dialog.mode === 'stats' && statsGoal && (
        <GoalStatsDialog
          goal={statsGoal}
          sessions={sessions}
          locations={locations}
          items={items}
          imageCache={imageCache}
          onRemoveSession={(sessionId) => handleRemoveSession(statsGoal.id, sessionId)}
          onClose={closeDialog}
        />
      )}
    </section>
  )
}
