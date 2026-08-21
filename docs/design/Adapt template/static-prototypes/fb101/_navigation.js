(() => {
  const navigation = document.querySelector("[data-fb101-navigation]");
  if (!navigation) return;
  const menu = navigation.querySelector("[data-navigation-menu]");
  const mobile = navigation.querySelector("[data-navigation-mobile]");
  const setOpen = (open, restoreFocus = false) => {
    mobile.hidden = !open;
    mobile.classList.toggle("is-open", open);
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.textContent = open ? "×" : "☰";
    if (!open && restoreFocus) menu.focus();
  };
  menu.addEventListener("click", () => {
    setOpen(menu.getAttribute("aria-expanded") !== "true");
  });
  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !mobile.hidden) setOpen(false, true);
  });
  addEventListener("resize", () => {
    if (innerWidth > 760 && !mobile.hidden) setOpen(false);
  });
})();
