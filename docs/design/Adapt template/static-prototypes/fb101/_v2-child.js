(() => {
  const menu = document.querySelector(".menu"),
    mobile = document.querySelector(".mobile");
  if (menu && mobile) {
    menu.addEventListener("click", () => {
      const open = mobile.classList.toggle("open");
      mobile.hidden = !open;
      menu.setAttribute("aria-expanded", String(open));
      menu.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu.textContent = open ? "×" : "☰";
    });
    addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !mobile.hidden) {
        mobile.hidden = true;
        mobile.classList.remove("open");
        menu.setAttribute("aria-expanded", "false");
        menu.setAttribute("aria-label", "Open menu");
        menu.textContent = "☰";
        menu.focus();
      }
    });
  }
  const form = document.querySelector("[data-contact-preview]");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const status = form.querySelector(".form-status");
      status.classList.add("show");
      status.textContent = "Thanks — your message preview is ready.";
      status.focus();
    });
  }
  const toolbar = document.querySelector("[data-product-controls]"),
    cards = [...document.querySelectorAll(".product-card")];
  if (toolbar && cards.length) {
    const search = toolbar.querySelector('[type="search"]'),
      category = toolbar.querySelector('[name="category"]'),
      sort = toolbar.querySelector('[name="sort"]'),
      reset = toolbar.querySelector("[data-reset-filters]"),
      grid = document.querySelector(".product-grid"),
      count = document.querySelector("[data-result-count]");
    const requestedCategory = new URLSearchParams(window.location.search).get(
      "category",
    );
    if (
      requestedCategory &&
      [...category.options].some((option) => option.value === requestedCategory)
    ) {
      category.value = requestedCategory;
    }
    const update = () => {
      const term = search.value.trim().toLowerCase(),
        selected = category.value;
      cards.forEach((card) => {
        card.hidden = !(
          card.dataset.name.includes(term) &&
          (selected === "all" || card.dataset.category === selected)
        );
      });
      const visible = cards.filter((card) => !card.hidden);
      const ordered =
        sort.value === "price"
          ? [...visible].sort((a, b) => +a.dataset.price - +b.dataset.price)
          : cards;
      ordered.forEach((card) => grid.append(card));
      count.textContent = `Showing ${visible.length} products`;
    };
    toolbar.addEventListener("input", update);
    toolbar.addEventListener("change", update);
    reset?.addEventListener("click", () => {
      search.value = "";
      category.value = "all";
      sort.value = "featured";
      history.replaceState({}, "", location.pathname);
      update();
      search.focus();
    });
    update();
  }
  document.querySelectorAll("[data-newsletter-preview]").forEach((form) =>
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const status = form.querySelector('[role="status"]');
      status.textContent = "Thanks — subscription preview confirmed.";
    }),
  );
  const cart = document.querySelector(".cart-link");
  if (cart) {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div class="drawer-overlay" aria-hidden="true"><aside class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><div class="drawer-head"><div><small>OrganicNest basket</small><h2 id="drawer-title">Your cart</h2></div><button class="drawer-close" type="button" aria-label="Close cart">×</button></div><div class="drawer-empty"><div><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 5h2l2 10h10l3-7H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><h3>Your cart is empty</h3><p>Add something fresh to get started.</p><a class="button" href="' +
        cart
          .getAttribute("href")
          .replace("cart/index.html", "products/index.html") +
        '">Browse products</a></div></div></aside></div>',
    );
    const overlay = document.querySelector(".drawer-overlay"),
      close = overlay.querySelector(".drawer-close");
    let last;
    const setOpen = (open) => {
      overlay.classList.toggle("open", open);
      overlay.setAttribute("aria-hidden", String(!open));
      cart.setAttribute("aria-expanded", String(open));
      document
        .querySelectorAll("header,main,footer")
        .forEach((el) => (el.inert = open));
      document.body.style.overflow = open ? "hidden" : "";
      if (open) {
        last = document.activeElement;
        close.focus();
      } else last?.focus();
    };
    cart.addEventListener("click", (event) => {
      event.preventDefault();
      setOpen(true);
    });
    close.addEventListener("click", () => setOpen(false));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) setOpen(false);
    });
    addEventListener("keydown", (event) => {
      if (event.key === "Escape" && overlay.classList.contains("open"))
        setOpen(false);
      if (event.key === "Tab" && overlay.classList.contains("open")) {
        const focusable = [...overlay.querySelectorAll("button,a[href]")];
        const first = focusable[0],
          lastItem = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          lastItem.focus();
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }
})();
