const revealTargets = document.querySelectorAll("[data-reveal]");
const revealAll = () => {
  revealTargets.forEach((target) => target.classList.add("is-visible"));
};

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const delayAttr = entry.target.getAttribute("data-reveal");
          if (delayAttr && delayAttr.startsWith("delay-")) {
            entry.target.classList.add(`reveal-${delayAttr}`);
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealTargets.forEach((target) => observer.observe(target));
} else {
  revealAll();
}

const header = document.querySelector(".site-header");
if (header) {
  const handleScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 50);
  };

  window.addEventListener("scroll", handleScroll);
  handleScroll();
}
