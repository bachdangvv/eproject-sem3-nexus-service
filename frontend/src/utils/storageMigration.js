const CURRENT_STORAGE_VERSION = '2.2'
const STORAGE_VERSION_KEY = 'nexus_storage_version'

export function migrateStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return

  try {
    const existingVersion = localStorage.getItem(STORAGE_VERSION_KEY)
    if (existingVersion === CURRENT_STORAGE_VERSION) {
      return
    }

    console.info(`[Nexus Migration] Migrating localStorage schema from ${existingVersion || 'legacy'} to ${CURRENT_STORAGE_VERSION}...`)

    const keysToClean = ['nexus_retail_orders', 'nexus_activated_accounts']
    for (const key of keysToClean) {
      try {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            const sanitized = parsed.map((item) => {
              if (item.accountPrefix && item.accountPrefix.includes('-')) {
                delete item.accountPrefix
              }
              return item
            })
            localStorage.setItem(key, JSON.stringify(sanitized))
          }
        }
      } catch (e) {
        console.warn(`[Nexus Migration] Could not migrate ${key}:`, e)
      }
    }

    try {
      const rawInvoices = localStorage.getItem('nexus_invoices')
      if (rawInvoices) {
        const invoices = JSON.parse(rawInvoices)
        if (Array.isArray(invoices)) {
          const sanitized = invoices.map((inv) => {
            if (inv.accountId && inv.accountId.startsWith('B001000000000001')) {
              inv.accountId = 'B101000000000089'
            }
            return inv
          })
          localStorage.setItem('nexus_invoices', JSON.stringify(sanitized))
        }
      }
    } catch {}

    try {
      const rawDebtAccounts = localStorage.getItem('nexus_debt_accounts_v1')
      if (rawDebtAccounts) {
        const debtAccounts = JSON.parse(rawDebtAccounts)
        if (Array.isArray(debtAccounts)) {
          const legacySeeds = {
            B101000000000089: {
              legacyBalance: 3388.25,
              balanceUSD: 507.89,
              openInvoicesBalanceUSD: 507.89,
              historicalArrearsUSD: 0,
              historicalArrearsNote: '',
              invoiceRef: '#INV-2026-02-0719, #INV-2026-03-0881',
              taxId: '0108881948',
            },
            T101000000000102: {
              legacyBalance: 18450.0,
              openInvoicesBalanceUSD: 807.62,
              historicalArrearsUSD: 17642.38,
              historicalArrearsNote: 'Legacy PRI trunking arrears carried forward outside Billing invoice list (#LEG-2026-088)',
              invoiceRef: '#INV-2026-03-0882 (+ Legacy #LEG-2026-088)',
            },
            D101000000000045: {
              legacyBalance: 42120.0,
              openInvoicesBalanceUSD: 0,
              historicalArrearsUSD: 42120.0,
              historicalArrearsNote: 'Pre-migration multi-site leased line arrears outside Billing invoice list (#LEG-2026-072)',
              invoiceRef: '#INV-2026-03-0883 (Paid) + Legacy #LEG-2026-072',
            },
            B102000000000210: {
              legacyBalance: 9870.0,
              openInvoicesBalanceUSD: 0,
              historicalArrearsUSD: 9870.0,
              historicalArrearsNote: 'Legacy hospitality setup & multi-play arrears outside Billing invoice list (#LEG-2026-095)',
              invoiceRef: 'Legacy #LEG-2026-095 (Outside Billing)',
            },
          }
          const sanitizedDebt = debtAccounts.map((acc) => {
            const spec = legacySeeds[acc.accountId]
            if (spec && acc.historicalArrearsUSD === undefined && Number(acc.balanceUSD) === spec.legacyBalance) {
              return {
                ...acc,
                balanceUSD: spec.balanceUSD ?? acc.balanceUSD,
                openInvoicesBalanceUSD: spec.openInvoicesBalanceUSD,
                historicalArrearsUSD: spec.historicalArrearsUSD,
                historicalArrearsNote: spec.historicalArrearsNote,
                invoiceRef: spec.invoiceRef,
                ...(spec.taxId ? { taxId: spec.taxId } : {}),
              }
            }
            return acc
          })
          localStorage.setItem('nexus_debt_accounts_v1', JSON.stringify(sanitizedDebt))
        }
      }
    } catch {}

    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION)
    console.info(`[Nexus Migration] Storage schema migration to v${CURRENT_STORAGE_VERSION} completed successfully.`)
  } catch (err) {
    console.error('[Nexus Migration] Storage migration error:', err)
  }
}

