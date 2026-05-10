import React, { createContext, useContext, useState } from 'react'
import type { Item } from '../pages/ItemRegistrationPage'
import type { FarmLocation } from '../pages/FarmLocationPage'
import type { FarmSession } from '../pages/FarmSessionPage'
import type { WorldBoss } from '../pages/WorldBossPage'

// ── Mock data ─────────────────────────────────────────────────────────────────

export const MOCK_ITEMS: Item[] = [
  { id: 'mock_item_1',  name: 'Pena de Harpy',               price: 12000,    imageFile: null, createdAt: '2026-01-01T10:00:00Z' },
  { id: 'mock_item_2',  name: 'Cristal de Sangue',           price: 1200000,  imageFile: null, createdAt: '2026-01-01T10:01:00Z' },
  { id: 'mock_item_3',  name: 'Osso de Ogre',                price: 320000,   imageFile: null, createdAt: '2026-01-01T10:02:00Z' },
  { id: 'mock_item_4',  name: 'Pó de Cron',                  price: 2200000,  imageFile: null, createdAt: '2026-01-01T10:03:00Z' },
  { id: 'mock_item_5',  name: 'Âmbar de Priscila',           price: 450000,   imageFile: null, createdAt: '2026-01-01T10:04:00Z' },
  { id: 'mock_item_6',  name: 'Fragmento de Destino',        price: 95000,    imageFile: null, createdAt: '2026-01-01T10:05:00Z' },
  { id: 'mock_item_7',  name: 'Escama de Ladrão das Cavernas', price: 28000,  imageFile: null, createdAt: '2026-01-01T10:06:00Z' },
  { id: 'mock_item_8',  name: 'Pele de Lobo Endurecida',     price: 8500,     imageFile: null, createdAt: '2026-01-01T10:07:00Z' },
  { id: 'mock_item_9',  name: 'Pedra de Fusão (Arsha)',      price: 180000,   imageFile: null, createdAt: '2026-01-01T10:08:00Z' },
  { id: 'mock_item_10', name: 'Roupa Destruída (PRI)',        price: 35000,    imageFile: null, createdAt: '2026-01-01T10:09:00Z' },
  { id: 'mock_item_11', name: 'Pérola Negra de Valencia',    price: 750000,   imageFile: null, createdAt: '2026-01-01T10:10:00Z' },
  { id: 'mock_item_12', name: 'Pó de Ator',                  price: 3500,     imageFile: null, createdAt: '2026-01-01T10:11:00Z' },
]

export const MOCK_LOCATIONS: FarmLocation[] = [
  {
    id: 'mock_loc_1', name: 'Cânion das Harpies', imageFile: null,
    lootIds: ['mock_item_1', 'mock_item_6', 'mock_item_10'],
    createdAt: '2026-01-05T08:00:00Z',
  },
  {
    id: 'mock_loc_2', name: 'Pântano de Fogans', imageFile: null,
    lootIds: ['mock_item_3', 'mock_item_7', 'mock_item_8', 'mock_item_12'],
    createdAt: '2026-01-06T08:00:00Z',
  },
  {
    id: 'mock_loc_3', name: 'Pirâmide de Aakman', imageFile: null,
    lootIds: ['mock_item_2', 'mock_item_4', 'mock_item_5'],
    createdAt: '2026-01-07T08:00:00Z',
  },
  {
    id: 'mock_loc_4', name: 'Mansão dos Narc', imageFile: null,
    lootIds: ['mock_item_9', 'mock_item_11', 'mock_item_6'],
    createdAt: '2026-01-08T08:00:00Z',
  },
  {
    id: 'mock_loc_5', name: 'Arena de Mediah', imageFile: null,
    lootIds: ['mock_item_1', 'mock_item_3', 'mock_item_7', 'mock_item_9'],
    createdAt: '2026-01-09T08:00:00Z',
  },
]

export const MOCK_SESSIONS: FarmSession[] = [
  {
    id: 'mock_sess_1', locationId: 'mock_loc_1', date: '2026-04-01',
    duration: '2h 30min', durationMinutes: 150, notes: 'Sessão de aquecimento.',
    loot: [
      { itemId: 'mock_item_1',  qty: 120, qtyBefore: 0,  qtyAfter: 120 },
      { itemId: 'mock_item_6',  qty: 18,  qtyBefore: 0,  qtyAfter: 18  },
      { itemId: 'mock_item_10', qty: 5,   qtyBefore: 0,  qtyAfter: 5   },
    ],
    createdAt: '2026-04-01T12:00:00Z',
  },
  {
    id: 'mock_sess_2', locationId: 'mock_loc_3', date: '2026-04-03',
    duration: '3h', durationMinutes: 180, notes: 'Boa drop de Pó de Cron.',
    loot: [
      { itemId: 'mock_item_2', qty: 3,  qtyBefore: 0, qtyAfter: 3  },
      { itemId: 'mock_item_4', qty: 12, qtyBefore: 0, qtyAfter: 12 },
      { itemId: 'mock_item_5', qty: 7,  qtyBefore: 0, qtyAfter: 7  },
    ],
    createdAt: '2026-04-03T15:00:00Z',
  },
  {
    id: 'mock_sess_3', locationId: 'mock_loc_2', date: '2026-04-05',
    duration: '1h 45min', durationMinutes: 105, notes: '',
    loot: [
      { itemId: 'mock_item_3',  qty: 22, qtyBefore: 0, qtyAfter: 22 },
      { itemId: 'mock_item_7',  qty: 80, qtyBefore: 0, qtyAfter: 80 },
      { itemId: 'mock_item_8',  qty: 55, qtyBefore: 0, qtyAfter: 55 },
      { itemId: 'mock_item_12', qty: 200,qtyBefore: 0, qtyAfter: 200},
    ],
    createdAt: '2026-04-05T18:00:00Z',
  },
  {
    id: 'mock_sess_4', locationId: 'mock_loc_4', date: '2026-04-08',
    duration: '4h', durationMinutes: 240, notes: 'Drop raro de Pérola Negra!',
    loot: [
      { itemId: 'mock_item_9',  qty: 8, qtyBefore: 0, qtyAfter: 8 },
      { itemId: 'mock_item_11', qty: 2, qtyBefore: 0, qtyAfter: 2 },
      { itemId: 'mock_item_6',  qty: 30,qtyBefore: 0, qtyAfter: 30},
    ],
    createdAt: '2026-04-08T20:00:00Z',
  },
  {
    id: 'mock_sess_5', locationId: 'mock_loc_5', date: '2026-04-10',
    duration: '2h', durationMinutes: 120, notes: 'Testando nova rota.',
    loot: [
      { itemId: 'mock_item_1', qty: 90, qtyBefore: 0, qtyAfter: 90 },
      { itemId: 'mock_item_3', qty: 14, qtyBefore: 0, qtyAfter: 14 },
      { itemId: 'mock_item_9', qty: 5,  qtyBefore: 0, qtyAfter: 5  },
    ],
    createdAt: '2026-04-10T14:00:00Z',
  },
  {
    id: 'mock_sess_6', locationId: 'mock_loc_1', date: '2026-04-15',
    duration: '3h 30min', durationMinutes: 210, notes: 'Melhor sessão do mês.',
    loot: [
      { itemId: 'mock_item_1',  qty: 200, qtyBefore: 0, qtyAfter: 200 },
      { itemId: 'mock_item_6',  qty: 35,  qtyBefore: 0, qtyAfter: 35  },
      { itemId: 'mock_item_10', qty: 12,  qtyBefore: 0, qtyAfter: 12  },
    ],
    createdAt: '2026-04-15T11:00:00Z',
  },
  {
    id: 'mock_sess_7', locationId: 'mock_loc_3', date: '2026-04-20',
    duration: '2h 15min', durationMinutes: 135, notes: '',
    loot: [
      { itemId: 'mock_item_2', qty: 2,  qtyBefore: 0, qtyAfter: 2  },
      { itemId: 'mock_item_4', qty: 9,  qtyBefore: 0, qtyAfter: 9  },
      { itemId: 'mock_item_5', qty: 11, qtyBefore: 0, qtyAfter: 11 },
    ],
    createdAt: '2026-04-20T16:00:00Z',
  },
  {
    id: 'mock_sess_8', locationId: 'mock_loc_2', date: '2026-05-01',
    duration: '1h', durationMinutes: 60, notes: 'Sessão curta para testar.',
    loot: [
      { itemId: 'mock_item_3',  qty: 10, qtyBefore: 0, qtyAfter: 10 },
      { itemId: 'mock_item_7',  qty: 42, qtyBefore: 0, qtyAfter: 42 },
      { itemId: 'mock_item_12', qty: 100,qtyBefore: 0, qtyAfter: 100},
    ],
    createdAt: '2026-05-01T09:00:00Z',
  },
]

export const MOCK_BOSSES: WorldBoss[] = [
  {
    id: 'mock_boss_1', name: 'Kzarka', imageFile: null, color: '#e84040',
    spawns: [
      { day: 0, time: '00:00' }, { day: 1, time: '00:00' },
      { day: 4, time: '00:00' }, { day: 6, time: '00:00' },
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mock_boss_2', name: 'Karanda', imageFile: null, color: '#9930c8',
    spawns: [
      { day: 2, time: '00:00' }, { day: 5, time: '00:00' },
      { day: 6, time: '06:00' },
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mock_boss_3', name: 'Nouver', imageFile: null, color: '#2060c8',
    spawns: [
      { day: 3, time: '00:00' }, { day: 6, time: '12:00' },
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mock_boss_4', name: 'Kutum', imageFile: null, color: '#20a060',
    spawns: [
      { day: 1, time: '06:00' }, { day: 4, time: '06:00' },
      { day: 0, time: '12:00' },
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mock_boss_5', name: 'Offin Tett', imageFile: null, color: '#cc8822',
    spawns: [
      { day: 2, time: '06:00' }, { day: 5, time: '06:00' },
      { day: 0, time: '06:00' },
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'mock_boss_6', name: 'Garmoth', imageFile: null, color: '#c83060',
    spawns: [
      { day: 5, time: '12:00' }, { day: 6, time: '18:00' },
      { day: 0, time: '18:00' },
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
]

// ── Context ───────────────────────────────────────────────────────────────────

interface DevModeContextValue {
  devMode:       boolean
  toggleDevMode: () => void
}

const DevModeContext = createContext<DevModeContextValue>({
  devMode:       false,
  toggleDevMode: () => {},
})

export function DevModeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [devMode, setDevMode] = useState(false)

  function toggleDevMode(): void {
    setDevMode(prev => !prev)
  }

  return (
    <DevModeContext.Provider value={{ devMode, toggleDevMode }}>
      {children}
    </DevModeContext.Provider>
  )
}

export function useDevMode(): DevModeContextValue {
  return useContext(DevModeContext)
}
