document.documentElement.classList.add("js");

const menuButton = document.querySelector("[data-menu]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
menuButton?.addEventListener("click", () => {
  const open = mobileMenu?.classList.toggle("open") ?? false;
  menuButton.setAttribute("aria-expanded", String(open));
});

const overlay = document.querySelector("[data-cart-overlay]");
let cartTrigger = null;
const openCart = () => {
  if (!overlay) return;
  cartTrigger = document.activeElement;
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("lock");
  setTimeout(() => overlay.querySelector("[data-cart-close]")?.focus(), 300);
};
const closeCart = () => {
  if (!overlay) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lock");
  cartTrigger?.focus();
};
document
  .querySelectorAll("[data-cart-open]")
  .forEach((button) => button.addEventListener("click", openCart));
document
  .querySelector("[data-cart-close]")
  ?.addEventListener("click", closeCart);
overlay?.addEventListener("click", (event) => {
  if (event.target === overlay) closeCart();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeCart();
  if (event.key === "Tab" && overlay?.classList.contains("open")) {
    const focusable = [
      ...overlay.querySelectorAll(
        "a[href],button:not([disabled]),input:not([disabled])",
      ),
    ];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

document.querySelectorAll("[data-demo-form]").forEach((form) => {
  form.addEventListener("submit", (event) => event.preventDefault());
});

const carousel = document.querySelector("[data-v2-carousel]");
const carouselTrack = document.querySelector("[data-v2-track]");
const carouselSlides = [...document.querySelectorAll(".v2-carousel-slide")];
const carouselDots = [...document.querySelectorAll("[data-v2-dot]")];
let carouselIndex = 0;
const showCarouselSlide = (nextIndex) => {
  if (!carouselTrack || !carouselSlides.length) return;
  carouselIndex = (nextIndex + carouselSlides.length) % carouselSlides.length;
  carouselTrack.style.transform = `translateX(-${carouselIndex * 100}%)`;
  carouselDots.forEach((dot, index) => {
    dot.classList.toggle("active", index === carouselIndex);
    dot.setAttribute(
      "aria-current",
      index === carouselIndex ? "true" : "false",
    );
  });
};
carousel
  ?.querySelector("[data-v2-prev]")
  ?.addEventListener("click", () => showCarouselSlide(carouselIndex - 1));
carousel
  ?.querySelector("[data-v2-next]")
  ?.addEventListener("click", () => showCarouselSlide(carouselIndex + 1));
carouselDots.forEach((dot, index) =>
  dot.addEventListener("click", () => showCarouselSlide(index)),
);

const featuredTrack = document.querySelector("[data-featured-track]");
const scrollFeatured = (direction) => {
  if (!featuredTrack) return;
  const card = featuredTrack.firstElementChild;
  const amount = (card?.getBoundingClientRect().width || 500) + 24;
  featuredTrack.scrollBy({ left: direction * amount, behavior: "smooth" });
};
document
  .querySelector("[data-featured-prev]")
  ?.addEventListener("click", () => scrollFeatured(-1));
document
  .querySelector("[data-featured-next]")
  ?.addEventListener("click", () => scrollFeatured(1));
