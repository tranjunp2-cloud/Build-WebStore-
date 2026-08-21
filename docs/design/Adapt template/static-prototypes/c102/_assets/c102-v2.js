(() => {
  const syncProductFilterStickyTop = () => {
    const sidebar = document.querySelector(".product-filter-sidebar");
    const stickyNav = document.querySelector(
      '.nav[data-block-variant="centered"]',
    );
    if (!sidebar || !stickyNav || innerWidth < 1024) return;
    const navHeight = stickyNav.getBoundingClientRect().height;
    sidebar.style.setProperty(
      "--product-filter-sticky-top",
      `${Math.ceil(navHeight + 16)}px`,
    );
  };

  const nav = document.querySelector('[data-block-type="navigation"]');
  const menu = document.querySelector("[data-menu-button]");
  const links = document.querySelector("[data-nav-links]");
  let overflow;
  let overflowButton;
  let overflowMenu;
  if (nav && links && links.children.length > 3) {
    overflow = document.createElement("div");
    overflow.className = "nav-overflow";
    overflowButton = document.createElement("button");
    overflowButton.type = "button";
    overflowButton.textContent = "More";
    overflowButton.setAttribute("aria-expanded", "false");
    overflowButton.setAttribute("aria-haspopup", "menu");
    overflowButton.setAttribute("aria-label", "More navigation links");
    overflowMenu = document.createElement("div");
    overflowMenu.className = "nav-overflow-menu";
    overflowMenu.setAttribute("role", "menu");
    overflowMenu.hidden = true;
    [...links.children].slice(3).forEach((link) => {
      const clone = link.cloneNode(true);
      clone.setAttribute("role", "menuitem");
      overflowMenu.append(clone);
    });
    overflow.append(overflowButton, overflowMenu);
    nav.querySelector(".nav-inner")?.append(overflow);
    overflowButton.addEventListener("click", () => {
      const open = overflowButton.getAttribute("aria-expanded") === "true";
      overflowButton.setAttribute("aria-expanded", String(!open));
      overflowMenu.hidden = open;
    });
  }
  menu?.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") === "true";
    menu.setAttribute("aria-expanded", String(!open));
    links?.classList.toggle("is-open", !open);
  });
  const closeMenu = () => {
    if (menu?.getAttribute("aria-expanded") !== "true") return;
    menu.setAttribute("aria-expanded", "false");
    links?.classList.remove("is-open");
    menu.focus();
  };
  document.addEventListener("pointerdown", (event) => {
    if (nav && !nav.contains(event.target)) closeMenu();
    if (overflow && !overflow.contains(event.target) && overflowMenu) {
      overflowMenu.hidden = true;
      overflowButton?.setAttribute("aria-expanded", "false");
    }
  });
  addEventListener(
    "scroll",
    () => {
      nav?.classList.toggle("is-scrolled", scrollY > 50);
      requestAnimationFrame(syncProductFilterStickyTop);
    },
    { passive: true },
  );
  addEventListener("resize", syncProductFilterStickyTop);
  nav?.addEventListener("transitionend", syncProductFilterStickyTop);
  if ("ResizeObserver" in window) {
    const stickyHeaderObserver = new ResizeObserver(syncProductFilterStickyTop);
    if (nav) stickyHeaderObserver.observe(nav);
  }
  syncProductFilterStickyTop();

  const slides = [...document.querySelectorAll("[data-hero-slide]")];
  const heroDots = [...document.querySelectorAll("[data-hero-dot]")];
  let heroIndex = 0;
  const showHero = (index) => {
    if (!slides.length) return;
    heroIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.classList.toggle("is-active", i === heroIndex);
      slide.setAttribute("aria-hidden", String(i !== heroIndex));
    });
    heroDots.forEach((dot, i) =>
      dot.setAttribute("aria-current", String(i === heroIndex)),
    );
  };
  heroDots.forEach((dot, i) =>
    dot.addEventListener("click", () => showHero(i)),
  );
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let heroPaused = false;
  let heroTimer;
  const syncHeroTimer = () => {
    clearInterval(heroTimer);
    if (!reduceMotion && !heroPaused && !document.hidden && slides.length > 1)
      heroTimer = setInterval(() => showHero(heroIndex + 1), 5000);
  };
  const hero = document.querySelector('[data-block-type="hero"]');
  hero?.addEventListener("mouseenter", () => {
    heroPaused = true;
    syncHeroTimer();
  });
  hero?.addEventListener("mouseleave", () => {
    heroPaused = false;
    syncHeroTimer();
  });
  hero?.addEventListener("focusin", () => {
    heroPaused = true;
    syncHeroTimer();
  });
  hero?.addEventListener("focusout", () => {
    heroPaused = false;
    syncHeroTimer();
  });
  document.addEventListener("visibilitychange", syncHeroTimer);
  syncHeroTimer();
  showHero(0);

  const track = document.querySelector("[data-carousel-track]");
  const carouselSlides = [...document.querySelectorAll(".carousel-slide")];
  const carouselDots = [...document.querySelectorAll("[data-carousel-dot]")];
  let carouselIndex = 0;
  const showCarousel = (index) => {
    if (!track || !carouselSlides.length) return;
    carouselIndex = (index + carouselSlides.length) % carouselSlides.length;
    track.style.transform = `translateX(-${carouselIndex * 100}%)`;
    carouselDots.forEach((dot, i) =>
      dot.setAttribute("aria-current", String(i === carouselIndex)),
    );
  };
  document
    .querySelector("[data-carousel-prev]")
    ?.addEventListener("click", () => showCarousel(carouselIndex - 1));
  document
    .querySelector("[data-carousel-next]")
    ?.addEventListener("click", () => showCarousel(carouselIndex + 1));
  carouselDots.forEach((dot, i) =>
    dot.addEventListener("click", () => showCarousel(i)),
  );
  showCarousel(0);

  const featuredRail = document.querySelector(
    '[data-block-type="products-featured"] .featured-wrap',
  );
  const featuredButtons = document.querySelectorAll(".featured-arrows button");
  const scrollFeatured = (direction) => {
    const card = featuredRail?.firstElementChild;
    if (!featuredRail || !card) return;
    featuredRail.scrollBy({
      left: direction * (card.getBoundingClientRect().width + 24),
      behavior: "smooth",
    });
  };
  featuredButtons[0]?.addEventListener("click", () => scrollFeatured(-1));
  featuredButtons[1]?.addEventListener("click", () => scrollFeatured(1));

  document.querySelectorAll("[data-newsletter-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const button = form.querySelector('button[type="submit"]');
      const status = form.querySelector("[data-newsletter-status]");
      if (!input?.checkValidity()) {
        if (status) status.textContent = "Enter a valid email address.";
        input?.focus();
        return;
      }
      if (button) {
        button.disabled = true;
        button.textContent = "Subscribing…";
      }
      if (status) status.textContent = "Thanks — you’re on the list.";
      if (button) button.textContent = "Subscribed";
    });
  });

  const cartOpen = document.querySelector("[data-cart-open]");
  const cartDrawer = document.querySelector("[data-cart-drawer]");
  const cartBackdrop = document.querySelector("[data-cart-backdrop]");
  const cartClose = document.querySelector("[data-cart-close]");
  const cartBackground = [...document.querySelectorAll("[data-cart-background]")];
  const setCartBackgroundInert = (active) => {
    cartBackground.forEach((element) => {
      if (active) {
        element.dataset.cartPreviousAriaHidden =
          element.getAttribute("aria-hidden") ?? "";
        element.inert = true;
        element.setAttribute("aria-hidden", "true");
      } else {
        element.inert = false;
        const previous = element.dataset.cartPreviousAriaHidden;
        if (previous) element.setAttribute("aria-hidden", previous);
        else element.removeAttribute("aria-hidden");
        delete element.dataset.cartPreviousAriaHidden;
      }
    });
  };
  const closeCart = () => {
    if (cartDrawer) cartDrawer.hidden = true;
    if (cartBackdrop) cartBackdrop.hidden = true;
    document.body.style.overflow = "";
    setCartBackgroundInert(false);
    cartOpen?.focus();
  };
  cartOpen?.addEventListener("click", () => {
    if (cartDrawer) cartDrawer.hidden = false;
    if (cartBackdrop) cartBackdrop.hidden = false;
    document.body.style.overflow = "hidden";
    setCartBackgroundInert(true);
    cartClose?.focus();
  });
  cartClose?.addEventListener("click", closeCart);
  cartBackdrop?.addEventListener("click", closeCart);
  if (cartDrawer && !cartDrawer.hidden) {
    document.body.style.overflow = "hidden";
    setCartBackgroundInert(true);
    queueMicrotask(() => cartClose?.focus());
  }
  addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (cartDrawer && !cartDrawer.hidden) closeCart();
      else if (overflowMenu && !overflowMenu.hidden) {
        overflowMenu.hidden = true;
        overflowButton?.setAttribute("aria-expanded", "false");
        overflowButton?.focus();
      } else closeMenu();
    }
    if (event.key === "Tab" && cartDrawer && !cartDrawer.hidden) {
      const focusable = [
        ...cartDrawer.querySelectorAll(
          "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  const orderForm = document.querySelector("[data-order-lookup]");
  orderForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = orderForm.querySelector('input[name="orderNumber"]');
    const error = orderForm.querySelector("#order-error");
    const value = input?.value.trim();
    if (!value) {
      if (error) error.textContent = "Order number is required.";
      input?.focus();
      return;
    }
    if (error) error.textContent = "";
    location.hash = `order-${encodeURIComponent(value)}`;
  });

  document.querySelectorAll('.pm input[type="radio"]').forEach((input) =>
    input.addEventListener("change", () => {
      document
        .querySelectorAll(".pm")
        .forEach((option) => option.classList.remove("active"));
      input.closest(".pm")?.classList.add("active");
    }),
  );
  document
    .querySelector("[data-place-order]")
    ?.addEventListener("click", () => {
      const form = document.querySelector("[data-checkout-form]");
      const error = document.querySelector("[data-checkout-error]");
      if (!form?.checkValidity()) {
        form?.reportValidity();
        if (error)
          error.textContent =
            "Complete the required contact and shipping fields.";
        return;
      }
      if (error) error.textContent = "Preview only — no order was created.";
    });

  const productVariants = [
    ...document.querySelectorAll("[data-product-variant]"),
  ];
  const productPrice = document.querySelector("[data-product-price]");
  const productAdd = document.querySelector("[data-product-add]");
  const productActionStatus = document.querySelector(
    "[data-product-action-status]",
  );
  const productQuantity = document.querySelector("[data-product-quantity]");
  const quantityDecrement = document.querySelector(
    "[data-quantity-decrement]",
  );
  const quantityIncrement = document.querySelector(
    "[data-quantity-increment]",
  );
  const readQuantity = () => {
    const value = Number(productQuantity?.textContent);
    return Number.isSafeInteger(value) && value >= 1 ? value : 1;
  };
  const setQuantity = (nextValue) => {
    if (!productQuantity || !Number.isSafeInteger(nextValue) || nextValue < 1)
      return;
    productQuantity.textContent = String(nextValue);
    if (quantityDecrement) quantityDecrement.disabled = nextValue === 1;
  };
  quantityDecrement?.addEventListener("click", () =>
    setQuantity(Math.max(1, readQuantity() - 1)),
  );
  quantityIncrement?.addEventListener("click", () => {
    const current = readQuantity();
    if (current < Number.MAX_SAFE_INTEGER) setQuantity(current + 1);
  });
  if (productVariants.length && productPrice && productAdd) {
    const selectVariant = (requestedButton) => {
      const selectedButton = requestedButton || productVariants[0];
      productVariants.forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button === selectedButton),
        ),
      );
      productPrice.textContent = `RM ${Number(selectedButton.dataset.price).toFixed(2)}`;
      productAdd.disabled = false;
      productAdd.textContent = "Add to cart";
      if (productActionStatus) {
        productActionStatus.hidden = true;
        productActionStatus.textContent = "";
      }
    };
    productVariants.forEach((button) =>
      button.addEventListener("click", () => selectVariant(button)),
    );
    selectVariant(
      productVariants.find(
        (button) => button.getAttribute("aria-pressed") === "true",
      ) || productVariants[0],
    );
    productAdd.addEventListener("click", () => {
      if (productAdd.disabled || !productActionStatus) return;
      productActionStatus.textContent =
        `Preview only — quantity ${readQuantity()}; your cart was not changed.`;
      productActionStatus.hidden = false;
    });
  }

  const productsGrid = document.querySelector("[data-products-grid]");
  if (productsGrid) {
    const products=[...productsGrid.querySelectorAll("[data-product]")],panel=document.querySelector("[data-filter-panel]"),backdrop=document.querySelector("[data-filter-backdrop]"),opener=document.querySelector("[data-filter-open]"),search=document.querySelector("[data-filter-search]"),min=document.querySelector("[data-filter-min]"),max=document.querySelector("[data-filter-max]"),categories=[...document.querySelectorAll("[data-filter-category]")],rangeOutput=document.querySelector("[data-filter-range-output]"),rangeTrack=document.querySelector("[data-filter-range-track]"),chips=document.querySelector("[data-active-filter-chips]"),count=document.querySelector("[data-product-count]"),empty=document.querySelector("[data-products-empty]");
    const params=new URLSearchParams(location.search),unrelated=[...params].filter(([key])=>!["categoryId","minPrice","maxPrice","search","view"].includes(key));let applied={search:params.get("search")||"",min:params.get("minPrice")||"",max:params.get("maxPrice")||"",categories:params.getAll("categoryId")};
    const rangeBounds={min:Number(min?.min||0),max:Number(max?.max||100)};
    const syncRangeVisual=()=>{if(!min||!max)return;const minValue=Number(min.value),maxValue=Number(max.value),span=rangeBounds.max-rangeBounds.min||1,minPercent=(minValue-rangeBounds.min)/span*100,maxPercent=(maxValue-rangeBounds.min)/span*100;if(rangeOutput)rangeOutput.textContent=`RM ${minValue} – RM ${maxValue}`;if(rangeTrack)rangeTrack.style.background=`linear-gradient(to right,var(--line) 0%,var(--line) ${minPercent}%,var(--rose-dark) ${minPercent}%,var(--rose-dark) ${maxPercent}%,var(--line) ${maxPercent}%,var(--line) 100%)`};
    const fillDraft=()=>{if(search)search.value=applied.search;if(min)min.value=applied.min||String(rangeBounds.min);if(max)max.value=applied.max||String(rangeBounds.max);categories.forEach(x=>x.setAttribute("aria-pressed",String(applied.categories.includes(x.value))));syncRangeVisual()};
    const syncProducts=()=>{let visible=0;products.forEach(product=>{const ok=(!applied.search||product.dataset.search.includes(applied.search.toLowerCase()))&&(!applied.categories.length||applied.categories.includes(product.dataset.category))&&Number(product.dataset.price)>=Number(applied.min||0)&&Number(product.dataset.price)<=Number(applied.max||Infinity);product.hidden=!ok;if(ok)visible++});if(count)count.textContent=`Showing ${visible} GlowBeauty essential${visible===1?"":"s"}`;if(empty)empty.hidden=visible>0;if(chips){chips.innerHTML="";const add=(label,remove,className="")=>{const chip=document.createElement("button");chip.type="button";chip.className=`filter-chip ${className}`.trim();chip.textContent=className?label:`${label} ×`;chip.setAttribute("aria-label",className?label:`Remove ${label}`);chip.addEventListener("click",remove);chips.append(chip)};applied.categories.forEach(category=>add(`Category: ${category}`,()=>{applied.categories=applied.categories.filter(x=>x!==category);fillDraft();syncProducts()}));if(applied.min||applied.max)add(`Price: RM ${applied.min||rangeBounds.min} – RM ${applied.max||rangeBounds.max}`,()=>{applied.min="";applied.max="";fillDraft();syncProducts()});if(applied.search)add(`Search: ${applied.search}`,()=>{applied.search="";fillDraft();syncProducts()});if(applied.categories.length||applied.min||applied.max||applied.search)add("Clear all filters",()=>clearAll(),"filter-chip-clear")}const next=new URLSearchParams(unrelated);applied.categories.forEach(x=>next.append("categoryId",x));if(applied.min)next.set("minPrice",applied.min);if(applied.max)next.set("maxPrice",applied.max);if(applied.search)next.set("search",applied.search);if(productsGrid.classList.contains("is-list"))next.set("view","list");history.replaceState(null,"",`${location.pathname}${next.size?`?${next}`:""}${location.hash}`)};
    const readDraft=()=>({search:search?.value.trim()||"",min:min&&Number(min.value)>rangeBounds.min?min.value:"",max:max&&Number(max.value)<rangeBounds.max?max.value:"",categories:categories.filter(x=>x.getAttribute("aria-pressed")==="true").map(x=>x.value)});const applyDraft=()=>{applied=readDraft();syncProducts()};const clearDraft=()=>{if(search)search.value="";if(min)min.value=String(rangeBounds.min);if(max)max.value=String(rangeBounds.max);categories.forEach(x=>x.setAttribute("aria-pressed","false"));syncRangeVisual()};const clearAll=()=>{applied={search:"",min:"",max:"",categories:[]};fillDraft();syncProducts()};
    const filterBackgroundTargets=()=>{const section=panel?.closest("section"),targets=[...document.querySelectorAll("header,footer,main>section")].filter(x=>!x.contains(panel));if(section){targets.push(...[...section.querySelectorAll(":scope > .container > *")].filter(x=>!x.contains(panel)));const layout=panel.closest(".products-filter-layout");if(layout)targets.push(...[...layout.children].filter(x=>x!==panel&&x!==backdrop))}return [...new Set(targets)]};
    const setBackground=(active)=>filterBackgroundTargets().forEach(x=>{if(active){x.dataset.filterPreviousAriaHidden=x.getAttribute("aria-hidden")??"";x.inert=true;x.setAttribute("aria-hidden","true")}else{x.inert=false;const previous=x.dataset.filterPreviousAriaHidden;if(previous)x.setAttribute("aria-hidden",previous);else x.removeAttribute("aria-hidden");delete x.dataset.filterPreviousAriaHidden}});
    const setPanelSemantics=(dialog)=>{if(!panel)return;panel.setAttribute("role",dialog?"dialog":"complementary");if(dialog)panel.setAttribute("aria-modal","true");else panel.removeAttribute("aria-modal")};
    const closeDrawer=(apply=false,restoreFocus=true)=>{if(apply)applyDraft();else fillDraft();panel?.classList.remove("is-open");if(backdrop)backdrop.hidden=true;document.body.style.overflow="";setBackground(false);setPanelSemantics(false);opener?.setAttribute("aria-expanded","false");if(restoreFocus)opener?.focus()};
    opener?.addEventListener("click",()=>{if(innerWidth>=1024)return;fillDraft();panel?.classList.add("is-open");setPanelSemantics(true);if(backdrop)backdrop.hidden=false;document.body.style.overflow="hidden";setBackground(true);opener.setAttribute("aria-expanded","true");panel?.querySelector("button,input")?.focus()});document.querySelector("[data-filter-close]")?.addEventListener("click",()=>closeDrawer(false));backdrop?.addEventListener("click",()=>closeDrawer(false));document.querySelector("[data-filter-save]")?.addEventListener("click",()=>closeDrawer(true));document.querySelectorAll("[data-filter-clear]").forEach(x=>x.addEventListener("click",()=>{if(innerWidth<1024&&panel?.contains(x))clearDraft();else clearAll()}));document.querySelector("[data-filter-search-form]")?.addEventListener("submit",event=>{event.preventDefault();if(innerWidth>=1024)applyDraft()});search?.addEventListener("blur",()=>{if(innerWidth>=1024)applyDraft()});categories.forEach(button=>button.addEventListener("click",()=>{button.setAttribute("aria-pressed",String(button.getAttribute("aria-pressed")!=="true"));if(innerWidth>=1024)applyDraft()}));min?.addEventListener("input",()=>{if(Number(min.value)>Number(max?.value))min.value=max.value;syncRangeVisual()});max?.addEventListener("input",()=>{if(Number(max.value)<Number(min?.value))max.value=min.value;syncRangeVisual()});[min,max].forEach(input=>input?.addEventListener("change",()=>{if(innerWidth>=1024)applyDraft()}));
    document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>{productsGrid.classList.toggle("is-list",button.dataset.view==="list");document.querySelectorAll("[data-view]").forEach(x=>x.setAttribute("aria-pressed",String(x===button)));syncProducts()}));if(params.get("view")==="list")productsGrid.classList.add("is-list");fillDraft();syncProducts();
    addEventListener("keydown",event=>{if(!panel?.classList.contains("is-open"))return;if(event.key==="Escape")closeDrawer(false);if(event.key==="Tab"){const focusable=[...panel.querySelectorAll("button,input")].filter(x=>!x.disabled),first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}});
    addEventListener("resize",()=>{if(innerWidth>=1024&&panel?.classList.contains("is-open"))closeDrawer(false,false);else setPanelSemantics(innerWidth<1024&&panel?.classList.contains("is-open"))});setPanelSemantics(false);
  }
})();
