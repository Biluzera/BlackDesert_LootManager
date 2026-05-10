import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { Item } from './ItemRegistrationPage'
import type { FarmSession } from './FarmSessionPage'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FarmLocation {
  id: string
  name: string
  imageFile: string | null
  lootIds: string[]   // references to Item.id
  createdAt: string
}

// ── Component ─────────────────────────────────────────────────────────────────

function FarmLocationPage(): React.ReactElement {
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

  // Loot search dropdown
  const [searchQuery, setSearchQuery]   = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // ── Load on mount ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load(): Promise<void> {
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
  }, [])

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
    await window.api.writeJson('locations.json', list)
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
      setError(e instanceof Error ? e.message : 'Erro ao selecionar imagem.')
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
            ? { ...loc, name: trimmed, imageFile, lootIds: selectedIds }
            : loc
        )
        await persist(updated)
      } else {
        const newLoc: FarmLocation = {
          id: `loc_${Date.now()}`,
          name: trimmed,
          imageFile,
          lootIds: selectedIds,
          createdAt: new Date().toISOString()
        }
        await persist([...locations, newLoc])
      }
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
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
        <span className="page-title-icon" aria-hidden="true">🗺️</span>
        Locais de Farm
      </h2>

      {/* ── Form ── */}
      <section className="form-section">
        <div className="wood-panel">
          <h3 className="panel-section-title">
            {isEditing ? '✏️ Editar Local' : '+ Novo Local de Farm'}
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
                  Nome do Local <span className="required-mark">*</span>
                </label>
                <input
                  id="loc-name"
                  className="form-input"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex.: Harpy Canyon"
                  maxLength={100}
                  required
                  autoComplete="off"
                />
              </div>

                  {/* Image picker */}
                  <div className="form-field">
                    <span className="form-label">Ícone do Local (PNG opcional)</span>
                    <div className="pick-image-row">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handlePickImage}
                      >
                        📁 Selecionar PNG
                      </button>
                      {imageFile
                        ? <span className="image-filename">Imagem selecionada ✓</span>
                        : <span className="image-filename-empty">Nenhuma imagem selecionada</span>
                      }
                      {imageFile && (
                        <button
                          type="button"
                          className="btn-icon-remove"
                          aria-label="Remover imagem"
                          onClick={() => { setImageFile(null); setImageDataUrl(null) }}
                        >✕</button>
                      )}
                    </div>
                  </div>

                </div>{/* /loc-form-fields */}

                {/* Right: image preview */}
                <div className="image-preview-column">
                  <span className="form-label preview-label">Prévia</span>
                  <div className="image-preview-box">
                    {imageDataUrl
                      ? <img src={imageDataUrl} alt="Prévia do local" draggable={false} />
                      : <span className="image-preview-placeholder" aria-hidden="true">⛰️</span>
                    }
                  </div>
                </div>

              </div>{/* /loc-form-top */}

              {/* Loot picker */}
              <div className="form-field">
                <span className="form-label">Loots da Área</span>

                {/* Selected loot tags */}
                {selectedIds.length > 0 && (
                  <ul className="loot-tags" aria-label="Loots selecionados">
                    {selectedIds.map(id => {
                      const item = itemById(id)
                      if (!item) return null
                      const img = item.imageFile ? imageCache[item.imageFile] : null
                      return (
                        <li key={id} className="loot-tag">
                          {img
                            ? <img src={img} alt="" className="loot-tag-img" draggable={false} />
                            : <span className="loot-tag-icon" aria-hidden="true">💎</span>
                          }
                          <span className="loot-tag-name">{item.name}</span>
                          <button
                            type="button"
                            className="loot-tag-remove"
                            aria-label={`Remover ${item.name}`}
                            onClick={() => removeLoot(id)}
                          >
                            ✕
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
                    placeholder={allItems.length === 0 ? 'Nenhum item cadastrado ainda…' : '🔍 Pesquisar item…'}
                    value={searchQuery}
                    disabled={allItems.length === 0}
                    onChange={e => { setSearchQuery(e.target.value); setDropdownOpen(true) }}
                    onFocus={() => setDropdownOpen(true)}
                    autoComplete="off"
                  />

                  {dropdownOpen && filteredItems.length > 0 && (
                    <ul className="loot-dropdown" role="listbox" aria-label="Itens disponíveis">
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
                                : <span aria-hidden="true">💎</span>
                              }
                            </div>
                            <span className="loot-dropdown-name">{item.name}</span>
                            {item.price > 0 && (
                              <span className="loot-dropdown-price">
                                {item.price.toLocaleString('pt-BR')} prata
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {dropdownOpen && searchQuery.trim() !== '' && filteredItems.length === 0 && (
                    <div className="loot-dropdown loot-dropdown-empty">
                      Nenhum item encontrado.
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
                  {saving ? 'Salvando…' : isEditing ? '⚔ Salvar Alterações' : '⚔ Cadastrar Local'}
                </button>
                {isEditing && (
                  <button type="button" className="btn btn-secondary" onClick={resetForm}>
                    Cancelar
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
          <span>Locais Cadastrados</span>
          <span className="items-count">{locations.length}</span>
        </div>

        {!loaded ? (
          <p className="loading-text">Carregando…</p>
        ) : locations.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">🗺️</span>
            <span className="empty-state-text">Nenhum local cadastrado ainda.</span>
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
                        : <span aria-hidden="true">⛰️</span>
                      }
                    </div>
                    <span className="loc-card-name">{loc.name}</span>
                  </div>
                  <div className="item-card-actions" style={{ border: 'none' }}>
                    <button
                      className="btn-labeled btn-labeled-edit"
                      aria-label={`Editar ${loc.name}`}
                      onClick={() => handleEdit(loc)}
                    >
                      <Pencil size={13} aria-hidden="true" />
                      Editar
                    </button>
                    <button
                      className="btn-labeled btn-labeled-delete"
                      aria-label={`Excluir ${loc.name}`}
                      onClick={() => handleDelete(loc.id)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      Excluir
                    </button>
                  </div>
                </div>

                {(() => {
                  const st = locationStats.get(loc.id) ?? { count: 0, total: 0, avg: 0, avgPph: null }
                  if (st.count === 0) return null
                  return (
                    <div className="loc-stats">
                      <div className="loc-stat-item">
                        <span className="loc-stat-value">{st.count}</span>
                        <span className="loc-stat-label">Sessões</span>
                      </div>
                      <div className="loc-stat-sep" aria-hidden="true" />
                      <div className="loc-stat-item">
                        <span className="loc-stat-value">{st.avg.toLocaleString('pt-BR')}</span>
                        <span className="loc-stat-label">Média / sessão</span>
                      </div>
                      {st.avgPph !== null && (
                        <>
                          <div className="loc-stat-sep" aria-hidden="true" />
                          <div className="loc-stat-item">
                            <span className="loc-stat-value loc-stat-pph">{st.avgPph.toLocaleString('pt-BR')}</span>
                            <span className="loc-stat-label">Média prata/h</span>
                          </div>
                        </>
                      )}
                      <div className="loc-stat-sep" aria-hidden="true" />
                      <div className="loc-stat-item">
                        <span className="loc-stat-value">{st.total.toLocaleString('pt-BR')}</span>
                        <span className="loc-stat-label">Total (prata)</span>
                      </div>
                    </div>
                  )
                })()}

                {loc.lootIds.length === 0 ? (
                  <p className="loc-no-loot">Nenhum loot configurado.</p>
                ) : (
                  <ul className="loc-loot-list" aria-label={`Loots de ${loc.name}`}>
                    {loc.lootIds.map(id => {
                      const item = itemById(id)
                      if (!item) return null
                      const img = item.imageFile ? imageCache[item.imageFile] : null
                      return (
                        <li key={id} className="loc-loot-chip">
                          {img
                            ? <img src={img} alt="" className="loc-loot-img" draggable={false} />
                            : <span aria-hidden="true">💎</span>
                          }
                          <span>{item.name}</span>
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
