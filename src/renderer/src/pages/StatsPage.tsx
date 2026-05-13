import React, { useState, useEffect, useMemo } from 'react'
import { BarChart2, Coins, ScrollText, Trophy, Zap, Flame, TrendingUp } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import type { Item } from './ItemRegistrationPage'
import type { FarmLocation } from './FarmLocationPage'
import type { FarmSession } from './FarmSessionPage'
import { useDevMode } from '../context/DevModeContext'
import { MOCK_ITEMS, MOCK_LOCATIONS, MOCK_SESSIONS } from '../context/DevModeContext'
import { useLanguage } from '../context/LanguageContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcTotal(session: FarmSession, itemMap: Map<string, Item>): number {
  let sum = 0
  for (const e of session.loot) {
    const item = itemMap.get(e.itemId)
    if (!item) continue
    const qty   = Math.max(0, e.qtyAfter - e.qtyBefore)
    const price = e.priceSnapshot ?? item.price
    sum += qty * price
  }
  return sum
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function shortNum(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

interface TooltipPayload {
  value: number
  payload: { label?: string; pph?: number; sessions?: number; silver?: number }
}

function SilverTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }): React.ReactElement | null {
  const { t } = useLanguage()
  if (!active || !payload || payload.length === 0) return null
  const val = payload[0].value
  const extra = payload[0].payload
  return (
    <div className="chart-tooltip">
      {label && <div className="chart-tooltip-label">{label}</div>}
      <div className="chart-tooltip-value">{val.toLocaleString()} {t('common.silver')}</div>
      {extra.pph != null && extra.pph > 0 && (
        <div className="chart-tooltip-sub">{extra.pph.toLocaleString()} {t('stats.pphTooltipSuffix')}</div>
      )}
      {extra.sessions != null && (
        <div className="chart-tooltip-sub">{extra.sessions} {t('stats.sessionCountTooltip')}</div>
      )}
    </div>
  )
}

function PphTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }): React.ReactElement | null {
  const { t } = useLanguage()
  if (!active || !payload || payload.length === 0) return null
  const val = payload[0].value
  return (
    <div className="chart-tooltip">
      {label && <div className="chart-tooltip-label">{label}</div>}
      <div className="chart-tooltip-value">{val.toLocaleString()} {t('stats.pphTooltipSuffix')}</div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StatsPage(): React.ReactElement {
  const { devMode } = useDevMode()
  const { t } = useLanguage()
  const [sessions,  setSessions]  = useState<FarmSession[]>([])
  const [locations, setLocations] = useState<FarmLocation[]>([])
  const [allItems,  setAllItems]  = useState<Item[]>([])
  const [loaded,    setLoaded]    = useState(false)

  useEffect(() => {
    async function load(): Promise<void> {
      if (devMode) {
        setSessions(MOCK_SESSIONS)
        setLocations(MOCK_LOCATIONS)
        setAllItems(MOCK_ITEMS)
        setLoaded(true)
        return
      }
      const [sessData, locData, itemData] = await Promise.all([
        window.api.readJson('sessions.json')  as Promise<FarmSession[]  | null>,
        window.api.readJson('locations.json') as Promise<FarmLocation[] | null>,
        window.api.readJson('items.json')     as Promise<Item[]         | null>
      ])
      setSessions(Array.isArray(sessData)  ? sessData  : [])
      setLocations(Array.isArray(locData)  ? locData   : [])
      setAllItems(Array.isArray(itemData)  ? itemData  : [])
      setLoaded(true)
    }
    load()
  }, [devMode])

  const itemMap = useMemo(() => {
    const m = new Map<string, Item>()
    allItems.forEach(i => m.set(i.id, i))
    return m
  }, [allItems])

  const locMap = useMemo(() => {
    const m = new Map<string, FarmLocation>()
    locations.forEach(l => m.set(l.id, l))
    return m
  }, [locations])

  // ── Summary stats ──────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    if (sessions.length === 0) return null
    const totals = sessions.map(s => calcTotal(s, itemMap))
    const grandTotal = totals.reduce((a, b) => a + b, 0)
    const best       = Math.max(...totals)
    const bestIdx    = totals.indexOf(best)
    const bestSess   = sessions[bestIdx]

    const pphValues = sessions
      .filter(s => (s.durationMinutes ?? 0) > 0)
      .map(s => Math.round(calcTotal(s, itemMap) / ((s.durationMinutes ?? 1) / 60)))

    const avgPph = pphValues.length > 0
      ? Math.round(pphValues.reduce((a, b) => a + b, 0) / pphValues.length)
      : null

    const bestPph = pphValues.length > 0 ? Math.max(...pphValues) : null

    return { grandTotal, best, bestSess, avgPph, bestPph, count: sessions.length }
  }, [sessions, itemMap])

  // ── Chart 1: Silver per session (line) ────────────────────────────────────

  const lineData = useMemo(() => {
    return [...sessions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s, i) => ({
        index: i + 1,
        label: formatDate(s.date),
        silver: calcTotal(s, itemMap),
        pph: (s.durationMinutes ?? 0) > 0
          ? Math.round(calcTotal(s, itemMap) / ((s.durationMinutes ?? 1) / 60))
          : 0
      }))
  }, [sessions, itemMap])

  // ── Chart 2: Silver/hour by location (bar) ────────────────────────────────

  const locBarData = useMemo(() => {
    const map = new Map<string, { total: number; mins: number; sessions: number }>()
    for (const s of sessions) {
      const mins  = s.durationMinutes ?? 0
      const total = calcTotal(s, itemMap)
      const entry = map.get(s.locationId) ?? { total: 0, mins: 0, sessions: 0 }
      map.set(s.locationId, {
        total:    entry.total    + total,
        mins:     entry.mins     + mins,
        sessions: entry.sessions + 1
      })
    }
    return Array.from(map.entries())
      .map(([locId, data]) => ({
        name:     locMap.get(locId)?.name ?? t('stats.unknownLocation'),
        pph:      data.mins > 0 ? Math.round(data.total / (data.mins / 60)) : 0,
        silver:   data.total,
        sessions: data.sessions
      }))
      .filter(d => d.pph > 0)
      .sort((a, b) => b.pph - a.pph)
  }, [sessions, itemMap, locMap])

  // ── Chart 3: Silver total by location (bar) ───────────────────────────────

  const locTotalData = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of sessions) {
      const prev  = map.get(s.locationId) ?? 0
      map.set(s.locationId, prev + calcTotal(s, itemMap))
    }
    return Array.from(map.entries())
      .map(([locId, silver]) => ({
        name:   locMap.get(locId)?.name ?? t('stats.unknown'),
        silver
      }))
      .sort((a, b) => b.silver - a.silver)
      .slice(0, 8)
  }, [sessions, itemMap, locMap])

  // ── Palette ───────────────────────────────────────────────────────────────

  const BAR_COLORS = ['#c9a030', '#a07820', '#8a6a18', '#7a5810', '#6a4808', '#5a3a04']

  // ── Render ────────────────────────────────────────────────────────────────

  if (!loaded) return <div className="page-container"><p className="loading-text">{t('common.loading')}</p></div>

  if (sessions.length === 0) {
    return (
      <div className="page-container">
        <h2 className="page-title">
          <BarChart2 size={20} className="page-title-icon" aria-hidden="true" />
          {t('stats.pageTitle')}
        </h2>
        <div className="empty-state" style={{ marginTop: 32 }}>
          <BarChart2 size={48} className="empty-state-icon" aria-hidden="true" />
          <span className="empty-state-text">{t('stats.noSessionsYet')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <h2 className="page-title">
        <BarChart2 size={20} className="page-title-icon" aria-hidden="true" />
        {t('stats.pageTitle')}
      </h2>

      {/* ── Summary cards ── */}
      {summary && (
        <div className="stats-summary-grid">
          <div className="stats-summary-card">
            <Coins size={22} className="stats-summary-icon" />
            <span className="stats-summary-value">{shortNum(summary.grandTotal)}</span>
            <span className="stats-summary-label">{t('stats.totalSilverLabel')}</span>
          </div>
          <div className="stats-summary-card">
            <ScrollText size={22} className="stats-summary-icon" />
            <span className="stats-summary-value">{summary.count}</span>
            <span className="stats-summary-label">{t('stats.sessionsLabel')}</span>
          </div>
          <div className="stats-summary-card">
            <Trophy size={22} className="stats-summary-icon" />
            <span className="stats-summary-value">{shortNum(summary.best)}</span>
            <span className="stats-summary-label">{t('stats.bestSessionLabel')}</span>
          </div>
          {summary.avgPph !== null && (
            <div className="stats-summary-card">
              <Zap size={22} className="stats-summary-icon" />
              <span className="stats-summary-value">{shortNum(summary.avgPph)}</span>
              <span className="stats-summary-label">{t('stats.avgSilverPerHour')}</span>
            </div>
          )}
          {summary.bestPph !== null && (
            <div className="stats-summary-card">
              <Flame size={22} className="stats-summary-icon" />
              <span className="stats-summary-value">{shortNum(summary.bestPph)}</span>
              <span className="stats-summary-label">{t('stats.bestSilverPerHour')}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Line chart: silver per session ── */}
      {lineData.length > 1 && (
        <section className="stats-section">
          <div className="stats-section-title">
            <TrendingUp size={16} aria-hidden="true" /> {t('stats.silverPerSession')}
          </div>
          <div className="stats-chart-box">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={lineData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(138,106,24,0.18)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#6e4c28', fontSize: 11, fontFamily: 'Crimson Text, serif' }}
                  tickLine={false}
                  axisLine={{ stroke: '#4a2e12' }}
                />
                <YAxis
                  tickFormatter={shortNum}
                  tick={{ fill: '#6e4c28', fontSize: 11, fontFamily: 'Crimson Text, serif' }}
                  tickLine={false}
                  axisLine={{ stroke: '#4a2e12' }}
                  width={52}
                />
                <Tooltip content={<SilverTooltip />} />
                <Line
                  type="monotone"
                  dataKey="silver"
                  stroke="#c9a030"
                  strokeWidth={2}
                  dot={{ fill: '#c9a030', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#f5d060' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── Bar chart: prata/hora por local ── */}
      {locBarData.length > 0 && (
        <section className="stats-section">
          <div className="stats-section-title">
            <Zap size={16} aria-hidden="true" /> {t('stats.silverPerHourByLocation')}
          </div>
          <div className="stats-chart-box">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={locBarData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(138,106,24,0.18)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#6e4c28', fontSize: 11, fontFamily: 'Crimson Text, serif' }}
                  tickLine={false}
                  axisLine={{ stroke: '#4a2e12' }}
                />
                <YAxis
                  tickFormatter={shortNum}
                  tick={{ fill: '#6e4c28', fontSize: 11, fontFamily: 'Crimson Text, serif' }}
                  tickLine={false}
                  axisLine={{ stroke: '#4a2e12' }}
                  width={52}
                />
                <Tooltip content={<PphTooltip />} />
                <Bar dataKey="pph" radius={[2, 2, 0, 0]}>
                  {locBarData.map((_, idx) => (
                    <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── Bar chart: prata total por local ── */}
      {locTotalData.length > 0 && (
        <section className="stats-section">
          <div className="stats-section-title">
            <Coins size={16} aria-hidden="true" /> {t('stats.totalSilverByLocation')}
          </div>
          <div className="stats-chart-box">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={locTotalData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(138,106,24,0.18)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#6e4c28', fontSize: 11, fontFamily: 'Crimson Text, serif' }}
                  tickLine={false}
                  axisLine={{ stroke: '#4a2e12' }}
                />
                <YAxis
                  tickFormatter={shortNum}
                  tick={{ fill: '#6e4c28', fontSize: 11, fontFamily: 'Crimson Text, serif' }}
                  tickLine={false}
                  axisLine={{ stroke: '#4a2e12' }}
                  width={52}
                />
                <Tooltip content={<SilverTooltip />} />
                <Bar dataKey="silver" radius={[2, 2, 0, 0]}>
                  {locTotalData.map((_, idx) => (
                    <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

    </div>
  )
}
