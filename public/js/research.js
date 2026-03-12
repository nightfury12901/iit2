// research.js - Dynamically load CMS projects/patents/research
(async () => {
    const API = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
    const container = document.getElementById('cms-projects-list');
    const section = document.getElementById('cms-projects-section');
    if (!container) return;

    try {
        const res = await fetch(`${API}/content/projects`);
        const items = await res.json();
        if (!Array.isArray(items) || items.length === 0) return;

        section.style.display = 'block';

        // Group by type
        const groups = {};
        items.forEach(p => {
            const type = p.type || 'Project';
            if (!groups[type]) groups[type] = [];
            groups[type].push(p);
        });

        Object.entries(groups).forEach(([type, list]) => {
            const heading = document.createElement('h3');
            heading.textContent = type + 's';
            heading.style.cssText = 'color:var(--dark-red);border-bottom:2px solid var(--primary-red);padding-bottom:.5rem;margin:1.5rem 0 1rem;';
            container.appendChild(heading);

            list.forEach(p => {
                const div = document.createElement('div');
                div.className = 'project';
                div.innerHTML = `
                    <h3>${p.title}</h3>
                    <div class="project-meta">
                        ${p.agency ? `<span class="project-agency">Agency: ${p.agency}</span>` : ''}
                        ${p.duration ? `<span class="project-duration">Duration: ${p.duration}</span>` : ''}
                        ${p.role ? `<span class="project-duration">Role: ${p.role}</span>` : ''}
                    </div>
                    ${p.description ? `<p>${p.description}</p>` : ''}
                `;
                container.appendChild(div);
            });
        });
    } catch (e) {
        console.warn('Could not load CMS projects:', e.message);
    }
})();
