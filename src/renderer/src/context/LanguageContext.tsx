import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import enLocale from '../locales/en.json'
import ptBrLocale from '../locales/pt-br.json'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LanguageId = 'en' | 'pt-br'

type LocaleData = Record<string, unknown>

const LOCALES: Record<LanguageId, LocaleData> = {
  'en':    enLocale as LocaleData,
  'pt-br': ptBrLocale as LocaleData,
}

interface LanguageContextValue {
  language: LanguageId
  setLanguage: (lang: LanguageId) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  tArr: (key: string) => string[]
  locale: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getNestedValue(obj: LocaleData, key: string): unknown {
  const parts = key.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
}

function buildT(locale: LocaleData, fallback: LocaleData) {
  return function t(key: string, vars?: Record<string, string | number>): string {
    let val = getNestedValue(locale, key)
    if (typeof val !== 'string') val = getNestedValue(fallback, key)
    if (typeof val !== 'string') return key
    return vars ? interpolate(val, vars) : val
  }
}

// ── Locale map ───────────────────────────────────────────────────────────────

const LOCALE_MAP: Record<LanguageId, string> = {
  'en':    'en-US',
  'pt-br': 'pt-BR',
}

// ── Context ───────────────────────────────────────────────────────────────────

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => undefined,
  t: (key) => key,
  tArr: () => [],
  locale: 'en-US',
})

// ── Provider ──────────────────────────────────────────────────────────────────

interface LanguageProviderProps {
  children: React.ReactNode
  initialLanguage?: LanguageId
  onLanguageChange?: (lang: LanguageId) => void
}

export function LanguageProvider({
  children,
  initialLanguage = 'en',
  onLanguageChange,
}: LanguageProviderProps): React.ReactElement {
  const [language, setLanguageState] = useState<LanguageId>(initialLanguage)

  useEffect(() => {
    setLanguageState(initialLanguage)
  }, [initialLanguage])

  const setLanguage = useCallback((lang: LanguageId) => {
    setLanguageState(lang)
    onLanguageChange?.(lang)
  }, [onLanguageChange])

  const t = useCallback(
    buildT(LOCALES[language], LOCALES['en']),
    [language]
  )

  const tArr = useCallback(
    (key: string): string[] => {
      const val = getNestedValue(LOCALES[language], key)
      if (Array.isArray(val)) return val as string[]
      const fallback = getNestedValue(LOCALES['en'], key)
      if (Array.isArray(fallback)) return fallback as string[]
      return []
    },
    [language]
  )

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tArr, locale: LOCALE_MAP[language] }}>
      {children}
    </LanguageContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext)
}
