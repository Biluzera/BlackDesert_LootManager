import React, { createContext, useContext, useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BdoDbItem {
  id: number
  name: string
  grade: number
}

interface ItemDbContextValue {
  itemDb: BdoDbItem[]
  dbLoaded: boolean
}

// ── Context ───────────────────────────────────────────────────────────────────

const ItemDbContext = createContext<ItemDbContextValue>({
  itemDb: [],
  dbLoaded: false,
})

// ── Provider ──────────────────────────────────────────────────────────────────

export function ItemDbProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [itemDb,   setItemDb]   = useState<BdoDbItem[]>([])
  const [dbLoaded, setDbLoaded] = useState(false)

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const data = await window.api.fetchItemDb()
        if (Array.isArray(data)) {
          setItemDb(data as BdoDbItem[])
        }
      } catch {
        // silently fail — user can still register items with manual price
      } finally {
        setDbLoaded(true)
      }
    }
    load()
  }, [])

  return (
    <ItemDbContext.Provider value={{ itemDb, dbLoaded }}>
      {children}
    </ItemDbContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useItemDb(): ItemDbContextValue {
  return useContext(ItemDbContext)
}
