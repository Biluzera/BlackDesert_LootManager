import React, { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppSettings {
  theme: ThemeId
}

export type ThemeId = 'medieval' | 'crimson' | 'elvia' | 'night' | 'desert' | 'abyss'

export const DEFAULT_SETTINGS: AppSettings = { theme: 'medieval' }

// ── Theme definitions ─────────────────────────────────────────────────────────

export interface ThemeDef {
  id: ThemeId
  label: string
  description: string
  preview: string[] // 3 color swatches
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
  }
]

// ── Props ──────────────────────────────────────────────────────────────────────

interface SettingsPageProps {
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SettingsPage({ settings, onSettingsChange }: SettingsPageProps): React.ReactElement {
  const [saved, setSaved] = useState(false)

  async function applyTheme(theme: ThemeId): Promise<void> {
    const next: AppSettings = { ...settings, theme }
    onSettingsChange(next)
    await window.api.writeJson('settings.json', next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
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
                {/* Color swatches */}
                <div className="theme-swatches">
                  {theme.preview.map((color, i) => (
                    <div
                      key={i}
                      className="theme-swatch"
                      style={{ background: color }}
                    />
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

        {saved && (
          <p className="settings-saved-msg" role="status">✦ Tema salvo com sucesso!</p>
        )}
      </section>
    </div>
  )
}
