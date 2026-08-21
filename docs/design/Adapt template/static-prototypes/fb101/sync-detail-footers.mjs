import { readFile, writeFile } from 'node:fs/promises'

const detailPages = [
  'products/benq-el2870u-4k/index.html',
  'articles/logitech-pop-mouse/index.html',
]

const prefix = '../../'

function footer() {
  return `<link rel="stylesheet" href="${prefix}_footer-dark.css" />
<footer class="pw-footer-dark" data-block-type="footer" data-block-variant="dark-gradient" data-mapping-status="approximation" data-react-component="FooterBlock">
  <div class="pw-footer-container">
    <div class="pw-footer-main">
      <div class="pw-footer-brand">
        <a href="${prefix}index.html" aria-label="fb101 home"><img src="${prefix}_assets/581207f8014b-eLM5HeXJltdyfLqzgi-xkSVyZddfCybGvWkJfsH85UA.png" alt="fb101" width="154" height="42" /></a>
        <p class="pw-footer-tagline">Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s</p>
        <ul class="pw-footer-contact">
          <li><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/></svg>BUSINESS SUITE 19A-24-3, LEVEL 24, UOA CENTRE, NO 19, JALAN PINANG 50450 KUALA LUMPUR.</li>
          <li><a href="tel:02866542688"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z"/></svg>02866542688</a></li>
          <li><a href="mailto:fb101@primeweb.asia"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>fb101@primeweb.asia</a></li>
        </ul>
      </div>
      <div class="pw-footer-column">
        <h3>Quality products</h3>
        <ul><li><a href="${prefix}products/index.html">Popular Products</a></li><li><a href="${prefix}products/index.html">Best Selling</a></li><li><a href="${prefix}products/index.html">Deal Of The Day</a></li></ul>
        <div class="pw-footer-socials"><a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><img src="${prefix}_assets/44fec0fbcbfd-facebook.png" alt="" /></a></div>
      </div>
      <div class="pw-footer-column">
        <h3>Support policy</h3>
        <ul><li><a href="${prefix}order-tracking/index.html" data-production-href="/orders">My Order Details</a></li><li><span>My Credit Offers</span></li><li><span>My Addresses</span></li><li><span>My Personal Details</span></li></ul>
        <div class="pw-footer-socials"><a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><img src="${prefix}_assets/02aa56fea786-youtube.png" alt="" /></a></div>
      </div>
      <div class="pw-footer-column">
        <h3>Introduce</h3>
        <ul><li><a href="${prefix}order-tracking/index.html" data-production-href="/orders">My Order Details</a></li><li><span>My Credit Offers</span></li><li><span>My Addresses</span></li><li><span>My Personal Details</span></li></ul>
        <div class="pw-footer-socials"><a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><img src="${prefix}_assets/1711b9f1f51e-instagram.png" alt="" /></a></div>
      </div>
    </div>
    <p class="pw-footer-copyright">Copyright © 2022 by Prime Commerce</p>
  </div>
</footer>`
}

for (const file of detailPages) {
  let html = await readFile(new URL(file, import.meta.url), 'utf8')
  html = html.replace(/<link rel="stylesheet" href="\.\.\/\.\.\/_footer-dark\.css" \/>\s*/g, '')
  const next = html.replace(/<footer\b[\s\S]*?<\/footer>/, footer())
  if (next === html) throw new Error(`Footer not found: ${file}`)
  await writeFile(new URL(file, import.meta.url), next)
}
