import { $COL, $FD, $FM, $PT, $RP, $TG, Api, AppManager, Field, Master, Part } from 'vuetify-extended'
import { makeConstantOptions } from '@bookmame/web-utils'
import { makeCollectionMenu } from '../../misc/menu'
import { shopAccess } from '../../misc/access'
import { useAppStore } from '../../store/app'

type BatchFlowType = 'payout' | 'remittance'

const PAGINATION_OPTIONS = [5, 10, 20, 50, 100]
const batchStateByFlow: Record<BatchFlowType, { activeReport: any; initialized: boolean }> = {
  payout: { activeReport: null, initialized: false },
  remittance: { activeReport: null, initialized: false },
}

function servicePath() {
  const shopId = useAppStore().shop?.id
  if (!shopId) {
    throw new Error('No active shop is selected.')
  }
  return `shops/${shopId}/settlement-batches`
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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

function renderStatusChip(value: unknown) {
  return `<span style="display:inline-block; padding:4px 10px; border-radius:999px; background:#eef4fa; border:1px solid #d7e2ec; color:#274056; font-size:12px; font-weight:700;">${escapeHtml(label(value))}</span>`
}

function flowTitle(flowType: BatchFlowType) {
  return flowType === 'remittance' ? 'Remittance Batches' : 'Settlement Batches'
}

function flowBadge(flowType: BatchFlowType) {
  return flowType === 'remittance' ? 'Remittance batch' : 'Settlement batch'
}

function flowAmountLabel(flowType: BatchFlowType) {
  return flowType === 'remittance' ? 'Remittance In Batch' : 'Net Payout'
}

function flowEntryLabel(flowType: BatchFlowType) {
  return flowType === 'remittance' ? 'Remittance Entries' : 'Settlements'
}

function flowSectionTitle(flowType: BatchFlowType) {
  return flowType === 'remittance' ? 'Remittance entries in this batch' : 'Settlements in this batch'
}

function flowEmptyState(flowType: BatchFlowType) {
  return flowType === 'remittance'
    ? 'No remittance entries were found for this batch.'
    : 'No settlement rows were found for this batch.'
}

function flowBatchAmountValue(batch: any, flowType: BatchFlowType) {
  return flowType === 'remittance'
    ? batch?.totalOutstandingRemittanceAmount
    : batch?.netPayoutAmount
}

function buildBatchDetailQuery(flowType: BatchFlowType, itemsPerPage: number, pageNumber: number) {
  return {
    $limit: itemsPerPage,
    $skip: (pageNumber - 1) * itemsPerPage,
    ...(flowType === 'remittance' ? { $filters: { remittanceOnly: '1' } } : {}),
  }
}

function buildPaginationState(batch: any) {
  const lines = Array.isArray(batch?.settlements) ? batch.settlements : []
  const totalItems = Number(batch?.settlementTotal ?? lines.length)
  const rawItemsPerPage = Number(batch?.itemsPerPage || 5)
  const itemsPerPage = PAGINATION_OPTIONS.includes(rawItemsPerPage) ? rawItemsPerPage : 5
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const rawPageNumber = Number(batch?.pageNumber || 1)
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

function renderSummary(batch: any, flowType: BatchFlowType) {
  const cards = flowType === 'remittance'
    ? [
        ['Status', label(batch?.status)],
        ['Currency', batch?.currency || 'n/a'],
        [flowEntryLabel(flowType), batch?.settlementCount ?? batch?.settlementTotal ?? 0],
        [flowAmountLabel(flowType), money(flowBatchAmountValue(batch, flowType), batch?.currency)],
        ['Initiated At', dateTime(batch?.initiatedAt)],
        ['Completed At', dateTime(batch?.completedAt)],
        ['Reference', batch?.payoutReference || 'Not recorded'],
      ]
    : [
        ['Status', label(batch?.status)],
        ['Currency', batch?.currency || 'n/a'],
        ['Settlements', batch?.settlementCount ?? batch?.settlementTotal ?? 0],
        ['Outstanding Payable', money(batch?.totalOutstandingPayableAmount, batch?.currency)],
        ['Outstanding Remittance', money(batch?.totalOutstandingRemittanceAmount, batch?.currency)],
        [flowAmountLabel(flowType), money(flowBatchAmountValue(batch, flowType), batch?.currency)],
        ['Initiated At', dateTime(batch?.initiatedAt)],
        ['Completed At', dateTime(batch?.completedAt)],
        ['Acknowledged At', dateTime(batch?.beneficiaryAcknowledgedAt)],
        ['Acknowledged By', batch?.beneficiaryAcknowledgedByLabel || (batch?.beneficiaryAcknowledgedAt ? 'Not recorded' : 'Pending')],
      ]

  return `
    <div style="font-family:inherit; color:#10263b; background:#f7fbff; border:1px solid #d9e5f0; border-radius:18px; padding:18px;">
      <div style="margin-bottom:16px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#61768b;">${escapeHtml(flowBadge(flowType))}</div>
        <div style="margin-top:6px; font-size:22px; font-weight:800;">${escapeHtml(batch?.beneficiaryName || useAppStore().shop?.name || 'Shop')}</div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
        ${cards.map(([name, value]) => `<div style="background:#fff; border:1px solid #dbe6ef; border-radius:14px; padding:14px;"><div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#61768b; margin-bottom:6px;">${escapeHtml(name)}</div><div style="font-size:18px; font-weight:800; color:#10263b;">${escapeHtml(value)}</div></div>`).join('')}
      </div>
      ${flowType === 'payout' && batch?.beneficiaryAcknowledgementNote ? `<div style="margin-top:14px; padding:14px; background:#fff; border:1px solid #dbe6ef; border-radius:14px;"><div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#61768b; margin-bottom:6px;">Acknowledgement Note</div><div style="color:#274056;">${escapeHtml(batch.beneficiaryAcknowledgementNote)}</div></div>` : ''}
    </div>
  `
}

function renderPaginationControls(pagination: ReturnType<typeof buildPaginationState>, flowType: BatchFlowType) {
  const token = `shop-batches-${flowType}`
  return `
    <div style="font-family:inherit; color:#10263b; background:#fff; border:1px solid #dbe6ef; border-radius:16px; padding:14px 16px;">
      <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:14px; align-items:center;">
        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
          <span style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#61768b;">Items per page</span>
          ${PAGINATION_OPTIONS.map((value) => {
            const active = pagination.itemsPerPage === value
            return `<button type="button" data-settlement-batch-pagination="${token}" data-action="items" data-value="${value}" style="border:1px solid ${active ? '#2f6fed' : '#d5e1eb'}; background:${active ? '#edf4ff' : '#fff'}; color:${active ? '#1f5e9d' : '#274056'}; border-radius:999px; padding:6px 12px; font-size:13px; font-weight:700; cursor:pointer;">${value}</button>`
          }).join('')}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:flex-end;">
          <span style="font-size:13px; color:#476079;">Showing ${pagination.lines.length === 0 ? 0 : pagination.startIndex + 1}-${pagination.endIndex} of ${pagination.totalItems}</span>
          <button type="button" data-settlement-batch-pagination="${token}" data-action="prev" style="border:1px solid #d5e1eb; background:${pagination.pageNumber <= 1 ? '#f4f7fa' : '#fff'}; color:${pagination.pageNumber <= 1 ? '#9aaaba' : '#274056'}; border-radius:10px; padding:6px 12px; font-size:13px; font-weight:700; cursor:${pagination.pageNumber <= 1 ? 'not-allowed' : 'pointer'};" ${pagination.pageNumber <= 1 ? 'disabled' : ''}>Previous</button>
          <span style="min-width:96px; text-align:center; font-size:13px; font-weight:700; color:#10263b;">Page ${pagination.pageNumber} of ${pagination.totalPages}</span>
          <button type="button" data-settlement-batch-pagination="${token}" data-action="next" style="border:1px solid #d5e1eb; background:${pagination.pageNumber >= pagination.totalPages ? '#f4f7fa' : '#fff'}; color:${pagination.pageNumber >= pagination.totalPages ? '#9aaaba' : '#274056'}; border-radius:10px; padding:6px 12px; font-size:13px; font-weight:700; cursor:${pagination.pageNumber >= pagination.totalPages ? 'not-allowed' : 'pointer'};" ${pagination.pageNumber >= pagination.totalPages ? 'disabled' : ''}>Next</button>
        </div>
      </div>
    </div>
  `
}

function renderBatchSettlements(batch: any, pagination: ReturnType<typeof buildPaginationState>, flowType: BatchFlowType) {
  if (pagination.totalItems === 0) {
    return `<div style="padding:18px; border:1px solid #dbe6ef; border-radius:14px; background:#fff; color:#61768b;">${escapeHtml(flowEmptyState(flowType))}</div>`
  }

  return `
    <div style="font-family:inherit; color:#10263b; background:#fff; border:1px solid #dbe6ef; border-radius:18px; overflow:hidden;">
      <div style="padding:16px 18px; border-bottom:1px solid #dbe6ef; background:#f8fbfe;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#61768b;">${escapeHtml(flowSectionTitle(flowType))}</div>
      </div>
      <div style="display:grid;">
        ${pagination.visibleLines.map((line: any) => `
          <div style="padding:16px 18px; border-bottom:1px solid #e5edf4;">
            <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:12px; align-items:flex-start;">
              <div>
                <div style="font-size:16px; font-weight:800; color:#10263b;">${escapeHtml(line?.orderNumber || 'Unknown order')}</div>
                <div style="margin-top:4px; color:#476079; font-size:13px;">Created: ${escapeHtml(dateTime(line?.placedAt || line?.createdAt))}</div>
                <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:8px;">
                  ${renderStatusChip(line?.paymentMethod || 'n/a')}
                  ${renderStatusChip(line?.status || 'n/a')}
                  ${renderStatusChip(`payment ${line?.orderPaymentStatus || 'n/a'}`)}
                  ${renderStatusChip(`order ${line?.orderRestaurantStatus || 'n/a'}`)}
                </div>
              </div>
              <div style="flex:1 1 300px; min-width:0; display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:10px;">
                <div><div style="font-size:11px; color:#61768b; text-transform:uppercase;">Order Total</div><div style="font-weight:700;">${escapeHtml(money(line?.totalAmount, batch?.currency))}</div></div>
                <div><div style="font-size:11px; color:#61768b; text-transform:uppercase;">Net</div><div style="font-weight:700;">${escapeHtml(money(line?.netAmount, batch?.currency))}</div></div>
                ${flowType === 'remittance'
                  ? `<div><div style="font-size:11px; color:#61768b; text-transform:uppercase;">Remittance Due</div><div style="font-weight:700;">${escapeHtml(money(line?.outstandingRemittanceAmount, batch?.currency))}</div></div>`
                  : `<div><div style="font-size:11px; color:#61768b; text-transform:uppercase;">Payable</div><div style="font-weight:700;">${escapeHtml(money(line?.outstandingPayableAmount, batch?.currency))}</div></div>
                <div><div style="font-size:11px; color:#61768b; text-transform:uppercase;">Remittance</div><div style="font-weight:700;">${escapeHtml(money(line?.outstandingRemittanceAmount, batch?.currency))}</div></div>`}
                <div><div style="font-size:11px; color:#61768b; text-transform:uppercase;">Eligible At</div><div style="font-weight:700;">${escapeHtml(dateTime(line?.eligibleAt))}</div></div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

function refreshBatchDetail(report: any, flowType: BatchFlowType) {
  const master = report.$master
  if (!master) {
    return
  }

  const detailState = master.$get('detailState', master.$data || {}) || {}
  const pagination = buildPaginationState(detailState)
  master.$set('itemsPerPage', pagination.itemsPerPage)
  master.$set('pageNumber', pagination.pageNumber)
  master.$set('summaryView', renderSummary(detailState, flowType))
  master.$set('paginationView', renderPaginationControls(pagination, flowType))
  master.$set('settlementsView', renderBatchSettlements(detailState, pagination, flowType))
}

async function loadBatchDetail(report: any, flowType: BatchFlowType) {
  const master = report?.$master
  if (!master) {
    return
  }

  const batchId = master.$get('id')
  const currentState = master.$get('detailState', master.$data || {}) || {}
  const itemsPerPage = PAGINATION_OPTIONS.includes(Number(master.$get('itemsPerPage', currentState.itemsPerPage || 5)))
    ? Number(master.$get('itemsPerPage', currentState.itemsPerPage || 5))
    : 5
  const pageNumber = Math.max(1, Number(master.$get('pageNumber', currentState.pageNumber || 1)) || 1)

  if (!batchId) {
    master.$set('detailState', {
      beneficiaryName: useAppStore().shop?.name || 'Shop',
      settlements: [],
      settlementTotal: 0,
      itemsPerPage,
      pageNumber,
    })
    refreshBatchDetail(report, flowType)
    return
  }

  try {
    const batch = await Api.instance.service(servicePath()).get(batchId, {
      query: buildBatchDetailQuery(flowType, itemsPerPage, pageNumber),
    })
    master.$set('detailState', { ...batch, itemsPerPage, pageNumber })
  } catch (error: any) {
    master.$set('detailState', {
      ...currentState,
      beneficiaryName: useAppStore().shop?.name || 'Shop',
      settlements: [],
      settlementTotal: 0,
      itemsPerPage,
      pageNumber,
    })
  }

  refreshBatchDetail(report, flowType)
}

function initializeBatchPagination(flowType: BatchFlowType) {
  if (batchStateByFlow[flowType].initialized || typeof document === 'undefined') {
    return
  }
  batchStateByFlow[flowType].initialized = true

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    const token = `shop-batches-${flowType}`
    const button = target?.closest?.(`[data-settlement-batch-pagination="${token}"]`) as HTMLElement | null

    if (!button || !batchStateByFlow[flowType].activeReport?.$master) {
      return
    }

    event.preventDefault()

    const action = button.getAttribute('data-action')
    const master = batchStateByFlow[flowType].activeReport.$master
    const detailState = master.$get('detailState', master.$data || {}) || {}
    const pagination = buildPaginationState(detailState)

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

    void loadBatchDetail(batchStateByFlow[flowType].activeReport, flowType)
  })
}

function createBatchReport(flowType: BatchFlowType) {
  const title = flowTitle(flowType)
  const fields: (Field | Part)[] = [
    $FD({ label: 'Summary', storage: 'summaryView', type: 'htmlview', readonly: true, cols: 12, minHeight: 320 }, {
      default(field) {
        return renderSummary(field.$master?.$data || {}, flowType)
      },
    }),
    $FD({ label: 'Pagination', storage: 'paginationView', type: 'htmlview', readonly: true, cols: 12 }, {
      default(field) {
        return renderPaginationControls(buildPaginationState(field.$master?.$data || {}), flowType)
      },
    }),
    $FD({ label: 'Settlements', storage: 'settlementsView', type: 'htmlview', readonly: true, cols: 12, minHeight: 480 }, {
      default(field) {
        return renderBatchSettlements(field.$master?.$data || {}, buildPaginationState(field.$master?.$data || {}), flowType)
      },
    }),
  ]

  return $RP({ title: `${title} Entry` }, {
    form: () => $FM({ title: `Inspect ${title.toLowerCase()}`, width: 1080 }, {
      children: () => [$PT({}, { children: () => fields })],
      access: shopAccess('shop.finance.view'),
    }),
    setup(report) {
      batchStateByFlow[flowType].activeReport = report
      initializeBatchPagination(flowType)
      const master = report.$master as Master | undefined
      if (!master) {
        return
      }
      master.$set('itemsPerPage', 5)
      master.$set('pageNumber', 1)
    },
    loaded(report) {
      batchStateByFlow[flowType].activeReport = report
      void loadBatchDetail(report, flowType)
    },
    access: shopAccess('shop.finance.view'),
  })
}

function createCollection(flowType: BatchFlowType) {
  const title = flowTitle(flowType)

  const trigger = () => {
    const trg = $TG({
      title,
      selectFields: [
        'id',
        'status',
        'currency',
        'settlementCount',
        'totalOutstandingPayableAmount',
        'totalOutstandingRemittanceAmount',
        'netPayoutAmount',
        'initiatedAt',
        'completedAt',
        'beneficiaryAcknowledgedAt',
      ],
      queryFields: ['status', 'payoutReference'],
      headers: [
        { title: 'Status', value: 'status' },
        { title: 'Currency', value: 'currency' },
        { title: flowEntryLabel(flowType), value: 'settlementCount' },
        { title: flowAmountLabel(flowType), value: 'flowAmountStr', align: 'end' },
        { title: 'Initiated', value: 'initiatedAtStr' },
        { title: 'Completed', value: 'completedAtStr' },
      ],
      query: {
        $sort: { createdAt: -1 },
        ...(flowType === 'remittance' ? { $filters: { remittanceOnly: '1' } } : {}),
      },
      width: 1500,
    }, {
      topChildren: () => [
        $FD({ label: 'Status', type: 'select', storage: 'status', md: 4, lg: 3, multiple: true }, {
          selectOptions: makeConstantOptions('payment-settlement-statuses'),
        }),
      ],
      format(_trigger, items) {
        for (const item of items) {
          item.flowAmountStr = money(flowBatchAmountValue(item, flowType), item.currency)
          item.initiatedAtStr = dateTime(item.initiatedAt)
          item.completedAtStr = dateTime(item.completedAt)
        }
        return items
      },
      processQuery(query, trigger) {
        const rawStatus = trigger.$master?.$get('status', [])
        const status = Array.isArray(rawStatus) ? rawStatus : rawStatus ? [rawStatus] : []
        const clauses: any[] = []
        delete query.$and
        query.$filters = {
          ...(query.$filters || {}),
          ...(flowType === 'remittance' ? { remittanceOnly: '1' } : {}),
        }

        if (status.length > 0) {
          clauses.push({ status: { $in: status } })
        }

        if (clauses.length > 0) {
          query.$and = clauses
        }

        return query
      },
      setup(trigger) {
        const master = new Master({})
        master.$set('status', [])
        trigger.setMaster(master)
      },
    })

    return trg
  }

  return $COL({
    objectType: servicePath(),
  }, {
    trigger,
    report: () => createBatchReport(flowType),
    access: shopAccess('shop.finance.view'),
  })
}

export const shopSettlementBatchesCollection = () => createCollection('payout')
export const shopRemittanceBatchesCollection = () => createCollection('remittance')

export const shopSettlementBatchesMenu = () => makeCollectionMenu({
  title: 'Settlement Batches',
  collection: shopSettlementBatchesCollection,
  access: shopAccess('shop.finance.view'),
})

export const shopRemittanceBatchesMenu = () => makeCollectionMenu({
  title: 'Remittance Batches',
  collection: shopRemittanceBatchesCollection,
  access: shopAccess('shop.finance.view'),
})

export function openShopSettlementBatchReport(batchId: string, flowType: BatchFlowType = 'payout') {
  const rep = createBatchReport(flowType)
  rep.$params.objectId = batchId
  rep.$params.mode = 'display'
  rep.$params.objectType = servicePath()
  AppManager.showReport(rep)
}
