import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ComboSkill {
  id: string
  label: string    // optional user-defined skill name
  keys: string     // e.g. "SHIFT+Q", "W+F"
  cooldown: number // seconds
  icon?: string    // lucide-react icon name (optional)
  displayText?: string // custom text shown in widget (defaults to keys)
}

export interface ComboConfig {
  id: string
  name: string
  description: string
  skills: ComboSkill[]
  enabled: boolean
  createdAt: string
}

interface ComboContextValue {
  configs: ComboConfig[]
  saveConfigs: (next: ComboConfig[]) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const ComboContext = createContext<ComboContextValue | null>(null)

export function ComboProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [configs, setConfigs] = useState<ComboConfig[]>([])

  // Load saved configs on mount and sync to main process
  useEffect(() => {
    window.api.readJson('combo-configs.json').then((raw) => {
      if (Array.isArray(raw)) {
        const cfgs = raw as ComboConfig[]
        setConfigs(cfgs)
        void window.comboApi.setConfigs(cfgs)
      }
    })
  }, [])

  const saveConfigs = useCallback((next: ComboConfig[]) => {
    setConfigs(next)
    void window.api.writeJson('combo-configs.json', next)
    void window.comboApi.setConfigs(next)
  }, [])

  return (
    <ComboContext.Provider value={{ configs, saveConfigs }}>
      {children}
    </ComboContext.Provider>
  )
}

export function useCombo(): ComboContextValue {
  const ctx = useContext(ComboContext)
  if (!ctx) throw new Error('useCombo must be used within ComboProvider')
  return ctx
}
