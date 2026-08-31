import { formatMoney, makeConstantOptions, resolveIdToImage, resolveImageToId } from '@bookmame/web-utils'
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

type MarketplaceAttributeDefinition = {
  id: string
  label: string
  description?: string | null
  dataType: string
  unitGroup?: string | null
  isRequired: boolean
  isVariantDefining: boolean
  categoryLabel: string
  options: Array<{ code: string; label: string }>
}

const marketplaceAttributeDefinitions = new Map<string, MarketplaceAttributeDefinition>()
const selectedMarketplaceDefinitionByField = new WeakMap<Field, string>()

function normalizeMarketplaceDateValue(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value
  return new Date(value * 86_400_000).toISOString().slice(0, 10)
}

function updateMarketplaceValueFieldVisibility(field: Field, dataType: string) {
  const update = (ref: string, visible: boolean, extra: Record<string, unknown> = {}) => {
    const target = field.$refs[ref]
    if (target) target.setParams({ ...target.$params, invisible: !visible, ...extra })
  }
  update('marketplaceRawValue', ['text', 'integer', 'decimal', 'date', 'measurement', 'color'].includes(dataType), {
    type: dataType === 'integer' ? 'integer' : ['decimal', 'measurement'].includes(dataType) ? 'float' : dataType === 'date' ? 'date' : 'text',
  })
  update('marketplaceColorValue', dataType === 'color')
  update('marketplaceOptionValues', ['single_option', 'multiple_option'].includes(dataType), { multiple: dataType === 'multiple_option' })
  update('marketplaceBooleanValue', dataType === 'boolean')
  update('marketplaceUnit', dataType === 'measurement')
}

async function fetchMarketplaceAttributeDefinitions(categoryId: string, variantDefining = false) {
  if (!categoryId) return []
  const response = await Api.instance.service(`shops/${getShopId()}/categories/${categoryId}/marketplace-attributes`).find({
    query: { $paginate: false },
  }) as any
  const rows = (Array.isArray(response) ? response : response?.data || []) as MarketplaceAttributeDefinition[]
  rows.forEach((row) => marketplaceAttributeDefinitions.set(row.id, row))
  return rows.filter((row) => Boolean(row.isVariantDefining) === variantDefining)
}

async function fetchUnitOptions(definitionId: string) {
  const definition = marketplaceAttributeDefinitions.get(definitionId)
  if (!definition?.unitGroup) return []
  const response = await Api.instance.service('reference-data/units').find({ query: { $paginate: false } }) as any
  const rows = Array.isArray(response) ? response : response?.data || []
  return rows
    .filter((row: any) => row.unitGroup === definition.unitGroup)
    .map((row: any) => ({ id: row.id, name: `${row.name} (${row.symbol})` }))
}

function normalizeMarketplaceAttributeRows(rows: any[]) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const definition = marketplaceAttributeDefinitions.get(row.attributeDefinitionId)
    const dataType = definition?.dataType || row.dataType
    const value = dataType === 'single_option'
      ? (Array.isArray(row.optionValues) ? row.optionValues[0] : row.optionValues)
      : dataType === 'multiple_option'
        ? (Array.isArray(row.optionValues) ? row.optionValues : [])
        : dataType === 'boolean'
          ? row.booleanValue
          : dataType === 'date'
            ? normalizeMarketplaceDateValue(row.rawValue ?? row.inputValue ?? row.value)
            : row.rawValue ?? row.inputValue ?? row.value
    return {
      ...row,
      dataType,
      colorValue: dataType === 'color' ? (row.rawValue ?? row.inputValue ?? row.value) : undefined,
      value,
      valueLabel: marketplaceAttributeValueLabel({ ...row, dataType, value }),
      unitId: dataType === 'measurement' ? row.unitId : undefined,
    }
  })
}

function marketplaceAttributeValueLabel(row: any) {
  const definition = marketplaceAttributeDefinitions.get(String(row.attributeDefinitionId || ''))
  if (row.dataType === 'single_option' || row.dataType === 'multiple_option') {
    const selected: unknown[] = Array.isArray(row.optionValues) ? row.optionValues : [row.optionValues]
    const labels = new Map((definition?.options || []).map((option) => [option.code, option.label]))
    return selected.filter(Boolean).map((code: unknown) => labels.get(String(code)) || String(code)).join(', ')
  }
  if (row.dataType === 'boolean') return row.booleanValue === true ? 'Yes' : row.booleanValue === false ? 'No' : ''
  const value = row.dataType === 'date'
    ? normalizeMarketplaceDateValue(row.rawValue ?? row.inputValue ?? row.value)
    : row.rawValue ?? row.inputValue ?? row.value
  return value == null ? '' : String(value)
}

function hydrateMarketplaceAttributeRows(rows: any[]) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    rawValue: ['single_option', 'multiple_option', 'boolean'].includes(row.dataType) ? undefined : row.inputValue,
    colorValue: row.dataType === 'color' ? row.inputValue : undefined,
    optionValues: row.dataType === 'single_option'
      ? (row.inputValue ? [row.inputValue] : [])
      : row.dataType === 'multiple_option'
        ? row.inputValue || []
        : [],
    booleanValue: row.dataType === 'boolean' ? row.inputValue : undefined,
    value: row.inputValue,
  }))
}

function marketplaceAttributesField(categoryId: () => string | undefined) {
  return $FD({
    label: 'Marketplace Category Attributes',
    storage: 'marketplaceAttributes',
    type: 'collection',
    cols: 12,
    hint: 'Structured attributes come from the linked global marketplace category. Additional free-entry attributes remain available below.',
  }, {
    headers() {
      return [
        { title: 'Attribute', value: 'label' },
        { title: 'Value', value: 'valueLabel' },
        { title: 'Origin', value: 'categoryLabel' },
      ]
    },
    form() {
      return $FM({}, {
        saved(form) {
          const master = form.$master
          master?.$set('valueLabel', marketplaceAttributeValueLabel({
            attributeDefinitionId: master?.$get('attributeDefinitionId'),
            dataType: master?.$get('dataType'),
            optionValues: master?.$get('optionValues'),
            booleanValue: master?.$get('booleanValue'),
            rawValue: master?.$get('rawValue'),
          }))
        },
        children: () => [$PT({}, {
          children: () => [
            $FD({ label: 'Attribute', storage: 'attributeDefinitionId', type: 'select', required: true }, {
              selectOptions: async () => (await fetchMarketplaceAttributeDefinitions(categoryId() || '')).map((definition) => ({
                id: definition.id,
                name: `${definition.label}${definition.isRequired ? ' *' : ''} (${definition.categoryLabel})`,
              })),
              changed(field) {
                const definitionId = String(field.$value || '')
                const definition = marketplaceAttributeDefinitions.get(definitionId)
                if (!definition) return
                const previousDefinitionId = selectedMarketplaceDefinitionByField.get(field)
                selectedMarketplaceDefinitionByField.set(field, definitionId)
                field.$master?.$set('label', definition.label)
                field.$master?.$set('categoryLabel', definition.categoryLabel)
                field.$master?.$set('dataType', definition.dataType)
                field.$master?.$set('attributeDescription', definition.description || 'No additional guidance.')
                updateMarketplaceValueFieldVisibility(field, definition.dataType)
                if (previousDefinitionId && previousDefinitionId !== definitionId) {
                  field.$master?.$set('rawValue', undefined)
                  field.$master?.$set('colorValue', undefined)
                  field.$master?.$set('optionValues', [])
                  field.$master?.$set('booleanValue', undefined)
                  field.$master?.$set('unitId', undefined)
                  field.$master?.$set('value', undefined)
                  field.$master?.$set('valueLabel', '')
                }
                field.$refs.marketplaceOptionValues?.loadOptions?.()
                field.$refs.marketplaceUnit?.loadOptions?.()
              },
              setup(field) {
                Promise.resolve().then(() => {
                  const definitionId = String(field.$value || '')
                  const definition = marketplaceAttributeDefinitions.get(definitionId)
                  if (definition) {
                    selectedMarketplaceDefinitionByField.set(field, definitionId)
                    updateMarketplaceValueFieldVisibility(field, definition.dataType)
                  }
                })
              },
            }),
            $FD({ label: 'Guidance', storage: 'attributeDescription', type: 'textarea', readonly: true }),
            $FD({ ref: 'marketplaceRawValue', label: 'Value', storage: 'rawValue', hint: 'For colors, pick a swatch or enter a hexadecimal value such as #1A73E8.' }),
            $FD({ ref: 'marketplaceColorValue', label: 'Color Picker', storage: 'colorValue', type: 'color', invisible: true }, {
              changed(field) {
                if (field.$value) field.$master?.$set('rawValue', field.$value)
              },
            }),
            $FD({ ref: 'marketplaceOptionValues', label: 'Option Value', storage: 'optionValues', type: 'select', multiple: true, invisible: true }, {
              selectOptions: async (field) => {
                const definition = marketplaceAttributeDefinitions.get(String(field.$master?.$get('attributeDefinitionId') || ''))
                return (definition?.options || []).map((option) => ({ id: option.code, name: option.label }))
              },
            }),
            $FD({ ref: 'marketplaceBooleanValue', label: 'Yes / No', storage: 'booleanValue', type: 'select', clearable: true, invisible: true }, {
              selectOptions: async () => [{ id: true, name: 'Yes' }, { id: false, name: 'No' }],
            }),
            $FD({ ref: 'marketplaceUnit', label: 'Unit', storage: 'unitId', type: 'select', clearable: true, invisible: true }, {
              selectOptions: async (field) => fetchUnitOptions(String(field.$master?.$get('attributeDefinitionId') || '')),
            }),
          ],
        })],
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

function parseTags(value: any) {
  return Array.from(
    new Set(value),
  ).slice(0, 20)
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

async function fetchDeliveryClassOptions() {
  const shop = await Api.instance.service('shops').get(getShopId()) as any
  const items = Array.isArray(shop?.supportedDeliveryClasses) ? shop.supportedDeliveryClasses : []
  return items.map((item: any) => ({
    id: item.id,
    name: item.name || item.code || item.id,
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
}, {
  format(_, items) {
    for (const item of items) {
      item.priceAmount = formatMoney(item.priceAmount, item.currency)
    }
    return items
  },
})

const createForm = () => {
  const fm = $FM({
    title: 'Catalog Product',
  }, {
    saved(form) {
      const tags = form.$master?.$get?.('tags', [])
      form.$master?.$set?.('tags', parseTags(tags))
      const rows = form.$master?.$get?.('marketplaceAttributes', [])
      form.$master?.$set?.('marketplaceAttributes', normalizeMarketplaceAttributeRows(rows))
    },
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
  const fields: (Field | Part)[] = [
    $FD({ label: 'Name', type: 'text', storage: 'name', required: true }),
    $FD({ label: 'Slug', type: 'text', storage: 'slug', required: true }),
    $FD({ label: 'Category', type: 'select', storage: 'categoryId', hint: 'Changing category may make marketplace attributes incompatible. Resolve any listed conflicts before saving; existing values are never deleted automatically.' }, {
      selectOptions: async () => fetchCategoryOptions(),
    }),
    $FD({ label: 'Legacy Category Label', type: 'text', storage: 'categoryLabel', hint: 'Optional fallback label when no category record is selected.' }),
    $FD({ label: 'SKU', type: 'text', storage: 'sku' }),
    $FD({ label: 'Price Amount', type: 'integer', storage: 'priceAmount', required: true, hint: 'Minor unit amount.' }),
    $FD({ label: 'Currency', type: 'select', storage: 'currency', required: true }, {
      selectOptions: makeConstantOptions('currencies'),
      default: () => useAppStore().shop?.defaultCurrencyCode,
    }),
    $FD({ label: 'Delivery Class', type: 'select', storage: 'deliveryClassId', hint: 'Required when this shop supports delivery. Choose from the approved shop delivery classes.' }, {
      selectOptions: fetchDeliveryClassOptions,
    }),
    $FD({ label: 'Weight (grams)', type: 'integer', storage: 'weightGrams' }),
    $FD({ label: 'Length (cm)', type: 'integer', storage: 'lengthCm' }),
    $FD({ label: 'Width (cm)', type: 'integer', storage: 'widthCm' }),
    $FD({ label: 'Height (cm)', type: 'integer', storage: 'heightCm' }),
    $FD({ label: 'Declared Value Amount', type: 'integer', storage: 'declaredValueAmount', hint: 'Optional. Collected now for future insurance-related flows.' }),
    $FD({ label: 'Inventory Quantity', type: 'integer', storage: 'inventoryQuantity' }),
    $FD({ label: 'Applicable Delivery Partners', type: 'select', storage: 'applicableDeliveryCompanyIds', multiple: true, cols: 12, hint: 'Leave empty to inherit all active shop delivery partners. Select specific partners only when a product needs delivery restrictions.' }, {
      selectOptions: async () => fetchDeliveryPartnerOptions(),
    }),
    $FD({
      label: 'Search Tags',
      storage: 'tags',
      type: 'text',
      multiple: true,
      cols: 12,
      hint: 'Optional keywords customers may search for. enter the text and press Enter to add a tag.',
      placeholder: 'iphone, charger, fast charging, travel',
      validation: {
        maxLen: 20
      }
    }),
    $FD({ label: 'Sort Order', type: 'integer', storage: 'sortOrder' }),
    $FD({ label: 'Status', type: 'select', storage: 'status' }, {
      selectOptions: makeConstantOptions('shop-product-statuses'),
    }),
    $FD({ label: 'Enabled', type: 'boolean', storage: 'enabled' }),
    $FD({ label: 'Available', type: 'boolean', storage: 'isAvailable' }),
    $FD({ label: 'Primary Image', type: 'image', storage: 'image' }),
    marketplaceAttributesField(() => fm.$master?.$get('categoryId')),
    productAttributesField('attributes', 'Additional Attributes'),
  ]
  return fm
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
    const rows = report.$master?.$get('marketplaceAttributes', [])
    report.$master?.$set('marketplaceAttributes', hydrateMarketplaceAttributeRows(rows))
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
