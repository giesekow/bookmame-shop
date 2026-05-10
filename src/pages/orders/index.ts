import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, Api, AppManager, Button, DialogForm, Dialogs, Report } from 'vuetify-extended';
import { ref, Ref } from 'vue';
import { shopAccess } from '../../misc/access';
import { useAppStore } from '../../store/app';
import { printReceipt, downloadReceiptPdf } from '../../misc/print-receipt';
import { printOrderLabel } from '../../misc/order-label';

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

function renderAttributeSummary(baseValue: unknown, variantValue: unknown) {
  const pairs = mergeAttributes(baseValue, variantValue);
  if (!pairs.length) {
    return '';
  }

  return `
    <div style="width:100%; box-sizing:border-box; margin-top:8px; padding:10px 12px; border-radius:14px; background:#f5f8f3; border:1px solid #dbead4;">
      <div style="font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#6a7f70; margin-bottom:8px;">Attributes</div>
      <div style="display:grid; gap:8px;">
        ${pairs.map((pair) => `
          <div style="padding-top:8px; border-top:1px solid rgba(106,127,112,0.18);">
            <div style="font-size:11px; letter-spacing:.05em; text-transform:uppercase; font-weight:700; color:#6a7f70; margin-bottom:4px;">${escapeHtml(pair.label)}</div>
            <div style="font-size:13px; font-weight:700; color:#183022; word-break:break-word;">${escapeHtml(pair.value)}</div>
          </div>
        `).join('').replace('border-top:1px solid rgba(106,127,112,0.18);', 'border-top:0;')}
      </div>
    </div>
  `;
}

function canShopCollectPayment(order: any) {
  const fulfillmentMethod = String(order?.fulfillmentMethod || '').trim().toLowerCase();
  const paymentMethod = String(order?.paymentMethod || '').trim().toLowerCase();
  return fulfillmentMethod === 'customer_pickup' && ['cash_on_pickup', 'card_on_pickup'].includes(paymentMethod);
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

function renderOrderHtml(order: any) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const settlements = Array.isArray(order?.settlements) ? order.settlements : [];
  const itemsHtml = items.length
    ? items.map((item: any) => `
      <div style="padding:12px 0; border-bottom:1px solid #e7ece2;">
        <div style="display:flex; justify-content:space-between; gap:12px;">
          <div style="flex:1 1 auto; min-width:0;">
            <div style="font-weight:700; color:#183022;">${escapeHtml(item.quantity)}x ${escapeHtml(item.productName)}</div>
          </div>
          <div style="font-weight:700; color:#183022; white-space:nowrap;">${escapeHtml(money(item.lineTotalAmount, item.currency || order?.currency))}</div>
        </div>
        <div style="display:flex; justify-content:space-between; gap:12px;">
          <div style="flex:1 1 auto; min-width:0;">
            ${item.variantName ? `<div style="margin-top:4px; color:#5d7063; font-size:13px;">Variant: ${escapeHtml(item.variantName)}</div>` : ''}
            ${item.variantSku ? `<div style="margin-top:4px; color:#5d7063; font-size:13px;">Variant SKU: ${escapeHtml(item.variantSku)}</div>` : ''}
            ${item.categoryLabel ? `<div style="margin-top:4px; color:#5d7063; font-size:13px;">${escapeHtml(item.categoryLabel)}</div>` : ''}
            ${renderAttributeSummary(item.productAttributesSnapshot, item.variantAttributesSnapshot)}
            ${item.notes ? `<div style="margin-top:4px; color:#6d5b46; font-size:12px;">Note: ${escapeHtml(item.notes)}</div>` : ''}
          </div>
        </div>
      </div>
    `).join('')
    : '<div style="padding:12px 0; color:#5d7063;">No items were returned for this order.</div>';

  const settlementsHtml = settlements.length
    ? settlements.map((settlement: any) => `
      <div style="padding:12px 14px; border:1px solid #dbead4; border-radius:12px; background:#fff;">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:10px;">
          <div>
            <div style="font-weight:800; color:#183022;">${escapeHtml(shopSettlementBeneficiaryLabel(order, settlement))}</div>
            <div style="margin-top:4px; color:#6a7f70; font-size:12px; text-transform:uppercase; letter-spacing:.05em;">${escapeHtml(shopSettlementBeneficiaryMeta(order, settlement))}</div>
            <div style="margin-top:4px; color:#5d7063; font-size:13px;">Status: ${escapeHtml(String(settlement?.status || 'n/a').replace(/_/g, ' '))}</div>
            <div style="margin-top:4px; color:#5d7063; font-size:13px;">Eligible: ${escapeHtml(dateTime(settlement?.eligibleAt))}</div>
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:10px; flex:1 1 360px;">
            <div><div style="font-size:11px; color:#6a7f70; text-transform:uppercase;">Gross</div><div style="font-weight:700; color:#183022;">${escapeHtml(money(settlement?.grossAmount, settlement?.currency || order?.currency))}</div></div>
            <div><div style="font-size:11px; color:#6a7f70; text-transform:uppercase;">Fee</div><div style="font-weight:700; color:#183022;">${escapeHtml(money(settlement?.feeAmount, settlement?.currency || order?.currency))}</div></div>
            <div><div style="font-size:11px; color:#6a7f70; text-transform:uppercase;">Net</div><div style="font-weight:700; color:#183022;">${escapeHtml(money(settlement?.netAmount, settlement?.currency || order?.currency))}</div></div>
            <div><div style="font-size:11px; color:#6a7f70; text-transform:uppercase;">Direct</div><div style="font-weight:700; color:#183022;">${escapeHtml(money(settlement?.directCollectedAmount, settlement?.currency || order?.currency))}</div></div>
            <div><div style="font-size:11px; color:#6a7f70; text-transform:uppercase;">Payable</div><div style="font-weight:700; color:#183022;">${escapeHtml(money(settlement?.outstandingPayableAmount, settlement?.currency || order?.currency))}</div></div>
            <div><div style="font-size:11px; color:#6a7f70; text-transform:uppercase;">Remittance</div><div style="font-weight:700; color:#183022;">${escapeHtml(money(settlement?.outstandingRemittanceAmount, settlement?.currency || order?.currency))}</div></div>
          </div>
        </div>
      </div>
    `).join('')
    : '<div style="padding:12px 0; color:#5d7063;">No settlement ledger rows are available for this order yet.</div>'

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
          ${order?.pickupHandoffStatus ? `<div style="margin-top:4px; color:#5d7063;">Pickup handoff: ${escapeHtml(String(order.pickupHandoffStatus || 'not_requested').replace(/_/g, ' '))}</div>` : ''}
          ${order?.deliveryConfirmationStatus ? `<div style="margin-top:4px; color:#5d7063;">Delivery confirmation: ${escapeHtml(String(order.deliveryConfirmationStatus || 'not_requested').replace(/_/g, ' '))}</div>` : ''}
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

      <div style="margin-top:18px; font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70; margin-bottom:8px;">Finance</div>
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
      'paymentMethod',
      'paymentStatus',
      'orderStatus',
      'customerAccountId',
      'customerDisplayName',
      'customerEmail',
      'customerPhoneNumber',
      'fulfillmentMethod',
      'deliveryStatus',
      'notes',
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

function notesDialog(title: string, initialNotes: string, onSubmit: (notes: string) => Promise<void>) {
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
                  : 'Internal operational notes for this shop order.',
              }),
            ],
          }),
        ],
        saved: async (form) => {
          await onSubmit(String(form.$master?.$get('notes') || '').trim());
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
          'Generate a rider pickup PIN and notify the assigned rider?',
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
                  $FD({ label: 'Rider PIN', storage: 'confirmationCode', type: 'text', required: true }),
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

function completeButton(report: Report, statusRef: Ref<any>, paymentStatusRef: Ref<any>) {
  return $BN({ text: 'Complete', color: 'secondary' }, {
    onClicked: async (button) => {
      const orderId = String(button.$master?.$get('id') || '');
      const pickupConfirmationCode = button.$master?.$get('pickupConfirmationCode');

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
                    paymentStatus: paymentStatusRef.value === 'paid' ? 'paid' : 'pending',
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

function markPickupPaymentPaidButton(report: Report, paymentStatusRef: Ref<any>) {
  return $BN({ text: 'Mark Payment Paid', color: 'success' }, {
    onClicked: async (button) => {
      const confirmed = await Dialogs.$confirm(
        'Confirm that the customer has paid for this pickup order?',
        'Mark payment paid',
      );
      if (!confirmed) {
        return;
      }

      try {
        await patchOrder(String(button.$master?.$get('id') || ''), { paymentStatus: 'paid' });
        paymentStatusRef.value = 'paid';
        await refreshReport(report);
        Dialogs.$success('Payment marked as paid.');
      } catch (error: any) {
        Dialogs.$error(error?.message || 'Failed to update payment status.');
      }
    },
  });
}

function updateNotesButton(report: Report) {
  return $BN({ text: 'Update Notes', color: 'info' }, {
    onClicked: async (button) => {
      const dialog = notesDialog(
        'Update Order Notes',
        String(button.$master?.$get('notes') || ''),
        async (notes) => {
          try {
            await patchOrder(String(button.$master?.$get('id') || ''), { notes });
            await refreshReport(report);
            Dialogs.$success('Order notes updated.');
          } catch (error: any) {
            Dialogs.$error(error?.message || 'Failed to update notes.');
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
  sideButtonWidth: 220,
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
    const pickupHandoffStatusRef: Ref<any> = ref(report.$master?.$get('pickupHandoffStatus'));
    const orderData = report.$master?.$data || {};
    const buttons: Button[] = [];

    buttons.push(refreshButton(report));
    buttons.push(updateNotesButton(report));
    buttons.push(printLabelButton());

    if (paymentStatusRef.value === 'paid') {
      buttons.push(printReceiptButton());
      buttons.push(downloadReceiptPdfButton());
    }

    if (statusRef.value === 'placed') {
      buttons.push(acceptButton(report, statusRef));
    }

    if (['accepted'].includes(String(statusRef.value || ''))) {
      buttons.push(readyButton(report, statusRef));
    }

    if (
      String(orderData.fulfillmentMethod || '').trim().toLowerCase() === 'delivery' &&
      String(statusRef.value || '').trim().toLowerCase() === 'ready_for_pickup'
    ) {
      if (String(pickupHandoffStatusRef.value || 'not_requested').trim().toLowerCase() === 'not_requested') {
        buttons.push(requestPickupHandoffButton(report, pickupHandoffStatusRef));
      }
      if (String(pickupHandoffStatusRef.value || '').trim().toLowerCase() === 'requested') {
        buttons.push(confirmPickupHandoffPinButton(report, pickupHandoffStatusRef));
      }
    }

    if (['placed', 'accepted', 'ready_for_pickup'].includes(String(statusRef.value || ''))) {
      buttons.push(cancelButton(report, statusRef));
      buttons.push(failButton(report, statusRef));
    }

    if (statusRef.value === 'ready_for_pickup' && String(orderData.fulfillmentMethod || '').trim().toLowerCase() === 'customer_pickup') {
      buttons.push(completeButton(report, statusRef, paymentStatusRef));
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
