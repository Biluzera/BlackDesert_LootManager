import React, { useState, useEffect, useMemo } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { Item } from './ItemRegistrationPage'
import type { FarmLocation } from './FarmLocationPage'
import { useDevMode } from '../context/DevModeContext'
import { MOCK_ITEMS, MOCK_LOCATIONS, MOCK_SESSIONS } from '../context/DevModeContext'
import { useMarket } from '../context/MarketContext'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SessionLootEntry {
  itemId: string
  qty: number           // for normal items
  qtyBefore: number     // previous quantity before session
  qtyAfter: number      // final quantity after session
  priceSnapshot?: number // price per unit at time of recording
}

export interface FarmSession {
  id: string
  locationId: string
  date: string           // ISO date string (date only, no time)
  duration: string       // formatted string for display, e.g. "2h 30min"
  durationMinutes: number // total minutes (0 = not set)
  notes: string
  loot: SessionLootEntry[]
  createdAt: string
}

// ── Confirmation dialog ───────────────────────────────────────────────────────

interface ConfirmDialogProps {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps): React.ReactElement {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-box confirm-box">
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="btn btn-primary" onClick={onConfirm}>Confirmar</button>
          <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ── Session form modal ────────────────────────────────────────────────────────

interface SessionFormProps {
  session: FarmSession | null            // null = new session
  locations: FarmLocation[]
  allItems: Item[]
  imageCache: Record<string, string>
  onSave: (s: FarmSession) => void
  onCancel: () => void
}

function SessionFormModal({
  session,
  locations,
  allItems,
  imageCache,
  onSave,
  onCancel
}: SessionFormProps): React.ReactElement {
  const isNew = session === null
  const { getEffectivePrice } = useMarket()

  const defaultLocationId = session?.locationId ?? (locations[0]?.id ?? '')

  const [locationId, setLocationId] = useState(defaultLocationId)
  const [date, setDate]             = useState(session?.date ?? new Date().toISOString().slice(0, 10))
  const [notes, setNotes]           = useState(session?.notes ?? '')

  // Duration: hours + minutes inputs
  const initMins = session?.durationMinutes ?? 0
  const [durHours, setDurHours] = useState(String(Math.floor(initMins / 60)))
  const [durMins,  setDurMins]  = useState(String(initMins % 60))

  const durationMinutes = (parseInt(durHours, 10) || 0) * 60 + (parseInt(durMins, 10) || 0)
  const durationDisplay = (() => {
    const h = parseInt(durHours, 10) || 0
    const m = parseInt(durMins,  10) || 0
    if (h === 0 && m === 0) return ''
    if (h === 0) return `${m}min`
    if (m === 0) return `${h}h`
    return `${h}h ${m}min`
  })()

  // Loot entries: keyed by itemId
  const [lootMap, setLootMap] = useState<Record<string, SessionLootEntry>>(() => {
    const map: Record<string, SessionLootEntry> = {}
    if (session) {
      for (const e of session.loot) map[e.itemId] = { ...e }
    }
    return map
  })

  // Reset loot when location changes (only when creating new)
  const prevLocationId = React.useRef(locationId)
  useEffect(() => {
    if (isNew && locationId !== prevLocationId.current) {
      setLootMap({})
      prevLocationId.current = locationId
    }
  }, [locationId, isNew])

  const location     = locations.find(l => l.id === locationId)
  const locationItems = (location?.lootIds ?? [])
    .map(id => allItems.find(i => i.id === id))
    .filter((i): i is Item => i !== undefined)

  function getEntry(itemId: string): SessionLootEntry {
    return lootMap[itemId] ?? { itemId, qty: 0, qtyBefore: 0, qtyAfter: 0 }
  }

  function setField(itemId: string, field: keyof SessionLootEntry, raw: string): void {
    const val = Math.max(0, parseInt(raw, 10) || 0)
    setLootMap(prev => ({
      ...prev,
      [itemId]: { ...getEntry(itemId), [field]: val }
    }))
  }

  // Running total (using effective price from market or manual)
  const total = useMemo(() => {
    let sum = 0
    for (const item of locationItems) {
      const e = getEntry(item.id)
      const qty = Math.max(0, e.qtyAfter - e.qtyBefore)
      const { price } = getEffectivePrice(item)
      sum += qty * price
    }
    return sum
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lootMap, locationItems, getEffectivePrice])

  const silverPerHour = durationMinutes > 0 ? Math.round(total / (durationMinutes / 60)) : null

  function handleSave(): void {
    const loot = locationItems.map(item => {
      const entry = getEntry(item.id)
      const { price } = getEffectivePrice(item)
      return { ...entry, priceSnapshot: price }
    })
    const now  = new Date().toISOString()
    const saved: FarmSession = session
      ? { ...session, locationId, date, duration: durationDisplay, durationMinutes, notes, loot }
      : { id: `session_${Date.now()}`, locationId, date, duration: durationDisplay, durationMinutes, notes, loot, createdAt: now }
    onSave(saved)
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={isNew ? 'Nova sessão' : 'Editar sessão'}>
      <div className="modal-box session-modal">

        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">{isNew ? '📜 Nova Sessão de Farm' : '✏️ Editar Sessão'}</span>
          <button className="modal-close" aria-label="Fechar" onClick={onCancel}>✕</button>
        </div>

        <div className="modal-body">

          {/* ── Meta row ── */}
          <div className="session-meta-row">
            {/* Location */}
            <div className="form-field">
              <label className="form-label" htmlFor="sess-loc">Local de Farm <span className="required-mark">*</span></label>
              <select
                id="sess-loc"
                className="form-input form-select"
                value={locationId}
                onChange={e => setLocationId(e.target.value)}
              >
                {locations.length === 0
                  ? <option value="">Nenhum local cadastrado</option>
                  : locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))
                }
              </select>
            </div>

            {/* Date */}
            <div className="form-field">
              <label className="form-label" htmlFor="sess-date">Data</label>
              <input
                id="sess-date"
                className="form-input"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>

            {/* Duration */}
            <div className="form-field">
              <label className="form-label">Duração</label>
              <div className="duration-inputs">
                <input
                  className="form-input duration-input"
                  type="number"
                  min="0"
                  max="23"
                  value={durHours}
                  onChange={e => setDurHours(e.target.value)}
                  placeholder="0"
                  aria-label="Horas"
                />
                <span className="duration-sep">h</span>
                <input
                  className="form-input duration-input"
                  type="number"
                  min="0"
                  max="59"
                  value={durMins}
                  onChange={e => setDurMins(e.target.value)}
                  placeholder="0"
                  aria-label="Minutos"
                />
                <span className="duration-sep">min</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="form-field" style={{ marginBottom: '18px' }}>
            <label className="form-label" htmlFor="sess-notes">Observações</label>
            <textarea
              id="sess-notes"
              className="form-input form-textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anotações sobre a sessão…"
              rows={2}
              maxLength={500}
            />
          </div>

          {/* ── Loot table ── */}
          <div className="loot-table-wrap">
            <div className="loot-table-heading">
              <span>Itens da Sessão</span>
              {location && (
                <span className="loot-table-loc">📍 {location.name}</span>
              )}
            </div>

            {locationItems.length === 0 ? (
              <p className="loot-table-empty">
                {locations.length === 0
                  ? 'Cadastre um local de farm para começar.'
                  : 'Este local não possui itens configurados.'}
              </p>
            ) : (
              <ul className="loot-table" role="list">
                {locationItems.map(item => {
                  const e   = getEntry(item.id)
                  const img = item.imageFile ? imageCache[item.imageFile] : null

                  const netQty = Math.max(0, e.qtyAfter - e.qtyBefore)
                  const { price: effectivePrice, source: priceSource } = getEffectivePrice(item)
                  const lineTotal = netQty * effectivePrice

                  return (
                    <li key={item.id} className="loot-row">
                      {/* Item identity */}
                      <div className="loot-row-identity">
                        <div className="loot-row-img">
                          {img
                            ? <img src={img} alt="" draggable={false} />
                            : <span aria-hidden="true">💎</span>
                          }
                        </div>
                        <div className="loot-row-identity-info">
                          <span className="loot-row-name">{item.name}</span>
                          <span
                            className={`loot-price-source-badge ${priceSource === 'market' ? 'loot-price-source-market' : 'loot-price-source-manual'}`}
                            title={priceSource === 'market' ? 'Preço vindo da API de mercado (arsha.io)' : 'Preço configurado manualmente'}
                          >
                            {priceSource === 'market' ? '🏪 Mercado' : '✋ Manual'}
                            {' · '}{effectivePrice.toLocaleString('pt-BR')} prata
                          </span>
                        </div>
                      </div>

                      {/* Quantity inputs */}
                      <div className="loot-row-inputs">
                        <label className="loot-qty-label">
                          <span>QTD ANTES</span>
                          <input
                            className="form-input loot-qty-input"
                            type="number"
                            min="0"
                            value={e.qtyBefore || ''}
                            onChange={ev => setField(item.id, 'qtyBefore', ev.target.value)}
                            placeholder="0"
                          />
                        </label>
                        <span className="loot-qty-arrow">→</span>
                        <label className="loot-qty-label">
                          <span>QTD DEPOIS</span>
                          <input
                            className="form-input loot-qty-input"
                            type="number"
                            min="0"
                            value={e.qtyAfter || ''}
                            onChange={ev => setField(item.id, 'qtyAfter', ev.target.value)}
                            placeholder="0"
                          />
                        </label>
                        <span className="loot-row-net">
                          Δ&nbsp;{netQty >= 0 ? `+${netQty}` : netQty}
                        </span>
                      </div>

                      {/* Line total */}
                      <div className="loot-row-value">
                        {effectivePrice > 0
                          ? <span className={lineTotal > 0 ? 'loot-value-gold' : 'loot-value-zero'}>
                              {lineTotal.toLocaleString('pt-BR')} prata
                            </span>
                          : <span className="loot-value-zero">—</span>
                        }
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ── Footer / total ── */}
        <div className="modal-footer">
          <div className="session-total">
            <div className="session-total-row">
              <span className="session-total-label">Total da Sessão</span>
              <span className="session-total-value">{total.toLocaleString('pt-BR')} prata</span>
            </div>
            {silverPerHour !== null && (
              <div className="session-total-row session-pph-row">
                <span className="session-total-label">Média / hora</span>
                <span className="session-pph-value">{silverPerHour.toLocaleString('pt-BR')} prata/h</span>
              </div>
            )}
          </div>
          <div className="modal-footer-actions">
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!locationId}
            >
              ⚔ {isNew ? 'Registrar Sessão' : 'Salvar Alterações'}
            </button>
            <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcSessionTotal(session: FarmSession, itemMap: Map<string, Item>): number {
  let sum = 0
  for (const e of session.loot) {
    const item = itemMap.get(e.itemId)
    if (!item) continue
    const qty   = Math.max(0, e.qtyAfter - e.qtyBefore)
    const price = e.priceSnapshot ?? item.price
    sum += qty * price
  }
  return sum
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── Main component ────────────────────────────────────────────────────────────

function FarmSessionPage(): React.ReactElement {
  const { devMode } = useDevMode()
  const [sessions,   setSessions]   = useState<FarmSession[]>([])
  const [locations,  setLocations]  = useState<FarmLocation[]>([])
  const [allItems,   setAllItems]   = useState<Item[]>([])
  const [imageCache, setImageCache] = useState<Record<string, string>>({})
  const [loaded,     setLoaded]     = useState(false)

  // Modal state
  type ModalMode = { type: 'add' } | { type: 'edit'; session: FarmSession } | null
  const [modal, setModal] = useState<ModalMode>(null)

  // Confirmation state
  type ConfirmState = { message: string; onConfirm: () => void } | null
  const [confirm, setConfirm] = useState<ConfirmState>(null)

  // ── Load on mount ────────────────────────────────────────────────────────

  useEffect(() => {
    async function load(): Promise<void> {
      if (devMode) {
        setSessions(MOCK_SESSIONS)
        setLocations(MOCK_LOCATIONS)
        setAllItems(MOCK_ITEMS)
        setLoaded(true)
        return
      }
      const [sessData, locData, itemData] = await Promise.all([
        window.api.readJson('sessions.json')  as Promise<FarmSession[]  | null>,
        window.api.readJson('locations.json') as Promise<FarmLocation[] | null>,
        window.api.readJson('items.json')     as Promise<Item[]         | null>
      ])
      const sessions  = Array.isArray(sessData)  ? sessData  : []
      const locations = Array.isArray(locData)   ? locData   : []
      const items     = Array.isArray(itemData)  ? itemData  : []
      setSessions(sessions)
      setLocations(locations)
      setAllItems(items)

      const cache: Record<string, string> = {}
      const files = [
        ...items.map(i => i.imageFile),
        ...locations.map(l => l.imageFile)
      ]
      for (const f of files) {
        if (f && !cache[f]) {
          const url = await window.api.getImageDataUrl(f)
          if (url) cache[f] = url
        }
      }
      setImageCache(cache)
      setLoaded(true)
    }
    load()
  }, [devMode])

  const itemMap = useMemo(() => {
    const m = new Map<string, Item>()
    for (const i of allItems) m.set(i.id, i)
    return m
  }, [allItems])

  // ── Persist ──────────────────────────────────────────────────────────────

  async function persist(list: FarmSession[]): Promise<void> {
    if (!devMode) await window.api.writeJson('sessions.json', list)
    setSessions(list)
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function askConfirm(message: string, onConfirm: () => void): void {
    setConfirm({ message, onConfirm })
  }

  function handleSave(session: FarmSession): void {
    const isNew = !sessions.find(s => s.id === session.id)
    const msg   = isNew
      ? `Registrar a sessão em "${locations.find(l => l.id === session.locationId)?.name ?? ''}"?`
      : 'Salvar as alterações nesta sessão?'
    askConfirm(msg, async () => {
      setConfirm(null)
      setModal(null)
      const updated = isNew
        ? [...sessions, session]
        : sessions.map(s => s.id === session.id ? session : s)
      await persist(updated)
    })
  }

  function handleDeleteRequest(session: FarmSession): void {
    const loc = locations.find(l => l.id === session.locationId)
    askConfirm(
      `Excluir a sessão de "${loc?.name ?? '—'}" em ${formatDate(session.date)}? Esta ação não pode ser desfeita.`,
      async () => {
        setConfirm(null)
        await persist(sessions.filter(s => s.id !== session.id))
      }
    )
  }

  function handleEditRequest(session: FarmSession): void {
    setModal({ type: 'edit', session })
  }

  function handleAddRequest(): void {
    setModal({ type: 'add' })
  }

  function handleModalCancel(): void {
    askConfirm('Descartar as alterações não salvas?', () => {
      setConfirm(null)
      setModal(null)
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="page-container">
      <h2 className="page-title">
        <span className="page-title-icon" aria-hidden="true">📜</span>
        Sessões de Farm
      </h2>

      {/* Add button */}
      <div className="session-page-toolbar">
        <button
          className="btn btn-primary"
          onClick={handleAddRequest}
          disabled={locations.length === 0}
          title={locations.length === 0 ? 'Cadastre um local de farm primeiro' : undefined}
        >
          + Nova Sessão
        </button>
        {locations.length === 0 && (
          <span className="toolbar-hint">Cadastre um local de farm antes de registrar uma sessão.</span>
        )}
      </div>

      {/* ── History list ── */}
      {!loaded ? (
        <p className="loading-text">Carregando…</p>
      ) : sessions.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <span className="empty-state-icon" aria-hidden="true">📜</span>
          <span className="empty-state-text">Nenhuma sessão registrada ainda.</span>
        </div>
      ) : (
        <ul className="session-list" role="list">
          {[...sessions].reverse().map(session => {
            const loc            = locations.find(l => l.id === session.locationId)
            const total          = calcSessionTotal(session, itemMap)
            const locImg         = loc?.imageFile ? imageCache[loc.imageFile] : null
            const durMins        = session.durationMinutes ?? 0
            const silverPerHour  = durMins > 0 ? Math.round(total / (durMins / 60)) : null

            return (
              <li key={session.id} className="session-card">

                {/* Card header */}
                <div className="session-card-header">
                  <div className="session-card-loc">
                    <div className="session-card-loc-icon">
                      {locImg
                        ? <img src={locImg} alt="" draggable={false} />
                        : <span aria-hidden="true">⛰️</span>
                      }
                    </div>
                    <div className="session-card-loc-info">
                      <span className="session-card-loc-name">{loc?.name ?? '—'}</span>
                      <span className="session-card-meta">
                        {formatDate(session.date)}
                        {session.duration && <> &bull; {session.duration}</>}
                      </span>
                    </div>
                  </div>
                  <div className="session-card-actions">
                    <button
                      className="btn-labeled btn-labeled-edit"
                      aria-label="Editar sessão"
                      onClick={() => handleEditRequest(session)}
                    >
                      <Pencil size={13} aria-hidden="true" />
                      Editar
                    </button>
                    <button
                      className="btn-labeled btn-labeled-delete"
                      aria-label="Excluir sessão"
                      onClick={() => handleDeleteRequest(session)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      Excluir
                    </button>
                  </div>
                </div>

                {/* Loot summary chips */}
                {session.loot.some(e => {
                  const item = itemMap.get(e.itemId)
                  if (!item) return false
                  const qty = Math.max(0, e.qtyAfter - e.qtyBefore)
                  return qty > 0
                }) && (
                  <ul className="session-card-loot" aria-label="Loot obtido">
                    {session.loot.map(e => {
                      const item = itemMap.get(e.itemId)
                      if (!item) return null
                      const qty = Math.max(0, e.qtyAfter - e.qtyBefore)
                      if (qty === 0) return null
                      const img = item.imageFile ? imageCache[item.imageFile] : null
                      return (
                        <li key={e.itemId} className="session-loot-chip">
                          {img
                            ? <img src={img} alt="" className="loc-loot-img" draggable={false} />
                            : <span aria-hidden="true">💎</span>
                          }
                          <span className="session-loot-qty">×{qty}</span>
                          <span className="session-loot-name">{item.name}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {/* Notes */}
                {session.notes && (
                  <p className="session-card-notes">💬 {session.notes}</p>
                )}

                {/* Total */}
                <div className="session-card-footer">
                  <span className="session-card-total-label">Total:</span>
                  <span className="session-card-total-value">{total.toLocaleString('pt-BR')} prata</span>
                  {silverPerHour !== null && (
                    <span className="session-card-pph">
                      ≈ {silverPerHour.toLocaleString('pt-BR')} <span className="session-card-pph-unit">prata/h</span>
                    </span>
                  )}
                </div>

              </li>
            )
          })}
        </ul>
      )}

      {/* ── Modals ── */}
      {modal && (
        <SessionFormModal
          session={modal.type === 'edit' ? modal.session : null}
          locations={locations}
          allItems={allItems}
          imageCache={imageCache}
          onSave={handleSave}
          onCancel={handleModalCancel}
        />
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

    </div>
  )
}

export default FarmSessionPage
