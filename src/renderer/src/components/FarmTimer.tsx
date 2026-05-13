import React, { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'

// ── Farm Timer Widget ─────────────────────────────────────────────────────────
// Standalone floating timer — start/pause/reset, no persistence needed.

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export default function FarmTimer(): React.ReactElement {
  const { t } = useLanguage()
  const [seconds,   setSeconds]   = useState(0)
  const [running,   setRunning]   = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  function toggle(): void { setRunning(r => !r) }
  function reset(): void  { setRunning(false); setSeconds(0) }

  const isZero = seconds === 0

  return (
    <div className={`farm-timer-widget${collapsed ? ' farm-timer-collapsed' : ''}${running ? ' farm-timer-running' : ''}`}>
      {/* Collapse toggle */}
      <button
        className="farm-timer-toggle"
        onClick={() => setCollapsed(c => !c)}
        aria-label={collapsed ? t('timer.expand') : t('timer.collapse')}
        title={collapsed ? t('timer.expand') : t('timer.collapse')}
      >
        ⏱
      </button>

      {!collapsed && (
        <div className="farm-timer-body">
          <span className="farm-timer-display">{formatTime(seconds)}</span>
          <div className="farm-timer-actions">
            <button
              className={`farm-timer-btn${running ? ' farm-timer-btn-pause' : ' farm-timer-btn-start'}`}
              onClick={toggle}
              aria-label={running ? t('timer.pause') : t('timer.start')}
            >
              {running ? '⏸' : '▶'}
            </button>
            <button
              className="farm-timer-btn farm-timer-btn-reset"
              onClick={reset}
              disabled={isZero}
              aria-label={t('timer.reset')}
              title={t('timer.reset')}
            >
              ↺
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
