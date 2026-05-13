import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Home, Gem, Map, ScrollText, BarChart2, Swords, Settings, Wrench, Keyboard } from 'lucide-react'
import HomePage from './pages/HomePage'
import ItemRegistrationPage from './pages/ItemRegistrationPage'
import FarmLocationPage from './pages/FarmLocationPage'
import FarmSessionPage from './pages/FarmSessionPage'
import StatsPage from './pages/StatsPage'
import SettingsPage from './pages/SettingsPage'
import WorldBossPage from './pages/WorldBossPage'
import ComboOverlayPage from './pages/ComboOverlayPage'
import FarmTimer from './components/FarmTimer'
import LoadingScreen from './components/LoadingScreen'
import type { AppSettings } from './pages/SettingsPage'
import { DEFAULT_SETTINGS } from './pages/SettingsPage'
import { DevModeProvider, useDevMode } from './context/DevModeContext'
import { MarketProvider, useMarket } from './context/MarketContext'
import { ComboProvider } from './context/ComboContext'
import { LanguageProvider, useLanguage, type LanguageId } from './context/LanguageContext'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TabId = 'home' | 'items' | 'locations' | 'sessions' | 'stats' | 'bosses' | 'combo' | 'settings'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactElement
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: Tab[] = [
  { id: 'home',      label: 'Início',           icon: <Home size={16} /> },
  { id: 'items',     label: 'Registro de Itens', icon: <Gem size={16} /> },
  { id: 'locations', label: 'Locais de Farm',    icon: <Map size={16} /> },
  { id: 'sessions',  label: 'Sessões de Farm',   icon: <ScrollText size={16} /> },
  { id: 'stats',     label: 'Estatísticas',      icon: <BarChart2 size={16} /> },
  { id: 'bosses',    label: 'Bosses Mundiais',   icon: <Swords size={16} /> },
  { id: 'combo',     label: 'Overlay de Combo',  icon: <Keyboard size={16} /> },
  { id: 'settings',  label: 'Configurações',     icon: <Settings size={16} /> }
]

// ── Component ─────────────────────────────────────────────────────────────────

// ── AppInner ──────────────────────────────────────────────────────────────────

interface AppInnerProps {
  onDataReady: () => void
}

function AppInner({ onDataReady }: AppInnerProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [settings,  setSettings]  = useState<AppSettings>(DEFAULT_SETTINGS)
  const { devMode } = useDevMode()
  const { setItems: setMarketItems } = useMarket()
  const { t, setLanguage } = useLanguage()

  const TABS: Tab[] = [
    { id: 'home',      icon: <Home size={16} /> },
    { id: 'items',     icon: <Gem size={16} /> },
    { id: 'locations', icon: <Map size={16} /> },
    { id: 'sessions',  icon: <ScrollText size={16} /> },
    { id: 'stats',     icon: <BarChart2 size={16} /> },
    { id: 'bosses',    icon: <Swords size={16} /> },
    { id: 'combo',     icon: <Keyboard size={16} /> },
    { id: 'settings',  icon: <Settings size={16} /> },
  ]

  // Track when both startup loads complete (idempotent set to handle StrictMode)
  const readySet    = useRef(new Set<string>())
  const readyCalled = useRef(false)
  const markReady   = useCallback((key: string) => {
    readySet.current.add(key)
    if (readySet.current.size >= 2 && !readyCalled.current) {
      readyCalled.current = true
      onDataReady()
    }
  }, [onDataReady])

  // Load items on startup so market prices are fetched immediately
  useEffect(() => {
    async function loadItemsForMarket(): Promise<void> {
      const data = await window.api.readJson('items.json')
      if (Array.isArray(data)) setMarketItems(data)
      markReady('items')
    }
    loadItemsForMarket()
  }, [setMarketItems, markReady])

  // Load settings on mount and apply theme
  useEffect(() => {
    async function loadSettings(): Promise<void> {
      const data = (await window.api.readJson('settings.json')) as AppSettings | null
      if (data && data.theme) {
        setSettings(data)
        document.documentElement.setAttribute('data-theme', data.theme)
        document.documentElement.setAttribute('data-font', data.font ?? 'classic')
        if (data.language) setLanguage(data.language as LanguageId)
      }
      markReady('settings')
    }
    loadSettings()
  }, [markReady])

  function handleSettingsChange(s: AppSettings): void {
    setSettings(s)
    document.documentElement.setAttribute('data-theme', s.theme)
    document.documentElement.setAttribute('data-font', s.font ?? 'classic')
  }

  function renderPage(): React.ReactElement {
    switch (activeTab) {
      case 'home':      return <HomePage onNavigate={setActiveTab} />
      case 'items':     return <ItemRegistrationPage />
      case 'locations': return <FarmLocationPage />
      case 'sessions':  return <FarmSessionPage />
      case 'stats':     return <StatsPage />
      case 'bosses':    return <WorldBossPage />
      case 'combo':     return <ComboOverlayPage />
      case 'settings':  return <SettingsPage settings={settings} onSettingsChange={handleSettingsChange} />
    }
  }

  return (
    <div className="app-container">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-title">
          <span className="title-ornament" aria-hidden="true"><Swords size={16} /></span>
          <h1>BDO Loot Log</h1>
          <span className="title-ornament" aria-hidden="true"><Swords size={16} /></span>
        </div>
        <p className="app-subtitle">{t('app.subtitle')}</p>
      </header>

      {/* ── Body: sidebar + content ── */}
      <div className="app-body">
        {/* ── Tab navigation ── */}
        <nav className="tab-nav" aria-label={t('common.mainNavAria')}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button${activeTab === tab.id ? ' tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
              <span className="tab-label">{t(`nav.${tab.id}`)}</span>
            </button>
          ))}
        </nav>

        {/* ── Page content ── */}
        <main className="content-area" role="main">
          {renderPage()}
        </main>
      </div>

      {/* ── Floating timer widget ── */}
      <FarmTimer />

      {/* ── Dev mode banner ── */}
      {devMode && (
        <div className="dev-mode-banner" role="status" aria-live="polite">
          <Wrench size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} aria-hidden="true" />
          {t('app.devBanner')}
        </div>
      )}
    </div>
  )
}

function App(): React.ReactElement {
  const [dataReady,    setDataReady]    = useState(false)
  const [loadingDone,  setLoadingDone]  = useState(false)

  return (
    <LanguageProvider>
      <DevModeProvider>
        <MarketProvider>
          <ComboProvider>
            {/* App renders underneath; loading screen is fixed on top */}
            <AppInner onDataReady={() => setDataReady(true)} />

            {!loadingDone && (
              <LoadingScreen
                dataReady={dataReady}
                onComplete={() => setLoadingDone(true)}
              />
            )}
          </ComboProvider>
        </MarketProvider>
      </DevModeProvider>
    </LanguageProvider>
  )
}

export default App

