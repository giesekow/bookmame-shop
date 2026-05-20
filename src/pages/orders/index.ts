import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, Api, AppManager, Button, DialogForm, Dialogs, Report } from 'vuetify-extended';
import { fetchAsset, uploadAsset } from '@bookmame/web-utils';
import { ref, Ref } from 'vue';
import { shopAccess } from '../../misc/access';
import { useAppStore } from '../../store/app';
import { printReceipt, downloadReceiptPdf } from '../../misc/print-receipt';
import { printOrderLabel } from '../../misc/order-label';

;(window as any).__openShopOrderImage = async (assetId: string) => {
  try {
    const result = await fetchAsset(assetId, { format: 'blobUrl' });
    if (result.blobUrl) {
      window.open(result.blobUrl, '_blank', 'noopener');
    }
  } catch {
    // asset may have been deleted or access denied
  }
};

function getShopId() {
  const shopId = useAppStore().shop?.id;
  if (!shopId) {
    throw new Error('No active shop is selected.');
  }
  return shopId;
}

function getServicePath() {
  return `shops/${getShopId()}/orders`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(amountMinor: unknown, currency?: unknown) {
  const amount = typeof amountMinor === 'number' ? amountMinor : Number(amountMinor || 0);
  const normalizedCurrency = typeof currency === 'string' && currency.length === 3 ? currency.toUpperCase() : 'USD';

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCurrency,
    }).format((Number.isFinite(amount) ? amount : 0) / 100);
  } catch (_error) {
    return `${normalizedCurrency} ${((Number.isFinite(amount) ? amount : 0) / 100).toFixed(2)}`;
  }
}

function dateTime(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function normalizeAttributes(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const label = String((item as any)?.label || '').trim();
        const attributeValue = String((item as any)?.value || '').trim();
        if (!label || !attributeValue) {
          return null;
        }
        return {
          key: label.toLowerCase(),
          label,
          value: attributeValue,
          sortOrder: typeof (item as any)?.sortOrder === 'number' ? (item as any).sortOrder : 100,
        };
      })
      .filter(Boolean) as Array<{ key: string; label: string; value: string; sortOrder: number }>;
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([label, attributeValue], index) => {
        const normalizedLabel = String(label || '').trim();
        const normalizedValue = String(attributeValue ?? '').trim();
        if (!normalizedLabel || !normalizedValue) {
          return null;
        }
        return {
          key: normalizedLabel.toLowerCase(),
          label: normalizedLabel,
          value: normalizedValue,
          sortOrder: (index + 1) * 10,
        };
      })
      .filter(Boolean) as Array<{ key: string; label: string; value: string; sortOrder: number }>;
  }

  return [];
}

function mergeAttributes(baseValue: unknown, variantValue: unknown) {
  const items = new Map<string, { key: string; label: string; value: string; sortOrder: number }>();

  for (const attribute of normalizeAttributes(baseValue)) {
    items.set(attribute.key, attribute);
  }

  for (const attribute of normalizeAttributes(variantValue)) {
    items.set(attribute.key, attribute);
  }

  return [...items.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

function shopOrderReportStyles() {
  return `
    <style>
      .shop-order-report {
        --shop-report-bg: #f8fcf6;
        --shop-report-card-bg: #ffffff;
        --shop-report-border: #dbead4;
        --shop-report-heading: #183022;
        --shop-report-text: #183022;
        --shop-report-muted: #5d7063;
        --shop-report-label: #6a7f70;
        --shop-report-danger: #7a3f38;
        font-family: inherit;
        color: var(--shop-report-text);
        background: var(--shop-report-bg);
        border: 1px solid var(--shop-report-border);
        border-radius: 18px;
        padding: 18px;
      }

      html[data-theme='dark'] .shop-order-report {
        --shop-report-bg: rgba(21, 28, 36, 0.72);
        --shop-report-card-bg: rgba(34, 41, 50, 0.92);
        --shop-report-border: rgba(255, 255, 255, 0.1);
        --shop-report-heading: rgba(246, 237, 226, 0.96);
        --shop-report-text: rgba(246, 237, 226, 0.92);
        --shop-report-muted: rgba(246, 237, 226, 0.72);
        --shop-report-label: rgba(246, 237, 226, 0.68);
        --shop-report-danger: #f2a49e;
      }

      .shop-order-report__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
        margin-bottom: 18px;
      }

      .shop-order-report__card,
      .shop-order-report__section,
      .shop-order-report__attributes,
      .shop-order-report__settlement {
        background: var(--shop-report-card-bg);
        border: 1px solid var(--shop-report-border);
        color: var(--shop-report-text);
      }

      .shop-order-report__card {
        border-radius: 14px;
        padding: 14px;
      }

      .shop-order-report__section {
        border-radius: 14px;
        padding: 0 14px;
      }

      .shop-order-report__label,
      .shop-order-report__section-title,
      .shop-order-report__attribute-label,
      .shop-order-report__metric-label {
        color: var(--shop-report-label);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: .08em;
      }

      .shop-order-report__section-title {
        margin: 18px 0 8px;
      }

      .shop-order-report__value,
      .shop-order-report__heading,
      .shop-order-report__item-title,
      .shop-order-report__metric-value {
        color: var(--shop-report-heading);
        font-weight: 800;
      }

      .shop-order-report__heading {
        font-size: 20px;
      }

      .shop-order-report__muted,
      .shop-order-report__item-meta,
      .shop-order-report__empty {
        color: var(--shop-report-muted);
      }

      .shop-order-report__danger {
        color: var(--shop-report-danger);
      }

      .shop-order-report__item {
        padding: 12px 0;
        border-bottom: 1px solid var(--shop-report-border);
      }

      .shop-order-report__item:last-child {
        border-bottom: 0;
      }

      .shop-order-report__attributes {
        width: 100%;
        box-sizing: border-box;
        margin-top: 8px;
        padding: 10px 12px;
        border-radius: 14px;
      }

      .shop-order-report__attribute-row {
        padding-top: 8px;
        border-top: 1px solid var(--shop-report-border);
      }

      .shop-order-report__attribute-row:first-child {
        border-top: 0;
      }

      .shop-order-report__attribute-value {
        color: var(--shop-report-heading);
        font-size: 13px;
        font-weight: 800;
        word-break: break-word;
      }

      .shop-order-report__settlement {
        padding: 12px 14px;
        border-radius: 12px;
      }
    </style>
  `;
}

function renderAttributeSummary(baseValue: unknown, variantValue: unknown) {
  const pairs = mergeAttributes(baseValue, variantValue);
  if (!pairs.length) {
    return '';
  }

  return `
    <div class="shop-order-report__attributes">
      <div class="shop-order-report__label" style="font-size:11px; margin-bottom:8px;">Attributes</div>
      <div style="display:grid; gap:8px;">
        ${pairs.map((pair) => `
          <div class="shop-order-report__attribute-row">
            <div class="shop-order-report__attribute-label" style="font-size:11px; letter-spacing:.05em; font-weight:700; margin-bottom:4px;">${escapeHtml(pair.label)}</div>
            <div class="shop-order-report__attribute-value">${escapeHtml(pair.value)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function canShopCollectPayment(order: any) {
  const fulfillmentMethod = String(order?.fulfillmentMethod || '').trim().toLowerCase();
  const paymentMethod = String(order?.paymentMethod || '').trim().toLowerCase();
  return fulfillmentMethod === 'customer_pickup' && ['cash_on_pickup', 'card_on_pickup'].includes(paymentMethod);
}

function isOnlinePickupAwaitingPayment(order: any) {
  const fulfillmentMethod = String(order?.fulfillmentMethod || '').trim().toLowerCase();
  const paymentMethod = String(order?.paymentMethod || '').trim().toLowerCase();
  const paymentStatus = String(order?.paymentStatus || '').trim().toLowerCase();
  return fulfillmentMethod === 'customer_pickup' && ['paystack', 'hubtel', 'online_demo'].includes(paymentMethod) && paymentStatus !== 'paid';
}

function shopSettlementBeneficiaryLabel(order: any, settlement: any) {
  const beneficiaryType = String(settlement?.beneficiaryType || 'platform').trim().toLowerCase();

  if (beneficiaryType === 'shop') {
    return useAppStore().shop?.name || 'Current shop';
  }

  if (beneficiaryType === 'delivery_company') {
    return order?.deliveryCompany?.name || 'Delivery company';
  }

  if (beneficiaryType === 'platform') {
    return 'Bookmame Platform';
  }

  return String(settlement?.beneficiaryId || settlement?.beneficiaryType || 'Unknown beneficiary');
}

function shopSettlementBeneficiaryMeta(order: any, settlement: any) {
  const beneficiaryType = String(settlement?.beneficiaryType || 'platform').replace(/_/g, ' ');
  const label = shopSettlementBeneficiaryLabel(order, settlement);
  return label === beneficiaryType ? beneficiaryType : `${beneficiaryType} · ${label}`;
}

function labelValue(value: unknown) {
  return String(value || 'n/a').replace(/_/g, ' ');
}

function normalizedPickupHandoffStatus(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'n/a' || normalized === 'null' || normalized === 'undefined') {
    return 'not_requested';
  }
  return normalized;
}

function orderFulfillmentLabel(order: any) {
  const method = String(order?.fulfillmentMethod || '').trim().toLowerCase();
  if (method === 'delivery') {
    return 'Delivery company';
  }
  if (method === 'customer_pickup') {
    return 'Customer pickup';
  }
  return labelValue(method || 'n/a');
}

function orderDeliveryAddress(order: any) {
  const structured = [
    order?.deliveryLabel,
    order?.deliveryAddressLine1,
    order?.deliveryAddressLine2,
    order?.deliveryLandmark,
  ]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
  if (structured.length) return structured.join(', ')
  return String(order?.deliveryGeoReferenceText || '').trim() || ''
}

function getPrimaryDeliveryTask(order: any) {
  if (order?.deliveryTask && typeof order.deliveryTask === 'object') {
    return order.deliveryTask;
  }
  const tasks = Array.isArray(order?.deliveryTasks) ? order.deliveryTasks : [];
  return tasks[0] || null;
}

function getReturnToPartnerTask(order: any) {
  const taskFromSingle = order?.deliveryTask && typeof order.deliveryTask === 'object'
    ? order.deliveryTask
    : null;
  const tasks = Array.isArray(order?.deliveryTasks) ? order.deliveryTasks : [];
  const combined = taskFromSingle ? [taskFromSingle, ...tasks] : tasks;
  return combined.find((task: any) => String(task?.taskType || '').trim().toLowerCase() === 'return_to_partner') || null;
}

function deliveryStatusLabel(order: any) {
  const primaryTask = getPrimaryDeliveryTask(order);
  return labelValue(
    order?.deliveryStatus
    || order?.deliveryTaskStatus
    || order?.activeDeliveryTaskStatus
    || primaryTask?.status
    || 'n/a',
  );
}

function assignedRiderDetails(order: any) {
  const primaryTask = getPrimaryDeliveryTask(order);
  const rider = order?.assignedRider || primaryTask?.assignedRider || null;
  const firstName = String(rider?.firstName || '').trim();
  const lastName = String(rider?.lastName || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const accountId = String(
    rider?.accountId
    || rider?.user?.accountId
    || rider?.id
    || order?.assignedRiderAccountId
    || primaryTask?.assignedRiderAccountId
    || primaryTask?.assignedRider?.user?.accountId
    || '',
  ).trim();
  const phoneNumber = String(
    rider?.phoneNumber
    || order?.assignedRiderPhoneNumber
    || primaryTask?.assignedRiderPhoneNumber
    || '',
  ).trim();
  const vehicleMode = String(rider?.vehicleMode || '').trim();
  return {
    isAssigned: Boolean(fullName || accountId),
    name: fullName || accountId || 'Unassigned',
    accountId,
    phoneNumber,
    vehicleMode,
  };
}

function renderImageLinks(imageAssetIds: unknown) {
  const ids = Array.isArray(imageAssetIds)
    ? imageAssetIds.map((v) => String(v || '').trim()).filter(Boolean)
    : [];
  if (!ids.length) return '';
  return `
    <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">
      ${ids.map((assetId, index) => `
        <a href="#" onclick="event.preventDefault(); window.__openShopOrderImage('${escapeHtml(assetId)}')" style="display:inline-flex; align-items:center; min-height:32px; padding:6px 10px; border:1px solid rgba(var(--v-theme-on-surface),0.18); border-radius:999px; background:rgba(var(--v-theme-on-surface),0.06); color:rgb(var(--v-theme-on-surface)); font-size:13px; font-weight:700; text-decoration:none; cursor:pointer;">
          Image ${index + 1}
        </a>
      `).join('')}
    </div>
  `;
}

function orderUpdateAuthor(update: any) {
  const type = String(update?.authorType || update?.createdByType || '').trim().toLowerCase();
  if (['customer', 'buyer'].includes(type)) return 'Customer';
  if (['shop', 'shop_staff', 'partner'].includes(type)) return 'Shop team';
  if (type === 'admin') return 'Admin';
  return update?.authorLabel || update?.authorAccountId || labelValue(type || 'update');
}

function renderOrderHtml(order: any) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const settlements = Array.isArray(order?.settlements) ? order.settlements : [];
  const updates = Array.isArray(order?.updates) ? order.updates : [];
  const fulfillmentMethod = String(order?.fulfillmentMethod || '').trim().toLowerCase();
  const deliveryCompanyName = order?.deliveryCompany?.name || order?.deliveryEstimateSnapshot?.deliveryCompanyName || '';
  const deliveryAddress = orderDeliveryAddress(order);
  const rider = assignedRiderDetails(order);
  const returnToPartnerTask = getReturnToPartnerTask(order);
  const returnConfirmationPin = String(
    returnToPartnerTask?.deliveryConfirmationCode
    || returnToPartnerTask?.confirmationCode
    || '',
  ).trim();
  const itemsHtml = items.length
    ? items.map((item: any) => `
      <div class="shop-order-report__item">
        <div style="display:flex; justify-content:space-between; gap:12px;">
          <div style="flex:1 1 auto; min-width:0;">
            <div class="shop-order-report__item-title">${escapeHtml(item.quantity)}x ${escapeHtml(item.productName)}</div>
          </div>
          <div class="shop-order-report__value" style="white-space:nowrap;">${escapeHtml(money(item.lineTotalAmount, item.currency || order?.currency))}</div>
        </div>
        <div style="display:flex; justify-content:space-between; gap:12px;">
          <div style="flex:1 1 auto; min-width:0;">
            ${item.variantName ? `<div class="shop-order-report__item-meta" style="margin-top:4px; font-size:13px;">Variant: ${escapeHtml(item.variantName)}</div>` : ''}
            ${item.variantSku ? `<div class="shop-order-report__item-meta" style="margin-top:4px; font-size:13px;">Variant SKU: ${escapeHtml(item.variantSku)}</div>` : ''}
            ${item.categoryLabel ? `<div class="shop-order-report__item-meta" style="margin-top:4px; font-size:13px;">${escapeHtml(item.categoryLabel)}</div>` : ''}
            ${renderAttributeSummary(item.productAttributesSnapshot, item.variantAttributesSnapshot)}
            ${item.notes ? `<div class="shop-order-report__muted" style="margin-top:4px; font-size:12px;">Note: ${escapeHtml(item.notes)}</div>` : ''}
          </div>
        </div>
      </div>
    `).join('')
    : '<div class="shop-order-report__empty" style="padding:12px 0;">No items were returned for this order.</div>';

  const settlementsHtml = settlements.length
    ? settlements.map((settlement: any) => `
      <div class="shop-order-report__settlement">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:10px;">
          <div>
            <div class="shop-order-report__value">${escapeHtml(shopSettlementBeneficiaryLabel(order, settlement))}</div>
            <div class="shop-order-report__label" style="margin-top:4px; font-size:12px; letter-spacing:.05em;">${escapeHtml(shopSettlementBeneficiaryMeta(order, settlement))}</div>
            <div class="shop-order-report__muted" style="margin-top:4px; font-size:13px;">Status: ${escapeHtml(String(settlement?.status || 'n/a').replace(/_/g, ' '))}</div>
            <div class="shop-order-report__muted" style="margin-top:4px; font-size:13px;">Eligible: ${escapeHtml(dateTime(settlement?.eligibleAt))}</div>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:10px; flex:1 1 360px;">
            <div><div class="shop-order-report__metric-label" style="font-size:11px;">Gross</div><div class="shop-order-report__metric-value">${escapeHtml(money(settlement?.grossAmount, settlement?.currency || order?.currency))}</div></div>
            <div><div class="shop-order-report__metric-label" style="font-size:11px;">Fee</div><div class="shop-order-report__metric-value">${escapeHtml(money(settlement?.feeAmount, settlement?.currency || order?.currency))}</div></div>
            <div><div class="shop-order-report__metric-label" style="font-size:11px;">Net</div><div class="shop-order-report__metric-value">${escapeHtml(money(settlement?.netAmount, settlement?.currency || order?.currency))}</div></div>
            <div><div class="shop-order-report__metric-label" style="font-size:11px;">Direct</div><div class="shop-order-report__metric-value">${escapeHtml(money(settlement?.directCollectedAmount, settlement?.currency || order?.currency))}</div></div>
            <div><div class="shop-order-report__metric-label" style="font-size:11px;">Payable</div><div class="shop-order-report__metric-value">${escapeHtml(money(settlement?.outstandingPayableAmount, settlement?.currency || order?.currency))}</div></div>
            <div><div class="shop-order-report__metric-label" style="font-size:11px;">Remittance</div><div class="shop-order-report__metric-value">${escapeHtml(money(settlement?.outstandingRemittanceAmount, settlement?.currency || order?.currency))}</div></div>
          </div>
        </div>
      </div>
    `).join('')
    : '<div class="shop-order-report__empty" style="padding:12px 0;">No settlement ledger rows are available for this order yet.</div>'

  const updatesHtml = updates.length
    ? updates.map((update: any) => `
      <div class="shop-order-report__item">
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:baseline;">
          <div class="shop-order-report__value" style="font-weight:700;">${escapeHtml(orderUpdateAuthor(update))}</div>
          <div class="shop-order-report__muted" style="font-size:12px;">${escapeHtml(dateTime(update?.createdAt))}</div>
        </div>
        <div class="shop-order-report__muted" style="margin-top:8px; white-space:pre-wrap;">${escapeHtml(update?.note || update?.message || '')}</div>
        ${renderImageLinks(update?.imageAssetIds)}
      </div>
    `).join('')
    : '<div class="shop-order-report__empty" style="padding:12px 0;">No seller/customer updates yet.</div>'

  return `
    ${shopOrderReportStyles()}
    <div class="shop-order-report">
      <div class="shop-order-report__grid">
        <div class="shop-order-report__card">
          <div class="shop-order-report__label" style="margin-bottom:8px;">Order</div>
          <div class="shop-order-report__heading">${escapeHtml(order?.orderNumber || 'Order')}</div>
          <div class="shop-order-report__muted" style="margin-top:4px;">Placed ${escapeHtml(dateTime(order?.placedAt))}</div>
        </div>
        <div class="shop-order-report__card">
          <div class="shop-order-report__label" style="margin-bottom:8px;">Customer</div>
          <div class="shop-order-report__value" style="font-weight:700;">${escapeHtml(order?.customerDisplayName || order?.customerAccountId || 'Unknown customer')}</div>
          ${order?.customerEmail ? `<div class="shop-order-report__muted" style="margin-top:4px;">${escapeHtml(order.customerEmail)}</div>` : ''}
          ${order?.customerPhoneNumber ? `<div class="shop-order-report__muted" style="margin-top:4px;">${escapeHtml(order.customerPhoneNumber)}</div>` : ''}
        </div>
        <div class="shop-order-report__card">
          <div class="shop-order-report__label" style="margin-bottom:8px;">Payment</div>
          <div class="shop-order-report__value" style="font-weight:700;">${escapeHtml(money(order?.totalAmount, order?.currency))}</div>
          <div class="shop-order-report__muted" style="margin-top:4px;">Method: ${escapeHtml(String(order?.paymentMethod || 'n/a').replace(/_/g, ' '))}</div>
          <div class="shop-order-report__muted" style="margin-top:4px;">Payment status: ${escapeHtml(String(order?.paymentStatus || 'pending').replace(/_/g, ' '))}</div>
        </div>
        <div class="shop-order-report__card">
          <div class="shop-order-report__label" style="margin-bottom:8px;">Fulfillment</div>
          <div class="shop-order-report__value" style="font-weight:700;">${escapeHtml(orderFulfillmentLabel(order))}</div>
          ${fulfillmentMethod === 'delivery' && deliveryCompanyName ? `<div class="shop-order-report__muted" style="margin-top:4px;">Delivery partner: ${escapeHtml(deliveryCompanyName)}</div>` : ''}
          ${fulfillmentMethod === 'delivery' ? `<div class="shop-order-report__muted" style="margin-top:4px;">Delivery status: ${escapeHtml(deliveryStatusLabel(order))}</div>` : ''}
          ${fulfillmentMethod === 'delivery' && typeof order?.deliveryFeeAmount !== 'undefined' ? `<div class="shop-order-report__muted" style="margin-top:4px;">Delivery fee: ${escapeHtml(money(order.deliveryFeeAmount, order?.currency))}</div>` : ''}
          ${fulfillmentMethod === 'delivery' && deliveryAddress ? `<div class="shop-order-report__muted" style="margin-top:4px;">Address: ${escapeHtml(deliveryAddress)}</div>` : ''}
          ${fulfillmentMethod === 'customer_pickup' ? `<div class="shop-order-report__muted" style="margin-top:4px;">Customer will pick up from the shop.</div>` : ''}
        </div>
        <div class="shop-order-report__card">
          <div class="shop-order-report__label" style="margin-bottom:8px;">Assigned rider</div>
          <div class="shop-order-report__value" style="font-weight:700;">${escapeHtml(rider.name)}</div>
          ${rider.accountId ? `<div class="shop-order-report__muted" style="margin-top:4px;">Account: ${escapeHtml(rider.accountId)}</div>` : ''}
          ${rider.phoneNumber ? `<div class="shop-order-report__muted" style="margin-top:4px;">Phone: ${escapeHtml(rider.phoneNumber)}</div>` : ''}
          ${rider.vehicleMode ? `<div class="shop-order-report__muted" style="margin-top:4px;">Mode: ${escapeHtml(labelValue(rider.vehicleMode))}</div>` : ''}
          ${!rider.isAssigned ? `<div class="shop-order-report__muted" style="margin-top:4px;">No rider assigned yet.</div>` : ''}
        </div>
        <div class="shop-order-report__card">
          <div class="shop-order-report__label" style="margin-bottom:8px;">Status</div>
          <div class="shop-order-report__value" style="font-weight:700;">${escapeHtml(String(order?.orderStatus || 'placed').replace(/_/g, ' '))}</div>
          ${order?.pickupHandoffStatus ? `<div class="shop-order-report__muted" style="margin-top:4px;">Pickup handoff: ${escapeHtml(String(order.pickupHandoffStatus || 'not_requested').replace(/_/g, ' '))}</div>` : ''}
          ${order?.deliveryConfirmationStatus ? `<div class="shop-order-report__muted" style="margin-top:4px;">Delivery confirmation: ${escapeHtml(String(order.deliveryConfirmationStatus || 'not_requested').replace(/_/g, ' '))}</div>` : ''}
          ${returnConfirmationPin ? `<div class="shop-order-report__muted" style="margin-top:4px;">Delivery confirmation PIN: <strong>${escapeHtml(returnConfirmationPin)}</strong></div>` : ''}
          ${order?.cancellationReason ? `<div class="shop-order-report__danger" style="margin-top:6px; font-size:12px;">Cancel: ${escapeHtml(order.cancellationReason)}</div>` : ''}
          ${order?.failedReason ? `<div class="shop-order-report__danger" style="margin-top:6px; font-size:12px;">Failure: ${escapeHtml(order.failedReason)}</div>` : ''}
        </div>
      </div>

      ${order?.notes ? `
        <div class="shop-order-report__card" style="margin-bottom:18px;">
          <div class="shop-order-report__label" style="margin-bottom:8px;">Customer checkout note</div>
          <div class="shop-order-report__muted" style="white-space:pre-wrap;">${escapeHtml(order.notes)}</div>
        </div>
      ` : ''}

      <div class="shop-order-report__section-title">Seller / Customer notes</div>
      <div class="shop-order-report__section">
        ${updatesHtml}
      </div>

      <div class="shop-order-report__label" style="margin-bottom:8px;margin-top:16px;">Items</div>
      <div class="shop-order-report__section">
        ${itemsHtml}
      </div>

      <div class="shop-order-report__section-title">Finance</div>
      <div style="display:grid; gap:12px;">
        ${settlementsHtml}
      </div>
    </div>
  `;
}

export async function updateShopOrderView(master: any) {
  await master?.$load?.();
  const orderId = String(master?.$get?.('id') || '');

  if (!orderId) {
    master?.$set?.('orderDetails', renderOrderHtml(master?.$data || {}));
    return;
  }

  const order = await Api.instance.service(getServicePath()).get(orderId, {
    $select: [
      'id',
      'orderNumber',
      'currency',
      'totalAmount',
      'voucherAppliedAmount',
      'paymentMethod',
      'paymentStatus',
      'orderStatus',
      'customerAccountId',
      'customerDisplayName',
      'customerEmail',
      'customerPhoneNumber',
      'fulfillmentMethod',
      'deliveryCompany',
      'deliveryCompany.name',
      'deliveryFeeAmount',
      'deliveryStatus',
      'deliveryTaskStatus',
      'activeDeliveryTaskStatus',
      'deliveryTask',
      'deliveryTask.status',
      'deliveryTask.taskType',
      'deliveryTask.deliveryConfirmationCode',
      'deliveryTask.assignedRider',
      'deliveryTask.assignedRider.id',
      'deliveryTask.assignedRider.accountId',
      'deliveryTask.assignedRider.firstName',
      'deliveryTask.assignedRider.lastName',
      'deliveryTask.assignedRider.phoneNumber',
      'deliveryTask.assignedRider.vehicleMode',
      'deliveryTasks',
      'deliveryTasks.taskType',
      'deliveryTasks.status',
      'deliveryTasks.deliveryConfirmationCode',
      'deliveryTasks.assignedRider',
      'deliveryTasks.assignedRider.id',
      'deliveryTasks.assignedRider.accountId',
      'deliveryTasks.assignedRider.firstName',
      'deliveryTasks.assignedRider.lastName',
      'deliveryTasks.assignedRider.phoneNumber',
      'deliveryTasks.assignedRider.vehicleMode',
      'assignedRider',
      'assignedRider.id',
      'assignedRider.accountId',
      'assignedRider.firstName',
      'assignedRider.lastName',
      'assignedRider.phoneNumber',
      'assignedRider.vehicleMode',
      'deliveryLabel',
      'deliveryAddressLine1',
      'deliveryAddressLine2',
      'deliveryLandmark',
      'deliveryGeoReferenceText',
      'deliveryEstimateSnapshot',
      'notes',
      'updates',
      'cancellationReason',
      'failedReason',
      'placedAt',
      'pickupConfirmationCode',
      'pickupHandoffStatus',
      'pickupHandoffCode',
      'deliveryConfirmationStatus',
      'items',
      'items.productName',
      'items.productSku',
      'items.variantName',
      'items.variantSku',
      'items.categoryLabel',
      'items.productAttributesSnapshot',
      'items.variantAttributesSnapshot',
      'items.quantity',
      'items.lineTotalAmount',
      'settlements',
    ],
  });
  master?.$set?.('orderStatus', order?.orderStatus ?? master?.$get?.('orderStatus'));
  master?.$set?.('paymentStatus', order?.paymentStatus ?? master?.$get?.('paymentStatus'));
  master?.$set?.('pickupHandoffStatus', order?.pickupHandoffStatus ?? master?.$get?.('pickupHandoffStatus'));
  master?.$set?.('fulfillmentMethod', order?.fulfillmentMethod ?? master?.$get?.('fulfillmentMethod'));
  master?.$set?.('deliveryTaskStatus', order?.deliveryTaskStatus ?? master?.$get?.('deliveryTaskStatus'));
  master?.$set?.('assignedRiderAccountId', order?.assignedRiderAccountId ?? master?.$get?.('assignedRiderAccountId'));
  master?.$set?.('orderDetails', renderOrderHtml(order || master?.$data || {}));
}

async function refreshReport(report: Report) {
  await updateShopOrderView(report.$master);
  report.forceRender();
}

async function patchOrder(orderId: string, data: Record<string, unknown>) {
  await Api.instance.service(getServicePath()).patch(orderId, data);
}

function reasonDialog(title: string, label: string, onSubmit: (reason: string) => Promise<void>) {
  const dialog = new DialogForm({}, {
    form() {
      return $FM({
        title,
        width: 520,
      }, {
        children: () => [
          $PT({}, {
            children: () => [
              $FD({ label, storage: 'reason', type: 'textarea', required: true }),
            ],
          }),
        ],
        saved: async (form) => {
          const reason = String(form.$master?.$get('reason') || '').trim();
          if (!reason) {
            Dialogs.$error(`${label} is required.`);
            return;
          }
          await onSubmit(reason);
          dialog.forceCancel();
        },
      });
    },
  });

  return dialog;
}

async function uploadImageAssetIds(form: any, imageField: string, purpose: string, entityId: string) {
  const rawValue = form?.$master?.$get?.(imageField);
  const images = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
  const assetIds: string[] = [];

  for (const image of images) {
    const uploaded = await uploadAsset(image, {
      purpose,
      isPublic: false,
      entityType: 'shop_order',
      entityId,
    });
    assetIds.push(uploaded.id);
  }

  form?.$master?.$set?.(imageField, null);
  return assetIds;
}

function notesDialog(title: string, initialNotes: string, entityId: string, onSubmit: (notes: string, imageAssetIds: string[]) => Promise<void>) {
  const dialog = new DialogForm({}, {
    form() {
      return $FM({
        title,
        width: 560,
      }, {
        children: () => [
          $PT({}, {
            children: () => [
              $FD({
                label: 'Notes',
                storage: 'notes',
                type: 'textarea',
                required: false,
                cols: 12,
                hint: initialNotes
                  ? `Current notes: ${initialNotes}`
                  : 'Share a seller/customer update for this shop order.',
              }),
              $FD({
                label: 'Images',
                storage: 'images',
                type: 'image',
                multiple: true,
                cols: 12,
              }),
            ],
          }),
        ],
        saved: async (form) => {
          const imageAssetIds = await uploadImageAssetIds(form, 'images', 'shop-order-update-image', entityId);
          await onSubmit(String(form.$master?.$get('notes') || '').trim(), imageAssetIds);
          dialog.forceCancel();
        },
      });
    },
  });

  return dialog;
}

function acceptButton(report: Report, statusRef: Ref<any>) {
  return $BN({ text: 'Accept', color: 'success' }, {
    onClicked: async (button) => {
      try {
        const confirmed = await Dialogs.$confirm(
          'Are you sure you want to accept this order?',
          'Accept Order',
        );
        if (!confirmed) {
          return;
        }
        await patchOrder(String(button.$master?.$get('id') || ''), { orderStatus: 'accepted' });
        statusRef.value = 'accepted';
        await refreshReport(report);
        Dialogs.$success('Order accepted.');
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Failed to accept order.');
      }
    },
  });
}

function readyButton(report: Report, statusRef: Ref<any>) {
  return $BN({ text: 'Ready for Pickup', color: 'primary' }, {
    onClicked: async (button) => {
      const confirmed = await Dialogs.$confirm(
        'Are you sure you want to mark this order as ready for pickup?',
        'Mark Ready for Pickup',
      );
      if (!confirmed) {
        return;
      }
      try {
        await patchOrder(String(button.$master?.$get('id') || ''), { orderStatus: 'ready_for_pickup' });
        statusRef.value = 'ready_for_pickup';
        await refreshReport(report);
        Dialogs.$success('Order marked ready.');
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Failed to update order.');
      }
    },
  });
}

function requestPickupHandoffButton(report: Report, pickupHandoffStatusRef: Ref<any>) {
  return $BN({ text: 'Start Pickup Handoff', color: 'primary' }, {
    onClicked: async (button) => {
      try {
        const confirmed = await Dialogs.$confirm(
          'Generate a pickup PIN to confirm handoff?',
          'Start Pickup Handoff',
        );
        if (!confirmed) {
          return;
        }
        await Api.instance.service(`shops/${getShopId()}/orders/${String(button.$master?.$get('id') || '')}/pickup-handoff/request`).create({});
        pickupHandoffStatusRef.value = 'requested';
        await refreshReport(report);
        Dialogs.$success('Pickup handoff started.');
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Failed to start pickup handoff.');
      }
    },
  });
}

function confirmPickupHandoffPinButton(report: Report, pickupHandoffStatusRef: Ref<any>) {
  return $BN({ text: 'Confirm Pickup PIN', color: 'success' }, {
    onClicked: async (button) => {
      const dialog = new DialogForm({}, {
        form() {
          return $FM({
            title: 'Confirm Pickup PIN',
            width: 420,
          }, {
            children: () => [
              $PT({}, {
                children: () => [
                  $FD({ label: 'Pickup PIN', storage: 'confirmationCode', type: 'text', required: true }),
                ],
              }),
            ],
            saved: async (form) => {
              try {
                await Api.instance.service(`shops/${getShopId()}/orders/${String(button.$master?.$get('id') || '')}/pickup-handoff/confirm`).create({
                  confirmationCode: String(form.$master?.$get('confirmationCode') || '').trim(),
                });
                pickupHandoffStatusRef.value = 'confirmed';
                await refreshReport(report);
                Dialogs.$success('Pickup handoff confirmed.');
                dialog.forceCancel();
              } catch (error: any) {
                Dialogs.$error(error?.message || 'Failed to confirm pickup PIN.');
              }
            },
          });
        },
      });

      AppManager.showDialog(dialog);
    },
  });
}

function completeButton(report: Report, statusRef: Ref<any>, paymentStatusRef: Ref<any>, orderData: any) {
  return $BN({ text: 'Complete Pickup', color: 'secondary' }, {
    onClicked: async (button) => {
      const orderId = String(button.$master?.$get('id') || '');
      const pickupConfirmationCode = button.$master?.$get('pickupConfirmationCode');

      if (isOnlinePickupAwaitingPayment(button.$master?.$data || orderData)) {
        Dialogs.$error('This pickup order uses online payment. The customer must complete payment before the order can be completed.');
        return;
      }

      if (pickupConfirmationCode) {
        const dialog = new DialogForm({}, {
          form() {
            return $FM({
              title: 'Confirm Customer Pickup',
              width: 420,
            }, {
              children: () => [
                $PT({}, {
                  children: () => [
                    $FD({ label: 'Customer Pickup Code', storage: 'confirmationCode', type: 'text', required: true }),
                  ],
                }),
              ],
              saved: async (form) => {
                try {
                  await patchOrder(orderId, {
                    orderStatus: 'completed',
                    pickupConfirmationCode: String(form.$master?.$get('confirmationCode') || '').trim(),
                  });
                  statusRef.value = 'completed';
                  await refreshReport(report);
                  Dialogs.$success('Order completed.');
                  dialog.forceCancel();
                } catch (error: any) {
                  Dialogs.$error(error?.message || 'Failed to complete order.');
                }
              },
            });
          },
        });
        AppManager.showDialog(dialog);
        return;
      }

      const confirmed = await Dialogs.$confirm(
        'Are you sure you want to mark this order as completed? This action cannot be undone.',
        'Complete Order',
      );
      if (!confirmed) {
        return;
      }
      try {
        await patchOrder(orderId, {
          orderStatus: 'completed',
        });
        statusRef.value = 'completed';
        await refreshReport(report);
        Dialogs.$success('Order completed.');
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Failed to complete order.');
      }
    },
  });
}

function markPickupPaymentPaidButton(report: Report, paymentStatusRef: Ref<any>) {
  return $BN({ text: 'Mark Payment Paid', color: 'success' }, {
    onClicked: async (button) => {
      const orderId = String(button.$master?.$get('id') || '');
      const currency = String(button.$master?.$get('currency') || 'GHS');
      const voucherApplied = Number(button.$master?.$get('voucherAppliedAmount') || 0);
      const totalMinor = Math.max(0, Number(button.$master?.$get('totalAmount') || 0) - voucherApplied);
      const expectedDisplay = money(totalMinor, currency);
      const paymentMethod = String(button.$master?.$get('paymentMethod') || '');
      const methodLabel = paymentMethod.startsWith('card') ? 'card' : 'cash';

      const dialog = new DialogForm({}, {
        form() {
          return $FM({
            title: 'Mark Payment Paid',
            width: 420,
          }, {
            children: () => [
              $PT({}, {
                children: () => [
                  $FD({
                    label: `Amount received (${currency})`,
                    storage: 'amountReceived',
                    type: 'text',
                    required: true,
                    hint: voucherApplied > 0
                      ? `Total: ${money(Number(button.$master?.$get('totalAmount') || 0), currency)} − Voucher: ${money(voucherApplied, currency)} = ${expectedDisplay}. Enter the exact amount to collect.`
                      : `Expected: ${expectedDisplay}. Enter the exact amount received from the customer.`,
                  }),
                ],
              }),
            ],
            saved: async (form) => {
              const raw = String(form.$master?.$get('amountReceived') || '').trim();
              const entered = parseFloat(raw);
              if (!Number.isFinite(entered) || entered <= 0) {
                Dialogs.$error('Please enter a valid amount.');
                return;
              }
              if (Math.round(entered * 100) !== totalMinor) {
                Dialogs.$error(`Amount does not match. Expected ${expectedDisplay} — please collect the correct amount before confirming.`);
                return;
              }
              try {
                await patchOrder(orderId, { paymentStatus: 'paid' });
                paymentStatusRef.value = 'paid';
                dialog.forceCancel();
                await refreshReport(report);
                Dialogs.$success(`${methodLabel.charAt(0).toUpperCase() + methodLabel.slice(1)} payment of ${expectedDisplay} confirmed as received.`);
              } catch (error: any) {
                Dialogs.$error(error?.message || 'Failed to update payment status.');
              }
            },
          });
        },
      });

      AppManager.showDialog(dialog);
    },
  });
}

function updateNotesButton(report: Report) {
  return $BN({ text: 'Add Update', color: 'info' }, {
    onClicked: async (button) => {
      const orderId = String(button.$master?.$get('id') || '');
      const dialog = notesDialog(
        'Add Order Update',
        String(button.$master?.$get('notes') || ''),
        orderId,
        async (notes, imageAssetIds) => {
          try {
            if (!notes) throw new Error('Update note is required.');
            await Api.instance.service(`shops/${getShopId()}/orders/${orderId}/updates`).create({
              message: notes,
              imageAssetIds,
            });
            await refreshReport(report);
            Dialogs.$success('Order update added.');
          } catch (error: any) {
            Dialogs.$error(error?.message || 'Failed to add update.');
          }
        },
      );
      AppManager.showDialog(dialog);
    },
  });
}

function printReceiptButton() {
  return $BN({ text: 'Print Receipt', color: 'info', icon: 'mdi-receipt-outline' }, {
    onClicked: async (button) => {
      try {
        const orderId = String(button.$master?.$get('id') || '');
        const shopId = useAppStore().shop?.id;
        if (!orderId || !shopId) throw new Error('Unable to identify the order.');
        const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
        await printReceipt(`${apiBase}/shops/${shopId}/orders/${orderId}/receipt`);
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Unable to print the receipt right now.');
      }
    },
  });
}

function downloadReceiptPdfButton() {
  return $BN({ text: 'Download PDF', color: 'info', icon: 'mdi-download-outline' }, {
    onClicked: async (button) => {
      try {
        const orderId = String(button.$master?.$get('id') || '');
        const shopId = useAppStore().shop?.id;
        if (!orderId || !shopId) throw new Error('Unable to identify the order.');
        const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
        await downloadReceiptPdf(`${apiBase}/shops/${shopId}/orders/${orderId}/receipt/pdf`, `order-${orderId}.pdf`);
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Unable to download the receipt right now.');
      }
    },
  });
}

function printLabelButton() {
  return $BN({ text: 'Print Label', color: 'secondary', icon: 'mdi-tag-outline' }, {
    onClicked: async (button) => {
      try {
        await printOrderLabel(button.$master?.$data);
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Unable to print the label right now.');
      }
    },
  });
}

function refreshButton(report: Report) {
  return $BN({ text: 'Refresh', color: 'secondary' }, {
    onClicked: async () => {
      try {
        await refreshReport(report);
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Failed to refresh order.');
      }
    },
  });
}

function cancelButton(report: Report, statusRef: Ref<any>) {
  return $BN({ text: 'Cancel', color: 'warning' }, {
    onClicked: async (button) => {
      const dialog = reasonDialog('Cancel Order', 'Cancellation Reason', async (reason) => {
        try {
          await patchOrder(String(button.$master?.$get('id') || ''), {
            orderStatus: 'cancelled',
            cancellationReason: reason,
          });
          statusRef.value = 'cancelled';
          await refreshReport(report);
          Dialogs.$success('Order cancelled.');
        } catch (error: any) {
          Dialogs.$error(error?.message || 'Failed to cancel order.');
        }
      });

      AppManager.showDialog(dialog);
    },
  });
}

function failButton(report: Report, statusRef: Ref<any>) {
  return $BN({ text: 'Mark Failed', color: 'error' }, {
    onClicked: async (button) => {
      const dialog = reasonDialog('Mark Order Failed', 'Failure Reason', async (reason) => {
        try {
          await patchOrder(String(button.$master?.$get('id') || ''), {
            orderStatus: 'failed',
            failedReason: reason,
          });
          statusRef.value = 'failed';
          await refreshReport(report);
          Dialogs.$success('Order marked failed.');
        } catch (error: any) {
          Dialogs.$error(error?.message || 'Failed to update order.');
        }
      });

      AppManager.showDialog(dialog);
    },
  });
}

async function fetchActiveReturnTaskForShopOrder(orderId: string): Promise<{ id: string, deliveryConfirmationCode: string } | null> {
  try {
    const tasks: any[] = await Api.instance.service('failed-delivery-tasks').find({
      query: { sourceType: 'shop_order', sourceId: orderId },
    })
    return tasks?.find((t: any) => t.taskType === 'return_to_partner' && t.confirmationStatus !== 'confirmed') ?? null
  } catch {
    return null
  }
}

function confirmReturnReceivedButton(report: Report, statusRef: Ref<any>) {
  return $BN({ text: 'Confirm Return Received', color: 'success', icon: 'mdi-package-check' }, {
    onClicked: async (button) => {
      const orderId = String(button.$master?.$get('id') || '')
      if (!orderId) return

      const task = await fetchActiveReturnTaskForShopOrder(orderId)
      if (!task) {
        Dialogs.$error('No active return task found for this order.')
        return
      }

      const returnToPartnerTask = getReturnToPartnerTask(button.$master?.$data || {});
      
      const pin = String(
        returnToPartnerTask?.deliveryConfirmationCode
        || returnToPartnerTask?.confirmationCode
        || '',
      ).trim();

      if (!pin) {
        Dialogs.$error('No return confirmation PIN found for this order.')
        return
      }

      const canprocess = await Dialogs.$confirm(
        'Are you sure you want to confirm receipt of the returned item? This will initiate a refund for the customer.',
        'Confirm Return Received',
      )
      if (!canprocess) {
        return
      }

      try {
        await Api.instance.service(`failed-delivery-tasks/${task.id}/confirm-return`).create({ handoffCode: pin })
        Dialogs.$success('Return confirmed. A refund will be initiated for the customer.')
        await refreshReport(report)
        statusRef.value = 'returned_to_partner'
        report.forceRender()
      } catch (err: any) {
        Dialogs.$error(err?.message || 'Incorrect PIN or confirmation failed.')
      }
    },
  });
}

const trigger = (defaultQuery: Record<string, any> = {}) => () => $TG({
  title: 'Orders',
  selectFields: ['id','orderNumber', 'customerDisplayName', 'totalAmount', 'currency', 'paymentStatus', 'orderStatus', 'placedAt'],
  headers: [
    { title: 'Order', value: 'orderNumber' },
    { title: 'Customer', value: 'customerDisplayName' },
    { title: 'Total', value: 'totalAmountStr' },
    { title: 'Currency', value: 'currency' },
    { title: 'Payment', value: 'paymentStatus' },
    { title: 'Status', value: 'orderStatus' },
    { title: 'Placed', value: 'placedAt' },
  ],
  query: {
    ...defaultQuery,
  },
}, {
  format(trigger, items) {
    for (const item of items) {
      item.totalAmountStr = money(item.totalAmount, item.currency);
      item.placedAt = dateTime(item.placedAt);
    }
    return items;
  },
});

const createForm = () => $FM({
  title: 'Order',
  width: 1200,
}, {
  children: () => [
    $PT({}, {
      children: () => [
        $FD({ label: 'Details', storage: 'orderDetails', type: 'htmlview', readonly: true, cols: 12, minHeight: 520 }),
      ],
    }),
  ],
});

export const shopOrdersReport = (orderId?: string) => () => $RP({
  title: 'Order',
  fluid: true,
  sideButtonWidth: 280,
  ...(orderId ? { objectId: orderId, objectType: getServicePath() } : {}),
}, {
  form: createForm,
  setup(report) {
    report.$set('isShopOrderView', true);
  },
  loaded: async (report) => {
    report.$set('isShopOrderView', true);
    if (report.$master?.$get('id')) {
      await refreshReport(report);
    }
  },
  sideButtons: (_props, _ctx, report) => {
    const statusRef: Ref<any> = ref(report.$master?.$get('orderStatus'));
    const paymentStatusRef: Ref<any> = ref(report.$master?.$get('paymentStatus'));
    const pickupHandoffStatusRef: Ref<any> = ref(report.$master?.$get('deliveryTask.pickupHandoffStatus'));
    const returnDeliveryConfirmationStatusRef: Ref<any> = ref(report.$master?.$get('deliveryTask.deliveryConfirmationStatus'));
    const orderData = report.$master?.$data || {};
    console.log(orderData)
    const buttons: Button[] = [];

    buttons.push(refreshButton(report));
    buttons.push(updateNotesButton(report));
    buttons.push(printLabelButton());

    if (paymentStatusRef.value === 'paid') {
      buttons.push(printReceiptButton());
      buttons.push(downloadReceiptPdfButton());
    }

    if (statusRef.value === 'return_in_progress' && returnDeliveryConfirmationStatusRef.value === 'requested') {
      buttons.push(confirmReturnReceivedButton(report, statusRef));
      return buttons;
    }

    if (statusRef.value === 'placed') {
      buttons.push(acceptButton(report, statusRef));
    }

    if (['accepted'].includes(String(statusRef.value || ''))) {
      buttons.push(readyButton(report, statusRef));
    }

    if (String(statusRef.value || '').trim().toLowerCase() === 'ready_for_pickup' && String(orderData.fulfillmentMethod || '').trim().toLowerCase() !== 'customer_pickup') {
      const handoffStatus = normalizedPickupHandoffStatus(pickupHandoffStatusRef.value);
      if (handoffStatus === 'not_requested') {
        buttons.push(requestPickupHandoffButton(report, pickupHandoffStatusRef));
      }
      if (handoffStatus === 'requested') {
        buttons.push(confirmPickupHandoffPinButton(report, pickupHandoffStatusRef));
      }
    }

    if (['placed', 'accepted', 'ready_for_pickup'].includes(String(statusRef.value || ''))) {
      buttons.push(cancelButton(report, statusRef));
      buttons.push(failButton(report, statusRef));
    }

    if (statusRef.value === 'ready_for_pickup' && String(orderData.fulfillmentMethod || '').trim().toLowerCase() === 'customer_pickup') {
      if (
        !isOnlinePickupAwaitingPayment(orderData)
        && String(paymentStatusRef.value || '').trim().toLowerCase() === 'paid'
      ) {
        buttons.push(completeButton(report, statusRef, paymentStatusRef, orderData));
      }
    }

    if (
      canShopCollectPayment(orderData) &&
      String(paymentStatusRef.value || '').trim().toLowerCase() !== 'paid' &&
      !['cancelled', 'failed', 'completed'].includes(String(statusRef.value || '').trim().toLowerCase())
    ) {
      buttons.push(markPickupPaymentPaidButton(report, paymentStatusRef));
    }

    return buttons;
  },
  access: shopAccess('shop.orders.view'),
});

export const shopOrdersCollection = (defaultQuery: Record<string, any> = {}) => () => $COL({
  objectType: getServicePath(),
}, {
  report: shopOrdersReport(),
  trigger: trigger(defaultQuery),
  access: shopAccess('shop.orders.view'),
});
