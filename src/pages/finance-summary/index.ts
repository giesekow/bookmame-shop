import { $BN, $FD, $FM, $PT, $RP, Api, Dialogs, Field, Master, Part } from 'vuetify-extended'
import { downloadCsv } from '../../misc/csv'
import { shopAccess } from '../../misc/access'
import { useAppStore } from '../../store/app'

const PAGINATION_OPTIONS = [5, 10, 20, 50, 100]
let activeShopFinanceReport: any = null
let shopFinancePaginationInitialized = false

function summaryCardStyle(label: string) {
  if (label === 'Ready For Payout' || label === 'Ready For Remittance' || label === 'Ready for Manual Payout') {
    return {
      background: '#fff8dd',
      border: '#ebd58c',
      text: '#8a6500',
    }
  }

  if (label === 'Net Settlement Position' || label === 'Net Ready for Payout') {
    return {
      background: '#e7f7ef',
      border: '#a8d9be',
      text: '#1f7a4d',
    }
  }

  return {
    background: '#fff',
    border: '#dbe6ef',
    text: '#10263b',
  }
}

function isDarkTheme() {
  if (typeof document === 'undefined') return false
  const root = document.documentElement
  return root.classList.contains('v-theme--dark') || root.classList.contains('theme--dark')
}

function servicePath() {
  const shopId = useAppStore().shop?.id
  if (!shopId) {
    throw new Error('No active shop is selected.')
  }
  return `shops/${shopId}/settlements/summary`
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function money(amountMinor: unknown, currency?: unknown) {
  const amount = typeof amountMinor === 'number' ? amountMinor : Number(amountMinor || 0)
  const normalizedCurrency = typeof currency === 'string' && currency.length === 3 ? currency.toUpperCase() : 'USD'
  try {
    if (!Number.isFinite(amount) || amount === 0) {
      return '0.00'
    }
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: normalizedCurrency }).format(amount / 100)
  } catch (_error) {
    return `${normalizedCurrency} ${((Number.isFinite(amount) ? amount : 0) / 100).toFixed(2)}`
  }
}

function label(value: unknown) {
  return String(value || 'n/a').replace(/_/g, ' ')
}

function dateTime(value: unknown) {
  const date = value ? new Date(String(value)) : null
  if (!date || Number.isNaN(date.getTime())) {
    return 'Not available'
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  } catch (_error) {
    return date.toISOString()
  }
}

function buildPaginationState(summary: any) {
  const lines = Array.isArray(summary?.settlements) ? summary.settlements : []
  const totalItems = Number(summary?.settlementTotal ?? lines.length)
  const rawItemsPerPage = Number(summary?.itemsPerPage || 5)
  const itemsPerPage = PAGINATION_OPTIONS.includes(rawItemsPerPage) ? rawItemsPerPage : 5
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const rawPageNumber = Number(summary?.pageNumber || 1)
  const pageNumber = Math.min(Math.max(Number.isFinite(rawPageNumber) ? rawPageNumber : 1, 1), totalPages)
  const startIndex = totalItems === 0 ? 0 : (pageNumber - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + lines.length, totalItems)

  return {
    lines,
    totalItems,
    itemsPerPage,
    pageNumber,
    totalPages,
    startIndex,
    endIndex,
    visibleLines: lines,
  }
}

function renderPaginationControls(pagination: ReturnType<typeof buildPaginationState>) {
  const dark = isDarkTheme()
  const panelBg = dark ? '#1f2a37' : '#fff'
  const panelBorder = dark ? '#34475f' : '#dbe6ef'
  const primaryText = dark ? '#e7eef6' : '#10263b'
  const mutedText = dark ? '#a9bbcf' : '#61768b'
  const secondaryText = dark ? '#c6d3e2' : '#476079'
  const btnBorder = dark ? '#3e5168' : '#d5e1eb'
  const btnBg = dark ? '#233143' : '#fff'
  const btnText = dark ? '#dbe7f3' : '#274056'
  const btnDisabledBg = dark ? '#2a3647' : '#f4f7fa'
  const btnDisabledText = dark ? '#8093a8' : '#9aaaba'
  const btnActiveBorder = dark ? '#67a2ff' : '#2f6fed'
  const btnActiveBg = dark ? '#1c3a66' : '#edf4ff'
  const btnActiveText = dark ? '#d8e7ff' : '#1f5e9d'

  return `
    <div style="font-family:inherit; color:${primaryText}; background:${panelBg}; border:1px solid ${panelBorder}; border-radius:16px; padding:14px 16px;">
      <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:14px; align-items:center;">
        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
          <span style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:${mutedText};">Items per page</span>
          ${PAGINATION_OPTIONS.map((value) => {
            const active = pagination.itemsPerPage === value
            return `<button type="button" data-finance-pagination="shop-finance" data-action="items" data-value="${value}" style="border:1px solid ${active ? btnActiveBorder : btnBorder}; background:${active ? btnActiveBg : btnBg}; color:${active ? btnActiveText : btnText}; border-radius:999px; padding:6px 12px; font-size:13px; font-weight:700; cursor:pointer;">${value}</button>`
          }).join('')}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:flex-end;">
          <span style="font-size:13px; color:${secondaryText};">Showing ${pagination.lines.length === 0 ? 0 : pagination.startIndex + 1}-${pagination.endIndex} of ${pagination.totalItems}</span>
          <button type="button" data-finance-pagination="shop-finance" data-action="prev" style="border:1px solid ${btnBorder}; background:${pagination.pageNumber <= 1 ? btnDisabledBg : btnBg}; color:${pagination.pageNumber <= 1 ? btnDisabledText : btnText}; border-radius:10px; padding:6px 12px; font-size:13px; font-weight:700; cursor:${pagination.pageNumber <= 1 ? 'not-allowed' : 'pointer'};" ${pagination.pageNumber <= 1 ? 'disabled' : ''}>Previous</button>
          <span style="min-width:96px; text-align:center; font-size:13px; font-weight:700; color:${primaryText};">Page ${pagination.pageNumber} of ${pagination.totalPages}</span>
          <button type="button" data-finance-pagination="shop-finance" data-action="next" style="border:1px solid ${btnBorder}; background:${pagination.pageNumber >= pagination.totalPages ? btnDisabledBg : btnBg}; color:${pagination.pageNumber >= pagination.totalPages ? btnDisabledText : btnText}; border-radius:10px; padding:6px 12px; font-size:13px; font-weight:700; cursor:${pagination.pageNumber >= pagination.totalPages ? 'not-allowed' : 'pointer'};" ${pagination.pageNumber >= pagination.totalPages ? 'disabled' : ''}>Next</button>
        </div>
      </div>
    </div>
  `
}

function renderSummary(summary: any, pagination: ReturnType<typeof buildPaginationState>) {
  const dark = isDarkTheme()
  const panelBg = dark ? '#1f2a37' : '#fffaf5'
  const panelBorder = dark ? '#34475f' : '#eadfd4'
  const primaryText = dark ? '#e7eef6' : '#241a14'
  const mutedText = dark ? '#a9bbcf' : '#8a7768'

  const cards: Array<[string, unknown]> = [
    ['Shop', summary?.beneficiaryName || useAppStore().shop?.name || 'Shop'],
    ['Currency', summary?.currency || 'n/a'],
    ['Orders', summary?.orderCount ?? 0],
    ['Finance Lines', pagination.totalItems],
    ['Showing', pagination.lines.length === 0 ? '0' : `${pagination.startIndex + 1}-${pagination.endIndex}`],
    ['Gross', money(summary?.grossAmount, summary?.currency)],
    ['Service Charge', money(summary?.feeAmount, summary?.currency)],
    ['Net', money(summary?.netAmount, summary?.currency)],
    ['Collected Directly', money(summary?.directCollectedAmount, summary?.currency)],
    ['Outstanding Payable', money(summary?.outstandingPayableAmount, summary?.currency)],
    ['Outstanding Remittance', money(summary?.outstandingRemittanceAmount, summary?.currency)],
    ['Ready For Payout', money(summary?.readyForManualPayoutAmount, summary?.currency)],
    ['Payout Initiated', money(summary?.payoutInitiatedAmount, summary?.currency)],
    ['Paid Out', money(summary?.paidOutAmount, summary?.currency)],
    ['Ready For Remittance', money(summary?.readyForManualRemittanceAmount, summary?.currency)],
    ['Remittance Initiated', money(summary?.remittanceInitiatedAmount, summary?.currency)],
    ['Remittance Received', money(summary?.remittanceReceivedAmount, summary?.currency)],
    ['Net Settlement Position', money(Number(summary?.outstandingPayableAmount ?? 0) - Number(summary?.outstandingRemittanceAmount ?? 0), summary?.currency)],
    ['Ready for Manual Payout', money(summary?.readyForManualPayoutAmount, summary?.currency)],
    ['Net Ready for Payout', money(Math.max(0, Number(summary?.readyForManualPayoutAmount ?? 0) - Number(summary?.outstandingRemittanceAmount ?? 0)), summary?.currency)],
  ]

  return `
    <div style="font-family:inherit; color:${primaryText}; background:${panelBg}; border:1px solid ${panelBorder}; border-radius:16px; padding:16px;">
      <div style="margin-bottom:14px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:${mutedText};">Shop finance summary</div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px;">
        ${cards.map(([name, value]) => {
          const tone = summaryCardStyle(String(name))
          const cardBg = dark ? '#223142' : tone.background
          const cardBorder = dark ? '#3a4e65' : tone.border
          const cardLabel = dark ? '#9fe3b2' : '#a2eb9e'
          const cardText = dark ? '#edf3fa' : tone.text
          return `<div style="background:${cardBg}; border:1px solid ${cardBorder}; border-radius:12px; padding:12px;"><div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:${cardLabel}; margin-bottom:6px;">${escapeHtml(name)}</div><div style="font-size:16px; font-weight:800; color:${cardText};">${escapeHtml(value)}</div></div>`
        }).join('')}
      </div>
    </div>
  `
}

function renderLines(summary: any, pagination: ReturnType<typeof buildPaginationState>) {
  const dark = isDarkTheme()
  const panelBg = dark ? '#1f2a37' : '#fff'
  const panelBorder = dark ? '#34475f' : '#dbe6ef'
  const panelHeadBg = dark ? '#223142' : '#f8fbfe'
  const primaryText = dark ? '#e7eef6' : '#10263b'
  const secondaryText = dark ? '#c6d3e2' : '#476079'
  const mutedText = dark ? '#a9bbcf' : '#61768b'
  const rowBorder = dark ? '#314358' : '#e5edf4'
  const badgeBg = dark ? '#2a3b4f' : '#eef4fa'
  const badgeText = dark ? '#dbe7f3' : '#274056'

  if (pagination.totalItems === 0) {
    return `<div style="padding:16px; border:1px solid ${panelBorder}; border-radius:12px; background:${panelBg}; color:${secondaryText};">No shop order finance lines were found.</div>`
  }

  return `
    <div style="font-family:inherit; color:${primaryText}; background:${panelBg}; border:1px solid ${panelBorder}; border-radius:18px; overflow:hidden;">
      <div style="padding:16px 18px; border-bottom:1px solid ${panelBorder}; background:${panelHeadBg};">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:${mutedText};">Shop order finance lines</div>
        <div style="margin-top:4px; color:${secondaryText}; font-size:13px;">Page ${pagination.pageNumber} of ${pagination.totalPages} · Showing ${pagination.lines.length === 0 ? 0 : pagination.startIndex + 1}-${pagination.endIndex} of ${pagination.totalItems}</div>
      </div>
      <div style="display:grid;">
        ${pagination.visibleLines.map((line: any) => `
          <article style="padding:16px 18px; border-bottom:1px solid ${rowBorder}; background:${panelBg};">
            <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:space-between; align-items:flex-start;">
              <div>
                <div style="font-size:16px; font-weight:800; color:${primaryText};">${escapeHtml(line?.orderNumber || 'Order')}</div>
                <div style="font-size:13px; color:${secondaryText};">Customer: ${escapeHtml(line?.guestName || 'n/a')}</div>
                <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                  <span style="padding:4px 8px; border-radius:999px; background:#f4e6d8; color:#8b5e14; font-size:11px; font-weight:700;">${escapeHtml(label(line?.status))}</span>
                  <span style="padding:4px 8px; border-radius:999px; background:#e6f2ea; color:#24613a; font-size:11px; font-weight:700;">${escapeHtml(label(line?.orderPaymentStatus))}</span>
                  <span style="padding:4px 8px; border-radius:999px; background:${badgeBg}; color:${badgeText}; font-size:11px; font-weight:700;">${escapeHtml(label(line?.paymentMethod))}</span>
                  <span style="padding:4px 8px; border-radius:999px; background:${badgeBg}; color:${badgeText}; font-size:11px; font-weight:700;">${escapeHtml(label(line?.orderRestaurantStatus))}</span>
                </div>
              </div>
              <div style="flex:1 1 320px; min-width:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; font-size:12px; color:${secondaryText};">
                <div><div style="font-size:11px; color:${mutedText}; text-transform:uppercase;">Order Total</div><div style="font-weight:700; color:${primaryText};">${escapeHtml(money(line?.totalAmount, summary?.currency))}</div></div>
                <div><div style="font-size:11px; color:${mutedText}; text-transform:uppercase;">Fees</div><div style="font-weight:700; color:${primaryText};">${escapeHtml(money(line?.feeAmount, summary?.currency))}</div></div>
                <div><div style="font-size:11px; color:${mutedText}; text-transform:uppercase;">Net</div><div style="font-weight:700; color:${primaryText};">${escapeHtml(money(line?.netAmount, summary?.currency))}</div></div>
                <div><div style="font-size:11px; color:${mutedText}; text-transform:uppercase;">Outstanding</div><div style="font-weight:700; color:${primaryText};">${escapeHtml(money(line?.outstandingPayableAmount, summary?.currency))}</div></div>
                <div><div style="font-size:11px; color:${mutedText}; text-transform:uppercase;">Outstanding Remittance</div><div style="font-weight:700; color:${primaryText};">${escapeHtml(money(line?.outstandingRemittanceAmount, summary?.currency))}</div></div>
                <div><div style="font-size:11px; color:${mutedText}; text-transform:uppercase;">Net Position</div><div style="font-weight:700; color:${primaryText};">${escapeHtml(money(Number(line?.outstandingPayableAmount ?? 0) - Number(line?.outstandingRemittanceAmount ?? 0), summary?.currency))}</div></div>
                <div><div style="font-size:11px; color:${mutedText}; text-transform:uppercase;">Created</div><div style="font-weight:700; color:${primaryText};">${escapeHtml(dateTime(line?.createdAt))}</div></div>
                <div><div style="font-size:11px; color:${mutedText}; text-transform:uppercase;">Eligible At</div><div style="font-weight:700; color:${primaryText};">${escapeHtml(dateTime(line?.eligibleAt))}</div></div>
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `
}

function refreshFinanceDetail(report: any) {
  const master = report?.$master
  if (!master) {
    return
  }
  const detailState = master.$get('detailState', master.$data || {}) || {}
  const pagination = buildPaginationState(detailState)
  master.$set('itemsPerPage', pagination.itemsPerPage)
  master.$set('pageNumber', pagination.pageNumber)
  master.$set('summaryView', renderSummary(detailState, pagination))
  master.$set('paginationControlsView', renderPaginationControls(pagination))
  master.$set('linesView', renderLines(detailState, pagination))
}

function initializeFinancePagination() {
  if (shopFinancePaginationInitialized || typeof document === 'undefined') {
    return
  }
  shopFinancePaginationInitialized = true

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    const button = target?.closest?.('[data-finance-pagination="shop-finance"]') as HTMLElement | null

    if (!button || !activeShopFinanceReport?.$master) {
      return
    }

    event.preventDefault()

    const action = button.getAttribute('data-action')
    const master = activeShopFinanceReport.$master
    const summary = master.$get('detailState', master.$data || {}) || {}
    const pagination = buildPaginationState(summary)

    if (action === 'items') {
      const value = Number(button.getAttribute('data-value') || 5)
      master.$set('itemsPerPage', PAGINATION_OPTIONS.includes(value) ? value : 5)
      master.$set('pageNumber', 1)
    } else if (action === 'prev' && pagination.pageNumber > 1) {
      master.$set('pageNumber', pagination.pageNumber - 1)
    } else if (action === 'next' && pagination.pageNumber < pagination.totalPages) {
      master.$set('pageNumber', pagination.pageNumber + 1)
    } else {
      return
    }

    void loadFinanceDetail(activeShopFinanceReport)
  })
}

async function loadFinanceDetail(report: any) {
  const master = report?.$master
  if (!master) return
  const summaryId = master.$get('id')
  const currentState = master.$get('detailState', master.$data || {}) || {}
  const itemsPerPage = PAGINATION_OPTIONS.includes(Number(master.$get('itemsPerPage', currentState.itemsPerPage || 5)))
    ? Number(master.$get('itemsPerPage', currentState.itemsPerPage || 5))
    : 5
  const pageNumber = Math.max(1, Number(master.$get('pageNumber', currentState.pageNumber || 1)) || 1)
  let resolvedSummaryId = summaryId

  if (!resolvedSummaryId) {
    try {
      const response = await Api.instance.service(servicePath()).find({
        $limit: 1,
        $skip: 0,
      })
      const items = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : []
      const first = items[0]

      if (first?.id) {
        resolvedSummaryId = first.id
        master.$set('id', first.id)
        master.$set('beneficiaryId', first.beneficiaryId)
        master.$set('beneficiaryName', first.beneficiaryName)
        master.$set('currency', first.currency)
      }
    } catch (error: any) {
      Dialogs.$error(error.message)
      master.$set('detailState', { ...currentState, itemsPerPage, pageNumber })
      refreshFinanceDetail(report)
      return
    }
  }

  if (!resolvedSummaryId) {
    master.$set('detailState', {
      ...currentState,
      beneficiaryName: useAppStore().shop?.name || 'Shop',
      itemsPerPage,
      pageNumber,
      settlements: [],
      settlementTotal: 0,
    })
    refreshFinanceDetail(report)
    return
  }

  try {
    const detail = await Api.instance.service(servicePath()).get(resolvedSummaryId, {
      $limit: itemsPerPage,
      $skip: (pageNumber - 1) * itemsPerPage,
    })
    master.$set('detailState', { ...detail, itemsPerPage, pageNumber })
  } catch (error: any) {
    Dialogs.$error(error.message)
  }

  refreshFinanceDetail(report)
}

async function exportFinanceSummaryCsv(master: any) {
  const detailState = master?.$get('detailState', master?.$data || {}) || {}
  const settlements = Array.isArray(detailState?.settlements) ? detailState.settlements : []

  if (settlements.length === 0) {
    Dialogs.$error('Open finance summary data before exporting.')
    return
  }

  const rows = settlements.map((item: any) => ({
    shop: detailState?.beneficiaryName || useAppStore().shop?.name || '',
    currency: detailState?.currency || '',
    orderNumber: item?.orderNumber || '',
    customerName: item?.guestName || '',
    paymentMethod: item?.paymentMethod || '',
    paymentStatus: item?.orderPaymentStatus || '',
    orderStatus: item?.orderRestaurantStatus || '',
    sourceStatus: item?.status || '',
    totalAmount: money(item?.totalAmount, detailState?.currency),
    feeAmount: money(item?.feeAmount, detailState?.currency),
    netAmount: money(item?.netAmount, detailState?.currency),
    collectedDirectly: money(item?.directCollectedAmount, detailState?.currency),
    outstandingPayable: money(item?.outstandingPayableAmount, detailState?.currency),
    outstandingRemittance: money(item?.outstandingRemittanceAmount, detailState?.currency),
    eligibleAt: dateTime(item?.eligibleAt),
    createdAt: dateTime(item?.createdAt),
  }))

  downloadCsv(`shop-finance-summary-${detailState?.currency || 'export'}.csv`, rows)
}

export const shopFinanceSummaryReport = () => {
  const fields: (Field | Part)[] = [
    $FD({ label: 'Summary', storage: 'summaryView', type: 'htmlview', readonly: true, cols: 12, minHeight: 300 }, {
      default(field) {
        const summary = field.$master?.$data || {}
        return renderSummary(summary, buildPaginationState(summary))
      },
    }),
    $FD({ label: 'Pagination', storage: 'paginationControlsView', type: 'htmlview', readonly: true, cols: 12 }, {
      default(field) {
        return renderPaginationControls(buildPaginationState(field.$master?.$data || {}))
      },
    }),
    $FD({ label: 'Order Finance', storage: 'linesView', type: 'htmlview', readonly: true, cols: 12, minHeight: 560 }, {
      default(field) {
        const summary = field.$master?.$data || {}
        return renderLines(summary, buildPaginationState(summary))
      },
    }),
  ]

  return $RP({ title: 'Finance Summary' }, {
    form: () => $FM({ title: 'Shop Finance Summary' }, {
      children: () => [
        $PT({}, { children: () => fields }),
      ],
      saved: async (form) => {
        await loadFinanceDetail({ $master: form.$master })
      },
      access: shopAccess('shop.finance.view'),
    }),
    sideButtons: (_props, _context, report) => [
      $BN({ text: 'Export CSV', color: 'secondary' }, {
        async onClicked() {
          await exportFinanceSummaryCsv(report?.$master)
        },
      }),
    ],
    setup(report) {
      activeShopFinanceReport = report
      initializeFinancePagination()
      const master = report.$master as Master | undefined
      if (!master) {
        return
      }
      master.$set('itemsPerPage', 5)
      master.$set('pageNumber', 1)
      void loadFinanceDetail(report)
    },
    loaded(report) {
      activeShopFinanceReport = report
      void loadFinanceDetail(report)
    },
    access: shopAccess('shop.finance.view'),
  })
}
