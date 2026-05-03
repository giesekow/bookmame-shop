import { $COL, $FD, $FM, $PT, $RP, $TG, Field, Part } from 'vuetify-extended'
import { shopAccess } from '../../misc/access'
import { useAppStore } from '../../store/app'

function getServicePath() {
  const shopId = useAppStore().shop?.id

  if (!shopId) {
    throw new Error('No active shop is selected.')
  }

  return `shops/${shopId}/ratings`
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function dateTime(value: unknown) {
  const date = value ? new Date(String(value)) : null

  if (!date || Number.isNaN(date.getTime())) {
    return 'Not available'
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

function label(value: unknown) {
  return String(value || 'n/a').replace(/_/g, ' ')
}

function renderRatingSummary(rating: any) {
  const cards = [
    ['Order', rating?.orderNumber || 'n/a'],
    ['Overall Rating', rating?.overallRating ? `${rating.overallRating}/5` : 'n/a'],
    ['Shop Rating', rating?.partnerRating ? `${rating.partnerRating}/5` : 'Not scored'],
    ['Delivery Rating', rating?.deliveryRating ? `${rating.deliveryRating}/5` : 'Not scored'],
    ['Fulfillment', label(rating?.fulfillmentMethod)],
    ['Customer', rating?.customerAccountId || 'n/a'],
    ['Delivery Company', rating?.deliveryCompanyName || (rating?.fulfillmentMethod === 'customer_pickup' ? 'Customer pickup' : 'n/a')],
    ['Placed', dateTime(rating?.placedAt)],
    ['Completed', dateTime(rating?.deliveredAt)],
    ['Created', dateTime(rating?.createdAt)],
  ]

  return `
    <div style="font-family:inherit; color:#17334d; background:#f6fbff; border:1px solid #d9e5ef; border-radius:18px; padding:18px;">
      <div style="margin-bottom:16px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#61788e;">Shop rating</div>
        <div style="margin-top:6px; font-size:22px; font-weight:800;">${escapeHtml(rating?.orderNumber || 'Customer review')}</div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
        ${cards.map(([name, value]) => `<div style="background:#fff; border:1px solid #d9e5ef; border-radius:14px; padding:14px;"><div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#61788e; margin-bottom:6px;">${escapeHtml(name)}</div><div style="font-size:18px; font-weight:800; color:#17334d;">${escapeHtml(value)}</div></div>`).join('')}
      </div>
      ${rating?.comment ? `<div style="margin-top:14px; padding:14px; background:#fff; border:1px solid #d9e5ef; border-radius:14px;"><div style="font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:#61788e; margin-bottom:6px;">Customer Comment</div><div style="color:#2b4d68; white-space:pre-wrap; word-break:break-word;">${escapeHtml(rating.comment)}</div></div>` : ''}
    </div>
  `
}

const trigger = () => $TG({
  title: 'Ratings',
  selectFields: ['orderNumber', 'overallRating', 'partnerRating', 'deliveryRating', 'fulfillmentMethod', 'customerAccountId', 'createdAt', 'id'],
  headers: [
    { title: 'Order', value: 'orderNumber' },
    { title: 'Overall', value: 'overallRating' },
    { title: 'Shop', value: 'partnerRating' },
    { title: 'Delivery', value: 'deliveryRating' },
    { title: 'Fulfillment', value: 'fulfillmentMethod' },
    { title: 'Customer', value: 'customerAccountId' },
    { title: 'Created', value: 'createdAt' },
  ],
  query: { $sort: { createdAt: -1 } },
}, {})

const report = () => {
  const fields: (Field | Part)[] = [
    $FD({ label: 'Rating', storage: 'summaryView', type: 'htmlview', readonly: true, cols: 12, minHeight: 420 }, {
      default(field) {
        return renderRatingSummary(field.$master?.$data || {})
      },
    }),
  ]

  return $RP({ title: 'Rating' }, {
    form: () => $FM({ title: 'Customer Rating', width: 980 }, {
      children: () => [$PT({}, { children: () => fields })],
      access: shopAccess('shop.orders.view'),
    }),
    access: shopAccess('shop.orders.view'),
  })
}

export const shopRatingsCollection = () => $COL({
  objectType: getServicePath(),
}, {
  trigger,
  report,
  access: shopAccess('shop.orders.view'),
})
