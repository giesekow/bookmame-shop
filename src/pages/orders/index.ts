import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, Api, Button, DialogForm, Dialogs, Report } from 'vuetify-extended';
import { ref, Ref } from 'vue';
import { shopAccess } from '../../misc/access';
import { useAppStore } from '../../store/app';

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

function renderOrderHtml(order: any) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const itemsHtml = items.length
    ? items.map((item: any) => `
      <div style="padding:12px 0; border-bottom:1px solid #e7ece2;">
        <div style="display:flex; justify-content:space-between; gap:12px;">
          <div>
            <div style="font-weight:700; color:#183022;">${escapeHtml(item.quantity)}x ${escapeHtml(item.productName)}</div>
            ${item.variantName ? `<div style="margin-top:4px; color:#5d7063; font-size:13px;">Variant: ${escapeHtml(item.variantName)}</div>` : ''}
            ${item.categoryLabel ? `<div style="margin-top:4px; color:#5d7063; font-size:13px;">${escapeHtml(item.categoryLabel)}</div>` : ''}
            ${item.notes ? `<div style="margin-top:4px; color:#6d5b46; font-size:12px;">Note: ${escapeHtml(item.notes)}</div>` : ''}
          </div>
          <div style="font-weight:700; color:#183022; white-space:nowrap;">${escapeHtml(money(item.lineTotalAmount, item.currency || order?.currency))}</div>
        </div>
      </div>
    `).join('')
    : '<div style="padding:12px 0; color:#5d7063;">No items were returned for this order.</div>';

  return `
    <div style="font-family:inherit; color:#183022; background:#f8fcf6; border:1px solid #dbead4; border-radius:18px; padding:18px;">
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-bottom:18px;">
        <div style="background:#fff; border:1px solid #dbead4; border-radius:14px; padding:14px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70; margin-bottom:8px;">Order</div>
          <div style="font-weight:800; font-size:20px;">${escapeHtml(order?.orderNumber || 'Order')}</div>
          <div style="margin-top:4px; color:#5d7063;">Placed ${escapeHtml(dateTime(order?.placedAt))}</div>
        </div>
        <div style="background:#fff; border:1px solid #dbead4; border-radius:14px; padding:14px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70; margin-bottom:8px;">Customer</div>
          <div style="font-weight:700;">${escapeHtml(order?.customerDisplayName || order?.customerAccountId || 'Unknown customer')}</div>
          ${order?.customerEmail ? `<div style="margin-top:4px; color:#5d7063;">${escapeHtml(order.customerEmail)}</div>` : ''}
          ${order?.customerPhoneNumber ? `<div style="margin-top:4px; color:#5d7063;">${escapeHtml(order.customerPhoneNumber)}</div>` : ''}
        </div>
        <div style="background:#fff; border:1px solid #dbead4; border-radius:14px; padding:14px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70; margin-bottom:8px;">Payment</div>
          <div style="font-weight:700;">${escapeHtml(money(order?.totalAmount, order?.currency))}</div>
          <div style="margin-top:4px; color:#5d7063;">Method: ${escapeHtml(String(order?.paymentMethod || 'n/a').replace(/_/g, ' '))}</div>
          <div style="margin-top:4px; color:#5d7063;">Payment status: ${escapeHtml(String(order?.paymentStatus || 'pending').replace(/_/g, ' '))}</div>
        </div>
        <div style="background:#fff; border:1px solid #dbead4; border-radius:14px; padding:14px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70; margin-bottom:8px;">Status</div>
          <div style="font-weight:700;">${escapeHtml(String(order?.orderStatus || 'placed').replace(/_/g, ' '))}</div>
          ${order?.cancellationReason ? `<div style="margin-top:6px; color:#7a3f38; font-size:12px;">Cancel: ${escapeHtml(order.cancellationReason)}</div>` : ''}
          ${order?.failedReason ? `<div style="margin-top:6px; color:#7a3f38; font-size:12px;">Failure: ${escapeHtml(order.failedReason)}</div>` : ''}
        </div>
      </div>

      ${order?.notes ? `
        <div style="margin-bottom:18px; padding:14px; border-radius:14px; background:#fff; border:1px solid #dbead4;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70; margin-bottom:8px;">Notes</div>
          <div style="color:#5d7063; white-space:pre-wrap;">${escapeHtml(order.notes)}</div>
        </div>
      ` : ''}

      <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70; margin-bottom:8px;">Items</div>
      <div style="background:#fff; border:1px solid #dbead4; border-radius:14px; padding:0 14px;">
        ${itemsHtml}
      </div>
    </div>
  `;
}

async function refreshReport(report: Report) {
  await report.$master?.$load();
  report.$master?.$set('orderDetails', renderOrderHtml(report.$master?.$data || {}));
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

function acceptButton(report: Report, statusRef: Ref<any>) {
  return $BN({ text: 'Accept', color: 'success' }, {
    onClicked: async (button) => {
      try {
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

function completeButton(report: Report, statusRef: Ref<any>, paymentStatusRef: Ref<any>) {
  return $BN({ text: 'Complete', color: 'secondary' }, {
    onClicked: async (button) => {
      try {
        await patchOrder(String(button.$master?.$get('id') || ''), {
          orderStatus: 'completed',
          paymentStatus: paymentStatusRef.value === 'paid' ? 'paid' : 'pending',
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

      dialog.show();
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

      dialog.show();
    },
  });
}

const trigger = () => $TG({
  title: 'Orders',
  selectFields: ['orderNumber', 'customerDisplayName', 'totalAmount', 'currency', 'paymentStatus', 'orderStatus', 'placedAt'],
  headers: [
    { title: 'Order', value: 'orderNumber' },
    { title: 'Customer', value: 'customerDisplayName' },
    { title: 'Total', value: 'totalAmount' },
    { title: 'Currency', value: 'currency' },
    { title: 'Payment', value: 'paymentStatus' },
    { title: 'Status', value: 'orderStatus' },
    { title: 'Placed', value: 'placedAt' },
  ],
}, {});

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
  sideButtonWidth: 220,
  ...(orderId ? { objectId: orderId, objectType: getServicePath() } : {}),
}, {
  form: createForm,
  loaded: async (report) => {
    if (report.$master?.$get('id')) {
      await refreshReport(report);
    }
  },
  sideButtons: (_props, _ctx, report) => {
    const statusRef: Ref<any> = ref(report.$master?.$get('orderStatus'));
    const paymentStatusRef: Ref<any> = ref(report.$master?.$get('paymentStatus'));
    const buttons: Button[] = [];

    if (statusRef.value === 'placed') {
      buttons.push(acceptButton(report, statusRef));
    }

    if (['accepted'].includes(String(statusRef.value || ''))) {
      buttons.push(readyButton(report, statusRef));
    }

    if (['accepted', 'ready_for_pickup'].includes(String(statusRef.value || ''))) {
      buttons.push(cancelButton(report, statusRef));
      buttons.push(failButton(report, statusRef));
    }

    if (statusRef.value === 'ready_for_pickup') {
      buttons.push(completeButton(report, statusRef, paymentStatusRef));
    }

    return buttons;
  },
  access: shopAccess('shop.orders.view'),
});

export const shopOrdersCollection = () => $COL({
  objectType: getServicePath(),
}, {
  report: shopOrdersReport(),
  trigger,
  access: shopAccess('shop.orders.view'),
});
