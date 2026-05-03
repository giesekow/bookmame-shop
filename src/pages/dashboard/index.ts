import { $DALW, $DB, $DMW, $DTW, $MI, Api, AppManager } from 'vuetify-extended'
import { shopHasAccess } from '../../misc/access'
import { useAppStore } from '../../store/app'
import { shopFinanceSummaryReport } from '../finance-summary'
import { shopOrdersCollection, shopOrdersReport } from '../orders'
import { shopRatingsCollection } from '../ratings'
import { supportCasesCollection } from '../support-cases'

type DashboardSummary = {
  pendingReviewCount: number
  inProgressCount: number
  completedCount: number
  averageRating: number | null
  ratingCount: number
  openSupportCaseCount: number
  readyForManualPayoutAmount?: number
  payoutInitiatedAmount?: number
  readyForManualRemittanceAmount?: number
  netSettlementPosition?: number
  paidTodayAmount?: number
  paidTodayCount?: number
  currency?: string | null
}

let dashboardSummaryPromise: Promise<DashboardSummary> | null = null
let dashboardSummaryLoadedAt = 0
const DASHBOARD_SUMMARY_CACHE_MS = 15000

type PaginatedResult<T> = {
  items: T[]
  total: number
}

function currentShop() {
  return useAppStore().shop || null
}

function shopId() {
  return currentShop()?.id || null
}

function dateTime(value: unknown) {
  const date = value ? new Date(String(value)) : null

  if (!date || Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch (_error) {
    return date.toISOString()
  }
}

function normalizeFindResult<T>(response: any): PaginatedResult<T> {
  if (Array.isArray(response)) {
    return {
      items: response as T[],
      total: response.length,
    }
  }

  if (Array.isArray(response?.data)) {
    return {
      items: response.data as T[],
      total: Number(response?.total ?? response.data.length ?? 0),
    }
  }

  if (Array.isArray(response?.items)) {
    return {
      items: response.items as T[],
      total: Number(response?.total ?? response.items.length ?? 0),
    }
  }

  return {
    items: [],
    total: 0,
  }
}

async function safeFind<T>(servicePath: string, query: Record<string, any>): Promise<PaginatedResult<T>> {
  try {
    const response = await Api.instance.service(servicePath).find({ query })
    return normalizeFindResult<T>(response)
  } catch (error: any) {
    console.error(`[shop-dashboard] Failed to load ${servicePath}`, error)
    return {
      items: [],
      total: 0,
    }
  }
}

async function loadDashboardSummary(force = false) {
  const id = shopId()
  if (!id) {
    return {
      pendingReviewCount: 0,
      inProgressCount: 0,
      completedCount: 0,
      averageRating: null,
      ratingCount: 0,
      openSupportCaseCount: 0,
      readyForManualPayoutAmount: 0,
      payoutInitiatedAmount: 0,
      readyForManualRemittanceAmount: 0,
      netSettlementPosition: 0,
      paidTodayAmount: 0,
      paidTodayCount: 0,
      currency: currentShop()?.defaultCurrencyCode || null,
    }
  }

  const cacheExpired = (Date.now() - dashboardSummaryLoadedAt) > DASHBOARD_SUMMARY_CACHE_MS

  if (force || !dashboardSummaryPromise || cacheExpired) {
    dashboardSummaryPromise = (async () => {
      const summary = await Api.instance.service(`shops/${id}/dashboard/summary`).find() as DashboardSummary
      return summary || {
        pendingReviewCount: 0,
        inProgressCount: 0,
        completedCount: 0,
        averageRating: null,
        ratingCount: 0,
        openSupportCaseCount: 0,
        readyForManualPayoutAmount: 0,
        payoutInitiatedAmount: 0,
        readyForManualRemittanceAmount: 0,
        netSettlementPosition: 0,
        paidTodayAmount: 0,
        paidTodayCount: 0,
        currency: currentShop()?.defaultCurrencyCode || null,
      }
    })()
    dashboardSummaryLoadedAt = Date.now()
  }

  return dashboardSummaryPromise
}

function money(amountMinor: unknown, currency?: unknown) {
  const amount = typeof amountMinor === 'number' ? amountMinor : Number(amountMinor || 0)
  const normalizedCurrency = typeof currency === 'string' && currency.length === 3 ? currency.toUpperCase() : 'USD'

  try {
    if (!Number.isFinite(amount) || amount === 0) {
      return '0.00'
    }
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCurrency,
    }).format(amount / 100)
  } catch (_error) {
    return `${normalizedCurrency} ${((Number.isFinite(amount) ? amount : 0) / 100).toFixed(2)}`
  }
}

function ratingValue(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? `${value.toFixed(1)}/5`
    : 'No ratings yet'
}

function openOrdersCollection() {
  AppManager.showCollection(shopOrdersCollection())
}

function openPendingOrdersCollection() {
  AppManager.showCollection(shopOrdersCollection({
    orderStatus: {
      $in: ['placed', 'accepted', 'ready_for_pickup'],
    },
  }))
}

function openOrder(orderId?: string) {
  if (!orderId) {
    openOrdersCollection()
    return
  }

  const report = shopOrdersReport(orderId)()
  report.$params.mode = 'display'
  AppManager.showReport(report)
}

function openRatingsCollection() {
  AppManager.showCollection(shopRatingsCollection())
}

function openSupportCasesCollection() {
  AppManager.showCollection(supportCasesCollection())
}

function openFinanceSummaryReport() {
  AppManager.showReport(shopFinanceSummaryReport())
}

export const SHOP_DASHBOARD_WIDGET = $DB({
  title: 'Dashboard',
  subtitle: 'Operational visibility for orders, customer feedback, support cases, payouts, and the currently selected shop.',
  fluid: true,
  theme: 'light',
  backgroundColor: '#f7fbf5',
  backgroundGradient: 'linear-gradient(180deg, rgba(251,255,249,0.98) 0%, rgba(239,247,234,0.94) 100%)',
  textColor: '#183022',
}, {
  menuItems: () => [
    $MI({
      text: 'Refresh',
      icon: 'mdi-refresh',
      action: 'function',
      color: 'primary',
    }, {
      callback: async () => {
        await useAppStore().switchShop(currentShop()?.id)
        dashboardSummaryPromise = null
        await SHOP_DASHBOARD_WIDGET.refresh()
      },
    }),
  ],
  topChildren: () => [
    $DMW({
      title: 'Selected Shop',
      subtitle: 'The merchant workspace currently active in this session.',
      icon: 'mdi-storefront-outline',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#ffffff',
      cardStyle: { border: '1px solid #dbead4' },
    }, {
      value: async () => currentShop()?.name || 'No shop selected',
    }),
    $DMW({
      title: 'Pending Orders',
      subtitle: 'Orders still awaiting completion or final handoff.',
      icon: 'mdi-receipt-text-clock-outline',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#ffffff',
      cardStyle: { border: '1px solid #dbead4' },
    }, {
      value: async () => {
        const summary = await loadDashboardSummary()
        return Number(summary.pendingReviewCount || 0) + Number(summary.inProgressCount || 0)
      },
      onClicked: async () => {
        if (await shopHasAccess('shop.orders.view')) {
          openPendingOrdersCollection()
        }
      },
    }),
    $DMW({
      title: 'Pending Review',
      subtitle: 'Orders waiting for the shop to accept or reject.',
      icon: 'mdi-timer-sand',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#fff8dd',
      cardStyle: { border: '1px solid #ebd58c' },
    }, {
      value: async () => (await loadDashboardSummary()).pendingReviewCount,
      onClicked: async () => {
        if (await shopHasAccess('shop.orders.view')) {
          openOrdersCollection()
        }
      },
    }),
    $DMW({
      title: 'In Progress',
      subtitle: 'Orders accepted or ready for pickup and still active operationally.',
      icon: 'mdi-package-variant-closed-check',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#eef4fa',
      cardStyle: { border: '1px solid #d7e2ec' },
    }, {
      value: async () => (await loadDashboardSummary()).inProgressCount,
      onClicked: async () => {
        if (await shopHasAccess('shop.orders.view')) {
          openOrdersCollection()
        }
      },
    }),
    $DMW({
      title: 'Completed',
      subtitle: 'Orders already completed on the shop side.',
      icon: 'mdi-check-decagram-outline',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#e7f7ef',
      cardStyle: { border: '1px solid #a8d9be' },
    }, {
      value: async () => (await loadDashboardSummary()).completedCount,
      onClicked: async () => {
        if (await shopHasAccess('shop.orders.view')) {
          openOrdersCollection()
        }
      },
    }),
    $DMW({
      title: 'Average Rating',
      subtitle: 'Current customer review score for the active shop.',
      icon: 'mdi-star-circle-outline',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#fff8dd',
      cardStyle: { border: '1px solid #ebd58c' },
    }, {
      value: async () => ratingValue((await loadDashboardSummary()).averageRating),
      onClicked: async () => {
        if (await shopHasAccess('shop.orders.view')) {
          openRatingsCollection()
        }
      },
    }),
    $DMW({
      title: 'Ratings',
      subtitle: 'Total reviews published by customers.',
      icon: 'mdi-star-box-multiple-outline',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#eef4fa',
      cardStyle: { border: '1px solid #d7e2ec' },
    }, {
      value: async () => (await loadDashboardSummary()).ratingCount,
      onClicked: async () => {
        if (await shopHasAccess('shop.orders.view')) {
          openRatingsCollection()
        }
      },
    }),
    $DMW({
      title: 'Open Support Cases',
      subtitle: 'Customer issues that still need a shop response.',
      icon: 'mdi-lifebuoy',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#fff3f0',
      cardStyle: { border: '1px solid #f2d0c6' },
    }, {
      value: async () => (await loadDashboardSummary()).openSupportCaseCount,
      onClicked: async () => {
        if (await shopHasAccess('shop.orders.view')) {
          openSupportCasesCollection()
        }
      },
    }),
    $DMW({
      title: 'Ready For Payout',
      subtitle: 'Net amount currently eligible for payout to this shop.',
      icon: 'mdi-cash-fast',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#fff8dd',
      cardStyle: { border: '1px solid #ebd58c' },
    }, {
      value: async () => {
        const summary = await loadDashboardSummary()
        return money(summary?.readyForManualPayoutAmount, summary?.currency || currentShop()?.defaultCurrencyCode)
      },
      onClicked: async () => {
        if (await shopHasAccess('shop.finance.view')) {
          openFinanceSummaryReport()
        }
      },
    }),
    $DMW({
      title: 'Payout Initiated',
      subtitle: 'Amount already moved into an initiated payout batch.',
      icon: 'mdi-bank-transfer-out',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#eef4fa',
      cardStyle: { border: '1px solid #d7e2ec' },
    }, {
      value: async () => {
        const summary = await loadDashboardSummary()
        return money(summary?.payoutInitiatedAmount, summary?.currency || currentShop()?.defaultCurrencyCode)
      },
      onClicked: async () => {
        if (await shopHasAccess('shop.finance.view')) {
          openFinanceSummaryReport()
        }
      },
    }),
    $DMW({
      title: 'Ready For Remittance',
      subtitle: 'Amount that should still be remitted back to the platform.',
      icon: 'mdi-cash-refund',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#fff8dd',
      cardStyle: { border: '1px solid #ebd58c' },
    }, {
      value: async () => {
        const summary = await loadDashboardSummary()
        return money(summary?.readyForManualRemittanceAmount, summary?.currency || currentShop()?.defaultCurrencyCode)
      },
      onClicked: async () => {
        if (await shopHasAccess('shop.finance.view')) {
          openFinanceSummaryReport()
        }
      },
    }),
    $DMW({
      title: 'Net Settlement Position',
      subtitle: 'Current net finance position from shop settlements and remittances.',
      icon: 'mdi-chart-line',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#e7f7ef',
      cardStyle: { border: '1px solid #a8d9be' },
    }, {
      value: async () => {
        const summary = await loadDashboardSummary()
        return money(summary?.netSettlementPosition, summary?.currency || currentShop()?.defaultCurrencyCode)
      },
      onClicked: async () => {
        if (await shopHasAccess('shop.finance.view')) {
          openFinanceSummaryReport()
        }
      },
    }),
    $DMW({
      title: 'Paid Today',
      subtitle: 'Net payout amount settled to this shop today.',
      icon: 'mdi-bank-transfer-out',
      cols: 12,
      md: 6,
      lg: 3,
      color: '#ffffff',
      cardStyle: { border: '1px solid #dbead4' },
    }, {
      value: async () => {
        const summary = await loadDashboardSummary()
        return money(summary?.paidTodayAmount, summary?.currency || currentShop()?.defaultCurrencyCode)
      },
      onClicked: async () => {
        if (await shopHasAccess('shop.finance.view')) {
          openFinanceSummaryReport()
        }
      },
    }),
  ],
  children: () => [
    $DTW({
      title: 'Pending Orders List',
      subtitle: 'Orders that still need shop attention.',
      icon: 'mdi-receipt-text-clock-outline',
      cols: 12,
      lg: 8,
      minHeight: 340,
      color: '#ffffff',
      cardStyle: { border: '1px solid #dbead4' },
      emptyText: 'No shop orders are currently waiting for action.',
      headers: [
        { key: 'orderNumber', title: 'Order' },
        { key: 'customerDisplayName', title: 'Customer' },
        { key: 'orderStatus', title: 'Status' },
        { key: 'paymentStatus', title: 'Payment' },
        { key: 'placedAtStr', title: 'Placed' },
      ],
      pagination: true,
      pageSize: 10,
    }, {
      loadPage: async (_widget, args) => {
        const id = shopId()
        if (!id) {
          return { total: 0, items: [] }
        }

        const page = Math.max(1, Number(args?.page || 1))
        const pageSize = Math.max(1, Number(args?.pageSize || 10))
        const skip = (page - 1) * pageSize
        const result = await safeFind<any>(`shops/${id}/orders`, {
          orderStatus: { $in: ['placed', 'accepted', 'ready_for_pickup'] },
          $limit: pageSize,
          $skip: skip,
        })

        return {
          total: result.total,
          items: result.items.map((item: any) => ({
            id: item?.id,
            orderNumber: item?.orderNumber || 'Unknown order',
            customerDisplayName: item?.customerDisplayName || 'Unknown customer',
            orderStatus: String(item?.orderStatus || 'n/a').replace(/_/g, ' '),
            paymentStatus: String(item?.paymentStatus || 'n/a').replace(/_/g, ' '),
            placedAtStr: dateTime(item?.placedAt),
          })),
        }
      },
      onRowClick: async (_widget, row) => {
        if (await shopHasAccess('shop.orders.view')) {
          openOrder(String(row?.id || ''))
        }
      },
    }),
    $DALW({
      title: 'Quick Actions',
      subtitle: 'Jump straight into the operational reports used most often.',
      icon: 'mdi-lightning-bolt-outline',
      cols: 12,
      lg: 4,
      minHeight: 300,
      color: '#ffffff',
      cardStyle: { border: '1px solid #dbead4' },
    }, {
      items: async () => [
        ...(await shopHasAccess('shop.orders.view')
          ? [
              {
                key: 'orders',
                title: 'Open Orders',
                subtitle: 'Review new requests, live progress, and completed orders.',
                icon: 'mdi-cart-outline',
                iconColor: '#2563eb',
                chipText: 'Operations',
                chipColor: 'primary',
                actionText: 'Open',
                actionColor: 'primary',
              },
              {
                key: 'ratings',
                title: 'Ratings',
                subtitle: 'Read customer feedback and review delivery experience.',
                icon: 'mdi-star-circle-outline',
                iconColor: '#b45309',
                chipText: String((await loadDashboardSummary()).ratingCount || 0),
                chipColor: 'warning',
                actionText: 'Open',
                actionColor: 'warning',
              },
              {
                key: 'support',
                title: 'Support Cases',
                subtitle: 'Respond to customer issues tied to shop orders.',
                icon: 'mdi-lifebuoy',
                iconColor: '#dc2626',
                chipText: String((await loadDashboardSummary()).openSupportCaseCount || 0),
                chipColor: 'error',
                actionText: 'Open',
                actionColor: 'error',
              },
            ]
          : []),
        ...(await shopHasAccess('shop.finance.view')
          ? [{
              key: 'finance',
              title: 'Finance Summary',
              subtitle: 'Track payout readiness, remittance, and current net settlement position.',
              icon: 'mdi-cash-register',
              iconColor: '#166534',
              chipText: 'Finance',
              chipColor: 'success',
              actionText: 'Open',
              actionColor: 'success',
            }]
          : []),
      ],
      onItemClicked: async (_widget, item) => {
        switch (item?.key) {
          case 'orders':
            openOrdersCollection()
            return
          case 'ratings':
            openRatingsCollection()
            return
          case 'support':
            openSupportCasesCollection()
            return
          case 'finance':
            openFinanceSummaryReport()
            return
          default:
            return
        }
      },
    }),
  ],
  setup(dashboard) {
    dashboardSummaryPromise = null
    void dashboard.refresh()
  },
})
