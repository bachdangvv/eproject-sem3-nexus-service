import { useState, useEffect } from 'react'
import { Zap, X, CheckCircle2, RefreshCw, Download, Radio, ShieldCheck, Activity } from 'lucide-react'

export default function LiveDiagnosticModal({ circuit, onClose }) {
  const [isRunning, setIsRunning] = useState(true)
  const [currentStep, setCurrentStep] = useState(1)

  useEffect(() => {
    let timer1 = setTimeout(() => setCurrentStep(2), 600)
    let timer2 = setTimeout(() => setCurrentStep(3), 1200)
    let timer3 = setTimeout(() => {
      setCurrentStep(4)
      setIsRunning(false)
    }, 1800)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [])

  const handleRerun = () => {
    setIsRunning(true)
    setCurrentStep(1)
    setTimeout(() => setCurrentStep(2), 500)
    setTimeout(() => setCurrentStep(3), 1000)
    setTimeout(() => {
      setCurrentStep(4)
      setIsRunning(false)
    }, 1600)
  }

  const handleDownloadReport = () => {
    const accId = circuit?.accountId || 'B101000000000089'
    const reportText = `NEXUS TELECOM SIMULATED OPTICAL DIAGNOSTIC REPORT (DEMO)
Generated: ${new Date().toISOString()}
Account Bound: ${accId}
Subscriber: ${circuit?.customerName || 'AlphaCorp Technology Solutions JSC'}
Circuit: ${circuit?.serviceTitle || circuit?.planName || 'FTTH Dedicated 500Mbps Metro Core'}

1. OPTICAL POWER LEVEL (SAMPLE):
   - Rx Power Level: -18.2 dBm [PASS - Margin: 5.8 dB vs -24 dBm SLA threshold]
   - Tx Laser Output: +2.4 dBm [NOMINAL]

2. LATENCY & JITTER METRICS (SAMPLE):
   - Round-trip ping to Hanoi Gateway: 1.6 ms [PASS - SLA < 10ms]
   - Packet Jitter: 0.18 ms [OPTIMAL]
   - Packet Loss (10,000 probes): 0.00% [ZERO DROP]

3. GPON OLT HARDWARE LINK (SAMPLE):
   - OLT Node: VN-HN01-R02 / PON-02
   - Optical Distance (OTDR): 185 meters from ODF-SP-HK-04
   - Splicing Attenuation: 0.18 dB (Target < 0.25 dB)

4. COMMITTED BANDWIDTH BENCHMARK (SAMPLE):
   - Download CIR / PIR: 512.4 Mbps (Target: 500 Mbps)
   - Upload CIR / PIR: 504.8 Mbps (Target: 500 Mbps)
   - Carrier SLA Target: 99.98% (SIMULATED DEMO PASS)

DEMO SUMMARY: Simulated optical link check complete (sample diagnostic metrics, not live hardware telemetry).
`
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Diagnostic_Report_${accId}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7 space-y-5 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 font-bold border border-cyan-100">
              <Zap size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-navy">Simulated Optical Line Diagnostic (Demo)</h3>
              <p className="text-xs text-slate-500">
                Circuit ID: <span className="font-mono font-bold text-indigo-600">{circuit?.accountId || 'B101000000000089'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress header */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">
              {isRunning ? 'Running Simulated Telemetry Checks...' : 'Simulated Checks Complete (Demo Metrics)'}
            </span>
            <span className="font-mono text-cyan-700 font-bold">
              {isRunning ? `Step ${currentStep}/4` : 'Demo Complete'}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-indigo-600 transition-all duration-500"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* 4 Test Results */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                currentStep >= 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
              }`}>
                {currentStep > 1 || !isRunning ? <CheckCircle2 size={14} /> : '1'}
              </span>
              <div>
                <span className="font-bold text-xs text-slate-800">Laser Rx Optical Power Level</span>
                <p className="text-[11px] text-slate-500">Threshold limit: &lt; -24 dBm</p>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-xs text-emerald-600">-18.2 dBm</span>
              <span className="block text-[10px] font-bold text-emerald-700 uppercase">PASS (Good Margin)</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                currentStep >= 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
              }`}>
                {currentStep > 2 || !isRunning ? <CheckCircle2 size={14} /> : '2'}
              </span>
              <div>
                <span className="font-bold text-xs text-slate-800">Carrier Gateway Ping &amp; Jitter</span>
                <p className="text-[11px] text-slate-500">10,000 UDP echo packets</p>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-xs text-cyan-700">1.6 ms</span>
              <span className="block text-[10px] font-bold text-slate-500">0.00% Packet Drop</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                currentStep >= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
              }`}>
                {currentStep > 3 || !isRunning ? <CheckCircle2 size={14} /> : '3'}
              </span>
              <div>
                <span className="font-bold text-xs text-slate-800">OLT PON Slot Synchronization</span>
                <p className="text-[11px] text-slate-500">Node VN-HN01-R02 dist 185m</p>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-xs text-indigo-700">Sample OK</span>
              <span className="block text-[10px] font-bold text-sky-700 uppercase">Demo Sync</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                currentStep >= 4 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
              }`}>
                {!isRunning ? <CheckCircle2 size={14} /> : '4'}
              </span>
              <div>
                <span className="font-bold text-xs text-slate-800">Throughput CIR/PIR Verification</span>
                <p className="text-[11px] text-slate-500">Rated against 500M contract SLA</p>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-xs text-emerald-600">512 Mbps / 504 Mbps</span>
              <span className="block text-[10px] font-bold text-emerald-700 uppercase">99.98% SLA OK</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={isRunning}
            onClick={handleRerun}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isRunning ? 'animate-spin' : ''} />
            <span>Rerun Diagnostic</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadReport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-2 text-xs font-bold text-cyan-800 hover:bg-cyan-100 transition cursor-pointer"
            >
              <Download size={13} />
              <span>Download Report</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-navy px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

