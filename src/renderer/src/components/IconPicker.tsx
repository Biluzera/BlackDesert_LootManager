import React, { useState, useMemo, memo } from 'react'
import { DynamicIcon, iconNames } from 'lucide-react/dynamic'
import type { IconName } from 'lucide-react/dynamic'
import { X, Search } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

// ── Types ─────────────────────────────────────────────────────────────────────

interface IconPickerProps {
  selectedIcon: string | null
  onSelect: (iconName: string) => void
  onClose: () => void
}

// ── Icon list ─────────────────────────────────────────────────────────────────
// iconNames from lucide-react/dynamic gives the full kebab-case list (e.g. "arrow-down")

const ALL_ICON_NAMES: string[] = [...iconNames].sort()

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDisplayName(kebabName: string): string {
  return kebabName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ── Memoised grid item ────────────────────────────────────────────────────────

interface GridItemProps {
  name: string
  isSelected: boolean
  onSelect: (name: string) => void
}

const GridItem = memo(function GridItem({ name, isSelected, onSelect }: GridItemProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      className={`icon-picker-item${isSelected ? ' icon-picker-item-selected' : ''}`}
      title={toDisplayName(name)}
      onClick={() => onSelect(name)}
    >
      <DynamicIcon name={name as IconName} size={26} />
      <span className="icon-picker-item-name">{toDisplayName(name)}</span>
    </button>
  )
})

// ── Component ─────────────────────────────────────────────────────────────────

function IconPicker({ selectedIcon, onSelect, onClose }: IconPickerProps): React.ReactElement {
  const { t } = useLanguage()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ALL_ICON_NAMES
    return ALL_ICON_NAMES.filter(name =>
      name.includes(q) || toDisplayName(name).toLowerCase().includes(q)
    )
  }, [search])

  return (
    <div className="icon-picker-overlay" role="dialog" aria-modal="true" aria-label={t('iconPicker.title')} onClick={onClose}>
      <div className="icon-picker-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="icon-picker-header">
          <span className="icon-picker-title">{t('iconPicker.title')}</span>
          <button
            type="button"
            className="icon-picker-close"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Search */}
        <div className="icon-picker-search-row">
          <Search size={14} className="icon-picker-search-icon" aria-hidden="true" />
          <input
            className="icon-picker-search"
            type="text"
            placeholder={t('iconPicker.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            autoComplete="off"
          />
          {search && (
            <button
              type="button"
              className="icon-picker-search-clear"
              onClick={() => setSearch('')}
              aria-label={t('items.clearSearchAria')}
            >
              <X size={12} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="icon-picker-grid" role="listbox" aria-label={t('iconPicker.title')}>
          {filtered.map(name => (
            <GridItem
              key={name}
              name={name}
              isSelected={selectedIcon === name}
              onSelect={onSelect}
            />
          ))}

          {filtered.length === 0 && (
            <div className="icon-picker-empty">
              <span>{t('iconPicker.noResults')}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="icon-picker-footer">
          <span className="icon-picker-count">
            {t('iconPicker.count', { count: filtered.length })}
          </span>
          {selectedIcon && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
            >
              {t('common.confirm')}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

export default IconPicker
export type { IconName }
