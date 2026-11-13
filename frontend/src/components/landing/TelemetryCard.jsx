import { useEffect, useMemo, useState } from 'react'

const STATS = [
  { label: 'Uptime SLA', value: '99.992%', sub: 'Target 99.98%', tone: 'text-online' },
  { label: 'Metro Latency', value: '1.18 ms', sub: 'Jitter < 0.1ms', tone: 'text-navy' },
  { label: 'Station Uplink', value: '10 Gbps', sub: 'Full Duplex', tone: 'text-navy' },
  { label: 'Global Gateway', value: '400 Gbps', sub: 'APG & AAG Routes', tone: 'text-brand-accent' },
]

const POINTS = 40
const W = 520
const H = 90

function seedSeries() {
  return Array.from({ length: POINTS }, (_, i) => 50 + 22 * Math.sin(i / 4) + 8 * Math.sin(i / 1.7))
}

function toSmoothPath(values) {
  const step = W / (values.length - 1)
  const pts = values.map((v, i) => [i * step, H - (v / 100) * H])
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`
  }
  return d
}

export default function TelemetryCard() {
  const [series, setSeries] = useState(seedSeries)

  useEffect(() => {
    const t = setInterval(() => {
      setSeries((prev) => {
        const last = prev[prev.length - 1]
        const next = Math.max(15, Math.min(90, last + (Math.random() - 0.5) * 18))
        return [...prev.slice(1), next]
      })
    }, 1500)
    return () => clearInterval(t)
  }, [])

  const line = useMemo(() => toSmoothPath(series), [series])
  const area = `${line} L ${W} ${H} L 0 ${H} Z`
  const tbps = (series[series.length - 1] * 4.5).toFixed(1)

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-wide text-navy">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> SIMULATED NOC TELEMETRY (DEMO)
        </h2>
        <span className="font-mono text-[10px] text-slate-400">SAMPLE : AP-SGP-VN01</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-xl bg-indigo-50/60 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.label}</div>
            <div className={`mt-1 text-lg font-extrabold ${s.tone}`}>{s.value}</div>
            <div className="text-[10px] text-slate-400">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl bg-indigo-50/60 p-4">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Simulated Traffic Curve (Demo)</span>
          <span className="font-mono font-bold text-navy">{tbps} Tbps</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-24 w-full" preserveAspectRatio="none" role="img" aria-label="Network traffic graph">
          <defs>
            <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#trafficFill)" />
          <path d={line} fill="none" stroke="#4f46e5" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>Anti-DDoS Profile: <b className="text-sky-700">Simulated Mode</b></span>
          <span>Sample Loss Rate: <b className="text-navy">0.0001%</b></span>
        </div>
      </div>
    </div>
  )
}
