import React, { useEffect, useRef, useState } from 'react'

// -- Types -------------------------------------------------------------------

interface LoadingScreenProps {
  dataReady: boolean
  onComplete: () => void
}

type Phase = 'loading' | 'credits' | 'out'

// -- Dust particle (amber only, organic fantasy drift) -----------------------

interface Dust {
  x: number; y: number
  vx: number; vy: number
  r: number
  life: number; maxLife: number
  wobbleOff: number; wobbleAmp: number; wobbleFreq: number
}

const AMBER = ['#c9a030', '#d4b050', '#b88420', '#e8c060', '#f0d070', '#a87010']

function newDust(w: number, h: number): Dust {
  const maxLife = 260 + Math.random() * 340
  return {
    x: Math.random() * w, y: h + Math.random() * 16,
    vx: (Math.random() - 0.5) * 0.14,
    vy: -(0.05 + Math.random() * 0.20),
    r: 0.4 + Math.random() * 1.3,
    life: 0, maxLife,
    wobbleOff:  Math.random() * Math.PI * 2,
    wobbleAmp:  0.06 + Math.random() * 0.20,
    wobbleFreq: 0.005 + Math.random() * 0.012,
  }
}

// -- Constants ---------------------------------------------------------------

const CREDITS = 'Made by Biluzera'

// -- Component ---------------------------------------------------------------

export default function LoadingScreen({ dataReady, onComplete }: LoadingScreenProps): React.ReactElement {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const animRef    = useRef<number>(0)
  const dustRef    = useRef<Dust[]>([])

  const [progress,     setProgress]     = useState(0)
  const [phase,        setPhase]        = useState<Phase>('loading')
  const [lettersShown, setLettersShown] = useState(0)
  const [shimmer,      setShimmer]      = useState(false)
  const [rootOpacity,  setRootOpacity]  = useState(1)

  const dataReadyRef = useRef(false)
  const startRef     = useRef(Date.now())
  const phaseRef     = useRef<Phase>('loading')
  const completedRef = useRef(false)

  useEffect(() => { dataReadyRef.current = dataReady }, [dataReady])

  // Canvas -- fantasy amber dust
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const fit = (): void => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    fit()
    window.addEventListener('resize', fit)

    dustRef.current = Array.from({ length: 65 }, () => {
      const d = newDust(canvas.width, canvas.height)
      d.life = Math.random() * d.maxLife * 0.72
      d.y    = canvas.height * (0.05 + Math.random() * 0.96)
      return d
    })

    let frame = 0
    const tick = (): void => {
      const w = canvas.width, h = canvas.height
      frame++
      ctx.fillStyle = 'rgba(5, 3, 1, 0.19)'
      ctx.fillRect(0, 0, w, h)

      if (frame % 2 === 0) {
        const gr = ctx.createRadialGradient(w * 0.50, h * 0.46, 0, w * 0.50, h * 0.46, Math.min(w, h) * 0.68)
        gr.addColorStop(0,    'rgba(95, 55, 6, 0.058)')
        gr.addColorStop(0.42, 'rgba(65, 38, 4, 0.030)')
        gr.addColorStop(1,    'rgba(0,   0, 0, 0)')
        ctx.fillStyle = gr
        ctx.fillRect(0, 0, w, h)
      }

      if (frame % 250 === 125) {
        const ry = h * (0.28 + Math.random() * 0.44)
        const a  = 0.022 + Math.random() * 0.038
        const rg = ctx.createLinearGradient(0, 0, w, 0)
        rg.addColorStop(0,    'rgba(201,160,48,0)')
        rg.addColorStop(0.20, `rgba(201,160,48,${a})`)
        rg.addColorStop(0.80, `rgba(201,160,48,${a})`)
        rg.addColorStop(1,    'rgba(201,160,48,0)')
        ctx.fillStyle = rg
        ctx.fillRect(0, ry, w, 0.8 + Math.random() * 1.0)
      }

      const dust = dustRef.current
      for (let i = 0; i < dust.length; i++) {
        const d = dust[i]
        d.life++
        d.x += d.vx + Math.sin(d.wobbleOff + d.life * d.wobbleFreq) * d.wobbleAmp
        d.y += d.vy
        const t     = d.life / d.maxLife
        const alpha = (t < 0.10 ? t / 0.10 : t > 0.82 ? (1 - t) / 0.18 : 1) * 0.55
        if (d.life >= d.maxLife || d.y < -12) { dust[i] = newDust(w, h); continue }
        const hex = Math.floor(alpha * 255).toString(16).padStart(2, '0')
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = AMBER[(i + frame) % AMBER.length] + hex
        ctx.fill()
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', fit) }
  }, [])

  // Progress simulation
  useEffect(() => {
    if (phaseRef.current !== 'loading') return
    const id = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const minDone = elapsed >= 1800
      const ready   = dataReadyRef.current && minDone
      setProgress(prev => {
        if (prev >= 100) return 100
        let next: number
        if (ready) {
          next = Math.min(100, prev + 2.8)
          if (next >= 100 && phaseRef.current === 'loading') {
            clearInterval(id)
            setTimeout(() => { phaseRef.current = 'credits'; setPhase('credits') }, 320)
          }
        } else {
          next = prev < 88 ? Math.min(88, prev + ((1 - prev / 88) * 3.2 + 0.12) * 0.38) : prev
        }
        return next
      })
    }, 16)
    return () => clearInterval(id)
  }, [])

  // Per-letter assembly
  useEffect(() => {
    if (phase !== 'credits') return
    let i = 0
    const id = setInterval(() => {
      i++
      setLettersShown(i)
      if (i >= CREDITS.length) {
        clearInterval(id)
        setTimeout(() => setShimmer(true), 180)
        setTimeout(() => {
          if (completedRef.current) return
          completedRef.current = true
          phaseRef.current = 'out'
          setPhase('out')
          setRootOpacity(0)
          setTimeout(onComplete, 760)
        }, 1500)
      }
    }, 70)
    return () => clearInterval(id)
  }, [phase, onComplete])

  const letters = CREDITS.split('')

  return (
    <div
      className="ls-root"
      style={{
        opacity:    rootOpacity,
        transition: phase === 'out' ? 'opacity 0.76s ease-in-out' : undefined,
      }}
    >
      <canvas ref={canvasRef} className="ls-canvas" />

      <div className="ls-border-outer" aria-hidden="true" />
      <div className="ls-border-inner" aria-hidden="true" />

      <div className="ls-corner ls-tl" aria-hidden="true"><span className="ls-corner-dot" /></div>
      <div className="ls-corner ls-tr" aria-hidden="true"><span className="ls-corner-dot" /></div>
      <div className="ls-corner ls-bl" aria-hidden="true"><span className="ls-corner-dot" /></div>
      <div className="ls-corner ls-br" aria-hidden="true"><span className="ls-corner-dot" /></div>

      <div className="ls-hbar ls-hbar-top" aria-hidden="true">
        <span className="ls-hbar-line" />
        <span className="ls-hbar-gem">&#x25C6;</span>
        <span className="ls-hbar-line" />
      </div>
      <div className="ls-hbar ls-hbar-bot" aria-hidden="true">
        <span className="ls-hbar-line" />
        <span className="ls-hbar-gem">&#x25C6;</span>
        <span className="ls-hbar-line" />
      </div>

      <span className="ls-side-gem ls-side-l" aria-hidden="true">&#x25C6;</span>
      <span className="ls-side-gem ls-side-r" aria-hidden="true">&#x25C6;</span>

      <div className="ls-content">

        {phase === 'loading' && (
          <>
            <div className="ls-divider" aria-hidden="true">
              <span className="ls-divider-line" />
              <span className="ls-divider-gem">&#x25C8;</span>
              <span className="ls-divider-line" />
            </div>

            <div className="ls-logo-row">
              <span className="ls-ornament" aria-hidden="true">&#x2726;</span>
              <h1 className="ls-title">BDO Loot Log</h1>
              <span className="ls-ornament" aria-hidden="true">&#x2726;</span>
            </div>

            <p className="ls-tagline">Registro de Itens &amp; Sess&#xF5;es de Farm</p>

            <div className="ls-divider" aria-hidden="true">
              <span className="ls-divider-line" />
              <span className="ls-divider-gem">&#x25C8;</span>
              <span className="ls-divider-line" />
            </div>

            <div className="ls-bar-outer">
              <span className="ls-bar-end" aria-hidden="true">&#x25C8;</span>
              <div className="ls-bar-track">
                <div className="ls-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="ls-bar-end" aria-hidden="true">&#x25C8;</span>
            </div>

            <span className="ls-pct">{Math.round(progress)}%</span>
          </>
        )}

        {(phase === 'credits' || phase === 'out') && (
          <div className={`ls-credits${shimmer ? ' ls-credits--shimmer' : ''}`} aria-live="polite">
            {letters.map((ch, i) => (
              <span
                key={i}
                className={`ls-letter${i < lettersShown ? ' ls-letter--in' : ''}`}
                aria-hidden={ch === ' ' ? 'true' : undefined}
              >
                {ch === ' ' ? '\u00a0' : ch}
              </span>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
