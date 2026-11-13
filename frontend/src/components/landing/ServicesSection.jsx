import { Landmark, ArrowUpDown, PhoneCall, Smartphone, Globe, Bot } from 'lucide-react'

const SERVICES = [
  {
    icon: Landmark,
    tag: 'Enterprise Retail',
    title: 'POS / ATM Data Circuits',
    desc: 'AES-256 hardware encryption, dedicated static IPs designed for 50,000+ retail POS terminals and bank branches.',
    badge: '99.99% SLA',
    badgeTone: 'bg-indigo-50 text-brand-accent',
    meta: { icon: Smartphone, text: '4G/5G Failover' },
  },
  {
    icon: ArrowUpDown,
    tag: 'Ultra Broadband',
    title: 'FTTH & Leased Line',
    desc: 'Symmetric bandwidth from 1 Gbps to 10 Gbps with guaranteed, unshared international bandwidth and low latency.',
    badge: '1 Gbps – 10 Gbps',
    badgeTone: 'bg-emerald-50 text-emerald-700',
    meta: { icon: Globe, text: 'Multi-gateway routing' },
  },
  {
    icon: PhoneCall,
    tag: 'Corporate Voice',
    title: 'SIP Trunking Cloud',
    desc: 'Multi-channel digital voice with automated CRM/ERP hooks, unlimited concurrent calls and free inter-branch dialing.',
    badge: 'Unlimited Channels',
    badgeTone: 'bg-violet-50 text-violet-700',
    meta: { icon: Bot, text: 'AI Call Recording' },
  },
]

export default function ServicesSection() {
  return (
    <section id="services" className="mx-auto mt-14 max-w-[1680px] px-4 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Enterprise Network Solutions</div>
          <h2 className="mt-1 text-3xl font-extrabold text-navy">Core Services</h2>
        </div>
        <span className="hidden rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-500 shadow-sm sm:block">
          100% Fiber Infrastructure
        </span>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {SERVICES.map(({ icon: Icon, tag, title, desc, badge, badgeTone, meta }) => (
          <article
            key={title}
            className="card card-hover flex flex-col p-6 cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50/80 text-brand-accent shadow-xs group-hover:bg-brand-soft group-hover:text-white transition-colors duration-200">
                <Icon size={22} />
              </span>
              <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide ${badgeTone}`}>
                {badge}
              </span>
            </div>
            <div className="mt-5 text-[10px] font-bold uppercase tracking-widest text-brand-soft">{tag}</div>
            <h3 className="mt-1 text-lg font-extrabold text-navy group-hover:text-brand-accent transition-colors">
              {title}
            </h3>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-500">{desc}</p>
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-slate-500">
                {meta.text} <meta.icon size={13} className="text-slate-400" />
              </span>
              <span className="font-bold text-brand-soft group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                View SLA &rarr;
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

