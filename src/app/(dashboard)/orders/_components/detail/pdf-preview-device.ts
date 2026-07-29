export function usesWebKitPdfRenderer(userAgent: string) {
  return (
    /AppleWebKit/i.test(userAgent) &&
    // Edge on iOS reports EdgiOS but still uses WebKit. Desktop Edge includes
    // Chrome in its UA and Android Edge includes Android, so both remain excluded.
    !/(Android|Chrome|Chromium|OPR)/i.test(userAgent)
  )
}
