import { resolveIdToImage, resolveImageToId, makeConstantOptions, formatMoney } from '@bookmame/web-utils'
import { $BN, $COL, $FD, $FM, $PT, $RP, $TG, Api, AppManager, Field } from 'vuetify-extended'
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

type VariantMarketplaceDefinition = {
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

const variantMarketplaceDefinitions = new Map<string, VariantMarketplaceDefinition>()
const selectedVariantMarketplaceDefinitionByField = new WeakMap<Field, string>()

function normalizeVariantMarketplaceDateValue(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return value
  return new Date(value * 86_400_000).toISOString().slice(0, 10)
}

function updateVariantMarketplaceValueFieldVisibility(field: Field, dataType: string) {
  const update = (ref: string, visible: boolean, extra: Record<string, unknown> = {}) => {
    const target = field.$refs[ref]
    if (target) target.setParams({ ...target.$params, invisible: !visible, ...extra })
  }
  update('variantMarketplaceRawValue', ['text', 'integer', 'decimal', 'date', 'measurement', 'color'].includes(dataType), {
    type: dataType === 'integer' ? 'integer' : ['decimal', 'measurement'].includes(dataType) ? 'float' : dataType === 'date' ? 'date' : 'text',
  })
  update('variantMarketplaceColorValue', dataType === 'color')
  update('variantMarketplaceOptionValues', ['single_option', 'multiple_option'].includes(dataType), { multiple: dataType === 'multiple_option' })
  update('variantMarketplaceBooleanValue', dataType === 'boolean')
  update('variantMarketplaceUnit', dataType === 'measurement')
}

async function fetchVariantUnitOptions(definitionId: string) {
  const definition = variantMarketplaceDefinitions.get(definitionId)
  if (!definition?.unitGroup) return []
  const response = await Api.instance.service('reference-data/units').find({ query: { $paginate: false } }) as any
  const rows = Array.isArray(response) ? response : response?.data || []
  return rows.filter((row: any) => row.unitGroup === definition.unitGroup).map((row: any) => ({ id: row.id, name: `${row.name} (${row.symbol})` }))
}

async function fetchVariantMarketplaceDefinitions(shopId: string, productId: string) {
  const product = await Api.instance.service(`shops/${shopId}/products`).get(productId) as any
  if (!product?.categoryId) return []
  const response = await Api.instance.service(`shops/${shopId}/categories/${product.categoryId}/marketplace-attributes`).find({ query: { $paginate: false } }) as any
  const rows = (Array.isArray(response) ? response : response?.data || []) as VariantMarketplaceDefinition[]
  rows.forEach((row) => variantMarketplaceDefinitions.set(row.id, row))
  return rows.filter((row) => row.isVariantDefining)
}

function normalizeVariantMarketplaceAttributes(rows: any[]) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const definition = variantMarketplaceDefinitions.get(row.attributeDefinitionId)
    const dataType = definition?.dataType || row.dataType
    return {
      ...row,
      dataType,
      colorValue: dataType === 'color' ? (row.rawValue ?? row.inputValue ?? row.value) : undefined,
      value: dataType === 'single_option'
        ? (Array.isArray(row.optionValues) ? row.optionValues[0] : row.optionValues)
        : dataType === 'multiple_option'
          ? (Array.isArray(row.optionValues) ? row.optionValues : [])
          : dataType === 'boolean'
            ? row.booleanValue
            : dataType === 'date'
              ? normalizeVariantMarketplaceDateValue(row.rawValue ?? row.inputValue ?? row.value)
              : row.rawValue ?? row.inputValue ?? row.value,
      valueLabel: variantMarketplaceAttributeValueLabel({ ...row, dataType }),
      unitId: dataType === 'measurement' ? row.unitId : undefined,
    }
  })
}

function variantMarketplaceAttributeValueLabel(row: any) {
  const definition = variantMarketplaceDefinitions.get(String(row.attributeDefinitionId || ''))
  if (row.dataType === 'single_option' || row.dataType === 'multiple_option') {
    const selected: unknown[] = Array.isArray(row.optionValues) ? row.optionValues : [row.optionValues]
    const labels = new Map((definition?.options || []).map((option) => [option.code, option.label]))
    return selected.filter(Boolean).map((code: unknown) => labels.get(String(code)) || String(code)).join(', ')
  }
  if (row.dataType === 'boolean') return row.booleanValue === true ? 'Yes' : row.booleanValue === false ? 'No' : ''
  const value = row.dataType === 'date'
    ? normalizeVariantMarketplaceDateValue(row.rawValue ?? row.inputValue ?? row.value)
    : row.rawValue ?? row.inputValue ?? row.value
  return value == null ? '' : String(value)
}

function hydrateVariantMarketplaceAttributes(rows: any[]) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    rawValue: ['single_option', 'multiple_option', 'boolean'].includes(row.dataType) ? undefined : row.inputValue,
    colorValue: row.dataType === 'color' ? row.inputValue : undefined,
    optionValues: row.dataType === 'single_option' ? (row.inputValue ? [row.inputValue] : []) : row.dataType === 'multiple_option' ? row.inputValue || [] : [],
    booleanValue: row.dataType === 'boolean' ? row.inputValue : undefined,
    value: row.inputValue,
  }))
}

function variantMarketplaceAttributesField(shopId: string, productId: string) {
  return $FD({
    label: 'Marketplace Variant Attributes',
    storage: 'marketplaceAttributes',
    type: 'collection',
    cols: 12,
    hint: 'Variant-defining attributes come from the product category. Additional variant attributes remain available below.',
  }, {
    headers: () => [
      { title: 'Attribute', value: 'label' }, { title: 'Value', value: 'valueLabel' }, { title: 'Origin', value: 'categoryLabel' },
    ],
    form: () => $FM({}, {
      saved(form) {
        const master = form.$master
        master?.$set('valueLabel', variantMarketplaceAttributeValueLabel({
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
            selectOptions: async () => (await fetchVariantMarketplaceDefinitions(shopId, productId)).map((definition) => ({
              id: definition.id,
              name: `${definition.label}${definition.isRequired ? ' *' : ''} (${definition.categoryLabel})`,
            })),
            changed(field) {
              const definitionId = String(field.$value || '')
              const definition = variantMarketplaceDefinitions.get(definitionId)
              if (!definition) return
              const previousDefinitionId = selectedVariantMarketplaceDefinitionByField.get(field)
              selectedVariantMarketplaceDefinitionByField.set(field, definitionId)
              field.$master?.$set('label', definition.label)
              field.$master?.$set('categoryLabel', definition.categoryLabel)
              field.$master?.$set('dataType', definition.dataType)
              field.$master?.$set('attributeDescription', definition.description || 'No additional guidance.')
              updateVariantMarketplaceValueFieldVisibility(field, definition.dataType)
              if (previousDefinitionId && previousDefinitionId !== definitionId) {
                field.$master?.$set('rawValue', undefined)
                field.$master?.$set('colorValue', undefined)
                field.$master?.$set('optionValues', [])
                field.$master?.$set('booleanValue', undefined)
                field.$master?.$set('unitId', undefined)
                field.$master?.$set('value', undefined)
                field.$master?.$set('valueLabel', '')
              }
              field.$refs.variantMarketplaceOptionValues?.loadOptions?.()
              field.$refs.variantMarketplaceUnit?.loadOptions?.()
            },
            setup(field) {
              Promise.resolve().then(() => {
                const definitionId = String(field.$value || '')
                const definition = variantMarketplaceDefinitions.get(definitionId)
                if (definition) {
                  selectedVariantMarketplaceDefinitionByField.set(field, definitionId)
                  updateVariantMarketplaceValueFieldVisibility(field, definition.dataType)
                }
              })
            },
          }),
          $FD({ label: 'Guidance', storage: 'attributeDescription', type: 'textarea', readonly: true }),
          $FD({ ref: 'variantMarketplaceRawValue', label: 'Value', storage: 'rawValue', hint: 'For colors, pick a swatch or enter a hexadecimal value such as #1A73E8.' }),
          $FD({ ref: 'variantMarketplaceColorValue', label: 'Color Picker', storage: 'colorValue', type: 'color', invisible: true }, {
            changed(field) {
              if (field.$value) field.$master?.$set('rawValue', field.$value)
            },
          }),
          $FD({ ref: 'variantMarketplaceOptionValues', label: 'Option Value', storage: 'optionValues', type: 'select', multiple: true, invisible: true }, {
            selectOptions: async (field) => {
              const definition = variantMarketplaceDefinitions.get(String(field.$master?.$get('attributeDefinitionId') || ''))
              return (definition?.options || []).map((option) => ({ id: option.code, name: option.label }))
            },
          }),
          $FD({ ref: 'variantMarketplaceBooleanValue', label: 'Yes / No', storage: 'booleanValue', type: 'select', clearable: true, invisible: true }, {
            selectOptions: async () => [{ id: true, name: 'Yes' }, { id: false, name: 'No' }],
          }),
          $FD({ ref: 'variantMarketplaceUnit', label: 'Unit', storage: 'unitId', type: 'select', clearable: true, invisible: true }, {
            selectOptions: async (field) => fetchVariantUnitOptions(String(field.$master?.$get('attributeDefinitionId') || '')),
          }),
        ],
      })],
    }),
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
          variantMarketplaceAttributesField(shopId, productId),
          variantAttributesField('attributes', 'Additional Variant Attributes'),
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
      const rows = form.$master?.$get('marketplaceAttributes', [])
      form.$master?.$set('marketplaceAttributes', normalizeVariantMarketplaceAttributes(rows))
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
    const rows = report.$master?.$get('marketplaceAttributes', [])
    report.$master?.$set('marketplaceAttributes', hydrateVariantMarketplaceAttributes(rows))
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
