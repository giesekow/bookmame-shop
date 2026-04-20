import { $FD, $FM, $PT, $RP } from 'vuetify-extended';
import { useAppStore } from '../../store/app';

function renderFinancePlaceholder() {
  const currency = useAppStore().shop?.defaultCurrencyCode || 'Not set';

  return `
    <div style="display:grid; gap:16px; font-family:inherit;">
      <section style="background:#fff; border:1px solid #dbead4; border-radius:20px; padding:20px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70;">Finance</div>
        <div style="margin-top:8px; font-size:24px; font-weight:800; color:#183022;">Finance scaffold is ready</div>
        <div style="margin-top:8px; font-size:15px; color:#5d7063;">The app now has a finance landing point. Once shop orders exist, we can plug this into the shared ledger and payout flow the same way we did for hotels.</div>
      </section>
      <section style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px;">
        <div style="background:#fff; border:1px solid #dbead4; border-radius:18px; padding:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70;">Settlement Currency</div>
          <div style="margin-top:8px; font-size:18px; font-weight:800; color:#183022;">${currency}</div>
        </div>
        <div style="background:#fff; border:1px solid #dbead4; border-radius:18px; padding:18px;">
          <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#6a7f70;">Recommended integration</div>
          <div style="margin-top:8px; font-size:15px; color:#183022;">Reuse the generic sourceType/sourceId settlement ledger model.</div>
        </div>
      </section>
    </div>
  `;
}

export const shopFinanceSummaryReport = () => $RP({ title: 'Finance Summary' }, {
  form: () => $FM({ title: 'Finance Summary', width: 1080 }, {
    children: () => [
      $PT({}, {
        children: () => [
          $FD({
            label: 'Finance',
            storage: 'financeView',
            type: 'htmlview',
            readonly: true,
            cols: 12,
            minHeight: 460,
          }, {
            default() {
              return renderFinancePlaceholder();
            },
          }),
        ],
      }),
    ],
    setup(form) {
      form.$master?.$set('financeView', renderFinancePlaceholder());
    },
  }),
});
