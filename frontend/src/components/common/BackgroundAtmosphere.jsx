export default function BackgroundAtmosphere() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(99, 102, 241, 0.30) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(99, 102, 241, 0.30) 1px, transparent 1px),
            radial-gradient(circle, rgba(79, 70, 229, 0.75) 2px, transparent 2px)
          `,
          backgroundSize: '40px 40px, 40px 40px, 40px 40px',
          backgroundPosition: '0 0, 0 0, 20px 20px',
        }}
      />

      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[1000px] rounded-full bg-gradient-to-b from-indigo-500/25 via-brand-soft/20 to-transparent blur-[110px]" />

      <div className="absolute top-1/4 -right-28 h-[550px] w-[550px] rounded-full bg-gradient-to-bl from-blue-500/25 via-cyan-400/20 to-transparent blur-[100px]" />

      <div className="absolute top-1/2 -left-28 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-emerald-400/20 via-teal-500/15 to-transparent blur-[100px]" />

      <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 h-[450px] w-[900px] rounded-full bg-gradient-to-t from-indigo-500/20 via-brand-accent/15 to-transparent blur-[110px]" />

      <svg
        className="absolute inset-0 w-full h-full opacity-30"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 1440 900"
      >
        <path
          d="M-100,200 Q300,100 700,300 T1500,250"
          fill="none"
          stroke="url(#fiberGrad1)"
          strokeWidth="2"
          strokeDasharray="6 8"
        />
        <path
          d="M-50,600 Q400,450 900,650 T1600,500"
          fill="none"
          stroke="url(#fiberGrad2)"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
        <defs>
          <linearGradient id="fiberGrad1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="fiberGrad2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}
