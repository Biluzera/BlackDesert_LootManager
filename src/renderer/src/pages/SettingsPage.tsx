import React, { useState } from 'react'
import { useDevMode } from '../context/DevModeContext'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppSettings {
  theme: ThemeId
  font:  FontId
}

export type ThemeId =
  | 'medieval' | 'crimson' | 'elvia'     | 'night'
  | 'desert'   | 'abyss'   | 'kamasylve' | 'drieghan'
  | 'calpheon' | 'shadow'

export type FontId = 'classic' | 'oldworld' | 'modern' | 'fantasy' | 'typewriter'

export const DEFAULT_SETTINGS: AppSettings = { theme: 'medieval', font: 'classic' }

// ── Theme definitions ─────────────────────────────────────────────────────────

export interface ThemeDef {
  id:          ThemeId
  label:       string
  description: string
  preview:     string[] // 3 color swatches
}

export const THEMES: ThemeDef[] = [
  {
    id:          'medieval',
    label:       'Medieval Dourado',
    description: 'O tema clássico — madeira escura e ouro antigo.',
    preview:     ['#1c0f07', '#c9a030', '#f0deb4']
  },
  {
    id:          'crimson',
    label:       'Crimson Sangue',
    description: 'Vermelho profundo, perfeito para o servidor Arsha.',
    preview:     ['#1a0505', '#c03030', '#f0c8b0']
  },
  {
    id:          'elvia',
    label:       'Elvia Violeta',
    description: 'Roxo etéreo das terras corrompidas de Elvia.',
    preview:     ['#0e0518', '#8b44cc', '#d4b8f0']
  },
  {
    id:          'night',
    label:       'Noite Estrelada',
    description: 'Azul profundo da noite, prata das estrelas.',
    preview:     ['#050a1a', '#4488cc', '#c0d0f0']
  },
  {
    id:          'desert',
    label:       'Deserto de Valencia',
    description: 'Areia quente e terracota das terras de Valencia.',
    preview:     ['#1a1005', '#cc8822', '#f0d89a']
  },
  {
    id:          'abyss',
    label:       'Abismo Oceânico',
    description: 'Verde-azulado das profundezas do mar de Margoria.',
    preview:     ['#021510', '#14836a', '#a0e8d4']
  },
  {
    id:          'kamasylve',
    label:       'Floresta de Kamasylve',
    description: 'Verde vivo das florestas eternas das Fadas.',
    preview:     ['#071408', '#449933', '#b8f0a0']
  },
  {
    id:          'drieghan',
    label:       'Vulcão de Drieghan',
    description: 'Laranja flamejante das terras vulcânicas de Drieghan.',
    preview:     ['#160800', '#ee6622', '#f8d0a0']
  },
  {
    id:          'calpheon',
    label:       'Calpheon Aristocrático',
    description: 'Azul-aço elegante da nobreza de Calpheon.',
    preview:     ['#08101c', '#8aaade', '#d0ddf4']
  },
  {
    id:          'shadow',
    label:       'Sombra Cinzenta',
    description: 'Monocromático, minimalista e severo.',
    preview:     ['#0c0c0c', '#aaaaaa', '#e0e0e0']
  },
]

// ── Font definitions ──────────────────────────────────────────────────────────

export interface FontDef {
  id:            FontId
  label:         string
  description:   string
  displayFamily: string
  sample:        string
}

export const FONTS: FontDef[] = [
  {
    id:            'classic',
    label:         'Clássico Medieval',
    description:   'Cinzel + Crimson Text — elegante e ornamentado.',
    displayFamily: "'Cinzel', serif",
    sample:        'Abc — BDO Loot Log'
  },
  {
    id:            'oldworld',
    label:         'Velho Mundo',
    description:   'IM Fell English — manuscrito e antigo.',
    displayFamily: "'IM Fell English SC', serif",
    sample:        'Abc — BDO Loot Log'
  },
  {
    id:            'modern',
    label:         'Interface Moderna',
    description:   'Rajdhani + Nunito — limpo e legível.',
    displayFamily: "'Rajdhani', sans-serif",
    sample:        'Abc — BDO Loot Log'
  },
  {
    id:            'fantasy',
    label:         'Runas Antigas',
    description:   'Uncial Antiqua + Merriweather — estilo celta.',
    displayFamily: "'Uncial Antiqua', cursive",
    sample:        'Abc — BDO Loot Log'
  },
  {
    id:            'typewriter',
    label:         'Diário de Aventureiro',
    description:   'Special Elite + Courier Prime — máquina de escrever.',
    displayFamily: "'Special Elite', cursive",
    sample:        'Abc — BDO Loot Log'
  },
]

// ── Props ──────────────────────────────────────────────────────────────────────

interface SettingsPageProps {
  settings:         AppSettings
  onSettingsChange: (s: AppSettings) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage({ settings, onSettingsChange }: SettingsPageProps): React.ReactElement {
  const [saved, setSaved] = useState(false)
  const { devMode, toggleDevMode } = useDevMode()

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

  return (
    <div className="page-container">
      <h2 className="page-title">
        <span className="page-title-icon" aria-hidden="true">⚙️</span>
        Configurações
      </h2>

      {/* ── Themes ── */}
      <section className="settings-section">
        <div className="settings-section-title">
          <span>🎨</span> Tema da Interface
        </div>
        <p className="settings-section-desc">
          Escolha o conjunto de cores que mais combina com o seu estilo de aventureiro.
        </p>

        <div className="theme-grid">
          {THEMES.map(theme => {
            const active = settings.theme === theme.id
            return (
              <button
                key={theme.id}
                className={`theme-card${active ? ' theme-card-active' : ''}`}
                onClick={() => applyTheme(theme.id)}
                aria-pressed={active}
                aria-label={`Tema ${theme.label}`}
              >
                <div className="theme-swatches">
                  {theme.preview.map((color, i) => (
                    <div key={i} className="theme-swatch" style={{ background: color }} />
                  ))}
                </div>
                <div className="theme-card-body">
                  <span className="theme-card-name">{theme.label}</span>
                  <span className="theme-card-desc">{theme.description}</span>
                </div>
                {active && <span className="theme-card-check" aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Fonts ── */}
      <section className="settings-section">
        <div className="settings-section-title">
          <span>🔤</span> Fonte da Interface
        </div>
        <p className="settings-section-desc">
          Escolha a tipografia que melhor se adapta à sua leitura.
        </p>

        <div className="font-grid">
          {FONTS.map(font => {
            const active = settings.font === font.id
            return (
              <button
                key={font.id}
                className={`font-card${active ? ' font-card-active' : ''}`}
                onClick={() => applyFont(font.id)}
                aria-pressed={active}
                aria-label={`Fonte ${font.label}`}
              >
                <span
                  className="font-card-sample"
                  style={{ fontFamily: font.displayFamily }}
                  aria-hidden="true"
                >
                  {font.sample}
                </span>
                <div className="font-card-body">
                  <span className="font-card-name">{font.label}</span>
                  <span className="font-card-desc">{font.description}</span>
                </div>
                {active && <span className="theme-card-check" aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>
      </section>

      {saved && (
        <p className="settings-saved-msg" role="status">✦ Configurações salvas!</p>
      )}

      {/* ── Dev Mode ── */}
      <section className="settings-section">
        <div className="settings-section-title">
          <span>🛠️</span> Ferramentas de Desenvolvimento
        </div>
        <p className="settings-section-desc">
          Preenche todas as abas com dados fictícios para testes de interface. Nenhum dado é
          salvo — ao desativar, tudo volta ao estado real.
        </p>
        <button
          className={`dev-mode-toggle-btn${devMode ? ' dev-mode-toggle-btn--active' : ''}`}
          onClick={toggleDevMode}
          aria-pressed={devMode}
        >
          <span className="dev-mode-toggle-icon" aria-hidden="true">
            {devMode ? '🔴' : '🟢'}
          </span>
          {devMode ? 'Desativar Modo Desenvolvimento' : 'Ativar Modo Desenvolvimento'}
        </button>
        {devMode && (
          <p className="dev-mode-warning" role="status">
            ⚠️ Modo ativo: itens, locais, sessões e bosses exibidos são mockados e não serão persistidos.
          </p>
        )}
      </section>
    </div>
  )
}
