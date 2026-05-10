import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { fetchMarketPrices } from '../services/marketApi'
import type { MarketEntry } from '../services/marketApi'

// ── Minimal item shape needed by this context (avoids circular dependency) ────
export interface MarketableItem {
  marketId?: string
  price: number
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MarketContextValue {
  marketData: Map<string, MarketEntry>
  loading: boolean
  lastUpdated: Date | null
  refresh: () => void
  getEffectivePrice: (item: MarketableItem) => { price: number; source: 'market' | 'manual' }
  setItems: (items: MarketableItem[]) => void
}

// ── Safe default (used when hook is called outside provider) ──────────────────

const DEFAULT_VALUE: MarketContextValue = {
  marketData: new Map(),
  loading: false,
  lastUpdated: null,
  refresh: () => undefined,
  getEffectivePrice: (item) => ({ price: item.price, source: 'manual' }),
  setItems: () => undefined,
}

const MarketContext = createContext<MarketContextValue>(DEFAULT_VALUE)

const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

// ── Provider ──────────────────────────────────────────────────────────────────

export function MarketProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [marketData,  setMarketData]  = useState<Map<string, MarketEntry>>(() => new Map())
  const [loading,     setLoading]     = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Keep item list in a ref — avoids needing it as a state dependency
  const itemsRef = useRef<MarketableItem[]>([])

  const doFetch = useCallback(async () => {
    const ids = itemsRef.current
      .filter(i => i.marketId != null && String(i.marketId).trim() !== '')
      .map(i => String(i.marketId).trim())
    if (ids.length === 0) return

    setLoading(true)
    try {
      const result = await fetchMarketPrices(ids)
      if (result) {
        setMarketData(result)
        setLastUpdated(new Date())
      }
    } catch {
      // network errors are silently ignored
    } finally {
      setLoading(false)
    }
  }, [])

  // Periodic refresh
  useEffect(() => {
    const timer = setInterval(doFetch, REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [doFetch])

  // Stable setItems — only updates the ref and triggers a fetch
  const setItems = useCallback((list: MarketableItem[]) => {
    itemsRef.current = list
    doFetch()
  }, [doFetch])

  const getEffectivePrice = useCallback((item: MarketableItem): { price: number; source: 'market' | 'manual' } => {
    if (item.marketId != null && String(item.marketId).trim() !== '') {
      const entry = marketData.get(String(item.marketId).trim())
      if (entry && entry.basePrice > 0) {
        return { price: entry.basePrice, source: 'market' }
      }
    }
    return { price: item.price, source: 'manual' }
  }, [marketData])

  const value = useMemo<MarketContextValue>(() => ({
    marketData,
    loading,
    lastUpdated,
    refresh: doFetch,
    getEffectivePrice,
    setItems,
  }), [marketData, loading, lastUpdated, doFetch, getEffectivePrice, setItems])

  return (
    <MarketContext.Provider value={value}>
      {children}
    </MarketContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMarket(): MarketContextValue {
  return useContext(MarketContext)
}
