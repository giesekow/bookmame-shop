import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, Api, Dialogs, Field, Part } from 'vuetify-extended'
import { shopAccess } from '../../misc/access'
import { makeCollectionMenu } from '../../misc/menu'
import { useAppStore } from '../../store/app'

function servicePath() {
  const shopId = useAppStore().shop?.id
  if (!shopId) throw new Error('No active shop is selected.')
  return `shops/${shopId}/cancellation-refunds`
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function money(amountMinor: unknown, currency = 'USD') {
  const amount = Number(amountMinor || 0) / 100
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch (_error) {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function dateTime(value: unknown) {
  const date = value ? new Date(String(value)) : null
  if (!date || Number.isNaN(date.getTime())) return 'n/a'
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  } catch (_error) {
    return date.toISOString()
  }
}

function label(value: unknown) {
  return String(value || 'n/a').replace(/_/g, ' ')
}

function statusColor(value: string) {
  if (value === 'processed') return '#4caf50'
  if (value === 'processing') return '#2196f3'
  if (value === 'pending') return '#ffc107'
  if (value === 'partner_action_required') return '#9c27b0'
  if (value === 'pending_channel_choice') return '#ff9800'
  if (value === 'failed') return '#ef5350'
  return 'rgb(var(--v-theme-on-surface))'
}

function chip(text: string, color: string) {
  return `<span style="display:inline-block; padding:3px 10px; border-radius:999px; background:rgba(var(--v-theme-on-surface),0.07); border:1px solid rgba(var(--v-theme-on-surface),0.18); color:${color}; font-size:12px; font-weight:700;">${escapeHtml(text)}</span>`
}

async function markProcessed(id: string) {
  const shopId = useAppStore().shop?.id
  if (!shopId) {
    Dialogs.$error('No active shop selected.')
    return false
  }
  try {
    await Api.instance.service(`shops/${shopId}/cancellation-refunds/${id}/mark-processed`).patch(null, {})
    Dialogs.$success('Refund obligation marked as processed.')
    return true
  } catch (error: any) {
    Dialogs.$error(error.message || 'Failed to mark refund as processed.')
    return false
  }
}

async function initiateHandoff(id: string) {
  const shopId = useAppStore().shop?.id
  if (!shopId) {
    Dialogs.$error('No active shop selected.')
    return false
  }
  try {
    await Api.instance.service(`shops/${shopId}/cancellation-refunds/${id}/initiate-handoff`).create({})
    Dialogs.$success('Refund handoff initiated. Ask the customer to show their PIN.')
    return true
  } catch (error: any) {
    Dialogs.$error(error.message || 'Failed to initiate refund handoff.')
    return false
  }
}

async function confirmPin(id: string) {
  const shopId = useAppStore().shop?.id
  if (!shopId) {
    Dialogs.$error('No active shop selected.')
    return false
  }
  const pin = await Dialogs.$prompt({ fieldParams: { label: 'Enter Customer PIN' }, title: 'Ask the customer to show the PIN from their app and enter it below.' })
  if (!pin) return false
  try {
    await Api.instance.service(`shops/${shopId}/cancellation-refunds/${id}/confirm-pin`).create({ pin })
    Dialogs.$success('Refund confirmed successfully.')
    return true
  } catch (error: any) {
    Dialogs.$error(error.message || 'Invalid PIN or refund confirmation failed.')
    return false
  }
}

function renderDetails(item: any) {
  const cards = [
    ['Source Type', label(item?.sourceType)],
    ['Currency', item?.currency || 'n/a'],
    ['Refund Amount', money(item?.refundAmount, item?.currency)],
    ['Voucher Reinstatement', money(item?.voucherReinstatementAmount, item?.currency)],
    ['Payment Method', label(item?.originalPaymentMethod)],
    ['Refund Type', label(item?.refundType)],
    ['Responsible Party', label(item?.responsibleParty)],
    ['Partner Remittance Required', item?.partnerRemittanceRequired ? 'Yes' : 'No'],
    ['Status', label(item?.status)],
    ['Processed At', dateTime(item?.processedAt)],
    ['Refund Channel', label(item?.refundChannel)],
    ['Channel Chosen By', label(item?.refundChannelChosenBy)],
    ['Channel Chosen At', dateTime(item?.refundChannelChosenAt)],
    ['Created', dateTime(item?.createdAt)],
  ]

  const isGiftVoucher = item?.refundChannel === 'gift_voucher'

  const handoffSection = !isGiftVoucher && item?.refundType === 'partner_direct_refund' && item?.handoffStatus && item?.handoffStatus !== 'not_initiated'
    ? `<div style="margin-top:14px; padding:14px; background:rgba(var(--v-theme-on-surface),0.05); border:1px solid rgba(var(--v-theme-on-surface),0.14); border-radius:14px;">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:rgba(var(--v-theme-on-surface),0.6); margin-bottom:8px;">Refund Handoff</div>
        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <div>${chip(label(item.handoffStatus), item.handoffStatus === 'confirmed' ? '#4caf50' : '#9c27b0')}</div>
          ${item.handoffStatus === 'pending' ? `<div style="font-size:1.6rem; font-weight:700; letter-spacing:.15em; color:rgb(var(--v-theme-on-surface));">${escapeHtml(item.handoffCode || '')}</div><div style="font-size:13px; color:rgba(var(--v-theme-on-surface),0.6);">Customer PIN — enter this after handing over the cash</div>` : ''}
          ${item.handoffConfirmedAt ? `<div style="font-size:13px; color:rgba(var(--v-theme-on-surface),0.6);">Confirmed: ${dateTime(item.handoffConfirmedAt)}</div>` : ''}
        </div>
      </div>`
    : ''

  const remittanceNotice = isGiftVoucher
    ? `<div style="margin-top:14px; padding:14px; background:rgba(76,175,80,0.12); border:1px solid rgba(76,175,80,0.35); border-radius:14px; color:#4caf50;">
        ${item?.partnerRemittanceRequired && ['processed', 'processing'].includes(String(item?.status || '').toLowerCase())
          ? `<strong>Gift voucher issued to customer.</strong><br/>The platform has issued a gift voucher on your behalf. You owe the platform <strong>${escapeHtml(money(item?.refundAmount, item?.currency))}</strong> as remittance. Please contact us to arrange payment.`
          : `<strong>Gift voucher issued to customer.</strong><br/>The platform has issued a gift voucher for this cancellation refund.`
        }
      </div>`
    : ''

  return `
    <div style="font-family:inherit; color:rgb(var(--v-theme-on-surface)); background:rgba(var(--v-theme-surface),0.85); border:1px solid rgba(var(--v-theme-on-surface),0.14); border-radius:18px; padding:18px;">
      <div style="margin-bottom:16px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:rgba(var(--v-theme-on-surface),0.6);">Cancellation Refund Obligation</div>
        <div style="margin-top:6px;">${chip(label(item?.status), statusColor(String(item?.status || '')))}</div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
        ${cards.map(([name, value]) => `
          <div style="background:rgba(var(--v-theme-surface),1); border:1px solid rgba(var(--v-theme-on-surface),0.12); border-radius:14px; padding:14px;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:rgba(var(--v-theme-on-surface),0.6); margin-bottom:6px;">${escapeHtml(name)}</div>
            <div style="font-size:15px; font-weight:700; color:rgb(var(--v-theme-on-surface)); word-break:break-all;">${escapeHtml(String(value))}</div>
          </div>
        `).join('')}
      </div>
      ${handoffSection}
      ${remittanceNotice}
      ${item?.failureReason ? `<div style="margin-top:14px; padding:14px; background:rgba(211,47,47,0.12); border:1px solid rgba(211,47,47,0.35); border-radius:14px; color:#ef5350;"><strong>Failure Reason:</strong> ${escapeHtml(item.failureReason)}</div>` : ''}
      ${item?.notes ? `<div style="margin-top:14px; padding:14px; background:rgba(var(--v-theme-surface),1); border:1px solid rgba(var(--v-theme-on-surface),0.12); border-radius:14px; color:rgb(var(--v-theme-on-surface));"><strong>Notes:</strong> ${escapeHtml(item.notes)}</div>` : ''}
    </div>
  `
}

const trigger = () => $TG({
  title: 'Cancellation Refunds',
  selectFields: [
    'id',
    'sourceType',
    'sourceId',
    'currency',
    'refundAmount',
    'voucherReinstatementAmount',
    'originalPaymentMethod',
    'refundType',
    'responsibleParty',
    'partnerRemittanceRequired',
    'status',
    'processedAt',
    'failureReason',
    'notes',
    'handoffStatus',
    'handoffCode',
    'handoffMethod',
    'handoffInitiatedAt',
    'handoffConfirmedAt',
    'refundChannel',
    'refundChannelChosenAt',
    'refundChannelChosenBy',
    'voucherId',
    'voucherIssuedAt',
    'createdAt',
    'updatedAt',
  ],
  headers: [
    { title: 'Date', value: 'createdAt' },
    { title: 'Type', value: 'refundType' },
    { title: 'Currency', value: 'currency' },
    { title: 'Refund', value: 'refundAmount' },
    { title: 'Status', value: 'status' },
  ],
  query: { $sort: { createdAt: -1 } },
}, {
  format(trigger, items) {
    for (const item of items) {
      item.createdAt = dateTime(item.createdAt)
      item.refundAmount = money(item.refundAmount, item.currency)
      item.status = label(item.status)
      item.refundType = label(item.refundType)
    }
    return items;
  },
})

const report = () => {
  const fields: (Field | Part)[] = [
    $FD({
      label: 'Cancellation Refund',
      storage: 'detailsView',
      type: 'htmlview',
      readonly: true,
      cols: 12,
      minHeight: 420,
    }, {
      default(field) {
        return renderDetails(field.$master?.$data || {})
      },
    }),
  ]

  return $RP({ title: 'Cancellation Refund' }, {
    form: () => $FM({ title: 'Cancellation Refund Obligation', width: 900 }, {
      children: () => [$PT({}, { children: () => fields })],
      access: shopAccess('shop.finance.view'),
    }),
    sideButtons: (_props, _context, rp) => {
      const item = rp?.$master?.$data || {}
      if (item.refundType !== 'partner_direct_refund') return []
      if (!['pending', 'partner_action_required'].includes(item.status)) return []
      if (item.refundChannel === 'gift_voucher') return []

      const buttons = []

      if (item.handoffStatus === 'not_initiated') {
        buttons.push(
          $BN({ text: 'Pay Refund & Get Confirmation', icon: 'mdi-cash-check', color: 'primary' }, {
            async onClicked() {
              const ok = await initiateHandoff(item.id)
              if (ok) {
                rp?.$master?.$set('handoffStatus', 'pending')
                rp?.forceRender()
              }
            },
          }),
          $BN({ text: 'Mark Processed (No PIN)', icon: 'mdi-check-circle-outline', color: 'success' }, {
            async onClicked() {
              const ok = await markProcessed(item.id)
              if (ok) rp?.$master?.$set('status', 'processed')
            },
          }),
        )
      } else if (item.handoffStatus === 'pending') {
        buttons.push(
          $BN({ text: 'Confirm with Customer PIN', icon: 'mdi-shield-key-outline', color: 'success' }, {
            async onClicked() {
              const ok = await confirmPin(item.id)
              if (ok) {
                rp?.$master?.$set('status', 'processed')
                rp?.$master?.$set('handoffStatus', 'confirmed')
              }
            },
          }),
        )
      }

      return buttons
    },
    access: shopAccess('shop.finance.view'),
  })
}

export const shopCancellationRefundsCollection = () => $COL({
  objectType: servicePath(),
}, {
  trigger,
  report,
  access: shopAccess('shop.finance.view'),
})

export const shopCancellationRefundsMenu = () => makeCollectionMenu({
  title: 'Cancellation Refunds',
  collection: shopCancellationRefundsCollection,
  allowCreate: false,
  allowEdit: false,
  access: shopAccess('shop.finance.view'),
})
