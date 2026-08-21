(() => {
  const cart = document.querySelector(".pw-cart-widget");
  if (!cart) return;

  const count = cart.querySelector(".pw-cart-count");
  count.textContent = "0";
})();
