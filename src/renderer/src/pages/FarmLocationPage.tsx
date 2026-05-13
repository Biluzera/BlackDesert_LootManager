import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Pencil, Trash2, Map as MapIcon, Mountain, FolderOpen, Gem, Search, Save, X, Check, Sword, Swords, Shield } from 'lucide-react'
import type { Item } from './ItemRegistrationPage'
import type { FarmSession } from './FarmSessionPage'
import { useDevMode } from '../context/DevModeContext'
import { MOCK_ITEMS, MOCK_LOCATIONS, MOCK_SESSIONS } from '../context/DevModeContext'
import { useLanguage } from '../context/LanguageContext'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FarmLocation {
  id: string
  name: string
  imageFile: string | null
  lootIds: string[]   // references to Item.id
  apMin?: number
  apMax?: number
  dp?: number
  createdAt: string
}

// ── Component ─────────────────────────────────────────────────────────────────

function FarmLocationPage(): React.ReactElement {
  const { devMode } = useDevMode()
  const { t } = useLanguage()
  const [locations, setLocations] = useState<FarmLocation[]>([])
  const [allItems, setAllItems]   = useState<Item[]>([])
  const [imageCache, setImageCache] = useState<Record<string, string>>({})
  const [loaded, setLoaded]       = useState(false)
  const [sessions, setSessions]   = useState<FarmSession[]>([])

  // Form state
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [name, setName]             = useState('')
  const [imageFile, setImageFile]   = useState<string | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [apMin, setApMin]           = useState('')
  const [apMax, setApMax]           = useState('')
  const [dp, setDp]                 = useState('')

  // Loot search dropdown
  const [searchQuery, setSearchQuery]   = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // ── Load on mount ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load(): Promise<void> {
      if (devMode) {
        setLocations(MOCK_LOCATIONS)
        setAllItems(MOCK_ITEMS)
        setSessions(MOCK_SESSIONS)
        setLoaded(true)
        return
      }
      const [locData, itemData, sessData] = await Promise.all([
        window.api.readJson('locations.json') as Promise<FarmLocation[] | null>,
        window.api.readJson('items.json')     as Promise<Item[] | null>,
        window.api.readJson('sessions.json')  as Promise<FarmSession[] | null>
      ])
      const locs  = Array.isArray(locData)  ? locData  : []
      const items = Array.isArray(itemData) ? itemData : []
      const sess  = Array.isArray(sessData) ? sessData : []
      setLocations(locs)
      setAllItems(items)
      setSessions(sess)

      // Load images for items and locations
      const cache: Record<string, string> = {}
      const allFiles = [
        ...items.map(i => i.imageFile),
        ...locs.map(l => l.imageFile)
      ]
      for (const file of allFiles) {
        if (file && !cache[file]) {
          const url = await window.api.getImageDataUrl(file)
          if (url) cache[file] = url
        }
      }
      setImageCache(cache)
      setLoaded(true)
    }
    load()
  }, [devMode])

  // Close dropdown on outside click
  useEffect(() => {
    function onPointerDown(e: MouseEvent): void {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function persist(list: FarmLocation[]): Promise<void> {
    if (!devMode) await window.api.writeJson('locations.json', list)
    setLocations(list)
  }

  function resetForm(): void {
    setEditingId(null)
    setName('')
    setImageFile(null)
    setImageDataUrl(null)
    setSelectedIds([])
    setSearchQuery('')
    setDropdownOpen(false)
    setError(null)
    setApMin('')
    setApMax('')
    setDp('')
  }

  async function handlePickImage(): Promise<void> {
    setError(null)
    try {
      const filename = await window.api.pickImage()
      if (!filename) return
      const url = await window.api.getImageDataUrl(filename)
      setImageFile(filename)
      setImageDataUrl(url)
      if (filename && url) setImageCache(prev => ({ ...prev, [filename]: url }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('locations.imageError'))
    }
  }

  function itemById(id: string): Item | undefined {
    return allItems.find(i => i.id === id)
  }

  // Items visible in the dropdown (not yet selected, match query)
  const filteredItems = allItems.filter(item => {
    if (selectedIds.includes(item.id)) return false
    if (!searchQuery.trim()) return true
    return item.name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const locationStats = useMemo(() => {
    const itemMap = new Map(allItems.map(i => [i.id, i]))
    const result  = new Map<string, { count: number; total: number; avg: number; avgPph: number | null }>()
    for (const loc of locations) {
      const locSessions = sessions.filter(s => s.locationId === loc.id)
      const count = locSessions.length
      let total = 0
      const pphValues: number[] = []
      for (const s of locSessions) {
        let sessTotal = 0
        for (const e of s.loot) {
          const item = itemMap.get(e.itemId)
          if (!item) continue
          const qty = Math.max(0, e.qtyAfter - e.qtyBefore)
          sessTotal += qty * item.price
        }
        total += sessTotal
        const mins = s.durationMinutes ?? 0
        if (mins > 0) pphValues.push(Math.round(sessTotal / (mins / 60)))
      }
      const avgPph = pphValues.length > 0
        ? Math.round(pphValues.reduce((a, b) => a + b, 0) / pphValues.length)
        : null
      result.set(loc.id, { count, total, avg: count > 0 ? Math.round(total / count) : 0, avgPph })
    }
    return result
  }, [locations, sessions, allItems])

  // ── Drop rate per item per location ────────────────────────────────────────
  // Map<locId, Map<itemId, { qtyPerHour: number|null; qtyPerSess: number|null }>>
  const lootDropRates = useMemo(() => {
    const result = new Map<string, Map<string, { qtyPerHour: number | null; qtyPerSess: number | null }>>()
    for (const loc of locations) {
      const locSessions = sessions.filter(s => s.locationId === loc.id)
      const itemMap2 = new Map<string, { totalQty: number; timedQty: number; totalMins: number; sessCount: number }>()
      for (const s of locSessions) {
        const mins = s.durationMinutes ?? 0
        for (const e of s.loot) {
          const qty = Math.max(0, e.qtyAfter - e.qtyBefore)
          const prev = itemMap2.get(e.itemId) ?? { totalQty: 0, timedQty: 0, totalMins: 0, sessCount: 0 }
          itemMap2.set(e.itemId, {
            totalQty:  prev.totalQty  + qty,
            timedQty:  prev.timedQty  + (mins > 0 ? qty : 0),
            totalMins: prev.totalMins + (mins > 0 ? mins : 0),
            sessCount: prev.sessCount + 1,
          })
        }
      }
      const locMap = new Map<string, { qtyPerHour: number | null; qtyPerSess: number | null }>()
      for (const [itemId, d] of itemMap2) {
        const qtyPerHour  = d.totalMins > 0 ? Math.round((d.timedQty / d.totalMins) * 60 * 10) / 10 : null
        const qtyPerSess  = d.sessCount > 0 ? Math.round((d.totalQty / d.sessCount) * 10) / 10 : null
        locMap.set(itemId, { qtyPerHour, qtyPerSess })
      }
      result.set(loc.id, locMap)
    }
    return result
  }, [locations, sessions])

  const addLoot = useCallback((id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev : [...prev, id])
    setSearchQuery('')
    setDropdownOpen(false)
  }, [])

  const removeLoot = useCallback((id: string) => {
    setSelectedIds(prev => prev.filter(x => x !== id))
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setError(null)
    setSaving(true)
    try {
      if (editingId !== null) {
        const updated = locations.map(loc =>
          loc.id === editingId
            ? { ...loc, name: trimmed, imageFile, lootIds: selectedIds,
                apMin: apMin ? Number(apMin) : undefined,
                apMax: apMax ? Number(apMax) : undefined,
                dp:    dp    ? Number(dp)    : undefined }
            : loc
        )
        await persist(updated)
      } else {
        const newLoc: FarmLocation = {
          id: `loc_${Date.now()}`,
          name: trimmed,
          imageFile,
          lootIds: selectedIds,
          apMin: apMin ? Number(apMin) : undefined,
          apMax: apMax ? Number(apMax) : undefined,
          dp:    dp    ? Number(dp)    : undefined,
          createdAt: new Date().toISOString()
        }
        await persist([...locations, newLoc])
      }
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveError'))
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(loc: FarmLocation): void {
    setEditingId(loc.id)
    setName(loc.name)
    setImageFile(loc.imageFile ?? null)
    setImageDataUrl(loc.imageFile ? (imageCache[loc.imageFile] ?? null) : null)
    setSelectedIds(loc.lootIds)
    setSearchQuery('')
    setDropdownOpen(false)
    setError(null)
    setApMin(loc.apMin != null ? String(loc.apMin) : '')
    setApMax(loc.apMax != null ? String(loc.apMax) : '')
    setDp(loc.dp != null ? String(loc.dp) : '')
    const area = document.querySelector('.content-area')
    if (area) area.scrollTop = 0
  }

  async function handleDelete(id: string): Promise<void> {
    await persist(locations.filter(loc => loc.id !== id))
    if (editingId === id) resetForm()
  }

  const isEditing = editingId !== null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page-container">
      <h2 className="page-title">
        <span className="page-title-icon" aria-hidden="true"><MapIcon size={20} /></span>
        {t('locations.pageTitle')}
      </h2>

      {/* ── Form ── */}
      <section className="form-section">
        <div className="wood-panel">
          <h3 className="panel-section-title">
            {isEditing
              ? <><Pencil size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} aria-hidden="true" /> {t('locations.editTitle')}</>
              : t('locations.newBtn')
            }
          </h3>

          {error && <p className="form-error" role="alert">{error}</p>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="loc-form-layout">
              <div className="loc-form-top">
                {/* Left: name + image picker */}
                <div className="loc-form-fields">

              {/* Name */}
              <div className="form-field">
                <label className="form-label" htmlFor="loc-name">
                  {t('locations.nameLabel')} <span className="required-mark">*</span>
                </label>
                <input
                  id="loc-name"
                  className="form-input"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('locations.namePlaceholder')}
                  maxLength={100}
                  required
                  autoComplete="off"
                />
              </div>

              {/* Gear requirements */}
              <div className="loc-gear-row">
                <div className="form-field">
                  <label className="form-label" htmlFor="loc-ap-min">{t('locations.apMin')}</label>
                  <input
                    id="loc-ap-min"
                    className="form-input loc-gear-input"
                    type="number"
                    min="0"
                    max="9999"
                    value={apMin}
                    onChange={e => setApMin(e.target.value)}
                    placeholder="—"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="loc-ap-max">{t('locations.apMax')}</label>
                  <input
                    id="loc-ap-max"
                    className="form-input loc-gear-input"
                    type="number"
                    min="0"
                    max="9999"
                    value={apMax}
                    onChange={e => setApMax(e.target.value)}
                    placeholder="—"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="loc-dp">{t('locations.dp')}</label>
                  <input
                    id="loc-dp"
                    className="form-input loc-gear-input"
                    type="number"
                    min="0"
                    max="9999"
                    value={dp}
                    onChange={e => setDp(e.target.value)}
                    placeholder="—"
                  />
                </div>
              </div>

                  {/* Image picker */}
                  <div className="form-field">
                    <span className="form-label">{t('locations.iconLabel')}</span>
                    <div className="pick-image-row">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handlePickImage}
                      >
                      <FolderOpen size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} aria-hidden="true" /> {t('locations.selectPng')}
                      </button>
                      {imageFile
                        ? <span className="image-filename"><Check size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} aria-hidden="true" />{t('locations.imageSelected')}</span>
                        : <span className="image-filename-empty">{t('locations.noImageSelected')}</span>
                      }
                      {imageFile && (
                        <button
                          type="button"
                          className="btn-icon-remove"
                          aria-label={t('locations.removeImageAria')}
                          onClick={() => { setImageFile(null); setImageDataUrl(null) }}
                        ><X size={12} aria-hidden="true" /></button>
                      )}
                    </div>
                  </div>

                </div>{/* /loc-form-fields */}

                {/* Right: image preview */}
                <div className="image-preview-column">
                  <span className="form-label preview-label">{t('locations.previewLabel')}</span>
                  <div className="image-preview-box">
                    {imageDataUrl
                      ? <img src={imageDataUrl} alt={t('locations.previewAlt')} draggable={false} />
                      : <Mountain size={32} className="image-preview-placeholder" aria-hidden="true" />
                    }
                  </div>
                </div>

              </div>{/* /loc-form-top */}

              {/* Loot picker */}
              <div className="form-field">
                <span className="form-label">{t('locations.lootsLabel')}</span>

                {/* Selected loot tags */}
                {selectedIds.length > 0 && (
                  <ul className="loot-tags" aria-label={t('locations.lootsSelected')}>
                    {selectedIds.map(id => {
                      const item = itemById(id)
                      if (!item) return null
                      const img = item.imageFile ? imageCache[item.imageFile] : null
                      return (
                        <li key={id} className="loot-tag">
                          {img
                            ? <img src={img} alt="" className="loot-tag-img" draggable={false} />
                            : <Gem size={14} className="loot-tag-icon" aria-hidden="true" />
                          }
                          <span className="loot-tag-name">{item.name}</span>
                          <button
                            type="button"
                            className="loot-tag-remove"
                            aria-label={t('locations.removeLootAria', { name: item.name })}
                            onClick={() => removeLoot(id)}
                          >
                            <X size={11} aria-hidden="true" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {/* Search box */}
                <div className="loot-search-wrap" ref={searchRef}>
                  <input
                    className="form-input loot-search-input"
                    type="text"
                    placeholder={allItems.length === 0 ? t('locations.noItemsPlaceholder') : t('locations.searchItemPlaceholder')}
                    value={searchQuery}
                    disabled={allItems.length === 0}
                    onChange={e => { setSearchQuery(e.target.value); setDropdownOpen(true) }}
                    onFocus={() => setDropdownOpen(true)}
                    autoComplete="off"
                  />

                  {dropdownOpen && filteredItems.length > 0 && (
                      <ul className="loot-dropdown" role="listbox" aria-label={t('locations.availableItems')}>
                      {filteredItems.map(item => {
                        const img = item.imageFile ? imageCache[item.imageFile] : null
                        return (
                          <li
                            key={item.id}
                            role="option"
                            aria-selected={false}
                            className="loot-dropdown-item"
                            onPointerDown={e => { e.preventDefault(); addLoot(item.id) }}
                          >
                            <div className="loot-dropdown-img">
                              {img
                                ? <img src={img} alt="" draggable={false} />
                                : <Gem size={16} aria-hidden="true" />
                              }
                            </div>
                            <span className="loot-dropdown-name">{item.name}</span>
                            {item.price > 0 && (
                              <span className="loot-dropdown-price">
                                {item.price.toLocaleString()} {t('common.silver')}
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {dropdownOpen && searchQuery.trim() !== '' && filteredItems.length === 0 && (
                    <div className="loot-dropdown loot-dropdown-empty">
                      {t('locations.noItemsFound')}
                    </div>
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
                  {saving
                    ? t('common.saving')
                    : isEditing
                      ? <><Save size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} aria-hidden="true" /> {t('common.saveChanges')}</>
                      : <><Save size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} aria-hidden="true" /> {t('locations.registerBtn')}</>
                  }
                </button>
                {isEditing && (
                  <button type="button" className="btn btn-secondary" onClick={resetForm}>
                    {t('common.cancel')}
                  </button>
                )}
              </div>

            </div>
          </form>
        </div>
      </section>

      {/* ── List ── */}
      <section>
        <div className="items-list-heading">
          <span>{t('locations.registeredLocations')}</span>
          <span className="items-count">{locations.length}</span>
        </div>

        {!loaded ? (
          <p className="loading-text">{t('common.loading')}</p>
        ) : locations.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true"><MapIcon size={48} /></span>
            <span className="empty-state-text">{t('locations.emptyState')}</span>
          </div>
        ) : (
          <ul className="loc-list" role="list">
            {locations.map(loc => (
              <li
                key={loc.id}
                className={`loc-card${editingId === loc.id ? ' item-card-editing' : ''}`}
              >
                <div className="loc-card-header">
                  <div className="loc-card-identity">
                    <div className="loc-card-icon-wrap">
                      {loc.imageFile && imageCache[loc.imageFile]
                        ? <img src={imageCache[loc.imageFile]} alt="" draggable={false} />
                        : <Mountain size={20} aria-hidden="true" />
                      }
                    </div>
                    <span className="loc-card-name">{loc.name}</span>
                  </div>
                  <div className="item-card-actions" style={{ border: 'none' }}>
                    <button
                      className="btn-labeled btn-labeled-edit"
                      aria-label={t('locations.editAria', { name: loc.name })}
                      onClick={() => handleEdit(loc)}
                    >
                      <Pencil size={13} aria-hidden="true" />
                      {t('common.edit')}
                    </button>
                    <button
                      className="btn-labeled btn-labeled-delete"
                      aria-label={t('locations.deleteAria', { name: loc.name })}
                      onClick={() => handleDelete(loc.id)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      {t('common.delete')}
                    </button>
                  </div>
                </div>

                {(loc.apMin != null || loc.apMax != null || loc.dp != null) && (
                  <div className="loc-gear-req">
                    {loc.apMin != null && (
                      <span className="loc-gear-badge loc-gear-ap-min" title={t('locations.apMinTitle')}>
                        <Sword size={11} aria-hidden="true" className="loc-gear-icon" />
                        <span className="loc-gear-key">{t('locations.apMinShort')}</span>
                        <span className="loc-gear-val">{loc.apMin}</span>
                      </span>
                    )}
                    {loc.apMax != null && (
                      <span className="loc-gear-badge loc-gear-ap-max" title={t('locations.apMaxTitle')}>
                        <Swords size={11} aria-hidden="true" className="loc-gear-icon" />
                        <span className="loc-gear-key">{t('locations.apMaxShort')}</span>
                        <span className="loc-gear-val">{loc.apMax}</span>
                      </span>
                    )}
                    {loc.dp != null && (
                      <span className="loc-gear-badge loc-gear-dp" title={t('locations.dpTitle')}>
                        <Shield size={11} aria-hidden="true" className="loc-gear-icon" />
                        <span className="loc-gear-key">{t('locations.dpShort')}</span>
                        <span className="loc-gear-val">{loc.dp}</span>
                      </span>
                    )}
                  </div>
                )}

                {(() => {
                  const st = locationStats.get(loc.id) ?? { count: 0, total: 0, avg: 0, avgPph: null }
                  if (st.count === 0) return null
                  return (
                    <div className="loc-stats">
                      <div className="loc-stat-item">
                        <span className="loc-stat-value">{st.count}</span>
                        <span className="loc-stat-label">{t('locations.statSessions')}</span>
                      </div>
                      <div className="loc-stat-sep" aria-hidden="true" />
                      <div className="loc-stat-item">
                        <span className="loc-stat-value">{st.avg.toLocaleString()}</span>
                        <span className="loc-stat-label">{t('locations.statAvgPerSess')}</span>
                      </div>
                      {st.avgPph !== null && (
                        <>
                          <div className="loc-stat-sep" aria-hidden="true" />
                          <div className="loc-stat-item">
                            <span className="loc-stat-value loc-stat-pph">{st.avgPph.toLocaleString()}</span>
                            <span className="loc-stat-label">{t('locations.statAvgPph')}</span>
                          </div>
                        </>
                      )}
                      <div className="loc-stat-sep" aria-hidden="true" />
                      <div className="loc-stat-item">
                        <span className="loc-stat-value">{st.total.toLocaleString()}</span>
                        <span className="loc-stat-label">{t('locations.statTotal')}</span>
                      </div>
                    </div>
                  )
                })()}

                {loc.lootIds.length === 0 ? (
                  <p className="loc-no-loot">{t('locations.noLootConfigured')}</p>
                ) : (
                  <ul className="loc-loot-list" aria-label={t('locations.lootsOfAria', { name: loc.name })}>
                    {loc.lootIds.map(id => {
                      const item = itemById(id)
                      if (!item) return null
                      const img  = item.imageFile ? imageCache[item.imageFile] : null
                      const rate = lootDropRates.get(loc.id)?.get(id)
                      const rateLabel = rate?.qtyPerHour != null
                        ? `${rate.qtyPerHour.toLocaleString()}/${t('locations.ratePerHour')}`
                        : rate?.qtyPerSess != null
                          ? `~${rate.qtyPerSess.toLocaleString()}/${t('locations.ratePerSession')}`
                          : null
                      return (
                        <li key={id} className={`loc-loot-chip${rateLabel ? ' loc-loot-chip--has-rate' : ''}`}>
                          {img
                            ? <img src={img} alt="" className="loc-loot-img" draggable={false} />
                            : <Gem size={14} aria-hidden="true" />
                          }
                          <span className="loc-loot-name">{item.name}</span>
                          {rateLabel && (
                            <span className="loc-loot-rate" title={t('locations.dropRateTooltip')}>
                              {rateLabel}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default FarmLocationPage
