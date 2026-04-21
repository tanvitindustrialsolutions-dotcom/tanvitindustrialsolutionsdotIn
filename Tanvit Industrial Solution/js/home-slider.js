(function () {
  const root = document.querySelector(".hero-slider");
  if (!root) return;

  const track = root.querySelector(".hero-slider-track");
  const slides = root.querySelectorAll(".hero-slide");
  const prevBtn = root.querySelector(".hero-slider-prev");
  const nextBtn = root.querySelector(".hero-slider-next");
  const dots = root.querySelectorAll(".hero-slider-dot");

  if (!track || slides.length === 0) return;

  let index = 0;
  const total = slides.length;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let autoplayTimer = null;
  const AUTO_MS = 6500;

  function setAria() {
    slides.forEach((slide, i) => {
      const hidden = i !== index;
      slide.setAttribute("aria-hidden", hidden ? "true" : "false");
      slide.tabIndex = hidden ? -1 : 0;
    });
    dots.forEach((dot, i) => {
      dot.setAttribute("aria-selected", i === index ? "true" : "false");
    });
  }

  function goTo(i) {
    index = ((i % total) + total) % total;
    track.style.transform = "translateX(-" + index * 100 + "%)";
    setAria();
  }

  function next() {
    goTo(index + 1);
  }

  function prev() {
    goTo(index - 1);
  }

  function startAutoplay() {
    if (reduceMotion) return;
    stopAutoplay();
    autoplayTimer = window.setInterval(next, AUTO_MS);
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      window.clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  prevBtn.addEventListener("click", () => {
    prev();
    startAutoplay();
  });
  nextBtn.addEventListener("click", () => {
    next();
    startAutoplay();
  });

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      goTo(i);
      startAutoplay();
    });
  });

  root.addEventListener("mouseenter", stopAutoplay);
  root.addEventListener("mouseleave", startAutoplay);
  root.addEventListener("focusin", stopAutoplay);
  root.addEventListener("focusout", function (e) {
    if (!root.contains(e.relatedTarget)) startAutoplay();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopAutoplay();
    else startAutoplay();
  });

  root.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
      startAutoplay();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
      startAutoplay();
    }
  });

  goTo(0);
  startAutoplay();
})();
