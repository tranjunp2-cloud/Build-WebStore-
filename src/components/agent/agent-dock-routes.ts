/** The blog editor has the copilot in its side column (one chat per post): no second mascot there. */
export const BLOG_EDITOR = /^\/blog\/(?!categories\/?$)[^/]+\/?$/;

/** Pages that show the dashboard mascot (the loader and the dock agree on this). */
export const dockShownOn = (pathname: string): boolean => !BLOG_EDITOR.test(pathname);

/**
 * Screens where the merchant is filling in a form (product editor, settings, a discount, a customer): the mascot
 * stays put but raises no card over it — a bubble over the Save button interrupts the work. It is still one click away.
 */
const FORM_SCREENS = [
	/^\/products\/(?!categories\/?$)[^/]+\/?$/, // /products/new, /products/:id
	/^\/settings(\/|$)/,
	/^\/discounts\/(?!usage-history\/?$)[^/]+\/?$/, // /discounts/new, /discounts/:id
	/^\/customers\/[^/]+\/?$/,
];

/** True on a form screen: no unprompted raise card or peek bubble from the mascot. */
export const quietOn = (pathname: string): boolean => FORM_SCREENS.some((screen) => screen.test(pathname));
