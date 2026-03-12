// team.js - Dynamically load CMS team members
(async () => {
    const API = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
    const grid = document.getElementById('cms-team-grid');
    const section = document.getElementById('cms-team-section');
    if (!grid) return;

    try {
        const res = await fetch(`${API}/content/team`);
        const members = await res.json();
        if (!Array.isArray(members) || members.length === 0) return;

        section.style.display = 'block';

        // Group by category
        const groups = {};
        members.forEach(m => {
            const cat = m.category || 'Team';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(m);
        });

        Object.entries(groups).forEach(([category, list]) => {
            const heading = document.createElement('h3');
            heading.textContent = category;
            heading.style.cssText = 'width:100%;grid-column:1/-1;color:var(--dark-red);border-bottom:2px solid var(--primary-red);padding-bottom:.5rem;margin-bottom:.5rem;';
            grid.appendChild(heading);

            list.forEach(m => {
                const card = document.createElement('div');
                card.className = 'team-member';
                card.innerHTML = `
                    ${m.image_url ? `<div class="member-photo"><img src="${m.image_url}" alt="${m.name}"></div>` : ''}
                    <div class="member-info">
                        <h3>${m.name}</h3>
                        <p class="member-role">${m.role}</p>
                        ${m.details ? `<p class="member-description">${m.details}</p>` : ''}
                    </div>`;
                grid.appendChild(card);
            });
        });
    } catch (e) {
        console.warn('Could not load CMS team members:', e.message);
    }
})();
