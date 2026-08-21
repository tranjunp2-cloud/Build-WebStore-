(() => {
  const menu = document.querySelector(".menu-btn");
  const mobile = document.querySelector(".mobile-nav");
  menu?.addEventListener("click", () => {
    const open = mobile.classList.toggle("open");
    menu.setAttribute("aria-expanded", String(open));
  });

  const heroSlides = [...document.querySelectorAll(".hero-slide")];
  const heroDots = [...document.querySelectorAll(".hero-dots .dot")];
  const heroToggle = document.querySelector(".hero-toggle");
  let heroIndex = 0;
  let heroTimer;
  function showHero(index) {
    if (!heroSlides.length) return;
    heroIndex = (index + heroSlides.length) % heroSlides.length;
    heroSlides.forEach((slide, i) =>
      slide.classList.toggle("active", i === heroIndex),
    );
    heroDots.forEach((dot, i) =>
      dot.setAttribute("aria-current", String(i === heroIndex)),
    );
  }
  heroDots.forEach((dot, i) =>
    dot.addEventListener("click", () => showHero(i)),
  );
  function setHeroPlaying(playing) {
    window.clearInterval(heroTimer);
    heroTimer = undefined;
    if (playing && heroSlides.length > 1) {
      heroTimer = window.setInterval(() => showHero(heroIndex + 1), 5000);
    }
    if (heroToggle) {
      heroToggle.setAttribute("aria-pressed", String(!playing));
      heroToggle.setAttribute(
        "aria-label",
        playing ? "Pause slideshow" : "Play slideshow",
      );
      heroToggle.textContent = playing ? "Ⅱ" : "▶";
    }
  }
  heroToggle?.addEventListener("click", () => setHeroPlaying(!heroTimer));
  setHeroPlaying(
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  document.querySelectorAll("[data-carousel]").forEach((carousel) => {
    const track = carousel.querySelector(".carousel-track");
    const slides = [...carousel.querySelectorAll(".carousel-slide")];
    const dots = [
      ...carousel.parentElement.querySelectorAll(".carousel-dots .dot"),
    ];
    let index = 0;
    function show(next) {
      index = (next + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((dot, i) =>
        dot.setAttribute("aria-current", String(i === index)),
      );
    }
    carousel
      .querySelector(".prev")
      ?.addEventListener("click", () => show(index - 1));
    carousel
      .querySelector(".next")
      ?.addEventListener("click", () => show(index + 1));
    dots.forEach((dot, i) => dot.addEventListener("click", () => show(i)));
  });

  document.querySelectorAll("[data-products-grid]").forEach((root) => {
    const grid = root.querySelector(".product-grid");
    const cards = [...root.querySelectorAll(".product-card")];
    const count = root.querySelector(".products-count strong");
    const empty = root.querySelector(".products-empty");
    const pagination = root.querySelector(".pagination");
    const desktopSearch = root.querySelector("#product-search");
    const mobileSearch = root.querySelector("#mobile-product-search");
    const desktopChecks = [
      ...root.querySelectorAll(".filters input[type=checkbox]"),
    ];
    const mobileChecks = [
      ...root.querySelectorAll(".mobile-filter-drawer input[type=checkbox]"),
    ];
    const chips = root.querySelector(".filter-chips");
    const drawer = root.querySelector(".mobile-filter-drawer");
    const backdrop = root.querySelector(".filter-backdrop");
    const trigger = root.querySelector(".mobile-filter");
    const close = drawer?.querySelector(".mobile-filter-head button");
    const initialParams = new URLSearchParams(location.search);
    let query = (initialParams.get("search") || "").trim().toLowerCase();
    let categories = new Set(initialParams.getAll("categoryId"));
    const rawMinPrice = Number(initialParams.get("minPrice") ?? 0);
    const rawMaxPrice = Number(initialParams.get("maxPrice") ?? 1000);
    const clampedMinPrice = Math.min(
      1000,
      Math.max(0, Number.isFinite(rawMinPrice) ? rawMinPrice : 0),
    );
    const clampedMaxPrice = Math.min(
      1000,
      Math.max(0, Number.isFinite(rawMaxPrice) ? rawMaxPrice : 1000),
    );
    let minPrice = Math.min(clampedMinPrice, clampedMaxPrice);
    let maxPrice = Math.max(clampedMinPrice, clampedMaxPrice);
    let filterPriorFocus;
    const categoryButtons = [
      ...root.querySelectorAll("[data-category-filter]"),
    ];
    const priceMins = [...root.querySelectorAll("[data-price-min]")];
    const priceMaxes = [...root.querySelectorAll("[data-price-max]")];

    function syncUrl() {
      if (location.protocol === "file:") return;
      const params = new URLSearchParams(location.search);
      params.delete("search");
      params.delete("categoryId");
      params.delete("minPrice");
      params.delete("maxPrice");
      if (query) params.set("search", query);
      categories.forEach((category) => params.append("categoryId", category));
      if (minPrice) params.set("minPrice", String(minPrice));
      if (maxPrice < 1000) params.set("maxPrice", String(maxPrice));
      history.replaceState(
        null,
        "",
        `${location.pathname}${params.size ? `?${params}` : ""}`,
      );
    }
    function renderChips() {
      if (!chips) return;
      chips.replaceChildren();
      categories.forEach((category) => {
        const chip = document.createElement("span");
        chip.className = "filter-chip";
        chip.append(category[0].toUpperCase() + category.slice(1));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.setAttribute("aria-label", `Remove ${category}`);
        remove.textContent = "×";
        remove.addEventListener("click", () => {
          categories.delete(category);
          syncControls();
          apply();
        });
        chip.append(remove);
        chips.append(chip);
      });
      if (minPrice > 0 || maxPrice < 1000) {
        const chip = document.createElement("span");
        chip.className = "filter-chip";
        chip.append(`Price: RM ${minPrice} — RM ${maxPrice}`);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.setAttribute("aria-label", "Remove price filter");
        remove.textContent = "×";
        remove.addEventListener("click", () => {
          minPrice = 0;
          maxPrice = 1000;
          syncControls();
          apply();
        });
        chip.append(remove);
        chips.append(chip);
      }
      if (categories.size || minPrice > 0 || maxPrice < 1000) {
        const clear = document.createElement("button");
        clear.type = "button";
        clear.className = "filter-chip clear-filters";
        clear.textContent = "Clear filters";
        clear.addEventListener("click", clearFilters);
        chips.append(clear);
      }
    }
    function syncControls() {
      [...desktopChecks, ...mobileChecks].forEach((input) => {
        input.checked = categories.has(input.value);
      });
      categoryButtons.forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(categories.has(button.dataset.categoryFilter)),
        ),
      );
      priceMins.forEach((input) => {
        input.value = String(minPrice);
      });
      priceMaxes.forEach((input) => {
        input.value = String(maxPrice);
      });
      root.querySelectorAll(".price-output").forEach((output) => {
        const spans = output.querySelectorAll("span");
        if (spans[0]) spans[0].textContent = minPrice.toLocaleString();
        if (spans[1]) spans[1].textContent = maxPrice.toLocaleString();
      });
    }
    function apply() {
      let visible = 0;
      cards.forEach((card) => {
        const text = card.textContent.toLowerCase();
        const categoryMatch =
          !categories.size || categories.has(card.dataset.category);
        const price = Number(card.dataset.price);
        const show =
          categoryMatch &&
          price >= minPrice &&
          price <= maxPrice &&
          (!query || text.includes(query));
        card.hidden = !show;
        if (show) visible += 1;
      });
      if (count) count.textContent = String(visible);
      empty?.toggleAttribute("hidden", visible !== 0);
      pagination?.toggleAttribute("hidden", visible === 0);
      renderChips();
      syncUrl();
    }
    function closeFilters() {
      drawer?.classList.remove("open");
      backdrop?.classList.remove("open");
      if (drawer?.open) drawer.close();
      backdrop?.setAttribute("hidden", "");
      trigger?.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      filterPriorFocus?.focus();
    }
    function openFilters() {
      filterPriorFocus = document.activeElement;
      if (mobileSearch) mobileSearch.value = query;
      syncControls();
      backdrop?.removeAttribute("hidden");
      drawer?.showModal();
      drawer?.classList.add("open");
      backdrop?.classList.add("open");
      trigger?.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      close?.focus();
    }
    root
      .querySelector(".product-search")
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        query = desktopSearch.value.trim().toLowerCase();
        if (mobileSearch) mobileSearch.value = query;
        apply();
      });
    desktopSearch?.addEventListener("blur", () => {
      query = desktopSearch.value.trim().toLowerCase();
      if (mobileSearch) mobileSearch.value = query;
      apply();
    });
    desktopChecks.forEach((input) =>
      input.addEventListener("change", () => {
        categories = new Set(
          desktopChecks
            .filter((item) => item.checked)
            .map((item) => item.value),
        );
        syncControls();
        apply();
      }),
    );
    categoryButtons.forEach((button) =>
      button.addEventListener("click", () => {
        const value = button.dataset.categoryFilter;
        if (categories.has(value)) categories.delete(value);
        else categories.add(value);
        syncControls();
        apply();
      }),
    );
    priceMins.forEach((input) =>
      input.addEventListener("change", () => {
        minPrice = Math.min(Number(input.value), maxPrice);
        syncControls();
        apply();
      }),
    );
    priceMaxes.forEach((input) =>
      input.addEventListener("change", () => {
        maxPrice = Math.max(Number(input.value), minPrice);
        syncControls();
        apply();
      }),
    );
    root.querySelectorAll("[data-view]").forEach((button) =>
      button.addEventListener("click", () => {
        const list = button.dataset.view === "list";
        grid?.classList.toggle("list-view", list);
        root
          .querySelectorAll("[data-view]")
          .forEach((item) =>
            item.setAttribute("aria-pressed", String(item === button)),
          );
        const params = new URLSearchParams(location.search);
        if (list) params.set("view", "list");
        else params.delete("view");
        if (location.protocol !== "file:")
          history.pushState(
            null,
            "",
            `${location.pathname}${params.size ? `?${params}` : ""}`,
          );
      }),
    );
    trigger?.addEventListener("click", openFilters);
    close?.addEventListener("click", closeFilters);
    backdrop?.addEventListener("click", closeFilters);
    drawer?.addEventListener("click", (event) => {
      const rect = drawer.getBoundingClientRect();
      if (
        event.clientY < rect.top ||
        event.clientX < rect.left ||
        event.clientX > rect.right
      )
        closeFilters();
    });
    drawer?.querySelector(".apply-filters")?.addEventListener("click", () => {
      query = mobileSearch.value.trim().toLowerCase();
      if (desktopSearch) desktopSearch.value = query;
      categories = new Set(
        mobileChecks.filter((item) => item.checked).map((item) => item.value),
      );
      minPrice = Number(priceMins.at(-1)?.value || 0);
      maxPrice = Number(priceMaxes.at(-1)?.value || 1000);
      syncControls();
      apply();
      closeFilters();
    });
    empty?.querySelector("button")?.addEventListener("click", () => {
      query = "";
      categories.clear();
      if (desktopSearch) desktopSearch.value = "";
      if (mobileSearch) mobileSearch.value = "";
      minPrice = 0;
      maxPrice = 1000;
      syncControls();
      apply();
    });
    function clearFilters() {
      query = "";
      categories.clear();
      minPrice = 0;
      maxPrice = 1000;
      if (desktopSearch) desktopSearch.value = "";
      if (mobileSearch) mobileSearch.value = "";
      syncControls();
      apply();
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && drawer?.classList.contains("open"))
        closeFilters();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth >= 1024 && drawer?.open) closeFilters();
    });
    if (desktopSearch) desktopSearch.value = query;
    if (mobileSearch) mobileSearch.value = query;
    syncControls();
    if (initialParams.get("view") === "list")
      root.querySelector('[data-view="list"]')?.click();
    apply();
  });

  const faqButtons = [...document.querySelectorAll(".faq-question")];
  faqButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      const opening = button.getAttribute("aria-expanded") !== "true";
      faqButtons.forEach((item) => {
        item.setAttribute("aria-expanded", "false");
        document
          .getElementById(item.getAttribute("aria-controls"))
          ?.setAttribute("hidden", "");
      });
      if (opening) {
        button.setAttribute("aria-expanded", "true");
        document
          .getElementById(button.getAttribute("aria-controls"))
          ?.removeAttribute("hidden");
      }
    });
    button.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? faqButtons.length - 1
            : (index +
                (event.key === "ArrowDown" ? 1 : -1) +
                faqButtons.length) %
              faqButtons.length;
      faqButtons[next].focus();
    });
  });

  document.querySelectorAll("[data-quantity-stepper]").forEach((stepper) => {
    const output = stepper.querySelector("[data-quantity-output]");
    const decrement = stepper.querySelector("[data-quantity-decrement]");
    const increment = stepper.querySelector("[data-quantity-increment]");
    const minimum = Number(stepper.dataset.min) || 1;
    const maximum = Number(stepper.dataset.max) || Number.MAX_SAFE_INTEGER;
    const readQuantity = () => Number(output?.textContent) || minimum;
    const setQuantity = (nextValue) => {
      if (!output || !Number.isSafeInteger(nextValue)) return;
      const quantity = Math.min(maximum, Math.max(minimum, nextValue));
      output.textContent = String(quantity);
      decrement?.toggleAttribute("disabled", quantity <= minimum);
      increment?.toggleAttribute("disabled", quantity >= maximum);
    };
    decrement?.addEventListener("click", () => setQuantity(readQuantity() - 1));
    increment?.addEventListener("click", () => setQuantity(readQuantity() + 1));
    setQuantity(readQuantity());
  });

  const launcher = document.querySelector(".cart-launcher");
  const drawer = document.querySelector(".drawer");
  const backdrop = document.querySelector(".drawer-backdrop");
  const closeDrawer = document.querySelector(".drawer-head button");
  let activeDialog;
  let priorFocus;
  const pageRoots = [...document.body.children].filter(
    (node) => !node.matches(".drawer, .drawer-backdrop, script"),
  );
  const focusable = (dialog) => [
    ...dialog.querySelectorAll(
      'a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])',
    ),
  ];

  function setBackgroundInert(inert) {
    pageRoots.forEach((node) => node.toggleAttribute("inert", inert));
  }
  function activate(dialog, trigger) {
    if (!dialog) return;
    priorFocus = trigger || document.activeElement;
    activeDialog = dialog;
    dialog.setAttribute("aria-hidden", "false");
    setBackgroundInert(true);
    focusable(dialog)[0]?.focus();
  }
  function deactivate(dialog) {
    if (!dialog) return;
    dialog.setAttribute("aria-hidden", "true");
    activeDialog = undefined;
    setBackgroundInert(false);
    priorFocus?.focus();
  }
  function setDrawer(open) {
    if (!drawer) return;
    drawer.toggleAttribute("inert", !open);
    drawer.classList.toggle("open", open);
    backdrop?.classList.toggle("open", open);
    if (open) activate(drawer, launcher);
    else deactivate(drawer);
  }

  launcher?.addEventListener("click", () => setDrawer(true));
  closeDrawer?.addEventListener("click", () => setDrawer(false));
  backdrop?.addEventListener("click", () => setDrawer(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (drawer?.classList.contains("open")) setDrawer(false);
    }
    if (event.key !== "Tab" || !activeDialog) return;
    const items = focusable(activeDialog);
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
})();
