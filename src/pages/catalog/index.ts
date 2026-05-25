import { makeConstantOptions, resolveIdToImage, resolveImageToId } from '@bookmame/web-utils'
import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, Api, AppManager, Field, Part } from 'vuetify-extended'
import { shopAccess } from '../../misc/access'
import { makeCollectionMenu } from '../../misc/menu'
import { useAppStore } from '../../store/app'
import { shopCategoriesCollection } from '../categories'
import { shopProductImagesCollection } from '../product-images'
import { shopProductVariantsCollection } from '../product-variants'

function productAttributesField(storage = 'attributes', label = 'Product Attributes') {
  return $FD({ label, storage, type: 'collection', cols: 12, hint: 'Structured label and value rows shown to customers before the description section.' }, {
    headers() {
      return [
        { title: 'Label', value: 'label' },
        { title: 'Value', value: 'value' },
        { title: 'Sort Order', value: 'sortOrder' },
      ]
    },
    form() {
      return $FM({}, {
        children: () => [
          $PT({}, {
            children: () => [
              $FD({ label: 'Label', storage: 'label', type: 'text', required: true }),
              $FD({ label: 'Value', storage: 'value', type: 'text', required: true }),
              $FD({ label: 'Sort Order', storage: 'sortOrder', type: 'integer' }),
            ],
          }),
        ],
      })
    },
  })
}

function getShopId() {
  const shopId = useAppStore().shop?.id
  if (!shopId) {
    throw new Error('No active shop is selected.')
  }
  return shopId
}

function getServicePath() {
  return `shops/${getShopId()}/products`
}

async function fetchCategoryOptions() {
  const response = await Api.instance.service(`shops/${getShopId()}/categories`).find({
    query: {
      $paginate: false,
      $sort: { sortOrder: 1, name: 1 },
    },
  }) as any[]

  const items = Array.isArray(response) ? response : []
  return items.map((item) => ({
    id: item.id,
    name: item.name,
  }))
}

async function fetchDeliveryPartnerOptions() {
  const response = await Api.instance.service(`shops/${getShopId()}/delivery-partners`).find({
    query: {
      $paginate: false,
      $sort: { priorityRank: 1, createdAt: 1 },
    },
  }) as any

  const items = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : [])
  return items
    .filter((item: any) => item?.deliveryCompanyId)
    .map((item: any) => ({
      id: item.deliveryCompanyId,
      name: item.deliveryCompany?.name || item.deliveryCompanyId,
    }))
}

const trigger = () => $TG({
  title: 'Catalog Products',
  selectFields: ['name', 'categoryLabel', 'priceAmount', 'currency', 'inventoryQuantity', 'status', 'enabled', 'isAvailable', 'createdAt', 'id'],
  headers: [
    { title: 'Name', value: 'name' },
    { title: 'Category', value: 'categoryLabel' },
    { title: 'Price', value: 'priceAmount' },
    { title: 'Currency', value: 'currency' },
    { title: 'Inventory', value: 'inventoryQuantity' },
    { title: 'Status', value: 'status' },
    { title: 'Enabled', value: 'enabled' },
    { title: 'Available', value: 'isAvailable' },
    { title: 'Created', value: 'createdAt' },
  ],
})

const createForm = () => {
  const fields: (Field | Part)[] = [
    $FD({ label: 'Name', type: 'text', storage: 'name', required: true }),
    $FD({ label: 'Slug', type: 'text', storage: 'slug', required: true }),
    $FD({ label: 'Category', type: 'select', storage: 'categoryId', hint: 'Assign the product to a managed catalog category.' }, {
      selectOptions: async () => fetchCategoryOptions(),
    }),
    $FD({ label: 'Legacy Category Label', type: 'text', storage: 'categoryLabel', hint: 'Optional fallback label when no category record is selected.' }),
    $FD({ label: 'SKU', type: 'text', storage: 'sku' }),
    $FD({ label: 'Price Amount', type: 'integer', storage: 'priceAmount', required: true, hint: 'Minor unit amount.' }),
    $FD({ label: 'Currency', type: 'select', storage: 'currency', required: true }, {
      selectOptions: makeConstantOptions('currencies'),
      default: () => useAppStore().shop?.defaultCurrencyCode,
    }),
    $FD({ label: 'Inventory Quantity', type: 'integer', storage: 'inventoryQuantity' }),
    $FD({ label: 'Applicable Delivery Partners', type: 'select', storage: 'applicableDeliveryCompanyIds', multiple: true, cols: 12, hint: 'Leave empty to inherit all active shop delivery partners. Select specific partners only when a product needs delivery restrictions.' }, {
      selectOptions: async () => fetchDeliveryPartnerOptions(),
    }),
    $FD({ label: 'Sort Order', type: 'integer', storage: 'sortOrder' }),
    $FD({ label: 'Status', type: 'select', storage: 'status' }, {
      selectOptions: makeConstantOptions('shop-product-statuses'),
    }),
    $FD({ label: 'Enabled', type: 'boolean', storage: 'enabled' }),
    $FD({ label: 'Available', type: 'boolean', storage: 'isAvailable' }),
    $FD({ label: 'Primary Image', type: 'image', storage: 'image' }),
    productAttributesField(),
  ]

  return $FM({
    title: 'Catalog Product',
  }, {
    children: () => [
      $PT({}, {
        children: () => fields,
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
}

export const shopCatalogReport = () => $RP({
  title: 'Catalog Product',
  objectType: getServicePath(),
  sideButtonWidth: 280,
}, {
  form: createForm,
  setup(report) {
    report.$master!.$temporary = ['image']
    resolveIdToImage({
      imageField: 'image',
      idField: 'imageAssetId',
      cacheField: 'imageCache',
    })(report)
  },
  loaded(report) {
    report.$master!.$temporary = ['image']
    resolveIdToImage({
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
        purpose: 'shop-product-image',
        isPublic: true,
      },
    })(report)
  },
  sideButtons: (_props, _context, report) => {
    if (report.$params.mode === 'create') {
      return [
        $BN({ text: 'Manage Categories', icon: 'mdi-shape-outline', color: 'secondary' }, {
          onClicked() {
            AppManager.showCollection(shopCategoriesCollection())
          },
        }),
      ]
    }

    const productId = report.$master?.$get('id')
    const shopId = useAppStore().shop?.id
    if (!productId || !shopId) {
      return []
    }

    return [
      $BN({ text: 'Manage Categories', icon: 'mdi-shape-outline', color: 'secondary' }, {
        onClicked() {
          const coll = shopCategoriesCollection()
          coll.$params.mode = report.$params.mode
          AppManager.showCollection(coll)
        },
      }),
      $BN({ text: 'Manage Gallery', icon: 'mdi-image-multiple-outline', color: 'info' }, {
        onClicked() {
          const coll = shopProductImagesCollection(String(shopId), String(productId))
          coll.$params.mode = report.$params.mode
          AppManager.showCollection(coll)
        },
      }),
      $BN({ text: 'Manage Variants', icon: 'mdi-format-list-bulleted-square', color: 'primary' }, {
        onClicked() {
          const coll = shopProductVariantsCollection(String(shopId), String(productId))
          coll.$params.mode = report.$params.mode
          AppManager.showCollection(coll)
        },
      }),
    ]
  },
  access: shopAccess('shop.catalog.view'),
})

export const shopCatalogCollection = () => $COL({
  objectType: getServicePath(),
}, {
  report: shopCatalogReport,
  trigger,
  access: shopAccess('shop.catalog.view'),
})

export const shopCatalogMenu = () => makeCollectionMenu({
  title: 'Catalog',
  collection: shopCatalogCollection,
  accessCreate: shopAccess('shop.catalog.manage'),
  accessEdit: shopAccess('shop.catalog.manage'),
  accessDisplay: shopAccess('shop.catalog.view'),
  access: shopAccess('shop.catalog.view'),
})
