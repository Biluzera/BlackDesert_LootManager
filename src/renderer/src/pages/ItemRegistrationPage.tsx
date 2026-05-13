import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Pencil, Trash2, MapPin, Search, ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp01, Gem, Package, FolderOpen, Save, RefreshCw, Store, Clock, Check, X, Link, Download } from 'lucide-react'
import type { FarmLocation } from './FarmLocationPage'
import type { FarmSession } from './FarmSessionPage'
import { useDevMode } from '../context/DevModeContext'
import { MOCK_ITEMS, MOCK_LOCATIONS, MOCK_SESSIONS } from '../context/DevModeContext'
import { useMarket } from '../context/MarketContext'
import { useLanguage } from '../context/LanguageContext'
import { useItemDb } from '../context/ItemDbContext'
import type { BdoDbItem } from '../context/ItemDbContext'
import { fetchMarketPrices } from '../services/marketApi'

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
  const { t, language } = useLanguage()
  const { itemDb, dbLoaded } = useItemDb()
  const [items, setItems] = useState<Item[]>([])
  const [locations, setLocations] = useState<FarmLocation[]>([])
  const [sessions, setSessions] = useState<FarmSession[]>([])
  const [imageCache, setImageCache] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [selectedDbItem, setSelectedDbItem] = useState<BdoDbItem | null>(null)
  const [dbDropdownOpen, setDbDropdownOpen] = useState(false)
  const [autoFetchingPrice, setAutoFetchingPrice] = useState(false)
  const [autoFetchingIcon, setAutoFetchingIcon] = useState(false)
  const [priceFromMarket, setPriceFromMarket] = useState(false)
  const [price, setPrice] = useState('')
  const [imageFile, setImageFile] = useState<string | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [downloadingUrl, setDownloadingUrl] = useState(false)
  type ImageSource = 'file' | 'url'
  const [imageSource, setImageSource] = useState<ImageSource>('file')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formSectionRef = useRef<HTMLElement>(null)
  const nameSearchRef   = useRef<HTMLDivElement>(null)
  const priceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Dropdown price cache ───────────────────────────────────────────────────
  // Map<itemId string, basePrice number> — populated by debounced batch fetch
  const [dropdownPrices, setDropdownPrices] = useState<Map<string, number>>(() => new Map())

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

  // ── Close dropdown on outside click ───────────────────────────────────────

  useEffect(() => {
    function handleOutside(e: MouseEvent): void {
      if (nameSearchRef.current && !nameSearchRef.current.contains(e.target as Node)) {
        setDbDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function persistItems(list: Item[]): Promise<void> {
    if (!devMode) await window.api.writeJson('items.json', list)
    setItems(list)
    setMarketItems(list)
  }

  function resetForm(): void {
    setEditingId(null)
    setName('')
    setSelectedDbItem(null)
    setDbDropdownOpen(false)
    setAutoFetchingPrice(false)
    setAutoFetchingIcon(false)
    setPriceFromMarket(false)
    setPrice('')
    setImageFile(null)
    setImageDataUrl(null)
    setImageUrl('')
    setImageSource('file')
    setError(null)
  }

  function scrollToForm(): void {
    // Scroll the .content-area container (not window) to top
    const area = document.querySelector('.content-area')
    if (area) area.scrollTop = 0
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Called when user selects an item from the DB dropdown */
  const handleSelectDbItem = useCallback(async (dbItem: BdoDbItem): Promise<void> => {
    setSelectedDbItem(dbItem)
    setName(dbItem.name)
    setDbDropdownOpen(false)
    setError(null)

    // Use cached price from dropdown immediately — skip network call if already known
    const cachedPrice = dropdownPrices.get(String(dbItem.id))
    if (cachedPrice != null && cachedPrice > 0) {
      setPrice(String(cachedPrice))
      setPriceFromMarket(true)
      setAutoFetchingPrice(false)
    } else {
      setPrice('')
      setPriceFromMarket(false)
      setAutoFetchingPrice(true)
      fetchMarketPrices([String(dbItem.id)])
        .then(result => {
          const entry = result?.get(String(dbItem.id))
          if (entry && entry.basePrice > 0) {
            setPrice(String(entry.basePrice))
            setPriceFromMarket(true)
            setDropdownPrices(prev => new Map(prev).set(String(dbItem.id), entry.basePrice))
          }
        })
        .catch(() => {})
        .finally(() => setAutoFetchingPrice(false))
    }

    // Show CDN preview immediately — no IPC needed for display
    const cdnUrl = `https://s1.pearlcdn.com/SA/TradeMarket/Common/img/BDO/item/${dbItem.id}.png`
    setImageDataUrl(cdnUrl)
    setImageFile(null)
    setAutoFetchingIcon(true)

    // Save locally in background so the item has a persistent copy
    window.api
      .fetchItemIcon(dbItem.id)
      .then(async filename => {
        if (!filename) {
          setImageDataUrl(null)
          return
        }
        const url = await window.api.getImageDataUrl(filename)
        setImageFile(filename)
        if (url) {
          setImageDataUrl(url)
          setImageCache(prev => ({ ...prev, [filename]: url }))
        }
      })
      .catch(() => {})
      .finally(() => setAutoFetchingIcon(false))
  }, [dropdownPrices])

  function handleClearDbSelection(): void {
    setSelectedDbItem(null)
    setName('')
    setPrice('')
    setImageFile(null)
    setImageDataUrl(null)
    setDbDropdownOpen(true)
  }

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

  async function handleDownloadUrl(): Promise<void> {
    const trimmedUrl = imageUrl.trim()
    if (!trimmedUrl) return
    setError(null)
    setDownloadingUrl(true)
    try {
      const filename = await window.api.downloadImageFromUrl(trimmedUrl)
      if (!filename) return
      const url = await window.api.getImageDataUrl(filename)
      setImageFile(filename)
      setImageDataUrl(url)
      if (filename && url) {
        setImageCache(prev => ({ ...prev, [filename]: url }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('items.urlError'))
    } finally {
      setDownloadingUrl(false)
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
            ? { ...item, name: trimmedName, price: parsePrice(price), marketId: (selectedDbItem && priceFromMarket) ? String(selectedDbItem.id) : undefined, imageFile }
            : item
        )
        await persistItems(updated)
      } else {
        const newItem: Item = {
          id: `item_${Date.now()}`,
          name: trimmedName,
          price: parsePrice(price),
          marketId: (selectedDbItem && priceFromMarket) ? String(selectedDbItem.id) : undefined,
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
    const dbItem = item.marketId != null ? (itemDb.find(d => d.id === Number(item.marketId)) ?? null) : null
    setSelectedDbItem(dbItem)
    setDbDropdownOpen(false)
    setImageFile(item.imageFile)
    setImageDataUrl(item.imageFile ? (imageCache[item.imageFile] ?? null) : null)
    setImageUrl('')
    setImageSource(item.imageFile ? 'file' : 'file')
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

  // Filtered DB search results
  const dbResults = useMemo(() => {
    const q = name.trim().toLowerCase()
    if (!q || !dbLoaded || itemDb.length === 0) return []
    return itemDb.filter(i => i.name.toLowerCase().includes(q)).slice(0, 20)
  }, [name, itemDb, dbLoaded])

  // When dbResults changes, debounce 400ms then batch-fetch prices for all visible IDs
  useEffect(() => {
    if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current)
    if (dbResults.length === 0) return
    priceDebounceRef.current = setTimeout(async () => {
      const ids = dbResults.map(i => String(i.id))
      try {
        const result = await fetchMarketPrices(ids)
        if (!result) return
        setDropdownPrices(prev => {
          const next = new Map(prev)
          for (const [id, entry] of result) {
            if (entry.basePrice > 0) next.set(id, entry.basePrice)
          }
          return next
        })
      } catch { /* network error — silently ignore */ }
    }, 400)
    return () => { if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current) }
  }, [dbResults])

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

                {/* DB item search / selected display */}
                <div className="form-field" ref={nameSearchRef}>
                  <label className="form-label" htmlFor="item-name">
                    {t('items.nameLabel')} <span className="required-mark">*</span>
                  </label>
                  {selectedDbItem ? (
                    <div className="item-db-selected">
                      <span className="item-db-selected-name">{name}</span>
                      <button
                        type="button"
                        className="btn-icon-remove"
                        onClick={handleClearDbSelection}
                        title={t('items.changeItem')}
                        aria-label={t('items.changeItem')}
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <div className="item-db-search-wrap">
                      <Search size={14} className="item-db-search-icon" aria-hidden="true" />
                      <input
                        id="item-name"
                        className="form-input item-db-search-input"
                        type="text"
                        value={name}
                        onChange={e => { setName(e.target.value); setDbDropdownOpen(true) }}
                        onFocus={() => setDbDropdownOpen(true)}
                        placeholder={dbLoaded ? t('items.dbSearchPlaceholder') : t('items.dbLoading')}
                        disabled={!dbLoaded}
                        autoComplete="off"
                        aria-autocomplete="list"
                        aria-expanded={dbDropdownOpen}
                      />
                      {dbDropdownOpen && name.trim() !== '' && (
                        <ul className="item-db-dropdown" role="listbox">
                          {dbResults.length > 0
                            ? dbResults.map(dbItem => {
                              const cdnIcon = `https://s1.pearlcdn.com/SA/TradeMarket/Common/img/BDO/item/${dbItem.id}.png`
                              const cachedPrice = dropdownPrices.get(String(dbItem.id))
                              return (
                                <li
                                  key={dbItem.id}
                                  className="item-db-dropdown-option"
                                  role="option"
                                  onMouseDown={() => void handleSelectDbItem(dbItem)}
                                >
                                  <img
                                    src={cdnIcon}
                                    className="item-db-dropdown-icon"
                                    alt=""
                                    aria-hidden="true"
                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                                  />
                                  <span className="item-db-dropdown-name">{dbItem.name}</span>
                                  {cachedPrice != null && (
                                    <span className="item-db-dropdown-price">{cachedPrice.toLocaleString()}</span>
                                  )}
                                </li>
                              )
                            })
                            : <li className="item-db-dropdown-empty">{t('items.dbSearchNoResults')}</li>
                          }
                        </ul>
                      )}
                    </div>
                  )}
                  {(autoFetchingPrice || autoFetchingIcon) && (
                    <span className="item-db-autofetch-hint">
                      <RefreshCw size={12} className="market-status-spin" aria-hidden="true" />
                      {' '}{autoFetchingPrice && autoFetchingIcon
                        ? t('items.autoFetchingBoth')
                        : autoFetchingPrice
                          ? t('items.autoFetchingPrice')
                          : t('items.autoFetchingIcon')}
                    </span>
                  )}
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
                    disabled={autoFetchingPrice}
                  />
                </div>

                {/* Image picker */}
                <div className="form-field">
                  {/* Not-tradeable warning: item selected, both fetches done, nothing found */}
                  {selectedDbItem !== null && !autoFetchingIcon && !autoFetchingPrice && !priceFromMarket && imageFile === null && (()=> {
                    const bdoLang = language === 'pt-br' ? 'pt' : language
                    const bdoUrl = `https://bdocodex.com/${bdoLang}/item/${selectedDbItem.id}/`
                    return (
                      <div className="item-not-tradeable-warning">
                        <span>
                          {t('items.notTradeableWarning')}{' '}
                          <a
                            href={bdoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="item-not-tradeable-link"
                            onClick={e => { e.preventDefault(); void window.api.openExternal(bdoUrl) }}
                          >
                            bdocodex.com
                          </a>
                        </span>
                      </div>
                    )
                  })()}
                  <span className="form-label">{t('items.imageLabel')}</span>

                  {/* Source type tabs */}
                  <div className="image-source-tabs">
                    <button
                      type="button"
                      className={`image-source-tab${imageSource === 'file' ? ' image-source-tab-active' : ''}`}
                      onClick={() => setImageSource('file')}
                    >
                      <FolderOpen size={13} aria-hidden="true" /> {t('items.sourceFile')}
                    </button>
                    <button
                      type="button"
                      className={`image-source-tab${imageSource === 'url' ? ' image-source-tab-active' : ''}`}
                      onClick={() => setImageSource('url')}
                    >
                      <Link size={13} aria-hidden="true" /> {t('items.sourceUrl')}
                    </button>
                  </div>

                  {/* File tab */}
                  {imageSource === 'file' && (
                    <div className="pick-image-row">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handlePickImage}
                      >
                        <FolderOpen size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('items.selectImageBtn')}
                      </button>
                      {imageFile
                        ? <span className="image-filename"><Check size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} aria-hidden="true" />{t('items.imageSelected')}</span>
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
                  )}

                  {/* URL tab */}
                  {imageSource === 'url' && (
                    <div className="image-url-row">
                      <input
                        className="image-url-input"
                        type="url"
                        placeholder={t('items.urlPlaceholder')}
                        value={imageUrl}
                        onChange={e => setImageUrl(e.target.value)}
                        autoComplete="off"
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleDownloadUrl() } }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void handleDownloadUrl()}
                        disabled={!imageUrl.trim() || downloadingUrl}
                      >
                        {downloadingUrl
                          ? <><RefreshCw size={14} className="market-status-spin" style={{ verticalAlign: 'middle', marginRight: 4 }} aria-hidden="true" />{t('items.downloading')}</>
                          : <><Download size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} aria-hidden="true" />{t('items.downloadBtn')}</>
                        }
                      </button>
                      {imageFile && (
                        <>
                          <span className="image-filename"><Check size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} aria-hidden="true" />{t('items.imageSelected')}</span>
                          <button
                            type="button"
                            className="btn-icon-remove"
                            aria-label={t('items.removeImageAria')}
                            onClick={handleRemoveImage}
                            title={t('items.removeImageAria')}
                          >
                            <X size={12} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || !name.trim() || (!isEditing && itemDb.length > 0 && !selectedDbItem)}
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

