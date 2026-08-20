const menu = document.querySelector(".menu"),
  mobile = document.querySelector(".mobile-links");
if (mobile && !mobile.querySelector('[href="order-tracking/index.html"]')) {
  const ordersLink = document.createElement("a");
  ordersLink.href = "order-tracking/index.html";
  ordersLink.textContent = "Orders";
  mobile.append(ordersLink);
}
if (menu && mobile)
  menu.onclick = () => {
    const open = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute(
      "aria-label",
      open ? "Close navigation menu" : "Open navigation menu",
    );
    mobile.classList.toggle("open", open);
    mobile.toggleAttribute("inert", !open);
  };
document.querySelectorAll(".filter-dropdown").forEach((dropdown) => {
  const label = dropdown.querySelector("summary");
  dropdown.addEventListener("toggle", () => {
    if (!dropdown.open) return;
    document.querySelectorAll(".filter-dropdown[open]").forEach((sibling) => {
      if (sibling !== dropdown) sibling.open = false;
    });
  });
  dropdown.querySelectorAll(".filter-options button").forEach((option) => {
    option.addEventListener("click", () => {
      const previous = dropdown.querySelector(".selected");
      previous?.classList.remove("selected");
      previous?.setAttribute("aria-pressed", "false");
      option.classList.add("selected");
      option.setAttribute("aria-pressed", "true");
      label.textContent = option.textContent;
      dropdown.open = false;
      label.focus();
    });
  });
});
document.addEventListener("click", (event) => {
  document.querySelectorAll(".filter-dropdown[open]").forEach((dropdown) => {
    if (!dropdown.contains(event.target)) dropdown.open = false;
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  document.querySelectorAll(".filter-dropdown[open]").forEach((dropdown) => {
    dropdown.open = false;
    dropdown.querySelector("summary")?.focus();
  });
});
const openCart = document.querySelector(".cart-launch"),
  closeCart = document.querySelector(".cart-close"),
  drawer = document.querySelector(".drawer"),
  shade = document.querySelector(".shade");
if (openCart && closeCart && drawer && shade) {
  const regions = document.querySelectorAll(".nav,main,.footer,.cart-widget");
  const toggle = (open) => {
    drawer.classList.toggle("open", open);
    shade.classList.toggle("open", open);
    drawer.toggleAttribute("inert", !open);
    drawer.setAttribute("aria-hidden", String(!open));
    regions.forEach((x) => x.toggleAttribute("inert", open));
    document.body.style.overflow = open ? "hidden" : "";
    (open ? closeCart : openCart).focus();
  };
  openCart.onclick = () => toggle(true);
  closeCart.onclick = () => toggle(false);
  shade.onclick = () => toggle(false);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("open")) toggle(false);
    if (e.key === "Tab" && drawer.classList.contains("open")) {
      const f = drawer.querySelectorAll("button,a[href]"),
        first = f[0],
        last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}
