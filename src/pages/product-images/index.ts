import { resolveIdToImage, resolveImageToId } from '@bookmame/web-utils'
import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, AppManager } from 'vuetify-extended'
import { shopAccess } from '../../misc/access'

function servicePath(shopId: string, productId: string) {
  return `shops/${shopId}/products/${productId}/images`
}

export const shopProductImagesReport = (shopId: string, productId: string) => $RP({
  title: 'Product Gallery Image',
  objectType: servicePath(shopId, productId),
}, {
  form: () => $FM({
    title: 'Product Gallery Image',
  }, {
    children: () => [
      $PT({}, {
        children: () => [
          $FD({ label: 'Image', type: 'image', storage: 'image', required: true, cols: 12 }),
          $FD({ label: 'Caption', storage: 'caption', type: 'text', cols: 12 }),
          $FD({ label: 'Sort Order', storage: 'sortOrder', type: 'integer' }),
          $FD({ label: 'Use as primary product image ?', storage: 'isPrimary', type: 'boolean' }),
        ],
      }),
    ],
    saved: async (form) => {
      form.$master!.$temporary = ['image']
      await resolveImageToId({
        imageField: 'image',
        idField: 'assetId',
        cacheField: 'imageCache',
        meta: {
          purpose: 'shop-product-gallery',
          isPublic: true,
        },
      })(form)
    },
  }),
  setup(report) {
    report.$master!.$temporary = ['image']
    void resolveIdToImage({
      imageField: 'image',
      idField: 'assetId',
      cacheField: 'imageCache',
    })(report)
  },
  loaded(report) {
    report.$master!.$temporary = ['image']
    void resolveIdToImage({
      imageField: 'image',
      idField: 'assetId',
      cacheField: 'imageCache',
    })(report)
  },
  access: shopAccess('shop.catalog.view'),
})

export const shopProductImagesCollection = (shopId: string, productId: string) => $COL({
  objectType: servicePath(shopId, productId),
}, {
  trigger: () => $TG({
    title: 'Product Gallery',
    selectFields: ['id', 'assetId', 'caption', 'sortOrder', 'isPrimary', 'createdAt'],
    headers: [
      { title: 'Asset', value: 'assetId' },
      { title: 'Caption', value: 'caption' },
      { title: 'Sort Order', value: 'sortOrder' },
      { title: 'Primary', value: 'isPrimary' },
      { title: 'Created', value: 'createdAt' },
    ],
  }, {
    sideButtons: (props, context, trigger) => trigger.$params.mode === 'edit' ? [
      $BN({ text: 'Add Image', icon: 'mdi-plus', color: 'success' }, {
        onClicked() {
          const report = shopProductImagesReport(shopId, productId)
          report.$params.mode = 'create'
          AppManager.showReport(report)
        },
      }),
    ] : [],
  }),
  report: () => shopProductImagesReport(shopId, productId),
  access: shopAccess('shop.catalog.view'),
})
