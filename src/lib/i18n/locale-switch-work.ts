/**
 * What the editor translates by itself when the canvas switches to a language.
 *
 * The menu, footer and widgets are always translated by the editor (the copilot's instructions say so). The
 * page's sections and the page titles are translated only when the merchant switches language from the language
 * menu. A switch the copilot makes to show a language (a translation it just made, "Show" on a translation's
 * line, the language that replaced a removed one) is `viewOnly`: it only re-renders, because the copilot's own
 * translation is reviewed on a card, and a "Show" must not translate pages or bill the merchant on the side.
 */
export type LocaleSwitchOptions = { viewOnly?: boolean }

export function localeSwitchWork(options: LocaleSwitchOptions = {}): { menuFooterWidgets: true; sections: boolean; pageTitles: boolean } {
    const translate = !options.viewOnly
    return { menuFooterWidgets: true, sections: translate, pageTitles: translate }
}
