import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Home, Gem, Map, ScrollText, BarChart2, Swords, Settings, Wrench, Keyboard, Target } from 'lucide-react'
import { motion } from 'framer-motion'
import HomePage from './pages/HomePage'
import ItemRegistrationPage from './pages/ItemRegistrationPage'
import FarmLocationPage from './pages/FarmLocationPage'
import FarmSessionPage from './pages/FarmSessionPage'
import StatsPage from './pages/StatsPage'
import SettingsPage from './pages/SettingsPage'
import WorldBossPage from './pages/WorldBossPage'
import ComboOverlayPage from './pages/ComboOverlayPage'
import MilestonesPage from './pages/MilestonesPage'
import FarmTimer from './components/FarmTimer'
import LoadingScreen from './components/LoadingScreen'
import type { AppSettings } from './pages/SettingsPage'
import { DEFAULT_SETTINGS } from './pages/SettingsPage'
import { DevModeProvider, useDevMode } from './context/DevModeContext'
import { MarketProvider, useMarket } from './context/MarketContext'
import { ComboProvider } from './context/ComboContext'
import { LanguageProvider, useLanguage, type LanguageId } from './context/LanguageContext'
import { ItemDbProvider } from './context/ItemDbContext'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TabId = 'home' | 'items' | 'locations' | 'sessions' | 'stats' | 'bosses' | 'milestones' | 'combo' | 'settings'

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
  { id: 'milestones', label: 'Marcos',            icon: <Target size={16} /> },
  { id: 'combo',     label: 'Overlay de Combo',  icon: <Keyboard size={16} /> },
  { id: 'settings',  label: 'Configurações',     icon: <Settings size={16} /> }
]

// ── Component ─────────────────────────────────────────────────────────────────

// ── AppInner ──────────────────────────────────────────────────────────────────

interface AppInnerProps {
  onDataReady: () => void
}

function BlackSpiritMascot(): React.ReactElement {
  return (
    <motion.div
      className="black-spirit-card"
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      aria-label="Mascote Espirito Negro"
    >
      <div className="black-spirit-aura" aria-hidden="true" />
      <div className="black-spirit-body" aria-hidden="true">
        <span className="black-spirit-horn black-spirit-horn-left" />
        <span className="black-spirit-horn black-spirit-horn-right" />
        <span className="black-spirit-eye black-spirit-eye-left" />
        <span className="black-spirit-eye black-spirit-eye-right" />
        <span className="black-spirit-smile" />
        <span className="black-spirit-spark black-spirit-spark-one" />
        <span className="black-spirit-spark black-spirit-spark-two" />
        <span className="black-spirit-spark black-spirit-spark-three" />
      </div>
      <div className="black-spirit-copy">
        <span className="black-spirit-kicker">Companheiro</span>
        <strong>Espirito Negro</strong>
        <small>Guardiao do espolio</small>
      </div>
    </motion.div>
  )
}

function AppInner({ onDataReady }: AppInnerProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [settings,  setSettings]  = useState<AppSettings>(DEFAULT_SETTINGS)
  const { devMode } = useDevMode()
  const { setItems: setMarketItems } = useMarket()
  const { t, setLanguage } = useLanguage()

  const TABS: Tab[] = [
    { id: 'home',      label: 'Inicio', icon: <Home size={16} /> },
    { id: 'items',     label: 'Itens', icon: <Gem size={16} /> },
    { id: 'locations', label: 'Locais', icon: <Map size={16} /> },
    { id: 'sessions',  label: 'Sessoes', icon: <ScrollText size={16} /> },
    { id: 'stats',     label: 'Estatisticas', icon: <BarChart2 size={16} /> },
    { id: 'bosses',    label: 'Bosses', icon: <Swords size={16} /> },
    { id: 'milestones', label: 'Marcos', icon: <Target size={16} /> },
    { id: 'combo',     label: 'Combo', icon: <Keyboard size={16} /> },
    { id: 'settings',  label: 'Configuracoes', icon: <Settings size={16} /> },
  ]
  const activeTabMeta = TABS.find((tab) => tab.id === activeTab)

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

  // Load settings on mount and apply persisted preferences
  useEffect(() => {
    async function loadSettings(): Promise<void> {
      const data = (await window.api.readJson('settings.json')) as AppSettings | null
      if (data) {
        const next: AppSettings = {
          font: data.font ?? DEFAULT_SETTINGS.font,
          language: (data.language ?? DEFAULT_SETTINGS.language) as LanguageId
        }
        setSettings(next)
        document.documentElement.setAttribute('data-font', next.font ?? 'classic')
        if (next.language) setLanguage(next.language as LanguageId)
      }
      markReady('settings')
    }
    loadSettings()
  }, [markReady])

  function handleSettingsChange(s: AppSettings): void {
    setSettings(s)
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
      case 'milestones': return <MilestonesPage />
      case 'combo':     return <ComboOverlayPage />
      case 'settings':  return <SettingsPage settings={settings} onSettingsChange={handleSettingsChange} />
    }
  }

  return (
    <div className="app-container">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-brand">
          <div className="app-title">
            <span className="title-ornament" aria-hidden="true"><Swords size={16} /></span>
            <h1>BDO Loot Log</h1>
          </div>
          <p className="app-subtitle">{t('app.subtitle')}</p>
        </div>
        <div className="top-nav-status" aria-label="Status da interface">
          <span className="top-nav-pill">Black Desert Online</span>
          <span className="top-nav-divider" aria-hidden="true" />
          <span className="top-nav-section">{activeTabMeta ? t(`nav.${activeTabMeta.id}`) : activeTab}</span>
        </div>
      </header>

      {/* ── Body: sidebar + content ── */}
      <div className="app-body">
        {/* ── Tab navigation ── */}
        <nav className="tab-nav" aria-label={t('common.mainNavAria')}>
          <BlackSpiritMascot />
          {TABS.map((tab) => (
            <motion.button
              key={tab.id}
              className={`tab-button${activeTab === tab.id ? ' tab-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.16 }}
            >
              <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
              <span className="tab-label">{t(`nav.${tab.id}`)}</span>
            </motion.button>
          ))}
        </nav>

        {/* ── Page content ── */}
        <motion.main
          key={activeTab}
          className="content-area"
          role="main"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, ease: 'easeOut' }}
        >
          {renderPage()}
        </motion.main>
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
          <ItemDbProvider>
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
          </ItemDbProvider>
        </MarketProvider>
      </DevModeProvider>
    </LanguageProvider>
  )
}

export default App

