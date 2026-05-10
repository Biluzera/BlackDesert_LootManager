import React, { useState, useEffect } from 'react'
import HomePage from './pages/HomePage'
import ItemRegistrationPage from './pages/ItemRegistrationPage'
import FarmLocationPage from './pages/FarmLocationPage'
import FarmSessionPage from './pages/FarmSessionPage'
import StatsPage from './pages/StatsPage'
import SettingsPage from './pages/SettingsPage'
import WorldBossPage from './pages/WorldBossPage'
import FarmTimer from './components/FarmTimer'
import type { AppSettings } from './pages/SettingsPage'
import { DEFAULT_SETTINGS } from './pages/SettingsPage'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TabId = 'home' | 'items' | 'locations' | 'sessions' | 'stats' | 'bosses' | 'settings'

interface Tab {
  id: TabId
  label: string
  icon: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: Tab[] = [
  { id: 'home',      label: 'Início',           icon: '🏰' },
  { id: 'items',     label: 'Registro de Itens', icon: '💎' },
  { id: 'locations', label: 'Locais de Farm',    icon: '🗺️' },
  { id: 'sessions',  label: 'Sessões de Farm',   icon: '📜' },
  { id: 'stats',     label: 'Estatísticas',      icon: '📊' },
  { id: 'bosses',    label: 'Bosses Mundiais',   icon: '⚔️' },
  { id: 'settings',  label: 'Configurações',     icon: '⚙️' }
]

// ── Component ─────────────────────────────────────────────────────────────────

function App(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [settings,  setSettings]  = useState<AppSettings>(DEFAULT_SETTINGS)

  // Load settings on mount and apply theme
  useEffect(() => {
    async function loadSettings(): Promise<void> {
      const data = (await window.api.readJson('settings.json')) as AppSettings | null
      if (data && data.theme) {
        setSettings(data)
        document.documentElement.setAttribute('data-theme', data.theme)
      }
    }
    loadSettings()
  }, [])

  function handleSettingsChange(s: AppSettings): void {
    setSettings(s)
    document.documentElement.setAttribute('data-theme', s.theme)
  }

  function renderPage(): React.ReactElement {
    switch (activeTab) {
      case 'home':      return <HomePage onNavigate={setActiveTab} />
      case 'items':     return <ItemRegistrationPage />
      case 'locations': return <FarmLocationPage />
      case 'sessions':  return <FarmSessionPage />
      case 'stats':     return <StatsPage />
      case 'bosses':    return <WorldBossPage />
      case 'settings':  return <SettingsPage settings={settings} onSettingsChange={handleSettingsChange} />
    }
  }

  return (
    <div className="app-container">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-title">
          <span className="title-ornament" aria-hidden="true">⚜</span>
          <h1>BDO Loot Log</h1>
          <span className="title-ornament" aria-hidden="true">⚜</span>
        </div>
        <p className="app-subtitle">Registro de Itens &amp; Sessões de Farm</p>
      </header>

      {/* ── Tab navigation ── */}
      <nav className="tab-nav" aria-label="Navegação principal">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button${activeTab === tab.id ? ' tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Page content ── */}
      <main className="content-area" role="main">
        {renderPage()}
      </main>

      {/* ── Floating timer widget ── */}
      <FarmTimer />
    </div>
  )
}

export default App

