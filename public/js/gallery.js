// gallery.js - Dynamically load CMS gallery photos
(async () => {
    const API = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
    const grid = document.getElementById('cms-gallery-grid');
    const section = document.getElementById('cms-gallery-section');
    if (!grid) return;

    try {
        const res = await fetch(`${API}/content/gallery`);
        const items = await res.json();
        if (!Array.isArray(items) || items.length === 0) return;

        section.style.display = 'block';

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'gallery-item';
            div.innerHTML = `
                <img src="${item.image_url}" alt="${item.caption || 'Gallery photo'}" loading="lazy">
                ${item.caption ? `<div class="gallery-item-caption">${item.caption}</div>` : ''}
            `;
            grid.appendChild(div);
        });
    } catch (e) {
        console.warn('Could not load CMS gallery:', e.message);
    }
})();
