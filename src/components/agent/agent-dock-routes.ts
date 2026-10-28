/** The blog editor has the copilot in its side column (one chat per post): no second mascot there. */
export const BLOG_EDITOR = /^\/blog\/(?!categories\/?$)[^/]+\/?$/;

/** Pages that show the dashboard mascot (the loader and the dock agree on this). */
export const dockShownOn = (pathname: string): boolean => !BLOG_EDITOR.test(pathname);
