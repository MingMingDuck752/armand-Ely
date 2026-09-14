const welcomeText = document.querySelector('[data-welcome]');
const statNumbers = document.querySelectorAll('[data-count]');
const cardEls = document.querySelectorAll('.card');

if (welcomeText) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  welcomeText.textContent = `${greeting}, I build worlds with code.`;
}

const animateCounter = (el) => {
  const target = Number(el.dataset.count || 0);
  const suffix = el.dataset.suffix || '';
  const duration = 1200;
  const start = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(target * eased);
    el.textContent = `${value}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
};

statNumbers.forEach((el) => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  observer.observe(el);
});

cardEls.forEach((card) => {
  card.addEventListener('pointermove', (event) => {
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const percentX = x / rect.width;
    const percentY = y / rect.height;

    const rotateY = (percentX - 0.5) * 10;
    const rotateX = (0.5 - percentY) * 10;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
  });

  card.addEventListener('pointerleave', () => {
    card.style.transform = '';
  });
});
