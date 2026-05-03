import { $COL, $FD, $FM, $PT, $RP, $TG, Api, Field, Part } from 'vuetify-extended'
import { makeConstantOptions } from '@bookmame/web-utils'
import { shopAccess } from '../../misc/access'
import { makeCollectionMenu } from '../../misc/menu'
import { useAppStore } from '../../store/app'

function getShopId() {
  const shopId = useAppStore().shop?.id
  if (!shopId) {
    throw new Error('No active shop is selected.')
  }
  return shopId
}

function getServicePath() {
  return `shops/${getShopId()}/delivery-partners`
}

async function deliveryCompanyOptions() {
  const response = await Api.instance.service(`shops/${getShopId()}/available-delivery-companies`).find({
    query: {
      $paginate: false,
      $select: ['id', 'name'],
    },
  }) as any

  const items = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : [])
  return items.map((item: any) => ({
    id: item.id,
    name: item.name,
  }))
}

const trigger = () => $TG({
  title: 'Delivery Partners',
  selectFields: ['deliveryCompany.name', 'status', 'priorityRank', 'id'],
  headers: [
    { title: 'Delivery Company', value: 'deliveryCompany.name' },
    { title: 'Status', value: 'status' },
    { title: 'Priority', value: 'priorityRank' },
  ],
}, {})

const createForm = () => {
  const fields: (Field | Part)[] = [
    $FD({ label: 'Delivery Company', type: 'select', storage: 'deliveryCompanyId', required: true, hint: 'Only active and approved delivery companies are shown here.' }, {
      selectOptions: deliveryCompanyOptions,
    }),
    $FD({ label: 'Status', type: 'select', storage: 'status' }, {
      selectOptions: makeConstantOptions('delivery-partner-statuses'),
    }),
    $FD({ label: 'Priority Rank', type: 'integer', storage: 'priorityRank', hint: 'Lower values are preferred first when multiple delivery partners are eligible.' }),
  ]

  return $FM({
    title: 'Manage shop delivery partners',
  }, {
    children: () => [
      $PT({}, {
        children: () => fields,
      }),
    ],
    access: shopAccess('shop.delivery_partners.manage'),
  })
}

const report = () => $RP({
  title: 'Delivery Partner',
}, {
  form: createForm,
  access: shopAccess('shop.delivery_partners.manage'),
})

const collection = () => $COL({
  objectType: getServicePath(),
}, {
  report,
  trigger,
  access: shopAccess('shop.delivery_partners.manage'),
})

export const shopDeliveryPartnersCollection = collection

export const shopDeliveryPartnersMenu = () => makeCollectionMenu({
  title: 'Delivery Partners',
  collection,
  access: shopAccess('shop.delivery_partners.manage'),
})
