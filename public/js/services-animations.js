// public/js/services-animations.js
document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.spec-card');
    if (!cards.length) return;

    // IntersectionObserver – aktywacja tylko w viewport (oszczędność CPU)
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                // Po wejściu w widok – włączamy hover
                setupHover(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    // Funkcja setup hover (mouseenter/leave)
    const setupHover = (card) => {
        card.addEventListener('mouseenter', () => card.classList.add('hover'));
        card.addEventListener('mouseleave', () => card.classList.remove('hover'));
    };

    // Obserwujemy karty
    cards.forEach(card => observer.observe(card));
});