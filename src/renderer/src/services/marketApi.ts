// ── Arsha.io Market API ───────────────────────────────────────────────────────
// All HTTP calls go through the Electron main process (IPC) to avoid CORS.

export interface MarketEntry {
  marketId: string
  stock: number
  basePrice: number
}

export interface MarketSearchResult {
  resultCode: number
  resultMsg: string
}

/**
 * Fetch market data for a list of market IDs.
 * Returns a map of marketId → MarketEntry, or null on failure.
 */
export async function fetchMarketPrices(
  marketIds: string[]
): Promise<Map<string, MarketEntry> | null> {
  if (marketIds.length === 0) return new Map()
  try {
    const raw = await window.api.marketSearch(marketIds)
    const data = raw as MarketSearchResult
    if (!data || data.resultCode !== 0 || !data.resultMsg) return null

    const result = new Map<string, MarketEntry>()
    const items = data.resultMsg.split('|')
    for (const item of items) {
      const parts = item.split('-')
      if (parts.length < 3) continue
      const id        = parts[0]
      const stock     = parseInt(parts[1], 10)
      const basePrice = parseInt(parts[2], 10)
      if (!isNaN(stock) && !isNaN(basePrice)) {
        result.set(id, { marketId: id, stock, basePrice })
      }
    }
    return result
  } catch {
    return null
  }
}

// ── Debug API (price detail) ──────────────────────────────────────────────────

export interface MarketPriceDetail {
  name: string
  id: number
  sid: number
  basePrice: number
}

export async function fetchMarketPriceDetail(id: string): Promise<MarketPriceDetail | null> {
  try {
    const raw = await window.api.marketPriceDetail(id)
    if (!raw) return null
    return raw as MarketPriceDetail
  } catch {
    return null
  }
}
