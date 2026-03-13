// Intersection Observer for scroll animations
document.addEventListener('DOMContentLoaded', () => {
    // Select all elements with the animate-on-scroll or fade-in-scroll class
    const scrollElements = document.querySelectorAll('.animate-on-scroll, .fade-in-scroll');

    // Create the IntersectionObserver
    const elementObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                // Add the 'is-visible' class when the element enters the viewport
                entry.target.classList.add('is-visible');
                
                // Unobserve so the animation only happens once
                observer.unobserve(entry.target);
            }
        });
    }, {
        // Trigger when 10% of the element is visible
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    });

    // Observe each element
    scrollElements.forEach((el) => {
        elementObserver.observe(el);
    });
});
