import { resolveIdToImage, resolveImageToId, makeConstantOptions, formatMoney } from '@bookmame/web-utils'
import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, Api, AppManager } from 'vuetify-extended'
import { shopAccess } from '../../misc/access'

function servicePath(shopId: string, productId: string) {
  return `shops/${shopId}/products/${productId}/variants`
}

async function fetchDeliveryClassOptions(shopId: string) {
  const shop = await Api.instance.service('shops').get(shopId) as any
  const items = Array.isArray(shop?.supportedDeliveryClasses) ? shop.supportedDeliveryClasses : []
  return items.map((item: any) => ({
    id: item.id,
    name: item.name || item.code || item.id,
  }))
}

function variantAttributesField(storage = 'attributes', label = 'Variant Attributes') {
  return $FD({ label, storage, type: 'collection', cols: 12, hint: 'Use this for structured variant-specific details such as color, size, storage, or pack size.' }, {
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

export const shopProductVariantsReport = (shopId: string, productId: string) => $RP({
  title: 'Product Variant',
  objectType: servicePath(shopId, productId),
}, {
  form: () => $FM({
    title: 'Product Variant',
  }, {
    children: () => [
      $PT({}, {
        children: () => [
          $FD({ label: 'Name', type: 'text', storage: 'name', required: true }),
          $FD({ label: 'Slug', type: 'text', storage: 'slug', required: true }),
          $FD({ label: 'SKU', type: 'text', storage: 'sku' }),
          $FD({ label: 'Status', type: 'select', storage: 'status' }, {
            selectOptions: makeConstantOptions('shop-product-variant-statuses'),
          }),
          $FD({ label: 'Enabled', type: 'boolean', storage: 'enabled' }),
          $FD({ label: 'Available', type: 'boolean', storage: 'isAvailable' }),
          $FD({ label: 'Variant Price Amount', type: 'integer', storage: 'priceAmount', required: true, hint: 'Minor unit amount.' }),
          $FD({ label: 'Delivery Class', type: 'select', storage: 'deliveryClassId', hint: 'Optional override. Leave blank to inherit the base product delivery metadata.' }, {
            selectOptions: async () => fetchDeliveryClassOptions(shopId),
          }),
          $FD({ label: 'Weight (grams)', type: 'integer', storage: 'weightGrams' }),
          $FD({ label: 'Length (cm)', type: 'integer', storage: 'lengthCm' }),
          $FD({ label: 'Width (cm)', type: 'integer', storage: 'widthCm' }),
          $FD({ label: 'Height (cm)', type: 'integer', storage: 'heightCm' }),
          $FD({ label: 'Declared Value Amount', type: 'integer', storage: 'declaredValueAmount', hint: 'Optional. Collected now for future insurance-related flows.' }),
          $FD({ label: 'Inventory Quantity', type: 'integer', storage: 'inventoryQuantity' }),
          $FD({ label: 'Sort Order', type: 'integer', storage: 'sortOrder' }),
          $FD({ label: 'Variant Image', type: 'image', storage: 'image' }),
          variantAttributesField(),
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
    saved: async (form) => {
      form.$master!.$temporary = ['image']
      await resolveImageToId({
        imageField: 'image',
        idField: 'imageAssetId',
        cacheField: 'imageCache',
        meta: {
          purpose: 'shop-product-variant-image',
          isPublic: true,
        },
      })(form)
    },
  }),
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
  access: shopAccess('shop.catalog.view'),
})

export const shopProductVariantsCollection = (shopId: string, productId: string) => $COL({
  objectType: servicePath(shopId, productId),
}, {
  trigger: () => $TG({
    title: 'Product Variants',
    selectFields: ['name', 'slug', 'sku', 'priceAmount', 'product.currency', 'inventoryQuantity', 'status', 'enabled', 'isAvailable', 'sortOrder', 'createdAt', 'id'],
    headers: [
      { title: 'Name', value: 'name' },
      { title: 'Slug', value: 'slug' },
      { title: 'SKU', value: 'sku' },
      { title: 'Price', value: 'priceAmount' },
      { title: 'Currency', value: 'product.currency' },
      { title: 'Inventory', value: 'inventoryQuantity' },
      { title: 'Status', value: 'status' },
      { title: 'Enabled', value: 'enabled' },
      { title: 'Available', value: 'isAvailable' },
      { title: 'Sort Order', value: 'sortOrder' },
      { title: 'Created', value: 'createdAt' },
    ],
    sideButtonWidth: 180,
  }, {
    format(_, items) {
      for (const item of items) {
        item.priceAmount = formatMoney(item.priceAmount, item.product?.currency)
      }
      return items
    },
    sideButtons: (props, context, trigger) => trigger.$params.mode === 'edit' ? [
      $BN({ text: 'Add Variant', icon: 'mdi-plus', color: 'success' }, {
        onClicked() {
          const report = shopProductVariantsReport(shopId, productId)
          report.$params.mode = 'create'
          AppManager.showReport(report)
        },
      }),
    ] : [],
  }),
  report: () => shopProductVariantsReport(shopId, productId),
  access: shopAccess('shop.catalog.view'),
})
