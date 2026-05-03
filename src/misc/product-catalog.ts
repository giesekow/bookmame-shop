import QRCode from 'qrcode'
import { $FD, $FM, $PT, Api, AppManager, DialogForm, Dialogs } from 'vuetify-extended'
import { useAppStore } from '../store/app'

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
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: normalizedCurrency }).format(
      (Number.isFinite(amount) ? amount : 0) / 100,
    )
  } catch {
    return `${normalizedCurrency} ${((Number.isFinite(amount) ? amount : 0) / 100).toFixed(2)}`
  }
}

type Product = {
  id: string
  name?: string | null
  categoryLabel?: string | null
  priceAmount?: number | null
  currency?: string | null
  description?: string | null
  status?: string | null
  enabled?: boolean | null
  isAvailable?: boolean | null
  inventoryQuantity?: number | null
}

async function loadProducts(shopId: string): Promise<Product[]> {
  const response = await Api.instance.service(`shops/${shopId}/products`).find({
    query: {
      $paginate: false,
      $sort: { categoryLabel: 1, sortOrder: 1, name: 1 },
      $select: ['id', 'name', 'categoryLabel', 'priceAmount', 'currency', 'description', 'status', 'enabled', 'isAvailable', 'inventoryQuantity'],
    },
  }) as any

  return Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : [])
}

function groupByCategory(products: Product[]): Map<string, Product[]> {
  const map = new Map<string, Product[]>()
  for (const product of products) {
    const category = String(product.categoryLabel || 'General').trim()
    if (!map.has(category)) map.set(category, [])
    map.get(category)!.push(product)
  }
  return map
}

function buildProductRow(product: Product) {
  const statusNote = product.isAvailable === false || product.enabled === false ? ' <span class="unavailable-badge">Unavailable</span>' : ''
  return `<tr class="product-row">
    <td class="product-name">${escapeHtml(product.name || 'Item')}${statusNote}</td>
    <td class="product-desc">${escapeHtml(product.description || '')}</td>
    <td class="product-price">${escapeHtml(formatMoney(product.priceAmount, product.currency))}</td>
  </tr>`
}

function buildCategorySection(category: string, products: Product[]) {
  return `<div class="category-section">
    <div class="category-heading">${escapeHtml(category)}</div>
    <table class="product-table">
      <tbody>${products.map(buildProductRow).join('')}</tbody>
    </table>
  </div>`
}

function buildCatalogMarkup(shop: any, products: Product[], qrCodeDataUrl: string, includeUnavailable: boolean) {
  const visibleProducts = includeUnavailable ? products : products.filter((p) => p.enabled !== false && p.isAvailable !== false && String(p.status || '').toLowerCase() !== 'archived')
  const grouped = groupByCategory(visibleProducts)

  const sections = [...grouped.entries()]
    .map(([cat, items]) => buildCategorySection(cat, items))
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(shop?.name || 'Shop')} – Product Catalog</title>
    <style>
      @page { size: A4 portrait; margin: 18mm 16mm; }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: "Helvetica Neue", Arial, sans-serif;
        font-size: 11pt;
        color: #1a2218;
        background: #fff;
      }

      .cover {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        page-break-after: always;
        padding: 40px 24px;
        background: linear-gradient(160deg, #1b4022 0%, #2d6a3c 100%);
        color: #f5fbf0;
      }

      .cover__brand {
        font-size: 10pt;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        opacity: 0.75;
        margin-bottom: 28px;
      }

      .cover__name {
        font-size: 34pt;
        font-weight: 900;
        line-height: 1.1;
        margin-bottom: 12px;
      }

      .cover__subtitle {
        font-size: 13pt;
        opacity: 0.82;
        margin-bottom: 36px;
      }

      .cover__qr {
        width: 100px;
        height: 100px;
        border-radius: 14px;
        border: 3px solid rgba(255,255,255,0.3);
        overflow: hidden;
        margin: 0 auto 12px;
        background: #fff;
        padding: 6px;
      }

      .cover__qr img { width: 100%; height: 100%; object-fit: contain; }

      .cover__qr-caption {
        font-size: 8pt;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        opacity: 0.7;
      }

      .cover__date {
        margin-top: 32px;
        font-size: 9pt;
        opacity: 0.6;
      }

      .content { padding: 0; }

      .category-section { margin-bottom: 24px; break-inside: avoid; }

      .category-heading {
        font-size: 10pt;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #2d6a3c;
        margin-bottom: 6px;
        padding-bottom: 5px;
        border-bottom: 1.5px solid #c4d9bc;
      }

      .product-table {
        width: 100%;
        border-collapse: collapse;
      }

      .product-row td {
        padding: 5px 6px;
        border-bottom: 1px solid #edf6ea;
        vertical-align: top;
      }

      .product-row:last-child td { border-bottom: none; }

      .product-name {
        font-weight: 700;
        font-size: 10pt;
        width: 36%;
        color: #1b4022;
      }

      .product-desc {
        font-size: 9pt;
        color: #4a6048;
        width: 50%;
        line-height: 1.4;
      }

      .product-price {
        font-size: 10pt;
        font-weight: 800;
        color: #2d6a3c;
        text-align: right;
        white-space: nowrap;
        width: 14%;
      }

      .unavailable-badge {
        font-size: 7pt;
        font-weight: 700;
        background: #f0ede8;
        color: #8a6040;
        padding: 1px 5px;
        border-radius: 4px;
        margin-left: 4px;
      }

      .footer {
        margin-top: 36px;
        padding-top: 12px;
        border-top: 1px solid #c4d9bc;
        font-size: 8pt;
        color: #547a4e;
        text-align: center;
      }

      @media print {
        .cover { background: #1b4022 !important; }
      }
    </style>
  </head>
  <body>
    <div class="cover">
      <div class="cover__brand">BookMaMe Shop Catalog</div>
      <div class="cover__name">${escapeHtml(shop?.name || 'Shop')}</div>
      <div class="cover__subtitle">Product Catalog &amp; Pricing</div>
      <div class="cover__qr">
        <img id="catalog-qr" src="${qrCodeDataUrl}" alt="Shop QR" />
      </div>
      <div class="cover__qr-caption">Scan to shop online</div>
      <div class="cover__date">Generated ${new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
    </div>

    <div class="content">${sections}</div>

    <div class="footer">
      ${escapeHtml(shop?.name || '')} &nbsp;·&nbsp; Powered by BookMaMe
    </div>
  </body>
</html>`
}

export async function printProductCatalog(options: { includeUnavailable: boolean }) {
  const store = useAppStore()
  const shop = store.shop
  const shopId = shop?.id

  if (!shopId) {
    throw new Error('No active shop selected.')
  }

  const printWindow = window.open('', '_blank', 'width=900,height=1200')
  if (!printWindow) {
    throw new Error('Unable to open the print window. Please allow pop-ups and try again.')
  }

  printWindow.document.open()
  printWindow.document.write('<html><head><title>Preparing catalog...</title></head><body style="display:grid;place-items:center;min-height:100vh;font-family:sans-serif;background:#e9f4e2;">Preparing product catalog&hellip;</body></html>')
  printWindow.document.close()

  const [products, qrCodeDataUrl] = await Promise.all([
    loadProducts(shopId),
    QRCode.toDataURL(`Shop: ${shop?.name || shopId}\nID: ${shopId}`, { margin: 1, width: 200, color: { dark: '#1b4022', light: '#ffffff' } }),
  ])

  if (products.length === 0) {
    printWindow.close()
    throw new Error('No products found to print.')
  }

  printWindow.document.open()
  printWindow.document.write(buildCatalogMarkup(shop, products, qrCodeDataUrl, options.includeUnavailable))
  printWindow.document.close()

  await new Promise<void>((resolve) => {
    const img = printWindow.document.getElementById('catalog-qr') as HTMLImageElement | null
    if (!img || (img.complete && img.naturalWidth > 0)) { resolve(); return }
    img.addEventListener('load', () => resolve(), { once: true })
    img.addEventListener('error', () => resolve(), { once: true })
    window.setTimeout(resolve, 1500)
  })

  window.setTimeout(() => { printWindow.focus(); printWindow.print() }, 80)
}

export function openProductCatalogDialog() {
  const dl = new DialogForm({}, {
    form: () => $FM({ title: 'Print Product Catalog', width: 520 }, {
      children: () => [$PT({}, {
        children: () => [
          $FD({ label: 'Include Unavailable Products', type: 'boolean', storage: 'includeUnavailable', hint: 'Show products that are currently unavailable or disabled.' }, {
            default: () => false,
          }),
        ],
      })],
      saved: async (form) => {
        try {
          await printProductCatalog({
            includeUnavailable: Boolean(form.$master?.$get('includeUnavailable', false)),
          })
          dl.forceCancel()
        } catch (error: any) {
          Dialogs.$error(error?.message || 'Unable to print the catalog right now.')
        }
      },
    }),
  })
  AppManager.showDialog(dl)
}
