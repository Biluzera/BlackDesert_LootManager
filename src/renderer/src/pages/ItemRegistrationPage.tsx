import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Pencil, Trash2, MapPin, Search, ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp01 } from 'lucide-react'
import type { FarmLocation } from './FarmLocationPage'
import { useDevMode } from '../context/DevModeContext'
import { MOCK_ITEMS, MOCK_LOCATIONS } from '../context/DevModeContext'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Item {
  id: string
  name: string
  price: number
  imageFile: string | null
  createdAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(p: number): string {
  if (p === 0) return '—'
  return p.toLocaleString('pt-BR') + ' prata'
}

function parsePrice(raw: string): number {
  const n = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) || n < 0 ? 0 : Math.round(n)
}

// ── Component ─────────────────────────────────────────────────────────────────

function ItemRegistrationPage(): React.ReactElement {
  const { devMode } = useDevMode()
  const [items, setItems] = useState<Item[]>([])
  const [locations, setLocations] = useState<FarmLocation[]>([])
  const [imageCache, setImageCache] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
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
        setLoaded(true)
        return
      }
      const [itemData, locData] = await Promise.all([
        window.api.readJson('items.json')     as Promise<Item[]         | null>,
        window.api.readJson('locations.json') as Promise<FarmLocation[] | null>
      ])
      const list = Array.isArray(itemData) ? itemData : []
      const locs = Array.isArray(locData)  ? locData  : []
      setItems(list)
      setLocations(locs)

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
  }

  function resetForm(): void {
    setEditingId(null)
    setName('')
    setPrice('')
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
      setError(e instanceof Error ? e.message : 'Erro ao selecionar imagem.')
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
            ? { ...item, name: trimmedName, price: parsePrice(price), imageFile }
            : item
        )
        await persistItems(updated)
      } else {
        const newItem: Item = {
          id: `item_${Date.now()}`,
          name: trimmedName,
          price: parsePrice(price),
          imageFile,
          createdAt: new Date().toISOString()
        }
        await persistItems([...items, newItem])
      }
      resetForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar item.')
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(item: Item): void {
    setEditingId(item.id)
    setName(item.name)
    setPrice(item.price > 0 ? String(item.price) : '')
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

  // Filtered + sorted list
  const visibleItems = useMemo(() => {
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
      if (sortKey === 'name-asc')  return a.name.localeCompare(b.name, 'pt-BR')
      if (sortKey === 'name-desc') return b.name.localeCompare(a.name, 'pt-BR')
      if (sortKey === 'price-asc')  return a.price - b.price
      return b.price - a.price
    })
    return list
  }, [items, searchQuery, filterLocId, sortKey, itemLocationMap])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page-container">
      <h2 className="page-title">
        <span className="page-title-icon" aria-hidden="true">💎</span>
        Registro de Itens
      </h2>

      {/* ── Form section ── */}
      <section className="form-section" ref={formSectionRef}>
        <div className="wood-panel">
          <h3 className="panel-section-title">
            {isEditing ? '✏️ Editar Item' : '+ Novo Item'}
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
                      Nome do Item <span className="required-mark">*</span>
                    </label>
                    <input
                      id="item-name"
                      className="form-input"
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Ex.: Pena de Harpy"
                      maxLength={100}
                      required
                      autoComplete="off"
                    />
                  </div>

                  {/* Price */}
                  <div className="form-field">
                    <label className="form-label" htmlFor="item-price">
                      Preço (prata)
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

                {/* Image picker */}
                <div className="form-field">
                  <span className="form-label">Imagem do Item (PNG / WebP opcional)</span>
                  <div className="pick-image-row">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handlePickImage}
                    >
                    📁 Selecionar PNG / WebP
                    </button>
                    {imageFile
                      ? <span className="image-filename" title={imageFile}>Imagem selecionada ✓</span>
                      : <span className="image-filename-empty">Nenhuma imagem selecionada</span>
                    }
                    {imageFile && (
                      <button
                        type="button"
                        className="btn-icon-remove"
                        aria-label="Remover imagem"
                        onClick={handleRemoveImage}
                        title="Remover imagem"
                      >
                        ✕
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
                    {saving ? 'Salvando…' : isEditing ? '⚔ Salvar Alterações' : '⚔ Cadastrar Item'}
                  </button>
                  {isEditing && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={resetForm}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              {/* RIGHT: image preview */}
              <div className="image-preview-column">
                <span className="form-label preview-label">Prévia</span>
                <div className="image-preview-box">
                  {imageDataUrl
                    ? <img src={imageDataUrl} alt="Prévia do item" draggable={false} />
                    : <span className="image-preview-placeholder" aria-hidden="true">💎</span>
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
          <span>Itens Cadastrados</span>
          <span className="items-count">{items.length}</span>
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
                placeholder="Pesquisar item…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
              {searchQuery && (
                <button className="item-search-clear" onClick={() => setSearchQuery('')} aria-label="Limpar pesquisa">✕</button>
              )}
            </div>

            {/* Location filter */}
            <div className="item-toolbar-select-wrap">
              <select
                className="item-toolbar-select"
                value={filterLocId}
                onChange={e => setFilterLocId(e.target.value)}
                aria-label="Filtrar por local"
              >
                <option value="all">Todos os locais</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="item-sort-group" role="group" aria-label="Ordenar por">
              <button
                className={`item-sort-btn${sortKey === 'name-asc'  ? ' item-sort-active' : ''}`}
                onClick={() => setSortKey('name-asc')}
                title="Nome A→Z"
              ><ArrowDownAZ size={14} aria-hidden="true" />Nome A→Z</button>
              <button
                className={`item-sort-btn${sortKey === 'name-desc' ? ' item-sort-active' : ''}`}
                onClick={() => setSortKey('name-desc')}
                title="Nome Z→A"
              ><ArrowUpAZ size={14} aria-hidden="true" />Nome Z→A</button>
              <button
                className={`item-sort-btn${sortKey === 'price-asc'  ? ' item-sort-active' : ''}`}
                onClick={() => setSortKey('price-asc')}
                title="Menor valor"
              ><ArrowDown01 size={14} aria-hidden="true" />Valor ↑</button>
              <button
                className={`item-sort-btn${sortKey === 'price-desc' ? ' item-sort-active' : ''}`}
                onClick={() => setSortKey('price-desc')}
                title="Maior valor"
              ><ArrowUp01 size={14} aria-hidden="true" />Valor ↓</button>
            </div>
          </div>
        )}

        {!loaded ? (
          <p className="loading-text">Carregando…</p>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">📦</span>
            <span className="empty-state-text">Nenhum item cadastrado ainda.</span>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">🔍</span>
            <span className="empty-state-text">Nenhum item encontrado para os filtros selecionados.</span>
          </div>
        ) : (
          <ul className="item-list" role="list">
            {visibleItems.map(item => {
              const img      = item.imageFile ? imageCache[item.imageFile] : null
              const locNames = (itemLocationMap.get(item.id) ?? []).map(l => l.name)
              return (
                <li
                  key={item.id}
                  className={`item-row${editingId === item.id ? ' item-row-editing' : ''}`}
                >
                  {/* Image */}
                  <div className="item-row-img">
                    {img
                      ? <img src={img} alt={item.name} draggable={false} />
                      : <span className="item-image-placeholder" aria-hidden="true">💎</span>
                    }
                  </div>

                  {/* Info */}
                  <div className="item-row-info">
                    <div className="item-row-name-line">
                      <span className="item-row-name" title={item.name}>{item.name}</span>
                      {item.price > 0 && (
                        <span className="item-row-price-badge">{formatPrice(item.price)}</span>
                      )}
                    </div>
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
                      aria-label={`Editar ${item.name}`}
                      onClick={() => handleEdit(item)}
                    >
                      <Pencil size={13} aria-hidden="true" />
                      Editar
                    </button>
                    <button
                      className="btn-labeled btn-labeled-delete"
                      aria-label={`Excluir ${item.name}`}
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      Excluir
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

