document.addEventListener("DOMContentLoaded", () => {
  const shellHeader = document.querySelector('[data-nav-contract="fn103-shell-v1"]'),
    toggle = shellHeader?.querySelector(".nav-toggle"),
    mobileNav = shellHeader?.querySelector(".shell-nav[data-mobile-drawer]");
  let navFocusReturn = null;
  const syncMobileNav = (open) => {
    if (!mobileNav || !toggle) return;
    if (open) navFocusReturn = document.activeElement;
    mobileNav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    if (matchMedia("(max-width: 767px)").matches && !open) mobileNav.setAttribute("inert", ""); else mobileNav.removeAttribute("inert");
    if (open) mobileNav.querySelector("a")?.focus();
    else if (navFocusReturn && matchMedia("(max-width: 767px)").matches) navFocusReturn.focus?.();
  };
  syncMobileNav(false);
  toggle?.addEventListener("click", () => {
    syncMobileNav(!mobileNav?.classList.contains("open"));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobileNav?.classList.contains("open")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      syncMobileNav(false);
    }
  });
  addEventListener("resize", () => syncMobileNav(matchMedia("(min-width: 768px)").matches ? false : Boolean(mobileNav?.classList.contains("open"))));
  const header = document.querySelector("header");
  const updateHeader = () => header?.classList.toggle("scrolled", window.scrollY > 50);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
  document.querySelectorAll("[data-hero-carousel]").forEach((hero) => {
    const slides = [...hero.querySelectorAll(".hero-banner-slide")];
    const dots = [...hero.querySelectorAll(".hero-banner-dots button")];
    const pauseButton = hero.querySelector(".hero-banner-toggle");
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let index = 0, timer = 0, paused = reducedMotion.matches;
    const show = (next) => {
      if (!slides.length) return;
      index = (next + slides.length) % slides.length;
      slides.forEach((slide, i) => {
        const active = i === index;
        slide.classList.toggle("active", active);
        slide.setAttribute("aria-hidden", String(!active));
      });
      dots.forEach((dot, i) => {
        dot.classList.toggle("active", i === index);
        if (i === index) dot.setAttribute("aria-current", "true"); else dot.removeAttribute("aria-current");
      });
    };
    const stop = () => { if (timer) clearInterval(timer); timer = 0; };
    const start = () => {
      stop();
      if (!paused && !document.hidden && !reducedMotion.matches) timer = setInterval(() => show(index + 1), 5000);
    };
    const syncPauseControl = () => {
      if (!pauseButton) return;
      const reduced = reducedMotion.matches;
      pauseButton.disabled = reduced;
      pauseButton.setAttribute("aria-pressed", String(paused));
      pauseButton.setAttribute("aria-label", reduced ? "Hero autoplay disabled by reduced motion preference" : paused ? "Play hero banners" : "Pause hero banners");
      pauseButton.querySelector("span").textContent = paused ? "\u25B6" : "\u275A\u275A";
    };
    dots.forEach((dot, i) => dot.addEventListener("click", () => { show(i); start(); }));
    pauseButton?.addEventListener("click", () => {
      paused = !paused;
      syncPauseControl();
      paused ? stop() : start();
    });
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
    reducedMotion.addEventListener?.("change", () => {
      paused = reducedMotion.matches;
      syncPauseControl();
      reducedMotion.matches ? stop() : start();
    });
    show(0);
    syncPauseControl();
    start();
  });
  document.querySelectorAll(".carousel-viewport").forEach((viewport) => {
    const track = viewport.querySelector(".category-grid");
    const slides = [...(track?.children || [])];
    const dots = [...(viewport.parentElement?.querySelectorAll(".carousel-dots button") || [])];
    let index = 0;
    let timer = 0, hovered = false, focused = false;
    const show = (next) => {
      if (!track || !slides.length) return;
      index = (next + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((dot, i) => { dot.classList.toggle("active", i === index); i === index ? dot.setAttribute("aria-current", "true") : dot.removeAttribute("aria-current"); });
    };
    viewport.querySelector(".prev")?.addEventListener("click", () => show(index - 1));
    viewport.querySelector(".next")?.addEventListener("click", () => show(index + 1));
    dots.forEach((dot, i) => dot.addEventListener("click", () => show(i)));
    const stop = () => { if (timer) window.clearInterval(timer); timer = 0; };
    const start = () => { if (!timer && !hovered && !focused && !document.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches) timer = window.setInterval(() => show(index + 1), 5000); };
    viewport.parentElement?.addEventListener("mouseenter", () => { hovered = true; stop(); });
    viewport.parentElement?.addEventListener("mouseleave", () => { hovered = false; start(); });
    viewport.parentElement?.addEventListener("focusin", () => { focused = true; stop(); });
    viewport.parentElement?.addEventListener("focusout", (event) => { focused = Boolean(viewport.parentElement?.contains(event.relatedTarget)); start(); });
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
    start();
  });
  document.querySelectorAll(".featured-controls button").forEach((button, i) =>
    button.addEventListener("click", () => {
      const track = button.closest("section")?.querySelector(".featured-track");
      const card = track?.querySelector(".product-card");
      track?.scrollBy({ left: (card?.getBoundingClientRect().width || 500) * (i ? 1 : -1) + (i ? 24 : -24), behavior: "smooth" });
    }),
  );
  const filterTrigger = document.querySelector(".filter-trigger");
  const productFilterDrawer = document.querySelector(".mobile-filter-drawer");
  const productFilterScrim = document.querySelector(".mobile-filter-scrim");
  const productFilterClose = productFilterDrawer?.querySelector(".mobile-filter-close");
  const productFilterApply = productFilterDrawer?.querySelector(".mobile-filter-apply");
  const productFilterClear = productFilterDrawer?.querySelector(".mobile-filter-clear");
  const productCards = [...document.querySelectorAll(".products-grid-block .product-card")];
  const productGrid = document.querySelector(".products-grid-block .product-grid");
  const productResults = document.querySelector(".products-grid-block .catalog-results");
  const activeChips = document.querySelector(".products-grid-block .active-chips");
  const emptyState = document.querySelector(".products-grid-block .products-empty");
  const pagination = document.querySelector(".products-grid-block .products-pagination");
  const desktopCategories = [...document.querySelectorAll("[data-filter-category]")];
  const desktopSearch = document.querySelector("[data-filter-search]");
  const desktopMin = document.querySelector("[data-filter-min]");
  const desktopMax = document.querySelector("[data-filter-max]");
  const draftCategories = [...document.querySelectorAll("[data-draft-category]")];
  const draftSearch = document.querySelector("[data-draft-search]");
  const draftMin = document.querySelector("[data-draft-min]");
  const draftMax = document.querySelector("[data-draft-max]");
  const fixturePriceBounds = { min: 39, max: 419 };
  const productsPerPage = () => matchMedia("(min-width: 1024px)").matches ? 9 : 10;
  const productState = { categories: [], search: "", min: "", max: "", page: 1 };
  const syncRangeVisual = (control, min, max) => {
    if (!control) return;
    const span = fixturePriceBounds.max - fixturePriceBounds.min;
    control.style.setProperty("--range-min", `${((min-fixturePriceBounds.min)/span)*100}%`);
    control.style.setProperty("--range-max", `${((max-fixturePriceBounds.min)/span)*100}%`);
    const output = control.querySelector("[data-range-output]");
    if (output) output.textContent = `RM ${min} – RM ${max}`;
  };
  const normalizePriceState = () => {
    let min = productState.min === "" ? null : Math.min(fixturePriceBounds.max, Math.max(fixturePriceBounds.min, Number(productState.min)));
    let max = productState.max === "" ? null : Math.min(fixturePriceBounds.max, Math.max(fixturePriceBounds.min, Number(productState.max)));
    if (min !== null && max !== null && min > max) [min, max] = [max, min];
    productState.min = min === null || !Number.isFinite(min) ? "" : String(min);
    productState.max = max === null || !Number.isFinite(max) ? "" : String(max);
  };
  const syncDesktopControls = () => {
    desktopCategories.forEach((button) => { button.setAttribute("aria-pressed", String(productState.categories.includes(button.value))); });
    if (desktopSearch) desktopSearch.value = productState.search;
    if (desktopMin) desktopMin.value = productState.min || String(fixturePriceBounds.min);
    if (desktopMax) desktopMax.value = productState.max || String(fixturePriceBounds.max);
    syncRangeVisual(desktopMin?.closest("[data-range-control]"), Number(desktopMin?.value), Number(desktopMax?.value));
  };
  const syncDraftControls = () => {
    draftCategories.forEach((button) => { button.setAttribute("aria-pressed", String(productState.categories.includes(button.value))); });
    if (draftSearch) draftSearch.value = productState.search;
    if (draftMin) draftMin.value = productState.min || String(fixturePriceBounds.min);
    if (draftMax) draftMax.value = productState.max || String(fixturePriceBounds.max);
    syncRangeVisual(draftMin?.closest("[data-range-control]"), Number(draftMin?.value), Number(draftMax?.value));
  };
  const renderProducts = () => {
    normalizePriceState();
    const query = productState.search.trim().toLowerCase();
    const minimum = productState.min === "" ? -Infinity : Number(productState.min);
    const maximum = productState.max === "" ? Infinity : Number(productState.max);
    const matches = productCards.filter((card) => {
      const price = Number(card.dataset.productPrice);
      return (!productState.categories.length || productState.categories.includes(card.dataset.productCategory)) &&
        (!query || card.dataset.productName.toLowerCase().includes(query)) && price >= minimum && price <= maximum;
    });
    const pageSize = productsPerPage();
    const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
    productState.page = Math.min(productState.page, totalPages);
    const first = (productState.page - 1) * pageSize;
    productCards.forEach((card) => { card.hidden = !matches.slice(first, first + pageSize).includes(card); });
    if (emptyState) emptyState.hidden = matches.length !== 0;
    if (productGrid) productGrid.hidden = matches.length === 0;
    const chips = [
      ...productState.categories.map((value) => ({ label: value, clear: () => { productState.categories = productState.categories.filter((item) => item !== value); } })),
      ...(query ? [{ label: `Search: ${productState.search}`, clear: () => { productState.search = ""; } }] : []),
      ...((productState.min || productState.max) ? [{ label: `RM ${productState.min || 0}–${productState.max || "∞"}`, clear: () => { productState.min = ""; productState.max = ""; } }] : []),
    ];
    if (activeChips) {
      activeChips.hidden = !chips.length;
      activeChips.replaceChildren(...chips.map(({ label, clear }) => { const button = document.createElement("button"); button.type = "button"; button.textContent = `${label} ×`; button.addEventListener("click", () => { clear(); productState.page = 1; syncDesktopControls(); renderProducts(); }); return button; }), ...(chips.length ? [Object.assign(document.createElement("button"), { type: "button", textContent: "Clear all", onclick: () => { productState.categories=[]; productState.search=""; productState.min=""; productState.max=""; productState.page=1; syncDesktopControls(); renderProducts(); } })] : []));
    }
    if (filterTrigger) { const count = filterTrigger.querySelector(".filter-count"); if (count) { count.textContent=String(chips.length); count.hidden=!chips.length; } }
    if (pagination) {
      pagination.hidden = matches.length === 0 || totalPages <= 1;
      pagination.replaceChildren();
      const addPage = (label, page, disabled, current=false, ariaLabel="") => { const button=document.createElement("button"); button.type="button"; button.textContent=label; button.disabled=disabled; button.setAttribute("aria-label",ariaLabel || `Page ${page}`); if(current){button.className="active";button.setAttribute("aria-current","page");} button.addEventListener("click",()=>{productState.page=page;renderProducts(); productResults?.scrollIntoView({behavior:"smooth",block:"start"});}); pagination.append(button); };
      addPage("«", productState.page-1, productState.page===1, false, "Previous page");
      for(let page=1;page<=totalPages;page++) addPage(String(page),page,false,page===productState.page,`Page ${page}`);
      addPage("»", productState.page+1, productState.page===totalPages, false, "Next page");
    }
  };
  const applyDesktopFacets = () => { productState.categories=desktopCategories.filter((button)=>button.getAttribute("aria-pressed")==="true").map((button)=>button.value); const min=Number(desktopMin?.value); const max=Number(desktopMax?.value); productState.min=min<=fixturePriceBounds.min?"":String(min); productState.max=max>=fixturePriceBounds.max?"":String(max); productState.page=1; renderProducts(); syncDesktopControls(); };
  const commitDesktopSearch = () => {
    const nextSearch = (desktopSearch?.value || "").trim();
    if (nextSearch === productState.search) return;
    productState.search = nextSearch;
    productState.page = 1;
    renderProducts();
    syncDesktopControls();
  };
  desktopCategories.forEach((button)=>button.addEventListener("click",()=>{button.setAttribute("aria-pressed",String(button.getAttribute("aria-pressed")!=="true"));applyDesktopFacets();}));
  desktopMin?.addEventListener("input",()=>{desktopMin.value=String(Math.min(Number(desktopMin.value),Number(desktopMax.value)));applyDesktopFacets();});
  desktopMax?.addEventListener("input",()=>{desktopMax.value=String(Math.max(Number(desktopMax.value),Number(desktopMin.value)));applyDesktopFacets();});
  draftCategories.forEach((button)=>button.addEventListener("click",()=>button.setAttribute("aria-pressed",String(button.getAttribute("aria-pressed")!=="true"))));
  draftMin?.addEventListener("input",()=>{draftMin.value=String(Math.min(Number(draftMin.value),Number(draftMax.value)));syncRangeVisual(draftMin.closest("[data-range-control]"),Number(draftMin.value),Number(draftMax.value));});
  draftMax?.addEventListener("input",()=>{draftMax.value=String(Math.max(Number(draftMax.value),Number(draftMin.value)));syncRangeVisual(draftMin.closest("[data-range-control]"),Number(draftMin.value),Number(draftMax.value));});
  desktopSearch?.addEventListener("blur", commitDesktopSearch);
  document.querySelector("[data-filter-search-form]")?.addEventListener("submit", (event) => { event.preventDefault(); commitDesktopSearch(); });
  let productFilterReturn = null;
  let productFilterBodyOverflow = "";
  const productFilterFocusables = () => [...(productFilterDrawer?.querySelectorAll('button:not([disabled]), a[href]:not([aria-disabled="true"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])]
    .filter((element) => element.getClientRects().length > 0);
  const setProductFilters = (open) => {
    if (!productFilterDrawer || !filterTrigger) return;
    if (open) { productFilterReturn = document.activeElement; syncDraftControls(); }
    productFilterDrawer.classList.toggle("open", open);
    productFilterScrim?.classList.toggle("open", open);
    productFilterDrawer.setAttribute("aria-hidden", String(!open));
    filterTrigger.setAttribute("aria-expanded", String(open));
    if (open) {
      productFilterDrawer.removeAttribute("inert");
      productFilterBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      (productFilterFocusables()[0] || productFilterDrawer).focus?.();
    } else {
      productFilterDrawer.setAttribute("inert", "");
      document.body.style.overflow = productFilterBodyOverflow;
      productFilterReturn?.focus?.();
    }
  };
  filterTrigger?.addEventListener("click", () => setProductFilters(true));
  productFilterClose?.addEventListener("click", () => setProductFilters(false));
  productFilterApply?.addEventListener("click", () => { productState.categories=draftCategories.filter((button)=>button.getAttribute("aria-pressed")==="true").map((button)=>button.value); productState.search=(draftSearch?.value||"").trim(); const min=Number(draftMin?.value),max=Number(draftMax?.value); productState.min=min<=fixturePriceBounds.min?"":String(min); productState.max=max>=fixturePriceBounds.max?"":String(max); productState.page=1; renderProducts(); syncDesktopControls(); setProductFilters(false); });
  productFilterClear?.addEventListener("click", () => { draftCategories.forEach((button)=>button.setAttribute("aria-pressed","false")); if(draftSearch)draftSearch.value=""; if(draftMin)draftMin.value=String(fixturePriceBounds.min); if(draftMax)draftMax.value=String(fixturePriceBounds.max); syncRangeVisual(draftMin?.closest("[data-range-control]"),fixturePriceBounds.min,fixturePriceBounds.max); });
  productFilterScrim?.addEventListener("click", () => setProductFilters(false));
  document.querySelectorAll("[data-static-product]").forEach((link) => link.addEventListener("click", (event) => event.preventDefault()));
  document.querySelectorAll("[data-product-view]").forEach((button, i, buttons) => button.addEventListener("click", () => {
    buttons.forEach((item, j) => { item.classList.toggle("active", i === j); item.setAttribute("aria-pressed", String(i === j)); });
    document.querySelector(".products-grid-block .catalog-results")?.classList.toggle("list-preview", button.dataset.productView === "list");
  }));
  if (productCards.length) renderProducts();
  let productsMobileViewport = matchMedia("(max-width: 1023px)").matches;
  addEventListener("resize", () => {
    const nextMobileViewport = matchMedia("(max-width: 1023px)").matches;
    if (productsMobileViewport && !nextMobileViewport && productFilterDrawer?.classList.contains("open")) {
      setProductFilters(false);
      const desktopFocusTarget = document.querySelector('[data-product-view][aria-pressed="true"]');
      desktopFocusTarget?.focus();
    }
    productsMobileViewport = nextMobileViewport;
    if (productCards.length) renderProducts();
  });
  const drawer = document.querySelector(".drawer"),
    scrim = document.querySelector(".scrim"),
    launch = document.querySelector(".cart-widget"),
    close = drawer?.querySelector('.drawer-close, [aria-label="Close cart"]');
  let last = null;
  let previousBodyOverflow = "";
  const drawerBackgroundState = new Map();
  const drawerBackground = () => [...document.body.children].filter((element) => element !== drawer && element !== scrim && element.tagName !== "SCRIPT");
  const drawerFocusables = () =>
    [...(drawer?.querySelectorAll('a[href]:not([aria-disabled="true"]), button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])]
      .filter((element) => element.getClientRects().length > 0);
  function setDrawer(open) {
    if (!drawer) return;
    const alreadyOpen = drawer.classList.contains("open");
    if ((!open && !alreadyOpen) || (open && alreadyOpen && drawerBackgroundState.size)) return;
    drawer.classList.toggle("open", open);
    scrim?.classList.toggle("open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    if (open) {
      drawer.removeAttribute("inert");
      const active = document.activeElement;
      last = active && active !== document.body && !drawer.contains(active)
        ? active
        : launch || document.querySelector('.skip, [data-drawer-focus-return]');
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      drawerBackground().forEach((element) => {
        drawerBackgroundState.set(element, element.hasAttribute("inert"));
        element.setAttribute("inert", "");
      });
      (close || drawerFocusables()[0])?.focus();
    } else {
      drawer.setAttribute("inert", "");
      document.body.style.overflow = previousBodyOverflow;
      drawerBackgroundState.forEach((wasInert, element) => { if (!wasInert) element.removeAttribute("inert"); });
      drawerBackgroundState.clear();
      last?.focus?.();
    }
  }
  launch?.addEventListener("click", () => setDrawer(true));
  close?.addEventListener("click", () => setDrawer(false));
  scrim?.addEventListener("click", () => setDrawer(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && productFilterDrawer?.classList.contains("open")) {
      e.preventDefault();
      setProductFilters(false);
      return;
    }
    if (e.key === "Tab" && productFilterDrawer?.classList.contains("open")) {
      const focusables = productFilterFocusables();
      if (!focusables.length) { e.preventDefault(); productFilterDrawer.focus?.(); return; }
      const first = focusables[0], lastFilterFocusable = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || !productFilterDrawer.contains(document.activeElement))) { e.preventDefault(); lastFilterFocusable.focus(); }
      else if (!e.shiftKey && document.activeElement === lastFilterFocusable) { e.preventDefault(); first.focus(); }
      return;
    }
    if (!drawer?.classList.contains("open")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setDrawer(false);
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = drawerFocusables();
    if (!focusables.length) {
      e.preventDefault();
      drawer.focus();
      return;
    }
    const first = focusables[0];
    const lastFocusable = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
      e.preventDefault();
      lastFocusable.focus();
    } else if (!e.shiftKey && document.activeElement === lastFocusable) {
      e.preventDefault();
      first.focus();
    }
  });
  if (drawer?.classList.contains("open")) setDrawer(true);
  document.querySelectorAll(".runtime-product-gallery").forEach((gallery) => {
    const mainImage = gallery.querySelector("[data-gallery-main]");
    const thumbnails = [...gallery.querySelectorAll(".gallery-thumbnails button")];
    let selectedIndex = Math.max(0, thumbnails.findIndex((button) => button.getAttribute("aria-selected") === "true"));
    const selectImage = (nextIndex) => {
      if (!mainImage || !thumbnails.length) return;
      selectedIndex = (nextIndex + thumbnails.length) % thumbnails.length;
      thumbnails.forEach((button, index) => {
        const selected = index === selectedIndex;
        button.setAttribute("aria-selected", String(selected));
        if (selected) {
          const image = button.querySelector("img");
          mainImage.src = image?.src || mainImage.src;
          mainImage.alt = button.dataset.galleryAlt || image?.alt || mainImage.alt;
        }
      });
    };
    thumbnails.forEach((button, index) => button.addEventListener("click", () => selectImage(index)));
    gallery.querySelector(".gallery-prev")?.addEventListener("click", () => selectImage(selectedIndex - 1));
    gallery.querySelector(".gallery-next")?.addEventListener("click", () => selectImage(selectedIndex + 1));
  });
  document.querySelectorAll(".runtime-variant-selector").forEach((selector) => {
    const variants = [...selector.querySelectorAll("[data-product-variant]")];
    const stock = selector.querySelector(".pd-variant-stock");
    const price = selector.querySelector(".pd-price strong");
    const comparePrice = selector.querySelector(".pd-price del");
    const discount = selector.querySelector(".pd-price span");
    const purchase = selector.parentElement?.querySelector(".pd-purchase");
    const addButton = purchase?.querySelector(".pd-add-button");
    const quantityOutput = purchase?.querySelector("[data-pd-quantity]");
    const quantityMinus = purchase?.querySelector("[data-pd-quantity-minus]");
    const quantityPlus = purchase?.querySelector("[data-pd-quantity-plus]");
    const cartStatus = purchase?.querySelector("[data-pd-cart-status]");
    const cartBadge = launch?.querySelector("span");
    const cartEmpty = drawer?.querySelector("[data-local-cart-empty]");
    const cartLines = drawer?.querySelector("[data-local-cart-lines]");
    const cartTemplate = drawer?.querySelector("[data-local-cart-template]");
    const cartFooter = drawer?.querySelector("[data-local-cart-footer]");
    const cartSubtotal = drawer?.querySelector("[data-cart-subtotal]");
    const base = { price: 39, comparePrice: 49 };
    let selectedVariant = variants.find((button) => button.getAttribute("aria-pressed") === "true") || null;
    let purchaseQuantity = 1;
    const cartItems = new Map();
    const productId = purchase?.dataset.productId || "product";
    const selectedKey = () => selectedVariant ? `${productId}:${selectedVariant.textContent.trim()}` : "";
    const selectedStock = () => selectedVariant ? Math.max(0, Number(selectedVariant.dataset.stock) || 0) : 0;
    const selectedCartQuantity = () => cartItems.get(selectedKey())?.quantity || 0;
    const remainingStock = () => Math.max(0, selectedStock() - selectedCartQuantity());
    const updatePurchaseState = () => {
      const needsVariant = !selectedVariant;
      const remaining = remainingStock();
      const atLimit = !needsVariant && remaining === 0;
      purchaseQuantity = Math.max(1, Math.min(purchaseQuantity, Math.max(1, remaining)));
      if (quantityOutput) quantityOutput.textContent = String(purchaseQuantity);
      if (quantityMinus) quantityMinus.disabled = purchaseQuantity <= 1 || needsVariant || atLimit;
      if (quantityPlus) quantityPlus.disabled = needsVariant || atLimit || purchaseQuantity >= remaining;
      if (addButton) {
        addButton.disabled = needsVariant || selectedStock() <= 0 || atLimit;
        addButton.setAttribute("aria-disabled", String(addButton.disabled));
        addButton.textContent = needsVariant ? "Select a variant" : selectedStock() <= 0 ? "Out of stock" : "Add to cart";
      }
      if (cartStatus) {
        cartStatus.classList.toggle("is-limit", atLimit);
        cartStatus.textContent = atLimit ? `Stock limit reached · ${selectedStock()} in cart` : "";
      }
    };
    const renderCart = () => {
      const items = [...cartItems.entries()];
      const hasItem = items.length > 0;
      const totalQuantity = items.reduce((sum, [, item]) => sum + item.quantity, 0);
      if (cartBadge) cartBadge.textContent = String(totalQuantity);
      if (cartEmpty) cartEmpty.hidden = hasItem;
      if (cartFooter) cartFooter.hidden = !hasItem;
      if (cartLines) {
        cartLines.replaceChildren();
        items.forEach(([key, item]) => {
          const line = cartTemplate?.content.firstElementChild?.cloneNode(true);
          if (!line) return;
          line.dataset.cartLineKey = key;
          const lineImage = line.querySelector("[data-cart-line-image]");
          if (lineImage) { lineImage.src = purchase?.dataset.productImage || ""; lineImage.alt = purchase?.dataset.productName || "Product"; }
          line.querySelector("[data-cart-line-name]").textContent = purchase?.dataset.productName || "Product";
          line.querySelector("[data-cart-line-variant]").textContent = item.variant;
          line.querySelector("[data-cart-line-unit]").textContent = `RM ${item.price.toFixed(2)} each`;
          line.querySelector("[data-cart-quantity]").textContent = String(item.quantity);
          line.querySelector("[data-cart-minus]").disabled = item.quantity <= 1;
          line.querySelector("[data-cart-plus]").disabled = item.quantity >= item.stock;
          cartLines.append(line);
        });
      }
      if (cartSubtotal) cartSubtotal.textContent = `RM ${items.reduce((sum, [, item]) => sum + item.price * item.quantity, 0).toFixed(2)}`;
      updatePurchaseState();
    };
    const renderVariant = (button) => {
      const selectedPrice = button ? Number(button.dataset.price) : base.price;
      const selectedCompare = button ? Number(button.dataset.comparePrice) : base.comparePrice;
      const selectedStock = button ? Number(button.dataset.stock) : null;
      const hasDiscount = Number.isFinite(selectedCompare) && selectedCompare > selectedPrice;
      if (price) price.textContent = `RM ${selectedPrice.toFixed(2)}`;
      if (comparePrice) { comparePrice.hidden = !hasDiscount; comparePrice.textContent = hasDiscount ? `RM ${selectedCompare.toFixed(2)}` : ""; }
      if (discount) { discount.hidden = !hasDiscount; discount.textContent = hasDiscount ? `-${Math.round((1 - selectedPrice / selectedCompare) * 100)}%` : ""; }
      if (stock) {
        stock.hidden = selectedStock === null;
        stock.classList.toggle("low-stock", selectedStock !== null && selectedStock <= 5);
        stock.textContent = selectedStock === null ? "" : selectedStock > 5 ? `In Stock · ${selectedStock} available` : `Only ${selectedStock} left`;
      }
      updatePurchaseState();
    };
    variants.forEach((button) => button.addEventListener("click", () => {
      const nextSelected = button.getAttribute("aria-pressed") !== "true";
      variants.forEach((item) => item.setAttribute("aria-pressed", String(nextSelected && item === button)));
      selectedVariant = nextSelected ? button : null;
      purchaseQuantity = 1;
      renderVariant(selectedVariant);
    }));
    quantityMinus?.addEventListener("click", () => { purchaseQuantity = Math.max(1, purchaseQuantity - 1); updatePurchaseState(); });
    quantityPlus?.addEventListener("click", () => { purchaseQuantity = Math.min(remainingStock(), purchaseQuantity + 1); updatePurchaseState(); });
    addButton?.addEventListener("click", () => {
      if (!selectedVariant || addButton.disabled) return;
      const variantName = selectedVariant.textContent.trim();
      const variantPrice = Number(selectedVariant.dataset.price);
      const variantStock = selectedStock();
      const key = selectedKey();
      const item = cartItems.get(key) || { variant: variantName, price: variantPrice, stock: variantStock, quantity: 0 };
      item.quantity = Math.min(item.stock, item.quantity + purchaseQuantity);
      cartItems.set(key, item);
      purchaseQuantity = 1;
      renderCart();
      setDrawer(true);
    });
    cartLines?.addEventListener("click", (event) => {
      const action = event.target.closest("[data-cart-minus],[data-cart-plus],[data-cart-remove]");
      const line = action?.closest("[data-cart-line-key]");
      const key = line?.dataset.cartLineKey;
      const item = key ? cartItems.get(key) : null;
      if (!action || !key || !item) return;
      if (action.matches("[data-cart-minus]")) item.quantity = Math.max(1, item.quantity - 1);
      if (action.matches("[data-cart-plus]")) item.quantity = Math.min(item.stock, item.quantity + 1);
      if (action.matches("[data-cart-remove]")) cartItems.delete(key); else cartItems.set(key, item);
      renderCart();
      if (!cartItems.size) cartEmpty?.querySelector("a")?.focus();
    });
    renderVariant(selectedVariant);
    renderCart();
  });
  document.querySelectorAll(".demo-form:not([data-commerce-preview])").forEach((form) =>
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const status = form.querySelector(".form-status");
      if (status) {
        const runtimeMirror = form.closest("[data-runtime-component]");
        status.textContent = runtimeMirror
          ? "Static renderer mirror: no data was submitted."
          : "Static prototype: no data was submitted.";
      }
    }),
  );
  document.querySelectorAll("form[data-commerce-preview]").forEach((form) => form.addEventListener("submit", (event) => event.preventDefault()));
});
