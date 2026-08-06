import React, { useEffect, useMemo, useState } from 'react'
import {
  Coins,
  Gem,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
  X
} from 'lucide-react'
import { useItemDb } from '../context/ItemDbContext'
import { useLanguage } from '../context/LanguageContext'
import type { Item } from './ItemRegistrationPage'

export interface UpgradeSession {
  id: string
  itemId: string
  itemName: string
  enhancementFrom: string
  enhancementTo: string
  pityAttempts: number
  currentAttempts: number
  materialName: string
  materialUnitPrice: number
  materialQuantity: number
  cronQuantity: number
  createdAt: string
}

interface UpgradePlannerData {
  cronUnitPrice: number
  sessions: UpgradeSession[]
}

interface CatalogItem {
  id: string
  name: string
  grade: number
}

interface SessionCosts {
  costPerAttempt: number
  spent: number
  maximum: number
  remaining: number
  attemptsRemaining: number
}

const EMPTY_DATA: UpgradePlannerData = { cronUnitPrice: 0, sessions: [] }

const ENHANCEMENT_LEVELS = [
  ...Array.from({ length: 16 }, (_, index) => `+${index}`),
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'
]

function createId(): string {
  return `upgrade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function asNonNegativeInt(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

function calculateCosts(session: UpgradeSession, cronUnitPrice: number): SessionCosts {
  const pityAttempts = Math.max(0, session.pityAttempts)
  const currentAttempts = Math.min(Math.max(0, session.currentAttempts), pityAttempts)
  const materialCost = session.materialUnitPrice * session.materialQuantity
  const cronCost = cronUnitPrice * session.cronQuantity
  const costPerAttempt = materialCost + cronCost
  const attemptsRemaining = Math.max(0, pityAttempts - currentAttempts)

  return {
    costPerAttempt,
    spent: costPerAttempt * currentAttempts,
    maximum: costPerAttempt * pityAttempts,
    remaining: costPerAttempt * attemptsRemaining,
    attemptsRemaining
  }
}

function UpgradePlannerPage(): React.ReactElement {
  const { itemDb, dbLoaded } = useItemDb()
  const { t, locale } = useLanguage()
  const [data, setData] = useState<UpgradePlannerData>(EMPTY_DATA)
  const [registeredItems, setRegisteredItems] = useState<Item[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [itemQuery, setItemQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null)
  const [enhancementFrom, setEnhancementFrom] = useState('+0')
  const [enhancementTo, setEnhancementTo] = useState('+1')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [pityAttempts, setPityAttempts] = useState('')
  const [currentAttempts, setCurrentAttempts] = useState('0')
  const [materialName, setMaterialName] = useState('')
  const [materialUnitPrice, setMaterialUnitPrice] = useState('')
  const [materialQuantity, setMaterialQuantity] = useState('1')
  const [cronQuantity, setCronQuantity] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load(): Promise<void> {
      const [saved, items] = await Promise.all([
        window.api.readJson('upgrade-planner.json'),
        window.api.readJson('items.json')
      ])
      if (saved && typeof saved === 'object') {
        const parsed = saved as Partial<UpgradePlannerData>
        setData({
          cronUnitPrice: asNonNegativeInt(parsed.cronUnitPrice ?? 0),
          sessions: Array.isArray(parsed.sessions)
            ? parsed.sessions.map(session => ({
                ...session,
                enhancementFrom: session.enhancementFrom ?? '+0',
                enhancementTo: session.enhancementTo ?? '+1'
              }))
            : []
        })
      }
      setRegisteredItems(Array.isArray(items) ? items as Item[] : [])
      setLoaded(true)
    }
    load()
  }, [])

  const catalog = useMemo<CatalogItem[]>(() => {
    const byName = new Map<string, CatalogItem>()
    for (const item of registeredItems) {
      byName.set(item.name.trim().toLocaleLowerCase(), {
        id: `registered:${item.id}`,
        name: item.name,
        grade: 0
      })
    }
    for (const item of itemDb) {
      const key = item.name.trim().toLocaleLowerCase()
      if (!byName.has(key)) {
        byName.set(key, { id: `db:${item.id}`, name: item.name, grade: item.grade })
      }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [registeredItems, itemDb, locale])

  const suggestions = useMemo(() => {
    const query = itemQuery.trim().toLocaleLowerCase()
    if (!query) return catalog.slice(0, 8)
    return catalog.filter(item => item.name.toLocaleLowerCase().includes(query)).slice(0, 8)
  }, [catalog, itemQuery])

  const totals = useMemo(() => data.sessions.reduce((acc, session) => {
    const costs = calculateCosts(session, data.cronUnitPrice)
    acc.spent += costs.spent
    acc.maximum += costs.maximum
    acc.remaining += costs.remaining
    acc.attemptsRemaining += costs.attemptsRemaining
    return acc
  }, { spent: 0, maximum: 0, remaining: 0, attemptsRemaining: 0 }), [data])

  function formatSilver(value: number): string {
    return Math.round(value).toLocaleString(locale)
  }

  async function persist(next: UpgradePlannerData): Promise<void> {
    setData(next)
    await window.api.writeJson('upgrade-planner.json', next)
  }

  async function handleCronPriceChange(value: string): Promise<void> {
    await persist({ ...data, cronUnitPrice: asNonNegativeInt(value) })
  }

  function resetForm(): void {
    setEditingId(null)
    setItemQuery('')
    setSelectedItem(null)
    setEnhancementFrom('+0')
    setEnhancementTo('+1')
    setPityAttempts('')
    setCurrentAttempts('0')
    setMaterialName('')
    setMaterialUnitPrice('')
    setMaterialQuantity('1')
    setCronQuantity('')
    setShowSuggestions(false)
    setError('')
  }

  function chooseItem(item: CatalogItem): void {
    setSelectedItem(item)
    setItemQuery(item.name)
    setShowSuggestions(false)
    setError('')
  }

  function handleEnhancementFromChange(value: string): void {
    const nextFromIndex = ENHANCEMENT_LEVELS.indexOf(value)
    setEnhancementFrom(value)
    if (ENHANCEMENT_LEVELS.indexOf(enhancementTo) <= nextFromIndex) {
      setEnhancementTo(ENHANCEMENT_LEVELS[nextFromIndex + 1])
    }
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    const pity = asNonNegativeInt(pityAttempts)
    const current = asNonNegativeInt(currentAttempts)
    const materialPrice = asNonNegativeInt(materialUnitPrice)
    const materialQty = asNonNegativeInt(materialQuantity)
    const crons = asNonNegativeInt(cronQuantity)
    const fromIndex = ENHANCEMENT_LEVELS.indexOf(enhancementFrom)
    const toIndex = ENHANCEMENT_LEVELS.indexOf(enhancementTo)

    if (!selectedItem) {
      setError(t('upgrades.itemRequired'))
      return
    }
    if (pity < 1 || current > pity || materialPrice < 1 || materialQty < 1 || crons < 1) {
      setError(t('upgrades.invalidValues'))
      return
    }
    if (fromIndex < 0 || toIndex <= fromIndex) {
      setError(t('upgrades.invalidEnhancementRange'))
      return
    }

    const session: UpgradeSession = {
      id: editingId ?? createId(),
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      enhancementFrom,
      enhancementTo,
      pityAttempts: pity,
      currentAttempts: current,
      materialName: materialName.trim() || t('upgrades.materialFallback'),
      materialUnitPrice: materialPrice,
      materialQuantity: materialQty,
      cronQuantity: crons,
      createdAt: editingId
        ? data.sessions.find(item => item.id === editingId)?.createdAt ?? new Date().toISOString()
        : new Date().toISOString()
    }

    const sessions = editingId
      ? data.sessions.map(item => item.id === editingId ? session : item)
      : [session, ...data.sessions]
    await persist({ ...data, sessions })
    resetForm()
  }

  function handleEdit(session: UpgradeSession): void {
    setEditingId(session.id)
    setSelectedItem({ id: session.itemId, name: session.itemName, grade: 0 })
    setItemQuery(session.itemName)
    setEnhancementFrom(session.enhancementFrom ?? '+0')
    setEnhancementTo(session.enhancementTo ?? '+1')
    setPityAttempts(String(session.pityAttempts))
    setCurrentAttempts(String(session.currentAttempts))
    setMaterialName(session.materialName)
    setMaterialUnitPrice(String(session.materialUnitPrice))
    setMaterialQuantity(String(session.materialQuantity))
    setCronQuantity(String(session.cronQuantity))
    setShowSuggestions(false)
    setError('')
    document.querySelector('.content-area')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id: string): Promise<void> {
    await persist({ ...data, sessions: data.sessions.filter(session => session.id !== id) })
    if (editingId === id) resetForm()
  }

  async function handleAttemptsChange(session: UpgradeSession, value: string): Promise<void> {
    const currentAttempts = Math.min(asNonNegativeInt(value), session.pityAttempts)
    await persist({
      ...data,
      sessions: data.sessions.map(item => item.id === session.id ? { ...item, currentAttempts } : item)
    })
  }

  return (
    <div className="page-container upgrade-page">
      <div className="page-header upgrade-page-header">
        <div>
          <h2 className="page-title"><TrendingUp size={20} /> {t('upgrades.pageTitle')}</h2>
          <p className="upgrade-page-subtitle">{t('upgrades.pageSubtitle')}</p>
        </div>
        <label className="cron-price-control">
          <span><Gem size={15} /> {t('upgrades.cronPrice')}</span>
          <div className="cron-price-input-wrap">
            <input
              className="form-input"
              type="number"
              min="0"
              value={data.cronUnitPrice || ''}
              onChange={event => setData({ ...data, cronUnitPrice: asNonNegativeInt(event.target.value) })}
              onBlur={event => handleCronPriceChange(event.target.value)}
              aria-label={t('upgrades.cronPrice')}
            />
            <small>{t('common.silver')}</small>
          </div>
        </label>
      </div>

      <section className="upgrade-summary-grid" aria-label={t('upgrades.summaryAria')}>
        <article className="upgrade-summary-card spent">
          <span className="upgrade-summary-icon"><Coins size={18} /></span>
          <div><small>{t('upgrades.totalSpent')}</small><strong>{formatSilver(totals.spent)}</strong><em>{t('common.silver')}</em></div>
        </article>
        <article className="upgrade-summary-card maximum">
          <span className="upgrade-summary-icon"><ShieldCheck size={18} /></span>
          <div><small>{t('upgrades.maximumCost')}</small><strong>{formatSilver(totals.maximum)}</strong><em>{t('common.silver')}</em></div>
        </article>
        <article className="upgrade-summary-card remaining">
          <span className="upgrade-summary-icon"><TrendingUp size={18} /></span>
          <div><small>{t('upgrades.remainingCost')}</small><strong>{formatSilver(totals.remaining)}</strong><em>{t('common.silver')}</em></div>
        </article>
        <article className="upgrade-summary-card attempts">
          <span className="upgrade-summary-icon"><Gem size={18} /></span>
          <div><small>{t('upgrades.attemptsRemaining')}</small><strong>{totals.attemptsRemaining.toLocaleString(locale)}</strong><em>{t('upgrades.attempts')}</em></div>
        </article>
      </section>

      <form className="upgrade-form-panel" onSubmit={handleSubmit}>
        <div className="upgrade-section-heading">
          <div><span>{editingId ? <Pencil size={17} /> : <Plus size={17} />}</span><div><h3>{editingId ? t('upgrades.editSession') : t('upgrades.newSession')}</h3><p>{t('upgrades.formHint')}</p></div></div>
          {editingId && <button className="btn btn-secondary" type="button" onClick={resetForm}><X size={15} /> {t('common.cancel')}</button>}
        </div>

        <div className="upgrade-form-grid">
          <label className="form-field upgrade-item-field">
            <span className="form-label">{t('upgrades.itemName')}</span>
            <div className="upgrade-item-search">
              <Search size={16} aria-hidden="true" />
              <input
                className="form-input"
                value={itemQuery}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
                onChange={event => { setItemQuery(event.target.value); setSelectedItem(null); setShowSuggestions(true) }}
                placeholder={dbLoaded ? t('upgrades.itemPlaceholder') : t('common.loading')}
                autoComplete="off"
              />
              {showSuggestions && (
                <div className="upgrade-suggestions" role="listbox">
                  {suggestions.length > 0 ? suggestions.map(item => (
                    <button key={item.id} type="button" onClick={() => chooseItem(item)} role="option">
                      <span className={`upgrade-grade grade-${item.grade}`}><Gem size={14} /></span>
                      {item.name}
                    </button>
                  )) : <p>{t('common.noResults')}</p>}
                </div>
              )}
            </div>
          </label>
          <label className="form-field">
            <span className="form-label">{t('upgrades.pityAttempts')}</span>
            <input className="form-input" type="number" min="1" value={pityAttempts} onChange={event => setPityAttempts(event.target.value)} />
          </label>
          <div className="form-field upgrade-level-fieldset">
            <span className="form-label">{t('upgrades.enhancementRange')}</span>
            <div className="upgrade-level-selects">
              <label>
                <span>{t('upgrades.levelFrom')}</span>
                <select className="form-select" value={enhancementFrom} onChange={event => handleEnhancementFromChange(event.target.value)}>
                  {ENHANCEMENT_LEVELS.slice(0, -1).map(level => <option key={`from-${level}`} value={level}>{level}</option>)}
                </select>
              </label>
              <span className="upgrade-level-arrow" aria-hidden="true">→</span>
              <label>
                <span>{t('upgrades.levelTo')}</span>
                <select className="form-select" value={enhancementTo} onChange={event => setEnhancementTo(event.target.value)}>
                  {ENHANCEMENT_LEVELS.filter(level => ENHANCEMENT_LEVELS.indexOf(level) > ENHANCEMENT_LEVELS.indexOf(enhancementFrom)).map(level => <option key={`to-${level}`} value={level}>{level}</option>)}
                </select>
              </label>
            </div>
          </div>
          <label className="form-field">
            <span className="form-label">{t('upgrades.currentAttempts')}</span>
            <input className="form-input" type="number" min="0" max={pityAttempts || undefined} value={currentAttempts} onChange={event => setCurrentAttempts(event.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-label">{t('upgrades.materialName')}</span>
            <input className="form-input" value={materialName} onChange={event => setMaterialName(event.target.value)} placeholder={t('upgrades.materialPlaceholder')} />
          </label>
          <label className="form-field">
            <span className="form-label">{t('upgrades.materialPrice')}</span>
            <input className="form-input" type="number" min="1" value={materialUnitPrice} onChange={event => setMaterialUnitPrice(event.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-label">{t('upgrades.materialQuantity')}</span>
            <input className="form-input" type="number" min="1" value={materialQuantity} onChange={event => setMaterialQuantity(event.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-label">{t('upgrades.cronQuantity')}</span>
            <input className="form-input" type="number" min="1" value={cronQuantity} onChange={event => setCronQuantity(event.target.value)} />
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="upgrade-form-actions">
          <button className="btn btn-primary" type="submit"><Save size={16} /> {editingId ? t('common.saveChanges') : t('upgrades.addSession')}</button>
        </div>
      </form>

      <section className="upgrade-list-section">
        <div className="upgrade-list-heading"><div><h3>{t('upgrades.sessionsTitle')}</h3><p>{t('upgrades.sessionsHint')}</p></div><span>{data.sessions.length}</span></div>
        {!loaded ? <div className="empty-state"><span className="empty-state-text">{t('common.loading')}</span></div> : data.sessions.length === 0 ? (
          <div className="upgrade-empty-state"><Gem size={34} /><h3>{t('upgrades.emptyTitle')}</h3><p>{t('upgrades.emptyHint')}</p></div>
        ) : (
          <div className="upgrade-session-list">
            {data.sessions.map(session => {
              const costs = calculateCosts(session, data.cronUnitPrice)
              const progress = session.pityAttempts > 0 ? Math.min(100, (session.currentAttempts / session.pityAttempts) * 100) : 0
              return (
                <article className="upgrade-session-card" key={session.id}>
                  <div className="upgrade-session-top">
                    <div className="upgrade-session-title"><span><Gem size={18} /></span><div><div className="upgrade-name-row"><h3>{session.itemName}</h3><strong className="upgrade-level-badge"><span>{session.enhancementFrom ?? '+0'}</span><i>→</i><span>{session.enhancementTo ?? '+1'}</span></strong></div><p>{session.materialQuantity}× {session.materialName} + {session.cronQuantity.toLocaleString(locale)} {t('upgrades.cronsPerAttempt')}</p></div></div>
                    <div className="upgrade-card-actions">
                      <button type="button" className="btn-icon-sm" onClick={() => handleEdit(session)} aria-label={`${t('common.edit')} ${session.itemName}`}><Pencil size={15} /></button>
                      <button type="button" className="btn-icon-sm btn-icon-danger" onClick={() => handleDelete(session.id)} aria-label={`${t('common.delete')} ${session.itemName}`}><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <div className="upgrade-progress-row">
                    <div className="upgrade-progress-label"><span>{t('upgrades.pityProgress')}</span><strong>{session.currentAttempts} / {session.pityAttempts}</strong></div>
                    <div className="upgrade-progress-track"><span style={{ width: `${progress}%` }} /></div>
                  </div>
                  <div className="upgrade-inline-attempts">
                    <label>{t('upgrades.updateAttempts')}<input type="number" min="0" max={session.pityAttempts} value={session.currentAttempts} onChange={event => handleAttemptsChange(session, event.target.value)} /></label>
                    <span>{costs.attemptsRemaining} {t('upgrades.attemptsLeft')}</span>
                  </div>
                  <div className="upgrade-cost-grid">
                    <div><small>{t('upgrades.costPerAttempt')}</small><strong>{formatSilver(costs.costPerAttempt)}</strong><em>{t('common.silver')}</em></div>
                    <div><small>{t('upgrades.spent')}</small><strong>{formatSilver(costs.spent)}</strong><em>{t('common.silver')}</em></div>
                    <div><small>{t('upgrades.maximum')}</small><strong>{formatSilver(costs.maximum)}</strong><em>{t('common.silver')}</em></div>
                    <div className="highlight"><small>{t('upgrades.remaining')}</small><strong>{formatSilver(costs.remaining)}</strong><em>{t('common.silver')}</em></div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

export default UpgradePlannerPage
