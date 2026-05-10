import React, { useState, useEffect, useMemo } from 'react'
import type { TabId } from '../App'
import type { Item } from './ItemRegistrationPage'
import type { FarmLocation } from './FarmLocationPage'
import type { FarmSession } from './FarmSessionPage'

interface HomePageProps {
  onNavigate: (tab: TabId) => void
}

interface NavCard {
  tab: TabId
  icon: string
  title: string
  desc: string
}

const NAV_CARDS: NavCard[] = [
  {
    tab:   'items',
    icon:  '💎',
    title: 'Registro de Itens',
    desc:  'Cadastre os itens que podem ser obtidos no farm e defina suas propriedades.'
  },
  {
    tab:   'locations',
    icon:  '🗺️',
    title: 'Locais de Farm',
    desc:  'Registre os locais onde você faz farm e organize-os por região ou tipo.'
  },
  {
    tab:   'sessions',
    icon:  '📜',
    title: 'Sessões de Farm',
    desc:  'Registre e acompanhe cada sessão de farm com os itens obtidos.'
  }
]

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
  const [sessions,   setSessions]   = useState<FarmSession[]>([])
  const [locations,  setLocations]  = useState<FarmLocation[]>([])
  const [allItems,   setAllItems]   = useState<Item[]>([])
  const [imageCache, setImageCache] = useState<Record<string, string>>({})
  const [loaded,     setLoaded]     = useState(false)

  const [transferBusy,    setTransferBusy]    = useState(false)
  const [transferMessage, setTransferMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    async function load(): Promise<void> {
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
  }, [])

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

  async function handleExport(): Promise<void> {
    setTransferBusy(true)
    setTransferMessage(null)
    try {
      const res = await window.api.exportData()
      if (res.success) {
        setTransferMessage({ type: 'ok', text: 'Dados exportados com sucesso!' })
      } else if (res.reason !== 'cancelled') {
        setTransferMessage({ type: 'err', text: 'Erro ao exportar os dados.' })
      }
    } catch {
      setTransferMessage({ type: 'err', text: 'Erro inesperado ao exportar.' })
    } finally {
      setTransferBusy(false)
    }
  }

  async function handleImport(): Promise<void> {
    setTransferBusy(true)
    setTransferMessage(null)
    try {
      const res = await window.api.importData()
      if (res.success) {
        setTransferMessage({ type: 'ok', text: 'Dados importados! Reinicie o app para ver as alterações.' })
      } else if (res.reason === 'size') {
        setTransferMessage({ type: 'err', text: 'Arquivo muito grande (máximo 50 MB).' })
      } else if (res.reason === 'parse' || res.reason === 'invalid') {
        setTransferMessage({ type: 'err', text: 'Arquivo inválido ou corrompido.' })
      } else if (res.reason !== 'cancelled') {
        setTransferMessage({ type: 'err', text: 'Erro ao importar os dados.' })
      }
    } catch {
      setTransferMessage({ type: 'err', text: 'Erro inesperado ao importar.' })
    } finally {
      setTransferBusy(false)
    }
  }

  return (
    <div className="page-container">
      {/* Welcome banner */}
      <section className="home-banner" aria-label="Bem-vindo">
        <div className="parchment-panel">
          <p className="home-banner-title">— Bem-vindo ao BDO Loot Log —</p>
          <p className="home-banner-text">
            Rastreie com precisão cada item obtido em suas sessões de farm em
            Black Desert Online. Cadastre itens, defina locais de caça e registre
            o histórico completo das suas aventuras.
          </p>
        </div>
      </section>

      {/* Navigation cards */}
      <nav aria-label="Atalhos de navegação">
        <div className="home-cards">
          {NAV_CARDS.map((card) => (
            <button
              key={card.tab}
              className="home-card"
              onClick={() => onNavigate(card.tab)}
              aria-label={`Ir para ${card.title}`}
            >
              <span className="home-card-icon" aria-hidden="true">{card.icon}</span>
              <span className="home-card-title">{card.title}</span>
              <span className="home-card-desc">{card.desc}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Stats section */}
      {loaded && stats && (
        <section className="home-stats-section" aria-label="Estatísticas">
          <div className="home-stats-heading">
            <span className="home-stats-heading-icon" aria-hidden="true">📊</span>
            Estatísticas Gerais
          </div>

          {/* Grand total + top location */}
          <div className="home-stat-highlights">
            <div className="home-highlight-card">
              <span className="home-highlight-icon" aria-hidden="true">💰</span>
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
                    : <span aria-hidden="true">⛰️</span>
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
                    : <span aria-hidden="true">⛰️</span>
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

      {/* Transfer section */}
      <section className="home-transfer-section" aria-label="Exportar e importar dados">
        <div className="home-transfer-heading">
          <span className="home-transfer-heading-icon" aria-hidden="true">🔄</span>
          Transferir Dados
        </div>
        <div className="home-transfer-row">
          <div className="home-transfer-card">
            <div className="home-transfer-card-icon" aria-hidden="true">📤</div>
            <div className="home-transfer-card-body">
              <span className="home-transfer-card-title">Exportar</span>
              <span className="home-transfer-card-desc">
                Salva seus itens e locais cadastrados (incluindo imagens) em um arquivo
                que pode ser compartilhado com amigos.
              </span>
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleExport}
              disabled={transferBusy}
            >
              {transferBusy ? 'Aguarde…' : '📤 Exportar'}
            </button>
          </div>

          <div className="home-transfer-card">
            <div className="home-transfer-card-icon" aria-hidden="true">📥</div>
            <div className="home-transfer-card-body">
              <span className="home-transfer-card-title">Importar</span>
              <span className="home-transfer-card-desc">
                Carrega um arquivo exportado pelo BDO Loot Log, substituindo os itens
                e locais atuais pelos do arquivo importado.
              </span>
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleImport}
              disabled={transferBusy}
            >
              {transferBusy ? 'Aguarde…' : '📥 Importar'}
            </button>
          </div>
        </div>

        {transferMessage && (
          <p className={`home-transfer-msg home-transfer-msg--${transferMessage.type}`} role="status">
            {transferMessage.text}
          </p>
        )}
      </section>

      <p className="home-data-note">
        ✦ Todos os dados são salvos localmente em arquivos .json no seu computador ✦
      </p>
    </div>
  )
}

export default HomePage
