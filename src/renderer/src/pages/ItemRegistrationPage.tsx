import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Pencil, Trash2, MapPin, Search, ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp01, Gem, Package, FolderOpen, Save, RefreshCw, Store, Clock, Check, X } from 'lucide-react'
import type { FarmLocation } from './FarmLocationPage'
import type { FarmSession } from './FarmSessionPage'
import { useDevMode } from '../context/DevModeContext'
import { MOCK_ITEMS, MOCK_LOCATIONS, MOCK_SESSIONS } from '../context/DevModeContext'
import { useMarket } from '../context/MarketContext'
import { useLanguage } from '../context/LanguageContext'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Item {
  id: string
  name: string
  price: number
  marketId?: string
  imageFile: string | null
  createdAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(p: number): string {
  if (p === 0) return '—'
  return p.toLocaleString()
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function parsePrice(raw: string): number {
  const n = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) || n < 0 ? 0 : Math.round(n)
}

// ── Component ─────────────────────────────────────────────────────────────────

function ItemRegistrationPage(): React.ReactElement {
  const { devMode } = useDevMode()
  const { marketData, setItems: setMarketItems, loading: marketLoading, lastUpdated } = useMarket()
  const { t } = useLanguage()
  const [items, setItems] = useState<Item[]>([])
  const [locations, setLocations] = useState<FarmLocation[]>([])
  const [sessions, setSessions] = useState<FarmSession[]>([])
  const [imageCache, setImageCache] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [marketId, setMarketId] = useState('')
  const [imageFile, setImageFile] = useState<string | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formSectionRef = useRef<HTMLElement>(null)

  // ── Filter / sort state ────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [filterLocId, setFilterLocId] = useState<string>('all')
  type SortKey = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'
  const [sortKey, setSortKey]         = useState<SortKey>('name-asc')

  // ── Load on mount ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load(): Promise<void> {
      if (devMode) {
        setItems(MOCK_ITEMS)
        setLocations(MOCK_LOCATIONS)
        setSessions(MOCK_SESSIONS)
        setLoaded(true)
        return
      }
      const [itemData, locData, sessData] = await Promise.all([
        window.api.readJson('items.json')     as Promise<Item[]         | null>,
        window.api.readJson('locations.json') as Promise<FarmLocation[] | null>,
        window.api.readJson('sessions.json')  as Promise<FarmSession[]  | null>
      ])
      const list = Array.isArray(itemData) ? itemData : []
      const locs = Array.isArray(locData)  ? locData  : []
      const sess = Array.isArray(sessData) ? sessData : []
      setItems(list)
      setMarketItems(list)
      setLocations(locs)
      setSessions(sess)

      const cache: Record<string, string> = {}
      for (const item of list) {
        if (item.imageFile && !cache[item.imageFile]) {
          const url = await window.api.getImageDataUrl(item.imageFile)
          if (url) cache[item.imageFile] = url
        }
      }
      setImageCache(cache)
      setLoaded(true)
    }
    load()
  }, [devMode])

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function persistItems(list: Item[]): Promise<void> {
    if (!devMode) await window.api.writeJson('items.json', list)
    setItems(list)
    setMarketItems(list)
  }

  function resetForm(): void {
    setEditingId(null)
    setName('')
    setPrice('')
    setMarketId('')
    setImageFile(null)
    setImageDataUrl(null)
    setError(null)
  }

  function scrollToForm(): void {
    // Scroll the .content-area container (not window) to top
    const area = document.querySelector('.content-area')
    if (area) area.scrollTop = 0
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handlePickImage(): Promise<void> {
    setError(null)
    try {
      const filename = await window.api.pickImage()
      if (!filename) return
      const url = await window.api.getImageDataUrl(filename)
      setImageFile(filename)
      setImageDataUrl(url)
      if (filename && url) {
        setImageCache(prev => ({ ...prev, [filename]: url }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('items.imageError'))
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return
    setError(null)
    setSaving(true)
    try {
      if (editingId !== null) {
        const updated = items.map(item =>
          item.id === editingId
            ? { ...item, name: trimmedName, price: parsePrice(price), marketId: String(marketId).trim() || undefined, imageFile }
            : item
        )
        await persistItems(updated)
      } else {
        const newItem: Item = {
          id: `item_${Date.now()}`,
          name: trimmedName,
          price: parsePrice(price),
          marketId: String(marketId).trim() || undefined,
          imageFile,
          createdAt: new Date().toISOString()
        }
        await persistItems([...items, newItem])
      }
      resetForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('items.saveError'))
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(item: Item): void {
    setEditingId(item.id)
    setName(item.name)
    setPrice(item.price > 0 ? String(item.price) : '')
    setMarketId(item.marketId != null ? String(item.marketId) : '')
    setImageFile(item.imageFile)
    setImageDataUrl(item.imageFile ? (imageCache[item.imageFile] ?? null) : null)
    setError(null)
    scrollToForm()
  }

  async function handleDelete(id: string): Promise<void> {
    await persistItems(items.filter(item => item.id !== id))
    if (editingId === id) resetForm()
  }

  function handleRemoveImage(): void {
    setImageFile(null)
    setImageDataUrl(null)
  }

  const isEditing = editingId !== null

  // Reverse map: itemId -> list of locations that include it
  const itemLocationMap = useMemo(() => {
    const map = new Map<string, FarmLocation[]>()
    for (const loc of locations) {
      for (const id of loc.lootIds) {
        const existing = map.get(id) ?? []
        map.set(id, [...existing, loc])
      }
    }
    return map
  }, [locations])

  // ── Global drop rate per item (across all sessions / all locations) ─────────
  // Map<itemId, { qtyPerHour: number|null; qtyPerSess: number|null }>
  const itemDropRates = useMemo(() => {
    const result = new Map<string, { qtyPerHour: number | null; qtyPerSess: number | null }>()
    // accumulate across every session
    const acc = new Map<string, { totalQty: number; timedQty: number; totalMins: number; sessCount: number }>()
    for (const s of sessions) {
      const mins = s.durationMinutes ?? 0
      for (const e of s.loot) {
        const qty  = Math.max(0, e.qtyAfter - e.qtyBefore)
        const prev = acc.get(e.itemId) ?? { totalQty: 0, timedQty: 0, totalMins: 0, sessCount: 0 }
        acc.set(e.itemId, {
          totalQty:  prev.totalQty  + qty,
          timedQty:  prev.timedQty  + (mins > 0 ? qty : 0),
          totalMins: prev.totalMins + (mins > 0 ? mins : 0),
          sessCount: prev.sessCount + 1,
        })
      }
    }
    for (const [itemId, d] of acc) {
      const qtyPerHour = d.totalMins > 0 ? Math.round((d.timedQty / d.totalMins) * 60 * 10) / 10 : null
      const qtyPerSess = d.sessCount > 0 ? Math.round((d.totalQty / d.sessCount) * 10) / 10 : null
      result.set(itemId, { qtyPerHour, qtyPerSess })
    }
    return result
  }, [sessions])

  // Filtered + sorted list
  const visibleItems = useMemo(() => {
    // Helper: resolve the effective price for sorting (market > manual > 0)
    const effectivePrice = (item: Item): number => {
      if (item.marketId != null && String(item.marketId).trim() !== '') {
        const entry = marketData.get(String(item.marketId).trim())
        if (entry && entry.basePrice > 0) return entry.basePrice
      }
      return item.price ?? 0
    }

    let list = items.slice()
    // search
    const q = searchQuery.trim().toLowerCase()
    if (q) list = list.filter(i => i.name.toLowerCase().includes(q))
    // location filter
    if (filterLocId !== 'all') {
      list = list.filter(i => (itemLocationMap.get(i.id) ?? []).some(l => l.id === filterLocId))
    }
    // sort
    list.sort((a, b) => {
      if (sortKey === 'name-asc')   return a.name.localeCompare(b.name, 'pt-BR')
      if (sortKey === 'name-desc')  return b.name.localeCompare(a.name, 'pt-BR')
      if (sortKey === 'price-asc')  return effectivePrice(a) - effectivePrice(b)
      return effectivePrice(b) - effectivePrice(a)
    })
    return list
  }, [items, searchQuery, filterLocId, sortKey, itemLocationMap, marketData])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page-container">
      <h2 className="page-title">
        <Gem size={20} className="page-title-icon" aria-hidden="true" />
        {t('items.pageTitle')}
      </h2>

      {/* ── Form section ── */}
      <section className="form-section" ref={formSectionRef}>
        <div className="wood-panel">
          <h3 className="panel-section-title">
            {isEditing ? <><Pencil size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('items.editTitle')}</> : t('items.newTitle')}
          </h3>

          {error && (
            <p className="form-error" role="alert">{error}</p>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="item-form-layout">

              {/* LEFT: fields */}
              <div className="item-form-fields">

                <div className="form-row-two">
                  {/* Name */}
                  <div className="form-field">
                    <label className="form-label" htmlFor="item-name">
                      {t('items.nameLabel')} <span className="required-mark">*</span>
                    </label>
                    <input
                      id="item-name"
                      className="form-input"
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={t('items.namePlaceholder')}
                      maxLength={100}
                      required
                      autoComplete="off"
                    />
                  </div>

                  {/* Price */}
                  <div className="form-field">
                    <label className="form-label" htmlFor="item-price">
                      {t('items.priceLabel')}
                    </label>
                    <input
                      id="item-price"
                      className="form-input"
                      type="number"
                      min="0"
                      step="1"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Market ID */}
                <div className="form-field">
                  <label className="form-label" htmlFor="item-market-id">
                    {t('items.marketIdLabel')}{' '}
                    <span className="form-label-hint">{t('items.marketIdHint')}</span>
                  </label>
                  <input
                    id="item-market-id"
                    className="form-input"
                    type="text"
                    value={marketId}
                    onChange={e => setMarketId(e.target.value)}
                    placeholder="Ex.: 721003"
                    maxLength={20}
                    autoComplete="off"
                  />
                </div>

                {/* Image picker */}
                <div className="form-field">
                  <span className="form-label">{t('items.imageLabel')}</span>
                  <div className="pick-image-row">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handlePickImage}
                    >
                    <FolderOpen size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('items.selectImageBtn')}
                    </button>
                    {imageFile
                      ? <span className="image-filename" title={imageFile ?? ''}><Check size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} aria-hidden="true" />{t('items.imageSelected')}</span>
                      : <span className="image-filename-empty">{t('items.noImageSelected')}</span>
                    }
                    {imageFile && (
                      <button
                        type="button"
                        className="btn-icon-remove"
                        aria-label={t('items.removeImageAria')}
                        onClick={handleRemoveImage}
                        title={t('items.removeImageAria')}
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || !name.trim()}
                  >
                    {saving ? t('common.saving') : isEditing ? <><Save size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('common.saveChanges')}</> : <><Save size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('items.registerBtn')}</>}
                  </button>
                  {isEditing && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={resetForm}
                    >
                      {t('common.cancel')}
                    </button>
                  )}
                </div>
              </div>

              {/* RIGHT: image preview */}
              <div className="image-preview-column">
                <span className="form-label preview-label">{t('items.previewLabel')}</span>
                <div className="image-preview-box">
                  {imageDataUrl
                    ? <img src={imageDataUrl} alt={t('items.previewAlt')} draggable={false} />
                    : <Gem size={32} className="image-preview-placeholder" aria-hidden="true" />
                  }
                </div>
              </div>

            </div>
          </form>
        </div>
      </section>

      {/* ── Items list ── */}
      <section>
        <div className="items-list-heading">
          <span>{t('items.registeredItems')}</span>
          <span className="items-count">{items.length}</span>
          {items.some(i => i.marketId != null && String(i.marketId).trim() !== '') && (
              <span className="market-status-label" title={t('items.marketUpdateTooltip')}>
              {marketLoading
                ? <><RefreshCw size={11} className="market-status-spin" aria-hidden="true" /> {t('items.marketUpdating')}</>
                : lastUpdated
                  ? <><Clock size={11} aria-hidden="true" /> {t('items.marketUpdated', { time: formatTime(lastUpdated) })}</>
                  : null
              }
            </span>
          )}
        </div>

        {/* Toolbar: search + filter + sort */}
        {loaded && items.length > 0 && (
          <div className="item-list-toolbar">
            {/* Search */}
            <div className="item-search-wrap">
              <Search size={14} className="item-search-icon" aria-hidden="true" />
              <input
                className="item-search-input"
                type="text"
                placeholder={t('items.searchPlaceholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
              {searchQuery && (
                <button className="item-search-clear" onClick={() => setSearchQuery('')} aria-label={t('items.clearSearchAria')}><X size={12} aria-hidden="true" /></button>
              )}
            </div>

            {/* Location filter */}
            <div className="item-toolbar-select-wrap">
              <select
                className="item-toolbar-select"
                value={filterLocId}
                onChange={e => setFilterLocId(e.target.value)}
                aria-label={t('items.filterByLocation')}
              >
                <option value="all">{t('items.allLocations')}</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="item-sort-group" role="group" aria-label={t('items.sortAria')}>
              <button
                className={`item-sort-btn${sortKey === 'name-asc'  ? ' item-sort-active' : ''}`}
                onClick={() => setSortKey('name-asc')}
                title={t('items.sortNameAsc')}
              ><ArrowDownAZ size={14} aria-hidden="true" />{t('items.sortNameAsc')}</button>
              <button
                className={`item-sort-btn${sortKey === 'name-desc' ? ' item-sort-active' : ''}`}
                onClick={() => setSortKey('name-desc')}
                title={t('items.sortNameDesc')}
              ><ArrowUpAZ size={14} aria-hidden="true" />{t('items.sortNameDesc')}</button>
              <button
                className={`item-sort-btn${sortKey === 'price-asc'  ? ' item-sort-active' : ''}`}
                onClick={() => setSortKey('price-asc')}
                title={t('items.sortPriceAsc')}
              ><ArrowDown01 size={14} aria-hidden="true" />{t('items.sortPriceAsc')}</button>
              <button
                className={`item-sort-btn${sortKey === 'price-desc' ? ' item-sort-active' : ''}`}
                onClick={() => setSortKey('price-desc')}
                title={t('items.sortPriceDesc')}
              ><ArrowUp01 size={14} aria-hidden="true" />{t('items.sortPriceDesc')}</button>
            </div>
          </div>
        )}

        {!loaded ? (
          <p className="loading-text">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <Package size={48} className="empty-state-icon" aria-hidden="true" />
            <span className="empty-state-text">{t('items.emptyState')}</span>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="empty-state">
            <Search size={48} className="empty-state-icon" aria-hidden="true" />
            <span className="empty-state-text">{t('items.emptyFilterState')}</span>
          </div>
        ) : (
          <ul className="item-list" role="list">
            {visibleItems.map(item => {
              const img      = item.imageFile ? imageCache[item.imageFile] : null
              const locNames = (itemLocationMap.get(item.id) ?? []).map(l => l.name)
              const rate     = itemDropRates.get(item.id)
              const rateLabel = rate?.qtyPerHour != null
                ? `${rate.qtyPerHour.toLocaleString()}/${t('locations.ratePerHour')}`
                : rate?.qtyPerSess != null
                  ? `~${rate.qtyPerSess.toLocaleString()}/${t('locations.ratePerSession')}`
                  : null
              const marketEntry = item.marketId != null ? marketData.get(String(item.marketId).trim()) : undefined
              return (
                <li
                  key={item.id}
                  className={`item-row${editingId === item.id ? ' item-row-editing' : ''}`}
                >
                  {/* Image */}
                  <div className="item-row-img">
                    {img
                      ? <img src={img} alt={item.name} draggable={false} />
                      : <Gem size={24} className="item-image-placeholder" aria-hidden="true" />
                    }
                  </div>

                  {/* Info */}
                  <div className="item-row-info">
                    <div className="item-row-name-line">
                      <span className="item-row-name" title={item.name}>{item.name}</span>
                      {marketEntry
                        ? (
                          <span className="item-row-price-badge item-price-market" title={t('items.marketPriceTooltip')}>
                            <Store size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} /> {marketEntry.basePrice.toLocaleString()} {t('common.silver')}
                          </span>
                        )
                        : item.price > 0 && (
                          <span className="item-row-price-badge item-price-manual" title={t('items.manualPriceTooltip')}>
                            <Pencil size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} /> {formatPrice(item.price)}
                          </span>
                        )
                      }
                      {rateLabel && (
                          <span className="item-drop-rate-badge" title={t('items.dropRateTooltip')}>
                          <Package size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} /> {rateLabel}
                        </span>
                      )}
                    </div>
                    {/* Market details */}
                    {marketEntry && (
                      <div className="item-row-market-details">
                        <span className="market-detail-chip">
                          <span className="market-detail-label">{t('items.stockLabel')}</span>
                          <span className="market-detail-value">{marketEntry.stock.toLocaleString()}</span>
                        </span>
                        <span className="market-detail-chip">
                          <span className="market-detail-label">{t('settings.basePriceLabel')}</span>
                          <span className="market-detail-value">{marketEntry.basePrice.toLocaleString()} {t('common.silver')}</span>
                        </span>
                        {item.price > 0 && (
                          <span className="market-detail-chip market-detail-override-note">
                              ({t('items.manualOverrideNote', { price: item.price.toLocaleString() })})
                          </span>
                        )}
                      </div>
                    )}
                    {item.marketId != null && String(item.marketId).trim() !== '' && !marketEntry && (
                      <div className="item-row-market-details">
                        <span className="market-detail-chip market-detail-loading">
                            <RefreshCw size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} /> {t('items.marketIdWaiting', { id: String(item.marketId) })}
                        </span>
                      </div>
                    )}
                    {locNames.length > 0 && (
                      <div className="item-row-locs">
                        {locNames.map((n, i) => (
                          <span
                            key={i}
                            className={`item-loc-badge${filterLocId !== 'all' && (itemLocationMap.get(item.id) ?? []).find(l => l.name === n)?.id === filterLocId ? ' item-loc-badge-active' : ''}`}
                          >
                            <MapPin size={10} aria-hidden="true" />{n}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="item-row-actions">
                    <button
                      className="btn-labeled btn-labeled-edit"
                      aria-label={t('items.editAria', { name: item.name })}
                      onClick={() => handleEdit(item)}
                    >
                      <Pencil size={13} aria-hidden="true" />
                      {t('common.edit')}
                    </button>
                    <button
                      className="btn-labeled btn-labeled-delete"
                      aria-label={t('items.deleteAria', { name: item.name })}
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      {t('common.delete')}
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

export default ItemRegistrationPage

