import QRCode from 'qrcode'

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatMoney(amountMinor: unknown, currency?: unknown) {
  const amount = typeof amountMinor === 'number' ? amountMinor : Number(amountMinor || 0)
  const normalizedCurrency = typeof currency === 'string' && currency.length === 3 ? currency.toUpperCase() : 'USD'

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCurrency,
    }).format((Number.isFinite(amount) ? amount : 0) / 100)
  } catch (_error) {
    return `${normalizedCurrency} ${((Number.isFinite(amount) ? amount : 0) / 100).toFixed(2)}`
  }
}

function formatDateTime(value: unknown) {
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

function formatClock(value: unknown) {
  const date = value ? new Date(String(value)) : null

  if (!date || Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch (_error) {
    return date.toISOString()
  }
}

function getCustomerFirstName(order: any) {
  return String(order?.customerDisplayName || 'Customer').trim().split(/\s+/)[0]
}

function getItemCount(order: any) {
  const items = Array.isArray(order?.items) ? order.items : []
  return items.reduce((total: number, item: any) => total + Number(item?.quantity || 0), 0)
}

function buildCompactItemSummary(order: any) {
  const items = Array.isArray(order?.items) ? order.items : []

  const lines = items
    .map((item: any) => {
      const qty = Number(item?.quantity || 0)
      const name = String(item?.productName || 'Item').trim()
      const variant = String(item?.variantName || '').trim()
      return variant ? `${qty}x ${name} – ${variant}` : `${qty}x ${name}`
    })
    .filter(Boolean)

  const visible = lines.slice(0, 4)
  const remaining = lines.length - visible.length

  if (remaining > 0) {
    visible.push(`+${remaining} more item${remaining === 1 ? '' : 's'}`)
  }

  return visible.join('\n')
}

function buildAddressCue(order: any) {
  const parts = [
    order?.deliveryLabel,
    order?.deliveryAddressLine1,
    order?.deliveryAddressLine2,
    order?.deliveryLandmark,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean)

  if (parts.length === 0) {
    const geoRef = String(order?.deliveryGeoReferenceText || '').trim()
    if (geoRef) return geoRef
    return order?.fulfillmentMethod === 'customer_pickup'
      ? String(order?.shop?.name || 'Shop pickup')
      : 'Address pending'
  }

  return parts.slice(0, 3).join(', ')
}

function buildPreparationCue(order: any) {
  if (order?.acceptedAt) {
    return `Accepted ${formatClock(order.acceptedAt)}`
  }
  return `Placed ${formatClock(order?.placedAt || order?.createdAt)}`
}

function buildFlags(order: any) {
  const flags: string[] = []

  flags.push(order?.fulfillmentMethod === 'customer_pickup' ? 'Pickup' : 'Delivery')

  if (order?.paymentMethod === 'cash_on_pickup') {
    flags.push('Cash on pickup')
  }

  if (order?.paymentMethod === 'card_on_pickup') {
    flags.push('Card on pickup')
  }

  if (order?.notes) {
    flags.push('Has notes')
  }

  return Array.from(new Set(flags)).slice(0, 5)
}

function buildQrPayload(order: any) {
  const lines = [
    'BOOKMAME SHOP ORDER LABEL',
    `Order Number: ${order?.orderNumber || ''}`,
    `Order ID: ${order?.id || ''}`,
    `Shop: ${order?.shop?.name || ''}`,
    `Customer: ${getCustomerFirstName(order)}`,
    `Fulfillment: ${order?.fulfillmentMethod === 'customer_pickup' ? 'Pickup' : 'Delivery'}`,
    `Items: ${getItemCount(order)}`,
    `Total: ${formatMoney(order?.totalAmount, order?.currency)}`,
    `Placed: ${formatDateTime(order?.placedAt || order?.createdAt)}`,
  ].filter(Boolean)

  return lines.join('\n')
}

function buildOrderLabelMarkup(order: any, qrCodeDataUrl: string) {
  const flags = buildFlags(order)
  const itemSummary = buildCompactItemSummary(order)
  const itemCount = getItemCount(order)
  const customerFirstName = getCustomerFirstName(order)
  const fulfillmentLabel =
    order?.fulfillmentMethod === 'customer_pickup' ? 'Customer Pickup' : 'Delivery'
  const shopName = String(order?.shop?.name || 'Shop').trim()

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BookMaMe Shop Label ${escapeHtml(order?.orderNumber || '')}</title>
    <style>
      @page {
        size: 4in 6in;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        width: 4in;
        height: 6in;
        overflow: hidden;
        background: #f0f4ec;
        color: #1a2218;
        font-family: "Helvetica Neue", Arial, sans-serif;
      }

      .label {
        width: 4in;
        height: 6in;
        padding: 0.12in;
        page-break-after: avoid;
        background:
          radial-gradient(circle at top right, rgba(80, 155, 80, 0.18), transparent 32%),
          linear-gradient(180deg, #f5fbf0 0%, #e9f4e2 100%);
      }

      .shell {
        height: 100%;
        border: 1.5px solid #c4d9bc;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.97);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .header {
        padding: 11px 13px 10px;
        background: linear-gradient(135deg, #1b4022 0%, #2d6a3c 100%);
        color: #f5fbf0;
      }

      .brand {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        opacity: 0.88;
      }

      .shop-name {
        margin-top: 6px;
        font-size: 16px;
        font-weight: 800;
        line-height: 1.15;
      }

      .fulfillment-chip {
        display: inline-block;
        margin-top: 8px;
        padding: 5px 9px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.16);
        border: 1px solid rgba(255, 255, 255, 0.2);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .body {
        padding: 10px 12px 12px;
        display: grid;
        gap: 8px;
      }

      .order-number {
        font-size: 24px;
        font-weight: 900;
        line-height: 1;
        letter-spacing: 0.02em;
      }

      .meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .panel {
        padding: 8px 9px;
        border: 1px solid #d3e5cc;
        border-radius: 12px;
        background: #f7fbf4;
      }

      .panel-label {
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #547a4e;
        margin-bottom: 4px;
      }

      .panel-value {
        font-size: 13px;
        font-weight: 800;
        line-height: 1.2;
      }

      .panel-subvalue {
        margin-top: 3px;
        font-size: 10px;
        color: #3e5e3a;
        line-height: 1.25;
      }

      .flags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .flag {
        display: inline-flex;
        align-items: center;
        padding: 4px 7px;
        border-radius: 999px;
        background: #eef6eb;
        color: #1b4022;
        border: 1px solid #cde0c6;
        font-size: 9px;
        font-weight: 800;
      }

      .item-summary {
        white-space: pre-line;
        font-size: 11px;
        line-height: 1.25;
        color: #2e3e2c;
      }

      .footer {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 8px;
        align-items: end;
      }

      .totals {
        display: grid;
        gap: 6px;
      }

      .totals .panel-value {
        font-size: 16px;
      }

      .qr-panel {
        padding: 8px;
        border: 1px solid #d3e5cc;
        border-radius: 14px;
        background: #ffffff;
        text-align: center;
      }

      .qr-panel img {
        width: 100%;
        max-width: 88px;
        height: auto;
        display: block;
        margin: 0 auto;
      }

      .qr-caption {
        margin-top: 6px;
        font-size: 9px;
        color: #547a4e;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 700;
      }

      .support {
        font-size: 9px;
        color: #547a4e;
        text-align: center;
      }

      @media print {
        body { background: #fff; }
        .label { background: #fff; }
      }
    </style>
  </head>
  <body>
    <div class="label">
      <div class="shell">
        <div class="header">
          <div class="brand">BookMaMe Package Label</div>
          <div class="shop-name">${escapeHtml(shopName)}</div>
          <div class="fulfillment-chip">${escapeHtml(fulfillmentLabel)}</div>
        </div>
        <div class="body">
          <div class="order-number">${escapeHtml(order?.orderNumber || 'Order')}</div>
          <div class="meta-grid">
            <div class="panel">
              <div class="panel-label">Customer</div>
              <div class="panel-value">${escapeHtml(customerFirstName)}</div>
              <div class="panel-subvalue">${escapeHtml(buildAddressCue(order))}</div>
            </div>
            <div class="panel">
              <div class="panel-label">Prepared at</div>
              <div class="panel-value">${escapeHtml(buildPreparationCue(order))}</div>
              <div class="panel-subvalue">Placed ${escapeHtml(formatDateTime(order?.placedAt || order?.createdAt))}</div>
            </div>
          </div>
          <div class="flags">
            ${flags.map((flag) => `<span class="flag">${escapeHtml(flag)}</span>`).join('')}
          </div>
          <div class="panel">
            <div class="panel-label">Contents</div>
            <div class="item-summary">${escapeHtml(itemSummary || 'Items pending')}</div>
          </div>
          <div class="footer">
            <div class="totals">
              <div class="panel">
                <div class="panel-label">Items</div>
                <div class="panel-value">${escapeHtml(itemCount)}</div>
                <div class="panel-subvalue">${escapeHtml(formatMoney(order?.totalAmount, order?.currency))} total</div>
              </div>
              <div class="panel">
                <div class="panel-label">Order ID</div>
                <div class="panel-subvalue">${escapeHtml(order?.id || '')}</div>
              </div>
            </div>
            <div class="qr-panel">
              <img id="order-label-qr" src="${qrCodeDataUrl}" alt="Order QR code" />
              <div class="qr-caption">Scan order details</div>
            </div>
          </div>
          <div class="support">Attach to the outside of the package before handoff.</div>
        </div>
      </div>
    </div>
  </body>
</html>`
}

export async function printOrderLabel(order: any) {
  const printWindow = window.open('', '_blank', 'width=420,height=820')

  if (!printWindow) {
    throw new Error('Unable to open the print window. Please allow pop-ups and try again.')
  }

  printWindow.document.open()
  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preparing label...</title>
    <style>
      html, body {
        margin: 0;
        min-height: 100%;
        font-family: "Helvetica Neue", Arial, sans-serif;
        background: #e9f4e2;
        color: #1a2218;
      }

      body {
        display: grid;
        place-items: center;
      }

      .status {
        padding: 20px 24px;
        border-radius: 16px;
        background: rgba(255,255,255,0.92);
        border: 1px solid #c4d9bc;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div class="status">Preparing BookMaMe shop label...</div>
  </body>
</html>`)
  printWindow.document.close()

  const qrCodeDataUrl = await QRCode.toDataURL(buildQrPayload(order), {
    margin: 1,
    width: 220,
    color: {
      dark: '#1a2218',
      light: '#ffffff',
    },
  })

  printWindow.document.open()
  printWindow.document.write(buildOrderLabelMarkup(order, qrCodeDataUrl))
  printWindow.document.close()

  const waitForQrImage = async () => {
    const qrImage = printWindow.document.getElementById('order-label-qr') as HTMLImageElement | null

    if (!qrImage) {
      return
    }

    if (qrImage.complete && qrImage.naturalWidth > 0) {
      return
    }

    await new Promise<void>((resolve) => {
      let settled = false

      const finish = () => {
        if (settled) return
        settled = true
        qrImage.removeEventListener('load', handleLoad)
        qrImage.removeEventListener('error', handleError)
        resolve()
      }

      const handleLoad = () => finish()
      const handleError = () => finish()

      qrImage.addEventListener('load', handleLoad, { once: true })
      qrImage.addEventListener('error', handleError, { once: true })
      window.setTimeout(finish, 1500)
    })
  }

  const triggerPrint = () => {
    printWindow.focus()
    printWindow.print()
  }

  await waitForQrImage()
  window.setTimeout(triggerPrint, 80)
}
