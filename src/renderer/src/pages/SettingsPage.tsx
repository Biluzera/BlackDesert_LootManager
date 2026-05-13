import React, { useState } from 'react'
import { Settings, Palette, Type, Wrench, ShoppingCart, Search, BarChart2, Tag, CircleOff, CircleCheck, TriangleAlert, Check, CheckCircle2, ArrowLeftRight, Upload, Download, HardDrive, Languages } from 'lucide-react'
import { useDevMode } from '../context/DevModeContext'
import { useLanguage, type LanguageId } from '../context/LanguageContext'
import { fetchMarketPrices, fetchMarketPriceDetail } from '../services/marketApi'
import type { MarketEntry, MarketPriceDetail } from '../services/marketApi'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppSettings {
  theme:    ThemeId
  font:     FontId
  language: LanguageId
}

export type ThemeId =
  | 'medieval' | 'crimson' | 'elvia'     | 'night'
  | 'desert'   | 'abyss'   | 'kamasylve' | 'drieghan'
  | 'calpheon' | 'shadow'

export type FontId = 'classic' | 'oldworld' | 'modern' | 'fantasy' | 'typewriter'

export const DEFAULT_SETTINGS: AppSettings = { theme: 'medieval', font: 'classic', language: 'en' }

// ── Theme definitions ─────────────────────────────────────────────────────────

export interface ThemeDef {
  id:      ThemeId
  preview: string[] // 3 color swatches
}

export const THEMES: ThemeDef[] = [
  { id: 'medieval',  preview: ['#1c0f07', '#c9a030', '#f0deb4'] },
  { id: 'crimson',   preview: ['#1a0505', '#c03030', '#f0c8b0'] },
  { id: 'elvia',     preview: ['#0e0518', '#8b44cc', '#d4b8f0'] },
  { id: 'night',     preview: ['#050a1a', '#4488cc', '#c0d0f0'] },
  { id: 'desert',    preview: ['#1a1005', '#cc8822', '#f0d89a'] },
  { id: 'abyss',     preview: ['#021510', '#14836a', '#a0e8d4'] },
  { id: 'kamasylve', preview: ['#071408', '#449933', '#b8f0a0'] },
  { id: 'drieghan',  preview: ['#160800', '#ee6622', '#f8d0a0'] },
  { id: 'calpheon',  preview: ['#08101c', '#8aaade', '#d0ddf4'] },
  { id: 'shadow',    preview: ['#0c0c0c', '#aaaaaa', '#e0e0e0'] },
]

// ── Font definitions ──────────────────────────────────────────────────────────

export interface FontDef {
  id:            FontId
  displayFamily: string
  sample:        string
}

export const FONTS: FontDef[] = [
  { id: 'classic',    displayFamily: "'Cinzel', serif",              sample: 'Abc — BDO Loot Log' },
  { id: 'oldworld',   displayFamily: "'IM Fell English SC', serif",  sample: 'Abc — BDO Loot Log' },
  { id: 'modern',     displayFamily: "'Rajdhani', sans-serif",       sample: 'Abc — BDO Loot Log' },
  { id: 'fantasy',    displayFamily: "'Uncial Antiqua', cursive",    sample: 'Abc — BDO Loot Log' },
  { id: 'typewriter', displayFamily: "'Special Elite', cursive",     sample: 'Abc — BDO Loot Log' },
]

// ── Export scope ─────────────────────────────────────────────────────────────

export type ExportScope =
  | 'all' | 'items' | 'locations' | 'sessions'
  | 'bosses' | 'settings' | 'combo' | 'goals'

// ── Props ──────────────────────────────────────────────────────────────────────

interface SettingsPageProps {
  settings:         AppSettings
  onSettingsChange: (s: AppSettings) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage({ settings, onSettingsChange }: SettingsPageProps): React.ReactElement {
  const [saved, setSaved] = useState(false)
  const { devMode, toggleDevMode } = useDevMode()
  const { t, language, setLanguage } = useLanguage()

  const [transferBusy,    setTransferBusy]    = useState(false)
  const [transferMessage, setTransferMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [exportScope, setExportScope] = useState<ExportScope>('all')

  async function handleExport(): Promise<void> {
    setTransferBusy(true)
    setTransferMessage(null)
    try {
      const res = await window.api.exportData(exportScope)
      if (res.success) {
        setTransferMessage({ type: 'ok', text: t('settings.exportSuccess') })
      } else if (res.reason !== 'cancelled') {
        setTransferMessage({ type: 'err', text: t('settings.exportError') })
      }
    } catch {
      setTransferMessage({ type: 'err', text: t('settings.exportErrorUnexpected') })
    } finally {
      setTransferBusy(false)
    }
  }

  async function handleImport(): Promise<void> {
    setTransferBusy(true)
    setTransferMessage(null)
    try {
      const res = await window.api.importData()
      if (res.success) {
        setTransferMessage({ type: 'ok', text: t('settings.importSuccess') })
      } else if (res.reason === 'size') {
        setTransferMessage({ type: 'err', text: t('settings.importErrorSize') })
      } else if (res.reason === 'parse' || res.reason === 'invalid') {
        setTransferMessage({ type: 'err', text: t('settings.importErrorParse') })
      } else if (res.reason !== 'cancelled') {
        setTransferMessage({ type: 'err', text: t('settings.importError') })
      }
    } catch {
      setTransferMessage({ type: 'err', text: t('settings.importErrorUnexpected') })
    } finally {
      setTransferBusy(false)
    }
  }

  // ── Market debug state ────────────────────────────────────────────────────
  const [debugId,         setDebugId]         = useState('')
  const [debugLoading,    setDebugLoading]     = useState(false)
  const [debugError,      setDebugError]       = useState<string | null>(null)
  const [debugSearch,     setDebugSearch]      = useState<MarketEntry | null>(null)
  const [debugDetail,     setDebugDetail]      = useState<MarketPriceDetail | null>(null)

  async function handleDebugFetch(): Promise<void> {
    const id = debugId.trim()
    if (!id) return
    setDebugLoading(true)
    setDebugError(null)
    setDebugSearch(null)
    setDebugDetail(null)
    try {
      const [searchResult, detail] = await Promise.all([
        fetchMarketPrices([id]),
        fetchMarketPriceDetail(id)
      ])
      const entry = searchResult?.get(id) ?? null
      setDebugSearch(entry)
      setDebugDetail(detail)
      if (!entry && !detail) {
        setDebugError(t('settings.marketDebugNoResult'))
      }
    } catch (e) {
      setDebugError(e instanceof Error ? e.message : t('settings.marketDebugNoResult'))
    } finally {
      setDebugLoading(false)
    }
  }

  function markSaved(): void {
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  async function applyTheme(theme: ThemeId): Promise<void> {
    const next: AppSettings = { ...settings, theme }
    onSettingsChange(next)
    await window.api.writeJson('settings.json', next)
    markSaved()
  }

  async function applyFont(font: FontId): Promise<void> {
    const next: AppSettings = { ...settings, font }
    onSettingsChange(next)
    await window.api.writeJson('settings.json', next)
    markSaved()
  }

  async function applyLanguage(lang: LanguageId): Promise<void> {
    setLanguage(lang)
    const next: AppSettings = { ...settings, language: lang }
    onSettingsChange(next)
    await window.api.writeJson('settings.json', next)
    markSaved()
  }

  return (
    <div className="page-container">
      <h2 className="page-title">
        <Settings size={20} className="page-title-icon" aria-hidden="true" />
        {t('settings.pageTitle')}
      </h2>

      {/* ── Themes ── */}
      <section className="settings-section">
        <div className="settings-section-title">
          <Palette size={16} aria-hidden="true" /> {t('settings.themeSectionTitle')}
        </div>
        <p className="settings-section-desc">{t('settings.themeDesc')}</p>

        <div className="theme-grid">
          {THEMES.map(theme => {
            const active = settings.theme === theme.id
            const label  = t(`themes.${theme.id}.label`)
            return (
              <button
                key={theme.id}
                className={`theme-card${active ? ' theme-card-active' : ''}`}
                onClick={() => applyTheme(theme.id)}
                aria-pressed={active}
                aria-label={label}
              >
                <div className="theme-swatches">
                  {theme.preview.map((color, i) => (
                    <div key={i} className="theme-swatch" style={{ background: color }} />
                  ))}
                </div>
                <div className="theme-card-body">
                  <span className="theme-card-name">{label}</span>
                  <span className="theme-card-desc">{t(`themes.${theme.id}.description`)}</span>
                </div>
                {active && <Check size={15} className="theme-card-check" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">
          <Type size={16} aria-hidden="true" /> {t('settings.fontSectionTitle')}
        </div>
        <p className="settings-section-desc">{t('settings.fontDesc')}</p>

        <div className="font-grid">
          {FONTS.map(font => {
            const active = settings.font === font.id
            const label  = t(`fonts.${font.id}.label`)
            return (
              <button
                key={font.id}
                className={`font-card${active ? ' font-card-active' : ''}`}
                onClick={() => applyFont(font.id)}
                aria-pressed={active}
                aria-label={label}
              >
                <span
                  className="font-card-sample"
                  style={{ fontFamily: font.displayFamily }}
                  aria-hidden="true"
                >
                  {font.sample}
                </span>
                <div className="font-card-body">
                  <span className="font-card-name">{label}</span>
                  <span className="font-card-desc">{t(`fonts.${font.id}.description`)}</span>
                </div>
                {active && <Check size={15} className="theme-card-check" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Language ── */}
      <section className="settings-section">
        <div className="settings-section-title">
          <Languages size={16} aria-hidden="true" /> {t('settings.languageSectionTitle')}
        </div>
        <p className="settings-section-desc">{t('settings.languageDesc')}</p>
        <div className="language-select-row">
          <select
            className="form-input form-select language-select"
            value={language}
            onChange={e => applyLanguage(e.target.value as LanguageId)}
            aria-label={t('settings.languageSectionTitle')}
          >
            {(['en', 'pt-br'] as LanguageId[]).map(lang => (
              <option key={lang} value={lang}>{t(`languages.${lang}`)}</option>
            ))}
          </select>
        </div>
      </section>

      {saved && (
        <p className="settings-saved-msg" role="status">
          <CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} aria-hidden="true" />
          {t('settings.savedMsg')}
        </p>
      )}

      {/* ── Dev Mode ── */}
      <section className="settings-section">
        <div className="settings-section-title">
          <Wrench size={16} aria-hidden="true" /> {t('settings.devModeSectionTitle')}
        </div>
        <p className="settings-section-desc">{t('settings.devModeDesc')}</p>
        <button
          className={`dev-mode-toggle-btn${devMode ? ' dev-mode-toggle-btn--active' : ''}`}
          onClick={toggleDevMode}
          aria-pressed={devMode}
        >
          <span className="dev-mode-toggle-icon" aria-hidden="true">
            {devMode ? <CircleOff size={16} /> : <CircleCheck size={16} />}
          </span>
          {devMode ? t('settings.devModeDeactivate') : t('settings.devModeActivate')}
        </button>
        {devMode && (
          <p className="dev-mode-warning" role="status">
            <TriangleAlert size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('settings.devModeWarning')}
          </p>
        )}
      </section>

      {/* ── Market API Debug ── */}
      <section className="settings-section">
        <div className="settings-section-title">
          <ShoppingCart size={16} aria-hidden="true" /> {t('settings.marketDebugSectionTitle')}
        </div>
        <p className="settings-section-desc">
          {t('settings.marketDebugDesc')}
        </p>

        <div className="market-debug-row">
          <input
            className="form-input market-debug-input"
            type="text"
            value={debugId}
            onChange={e => setDebugId(e.target.value)}
            placeholder={t('settings.marketDebugPlaceholder')}
            maxLength={20}
            onKeyDown={e => e.key === 'Enter' && handleDebugFetch()}
          />
          <button
            className="btn btn-primary"
            onClick={handleDebugFetch}
            disabled={debugLoading || !debugId.trim()}
          >
            {debugLoading
              ? t('settings.marketDebugSearchingBtn')
              : <><Search size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('settings.marketDebugSearchBtn')}</>}
          </button>
        </div>

        {debugError && (
          <p className="form-error" role="alert">{debugError}</p>
        )}

        {(debugSearch || debugDetail) && (
          <div className="market-debug-results">

            {/* Search result (/search) */}
            <div className="market-debug-block">
              <div className="market-debug-block-title">
                <BarChart2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('settings.marketDebugSearchResult')} <code>/v1/sa/search</code>
              </div>
              {debugSearch ? (
                <table className="market-debug-table">
                  <tbody>
                    <tr>
                      <td className="mdt-key">{t('settings.marketIdLabel')}</td>
                      <td className="mdt-val">{debugSearch.marketId}</td>
                    </tr>
                    <tr>
                      <td className="mdt-key">{t('settings.currentStockLabel')}</td>
                      <td className="mdt-val">{debugSearch.stock.toLocaleString()} {t('settings.unitsLabel')}</td>
                    </tr>
                    <tr>
                      <td className="mdt-key">{t('settings.basePriceLabel')}</td>
                      <td className="mdt-val">{debugSearch.basePrice.toLocaleString()} {t('common.silver')}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="market-debug-empty">{t('settings.marketDebugNoData')}</p>
              )}
            </div>

            {/* Price detail (/price) */}
            <div className="market-debug-block">
              <div className="market-debug-block-title">
                <Tag size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('settings.marketDebugPriceResult')} <code>/v1/sa/price</code>
              </div>
              {debugDetail ? (
                <table className="market-debug-table">
                  <tbody>
                    <tr>
                      <td className="mdt-key">{t('settings.nameLabel')}</td>
                      <td className="mdt-val">{debugDetail.name}</td>
                    </tr>
                    <tr>
                      <td className="mdt-key">{t('settings.idLabel')}</td>
                      <td className="mdt-val">{debugDetail.id}</td>
                    </tr>
                    <tr>
                      <td className="mdt-key">{t('settings.sidLabel')}</td>
                      <td className="mdt-val">{debugDetail.sid}</td>
                    </tr>
                    <tr>
                      <td className="mdt-key">{t('settings.basePriceLabel')}</td>
                      <td className="mdt-val">{debugDetail.basePrice.toLocaleString()} {t('common.silver')}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="market-debug-empty">{t('settings.marketDebugNoData')}</p>
              )}
            </div>

          </div>
        )}
      </section>

      {/* ── Data Transfer ── */}
      <section className="settings-section" aria-label={t('settings.transferSectionTitle')}>
        <div className="settings-section-title">
          <ArrowLeftRight size={16} aria-hidden="true" /> {t('settings.transferSectionTitle')}
        </div>
        <p className="settings-section-desc">{t('settings.transferDesc')}</p>
        <div className="home-transfer-row">
          <div className="home-transfer-card">
            <div className="home-transfer-card-icon" aria-hidden="true"><Upload size={24} /></div>
            <div className="home-transfer-card-body">
              <span className="home-transfer-card-title">{t('settings.exportTitle')}</span>
              <span className="home-transfer-card-desc">{t('settings.exportDesc')}</span>
              <label className="transfer-scope-label" htmlFor="export-scope-select">
                {t('settings.exportScopeLabel')}
              </label>
              <select
                id="export-scope-select"
                className="form-input form-select transfer-scope-select"
                value={exportScope}
                onChange={e => setExportScope(e.target.value as ExportScope)}
                disabled={transferBusy}
              >
                <option value="all">{t('settings.scopeAll')}</option>
                <option value="items">{t('settings.scopeItems')}</option>
                <option value="locations">{t('settings.scopeLocations')}</option>
                <option value="sessions">{t('settings.scopeSessions')}</option>
                <option value="bosses">{t('settings.scopeBosses')}</option>
                <option value="settings">{t('settings.scopeSettings')}</option>
                <option value="combo">{t('settings.scopeCombo')}</option>
                <option value="goals">{t('settings.scopeGoals')}</option>
              </select>
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleExport}
              disabled={transferBusy}
            >
              {transferBusy ? t('settings.waitingLabel') : <><Upload size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('settings.exportLabel')}</>}
            </button>
          </div>

          <div className="home-transfer-card">
            <div className="home-transfer-card-icon" aria-hidden="true"><Download size={24} /></div>
            <div className="home-transfer-card-body">
              <span className="home-transfer-card-title">{t('settings.importTitle')}</span>
              <span className="home-transfer-card-desc">{t('settings.importDesc')}</span>
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleImport}
              disabled={transferBusy}
            >
              {transferBusy ? t('settings.waitingLabel') : <><Download size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {t('settings.importLabel')}</>}
            </button>
          </div>
        </div>

        {transferMessage && (
          <p className={`home-transfer-msg home-transfer-msg--${transferMessage.type}`} role="status">
            {transferMessage.text}
          </p>
        )}

        <p className="home-data-note" style={{ marginTop: '12px' }}>
          <HardDrive size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} aria-hidden="true" />
          {t('settings.dataNote')}
        </p>
      </section>
    </div>
  )
}
