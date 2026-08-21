import { readFile, writeFile } from 'node:fs/promises'

const routes = [
  { file: 'index.html', prefix: '', active: 'home' },
  { file: 'products/index.html', prefix: '../', active: 'products' },
  { file: 'products/benq-el2870u-4k/index.html', prefix: '../../', active: 'products' },
  { file: 'articles/index.html', prefix: '../', active: 'blog' },
  { file: 'articles/logitech-pop-mouse/index.html', prefix: '../../', active: 'blog' },
  { file: 'contact/index.html', prefix: '../', active: 'contact' },
  { file: 'order-tracking/index.html', prefix: '../', active: 'tracking' },
  { file: 'cart/index.html', prefix: '../', active: null },
  { file: 'checkout/index.html', prefix: '../', active: null },
]

const links = [
  ['home', 'Home', 'index.html', ''],
  ['products', 'Products', 'products/index.html', ''],
  ['blog', 'Blog', 'articles/index.html', ' data-production-href="/blog"'],
  ['contact', 'Contact', 'contact/index.html', ''],
  ['tracking', 'Tracking order', 'order-tracking/index.html', ' data-production-href="/orders"'],
]

function href(prefix, target) {
  return `${prefix}${target}`
}

function linkMarkup(prefix, active, mobile = false) {
  return links.map(([key, label, target, metadata]) => {
    const current = active === key ? ' aria-current="page"' : ''
    return `${mobile ? '        ' : '          '}<a${current} href="${href(prefix, target)}"${metadata}>${label}</a>`
  }).join('\n')
}

function navigation(prefix, active) {
  return `<link rel="stylesheet" href="${prefix}_navigation.css" />
    <header class="pw-site-nav" data-fb101-navigation data-block-type="navigation" data-block-variant="default" data-mapping-status="approximation" data-react-component="NavigationBlock">
      <div class="pw-site-nav__inner">
        <a class="pw-site-nav__brand" href="${href(prefix, 'index.html')}" aria-label="fb101 home"><img src="${prefix}_assets/581207f8014b-eLM5HeXJltdyfLqzgi-xkSVyZddfCybGvWkJfsH85UA.png" alt="fb101" width="154" height="42" /></a>
        <nav class="pw-site-nav__links" aria-label="Primary">
${linkMarkup(prefix, active)}
        </nav>
        <button class="pw-site-nav__menu" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="fb101-mobile-navigation" data-navigation-menu>☰</button>
        <button class="bag pw-site-nav__compat-cart" type="button" tabindex="-1" aria-hidden="true"><b class="badge">0</b></button>
      </div>
      <nav class="pw-site-nav__mobile" id="fb101-mobile-navigation" aria-label="Mobile navigation" data-navigation-mobile hidden>
${linkMarkup(prefix, active, true)}
      </nav>
      <script src="${prefix}_navigation.js" defer></script>
    </header>`
}

for (const route of routes) {
  let html = await readFile(new URL(route.file, import.meta.url), 'utf8')
  html = html.replace(/<link rel="stylesheet" href="(?:\.\.\/)*_navigation\.css" \/>\s*/g, '')
  const next = html.replace(/<header\b[\s\S]*?<\/header>/, navigation(route.prefix, route.active))
  if (next === html) throw new Error(`Header not found: ${route.file}`)
  await writeFile(new URL(route.file, import.meta.url), next)
}
