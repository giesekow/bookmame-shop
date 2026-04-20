import { makeConstantOptions, resolveIdToImage, resolveImageToId } from '@bookmame/web-utils'
import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, AppManager } from 'vuetify-extended'
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

function servicePath() {
  return `shops/${getShopId()}/categories`
}

const trigger = () => $TG({
  title: 'Catalog Categories',
  selectFields: ['name', 'slug', 'status', 'enabled', 'sortOrder', 'createdAt', 'id'],
  headers: [
    { title: 'Name', value: 'name' },
    { title: 'Slug', value: 'slug' },
    { title: 'Status', value: 'status' },
    { title: 'Enabled', value: 'enabled' },
    { title: 'Sort Order', value: 'sortOrder' },
    { title: 'Created', value: 'createdAt' },
  ],
  sideButtonWidth: 180,
}, {
  sideButtons: (props, context, trigger) => trigger.$params.mode === 'edit' ? [
    $BN({ text: 'Add Category', icon: 'mdi-plus', color: 'success' }, {
      onClicked() {
        const report = shopCategoriesReport()
        report.$params.mode = 'create'
        AppManager.showReport(report)
      },
    }),
  ] : [],
})

const createForm = () => $FM({
  title: 'Catalog Category',
}, {
  children: () => [
    $PT({}, {
      children: () => [
        $FD({ label: 'Name', type: 'text', storage: 'name', required: true }),
        $FD({ label: 'Slug', type: 'text', storage: 'slug', required: true }),
        $FD({ label: 'Status', type: 'select', storage: 'status' }, {
          selectOptions: makeConstantOptions('shop-category-statuses'),
        }),
        $FD({ label: 'Enabled', type: 'boolean', storage: 'enabled' }),
        $FD({ label: 'Sort Order', type: 'integer', storage: 'sortOrder' }),
        $FD({ label: 'Image', type: 'image', storage: 'image' }),
      ],
    }),
  ],
  bottomChildren: () => [
    $PT({}, {
      children: () => [
        $FD({ label: 'Description', type: 'textarea', storage: 'description' }),
      ],
    }),
  ],
})

export const shopCategoriesReport = () => $RP({
  title: 'Catalog Category',
  objectType: servicePath(),
}, {
  form: createForm,
  setup(report) {
    report.$master!.$temporary = ['image']
    void resolveIdToImage({
      imageField: 'image',
      idField: 'imageAssetId',
      cacheField: 'imageCache',
    })(report)
  },
  loaded(report) {
    report.$master!.$temporary = ['image']
    void resolveIdToImage({
      imageField: 'image',
      idField: 'imageAssetId',
      cacheField: 'imageCache',
    })(report)
  },
  saved: async (report) => {
    report.$master!.$temporary = ['image']
    await resolveImageToId({
      imageField: 'image',
      idField: 'imageAssetId',
      cacheField: 'imageCache',
      meta: {
        purpose: 'shop-category-image',
        isPublic: true,
      },
    })(report)
  },
  access: shopAccess('shop.catalog.view'),
})

export const shopCategoriesCollection = () => $COL({
  objectType: servicePath(),
}, {
  report: shopCategoriesReport,
  trigger,
  access: shopAccess('shop.catalog.view'),
})

export const shopCategoriesMenu = () => makeCollectionMenu({
  title: 'Categories',
  collection: shopCategoriesCollection,
  access: shopAccess('shop.catalog.view'),
})
