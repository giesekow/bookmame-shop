import { $FD, $FM, $PT, $RP } from 'vuetify-extended';
import { useAppStore } from '../../store/app';

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderProfileCard() {
  const shop = useAppStore().shop;

  if (!shop) {
    return `
      <div style="padding:18px; border:1px solid #dbead4; border-radius:18px; background:#ffffff; color:#486055;">
        No shop is currently selected.
      </div>
    `;
  }

  const countries = Array.isArray(shop.countryOfOperationCodes) && shop.countryOfOperationCodes.length > 0
    ? shop.countryOfOperationCodes.join(', ')
    : 'Not configured';

  const address = [shop.addressLine1, shop.addressLine2, shop.landmark, shop.city]
    .filter((item) => String(item || '').trim().length > 0)
    .join(', ') || 'No address captured yet';

  return `
    <div style="display:grid; gap:16px; font-family:inherit;">
      <section style="background:#fff; border:1px solid #dbead4; border-radius:20px; padding:20px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70; margin-bottom:8px;">Merchant Profile</div>
        <div style="font-size:24px; font-weight:800; color:#183022;">${escapeHtml(shop.name)}</div>
        <div style="margin-top:6px; font-size:14px; color:#5d7063;">${escapeHtml(shop.description || 'No merchant description yet.')}</div>
      </section>
      <section style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px;">
        <div style="background:#fff; border:1px solid #dbead4; border-radius:18px; padding:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70;">Status</div>
          <div style="margin-top:8px; font-size:18px; font-weight:800; color:#183022;">${escapeHtml(shop.status || 'unknown')}</div>
        </div>
        <div style="background:#fff; border:1px solid #dbead4; border-radius:18px; padding:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70;">Approval</div>
          <div style="margin-top:8px; font-size:18px; font-weight:800; color:#183022;">${escapeHtml(shop.approvalStatus || 'pending')}</div>
        </div>
        <div style="background:#fff; border:1px solid #dbead4; border-radius:18px; padding:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70;">Default Currency</div>
          <div style="margin-top:8px; font-size:18px; font-weight:800; color:#183022;">${escapeHtml(shop.defaultCurrencyCode || 'Not set')}</div>
        </div>
        <div style="background:#fff; border:1px solid #dbead4; border-radius:18px; padding:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70;">Support Contact</div>
          <div style="margin-top:8px; font-size:16px; font-weight:700; color:#183022;">${escapeHtml(shop.supportPhoneNumber || shop.supportEmail || 'Not set')}</div>
        </div>
      </section>
      <section style="background:#fff; border:1px solid #dbead4; border-radius:18px; padding:18px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70;">Operating Countries</div>
        <div style="margin-top:8px; font-size:15px; color:#183022;">${escapeHtml(countries)}</div>
      </section>
      <section style="background:#fff; border:1px solid #dbead4; border-radius:18px; padding:18px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70;">Address</div>
        <div style="margin-top:8px; font-size:15px; color:#183022;">${escapeHtml(address)}</div>
      </section>
    </div>
  `;
}

export const shopProfileReport = () => $RP({ title: 'Shop Profile' }, {
  form: () => $FM({ title: 'Shop Profile', width: 1180 }, {
    children: () => [
      $PT({}, {
        children: () => [
          $FD({
            label: 'Profile',
            storage: 'profileView',
            type: 'htmlview',
            readonly: true,
            cols: 12,
            minHeight: 620,
          }, {
            default() {
              return renderProfileCard();
            },
          }),
        ],
      }),
    ],
    setup(form) {
      form.$master?.$set('profileView', renderProfileCard());
    },
  }),
});
