import { ref, type Doc, type MappingContext } from '../contracts'
import { rawChildren, rawRow, settings, sourceOrder } from './raw'

export function mapRawContent(ctx: MappingContext): void {
  const site = ctx.output.sites[0]
  if (!site) return
  const source: Doc = {}
  const store = ctx.find('stores', ctx.storeId)
  if (store) {
    source.store = rawRow(ctx, 'stores', store, 'sites.pw1_source.store')
    const template = ctx.find('frontend_templates', store.frontend_template_id)
    source.frontend_template = template
      ? rawRow(
          ctx,
          'frontend_templates',
          template,
          'sites.pw1_source.frontend_template',
        )
      : null
    if (store.frontend_template_id && !template)
      ctx.issue(
        'RAW_TEMPLATE_MISSING',
        'stores',
        store.id,
        'frontend_template_id',
      )
  }
  source.model_settings = settings(
    ctx,
    'Store',
    ctx.storeId,
    'sites.pw1_source.model_settings',
  )
  for (const table of [
    'brands',
    'categories',
    'products',
    'blog_categories',
    'blog_posts',
    'store_domains',
    'attributes',
    'attribute_values',
  ]) {
    source[table] = ctx
      .rows(table, true)
      .sort(sourceOrder)
      .map((row) => rawRow(ctx, table, row, `sites.pw1_source.${table}`))
  }
  const categoryIds = new Set(ctx.rows('categories', true).map((row) => row.id))
  source.category_attributes = (ctx.tables.category_attributes ?? [])
    .filter((row) => categoryIds.has(row.category_id))
    .sort(sourceOrder)
    .map((row) =>
      rawRow(
        ctx,
        'category_attributes',
        row,
        'sites.pw1_source.category_attributes',
      ),
    )
  site.pw1_source = source
  for (const page of ctx.rows('pages', true).sort(sourceOrder)) {
    const out = rawRow(ctx, 'pages', page, 'pages')
    out._ref = ref('pages', 'pages', page.id!)
    out.model_settings = settings(ctx, 'Page', page.id!, 'pages.model_settings')
    out.components = rawChildren(
      ctx,
      'page_components',
      'page_id',
      page.id!,
      'pages.components',
    ).map((component) => {
      const id = String(component.id)
      component.model_settings = settings(
        ctx,
        'PageComponent',
        id,
        'pages.components.model_settings',
      )
      component.banners = rawChildren(
        ctx,
        'banners',
        'page_component_id',
        id,
        'pages.components.banners',
      )
      component.shortlist_items = rawChildren(
        ctx,
        'shortlist_items',
        'page_component_id',
        id,
        'pages.components.shortlist_items',
      )
      const definition = ctx.find(
        'frontend_components',
        String(component.frontend_component_id ?? ''),
      )
      component.frontend_component = definition
        ? rawRow(
            ctx,
            'frontend_components',
            definition,
            'pages.components.frontend_component',
          )
        : null
      if (!definition)
        ctx.issue(
          'RAW_COMPONENT_DEFINITION_MISSING',
          'page_components',
          id,
          'frontend_component_id',
        )
      return component
    })
    ctx.output.pages.push(out)
  }
  const decorate = (doc: Doc, model: string): Doc => {
    doc.model_settings = settings(
      ctx,
      model,
      String(doc.id),
      `sites.menus.${model}.model_settings`,
    )
    if (doc.type_id) {
      const type = ctx.find('menu_line_types', String(doc.type_id))
      doc.menu_line_type = type
        ? rawRow(ctx, 'menu_line_types', type, 'sites.menus.menu_line_type')
        : null
      if (!type)
        ctx.issue(
          'RAW_MENU_TYPE_MISSING',
          model === 'MenuItem' ? 'menu_items' : 'menu_lines',
          String(doc.id),
          'type_id',
        )
    } else doc.menu_line_type = null
    return doc
  }
  site.menus = ctx
    .rows('menus', true)
    .sort(sourceOrder)
    .map((row) => {
      const menu = rawRow(ctx, 'menus', row, 'sites.menus')
      menu.model_settings = settings(
        ctx,
        'Menu',
        row.id!,
        'sites.menus.model_settings',
      )
      menu.menu_items = rawChildren(
        ctx,
        'menu_items',
        'menu_id',
        row.id!,
        'sites.menus.menu_items',
      ).map((item) => {
        decorate(item, 'MenuItem')
        item.menu_lines = rawChildren(
          ctx,
          'menu_lines',
          'menu_item_id',
          String(item.id),
          'sites.menus.menu_items.menu_lines',
        ).map((line) => decorate(line, 'MenuLine'))
        return item
      })
      return menu
    })
}
