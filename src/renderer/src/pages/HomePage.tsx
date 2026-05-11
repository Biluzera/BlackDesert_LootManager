import React, { useState, useEffect, useMemo } from 'react'
import { BarChart2, Coins, Mountain } from 'lucide-react'
import type { TabId } from '../App'
import type { Item } from './ItemRegistrationPage'
import type { FarmLocation } from './FarmLocationPage'
import type { FarmSession } from './FarmSessionPage'
import { useDevMode } from '../context/DevModeContext'
import { MOCK_ITEMS, MOCK_LOCATIONS, MOCK_SESSIONS } from '../context/DevModeContext'
import FarmGoalSection from '../components/FarmGoalSection'

interface HomePageProps {
  onNavigate: (tab: TabId) => void
}

const RECENT_COUNT = 5

function sessionTotal(session: FarmSession, itemMap: Map<string, Item>): number {
  let sum = 0
  for (const e of session.loot) {
    const item = itemMap.get(e.itemId)
    if (!item) continue
    const qty = Math.max(0, e.qtyAfter - e.qtyBefore)
    sum += qty * item.price
  }
  return sum
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function HomePage({ onNavigate }: HomePageProps): React.ReactElement {
  const { devMode } = useDevMode()
  const [sessions,   setSessions]   = useState<FarmSession[]>([])
  const [locations,  setLocations]  = useState<FarmLocation[]>([])
  const [allItems,   setAllItems]   = useState<Item[]>([])
  const [imageCache, setImageCache] = useState<Record<string, string>>({})
  const [loaded,     setLoaded]     = useState(false)

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
      const sess  = Array.isArray(sessData)  ? sessData  : []
      const locs  = Array.isArray(locData)   ? locData   : []
      const items = Array.isArray(itemData)  ? itemData  : []
      setSessions(sess)
      setLocations(locs)
      setAllItems(items)

      // cache images for locations used in recent sessions
      const recentLocIds = new Set(sess.slice(-RECENT_COUNT).map(s => s.locationId))
      const neededFiles  = locs
        .filter(l => recentLocIds.has(l.id) && l.imageFile)
        .map(l => l.imageFile as string)
      const cache: Record<string, string> = {}
      for (const file of neededFiles) {
        if (!cache[file]) {
          const url = await window.api.getImageDataUrl(file)
          if (url) cache[file] = url
        }
      }
      setImageCache(cache)
      setLoaded(true)
    }
    load()
  }, [devMode])

  const stats = useMemo(() => {
    if (!loaded || sessions.length === 0) return null
    const itemMap = new Map(allItems.map(i => [i.id, i]))
    const locMap  = new Map(locations.map(l => [l.id, l]))

    // Grand total
    const grandTotal = sessions.reduce((acc, s) => acc + sessionTotal(s, itemMap), 0)

    // Most used location
    const countByLoc = new Map<string, number>()
    for (const s of sessions) countByLoc.set(s.locationId, (countByLoc.get(s.locationId) ?? 0) + 1)
    let topLocId   = ''
    let topLocCount = 0
    for (const [id, count] of countByLoc) {
      if (count > topLocCount) { topLocId = id; topLocCount = count }
    }
    const topLoc = locMap.get(topLocId) ?? null

    // Recent sessions (last N, reversed)
    const recent = [...sessions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, RECENT_COUNT)
      .map(s => ({
        session: s,
        location: locMap.get(s.locationId) ?? null,
        total: sessionTotal(s, itemMap)
      }))

    return { grandTotal, topLoc, topLocCount, recent }
  }, [loaded, sessions, allItems, locations])

  return (
    <div className="page-container">
      {/* Farm Goals */}
      <FarmGoalSection />

      {/* Stats section */}
      {loaded && stats && (
        <section className="home-stats-section" aria-label="Estatísticas">
          <div className="home-stats-heading">
            <BarChart2 size={18} className="home-stats-heading-icon" aria-hidden="true" />
            Estatísticas Gerais
          </div>

          {/* Grand total + top location */}
          <div className="home-stat-highlights">
            <div className="home-highlight-card">
              <Coins size={22} className="home-highlight-icon" aria-hidden="true" />
              <div className="home-highlight-body">
                <span className="home-highlight-value">{stats.grandTotal.toLocaleString('pt-BR')}</span>
                <span className="home-highlight-label">prata total em todas as sessões</span>
              </div>
            </div>

            {stats.topLoc && (
              <div className="home-highlight-card">
                <div className="home-highlight-loc-icon">
                  {stats.topLoc.imageFile && imageCache[stats.topLoc.imageFile]
                    ? <img src={imageCache[stats.topLoc.imageFile]} alt="" draggable={false} />
                    : <Mountain size={20} aria-hidden="true" />
                  }
                </div>
                <div className="home-highlight-body">
                  <span className="home-highlight-value">{stats.topLoc.name}</span>
                  <span className="home-highlight-label">local mais usado · {stats.topLocCount} sessão{stats.topLocCount !== 1 ? 'ões' : ''}</span>
                </div>
              </div>
            )}
          </div>

          {/* Recent sessions */}
          <div className="home-recent-heading">
            Últimas Sessões
          </div>
          <ul className="home-recent-list" aria-label="Sessões recentes">
            {stats.recent.map(({ session, location, total }) => (
              <li key={session.id} className="home-recent-row">
                <div className="home-recent-loc-icon">
                  {location?.imageFile && imageCache[location.imageFile]
                    ? <img src={imageCache[location.imageFile]} alt="" draggable={false} />
                    : <Mountain size={20} aria-hidden="true" />
                  }
                </div>
                <div className="home-recent-info">
                  <span className="home-recent-loc-name">{location?.name ?? 'Local desconhecido'}</span>
                  <span className="home-recent-meta">
                    {formatDate(session.date)}
                    {session.duration ? ` · ${session.duration}` : ''}
                  </span>
                </div>
                <div className="home-recent-total">
                  {total.toLocaleString('pt-BR')}
                  <span className="home-recent-prata"> prata</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}


    </div>
  )
}

export default HomePage
