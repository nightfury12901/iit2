
class ScholarPublications {
    constructor() {
        this.publications = [];
        this.currentPage = 1;
        this.perPage = 50; // Show more per page
        this.currentFilter = 'all';
        this.scholarData = null;
        this.profile = null;
        // FIXED: Updated API URL for Vercel
        this.apiBaseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:5000/api' 
            : '/api';
        this.init();
    }

    async init() {
        try {
            console.log('🚀 Initializing Scholar Publications...');
            console.log('📡 API Base URL:', this.apiBaseUrl);
            this.setupActionButtons();
            await this.loadScholarData();
            this.hideLoading();
            this.renderPublications();
            this.setupFilters();
        } catch (error) {
            console.error('❌ Error initializing publications:', error);
            this.showError(error);
        }
    }

    setupActionButtons() {
        const refreshBtn = document.getElementById('refresh-btn');
        const clearCacheBtn = document.getElementById('clear-cache-btn');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshData());
        }

        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => this.syncScholarData());
        }
    }

    async loadScholarData() {
        try {
            this.showLoading();
            console.log('🔄 Loading scholar data from Node.js backend...');

            const startTime = Date.now();

            // FIXED: Updated endpoint for Node.js backend
            const response = await fetch(`${this.apiBaseUrl}/publications?page=1&per_page=1000`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const responseTime = Date.now() - startTime;
            console.log(`⏱️ API response time: ${responseTime}ms`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('✅ Scholar data loaded successfully from Node.js backend');
            console.log('📊 Data:', data);

            // Store profile
            this.profile = data.profile;

            // Store publications
            this.publications = data.publications || [];

            // Group publications by year
            this.publicationsByYear = this.groupPublicationsByYear(this.publications);

            // Update UI
            this.updateProfileHeader(data.profile, {
                responseTime: data.response_time || responseTime,
                source: data.source
            });

            this.updateLastUpdated(data.last_updated);

            console.log(`📚 Loaded ${this.publications.length} publications`);

        } catch (error) {
            console.error('❌ Error loading scholar data:', error);
            throw error;
        }
    }

    groupPublicationsByYear(publications) {
        if (!publications) return {};
        return publications.reduce((acc, pub) => {
            const year = pub.year || 'Unknown';
            if (!acc[year]) acc[year] = [];
            acc[year].push(pub);
            return acc;
        }, {});
    }

    updateProfileHeader(profile, meta) {
        console.log('Profile updated:', profile);
    }

    updateLastUpdated(dateString) {
        if (dateString) {
            console.log('Last updated:', new Date(dateString).toLocaleString());
        }
    }

    setupFilters() {
        console.log('Filters setup skipped for simple list view');
    }

    renderPublications() {
        const container = document.getElementById('publications-container');
        if (!container) return;

        container.innerHTML = '';

        if (!this.publications || this.publications.length === 0) {
            container.innerHTML = '<p class="no-publications">No publications found. Click "Sync from Scholar" to load data.</p>';
            return;
        }

        const listContainer = document.createElement('div');
        listContainer.className = 'publications-list';

        this.publications.forEach((pub, index) => {
            const pubItem = this.createPublicationItem(pub, index + 1);
            listContainer.appendChild(pubItem);
        });

        container.appendChild(listContainer);
        
        // Hide year filters if they exist since we want a simple list
        const filtersContainer = document.getElementById('year-filters');
        if (filtersContainer) {
            filtersContainer.style.display = 'none';
        }
    }

    createPublicationItem(pub, index) {
        const pubDiv = document.createElement('div');
        pubDiv.className = 'publication-item';
        
        const title = pub.title || 'Unknown Title';
        const authors = pub.authors || 'Unknown Authors';
        const venue = pub.venue || '';
        const scholarUrl = pub.scholar_url || '';

        pubDiv.innerHTML = `
            <div class="publication-number">[${pub.pub_number || index}]</div>
            <div class="publication-content">
                <h4 style="margin-bottom: 0.2rem; font-size: 1.1rem;">${scholarUrl ? `<a href="${scholarUrl}" target="_blank" rel="noopener" style="color: var(--primary-red); text-decoration: none;">${title}</a>` : title}</h4>
                <p class="authors" style="margin-bottom: 0.1rem; color: var(--text-dark);">${authors}</p>
                <p class="journal" style="color: var(--text-gray); font-style: italic; font-size: 0.9rem;">${venue}</p>
            </div>
        `;

        return pubDiv;
    }

    async refreshData() {
        try {
            const refreshBtn = document.getElementById('refresh-btn');
            if (refreshBtn) {
                refreshBtn.disabled = true;
                refreshBtn.textContent = '🔄 Refreshing...';
            }

            await this.loadScholarData();
            this.hideLoading();
            this.renderPublications();
            this.setupFilters();

            console.log('✅ Data refreshed successfully');

            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 Refresh Publications';
            }

        } catch (error) {
            console.error('❌ Error refreshing data:', error);
            this.showError(error);

            const refreshBtn = document.getElementById('refresh-btn');
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 Refresh Publications';
            }
        }
    }

    async syncScholarData() {
        if (!confirm('This will fetch fresh data from Google Scholar and update the database. This may take a few minutes. Continue?')) {
            return;
        }

        try {
            const clearCacheBtn = document.getElementById('clear-cache-btn');
            if (clearCacheBtn) {
                clearCacheBtn.disabled = true;
                clearCacheBtn.textContent = '⏳ Syncing...';
            }

            this.showLoading('Syncing from Google Scholar... This may take 2-3 minutes...');

            console.log('🔄 Syncing data from Google Scholar...');

            // Call the admin sync endpoint
            const response = await fetch(`${this.apiBaseUrl}/admin/sync-scholar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to sync data');
            }

            const result = await response.json();
            console.log('✅ Sync completed:', result);

            alert(`Success! Synced ${result.total_publications} publications from Google Scholar.`);

            // Reload the data
            await this.refreshData();

        } catch (error) {
            console.error('❌ Error syncing scholar data:', error);
            alert(`Error syncing data: ${error.message}`);
        } finally {
            const clearCacheBtn = document.getElementById('clear-cache-btn');
            if (clearCacheBtn) {
                clearCacheBtn.disabled = false;
                clearCacheBtn.textContent = '🔄 Sync from Scholar';
            }
            this.hideLoading();
        }
    }

    showLoading(message = 'Loading publications...') {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.style.display = 'block';
            const loadingText = indicator.querySelector('p');
            if (loadingText) {
                loadingText.textContent = message;
            }
        }
    }

    hideLoading() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    showError(error) {
        const container = document.getElementById('publications-container');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <h3>⚠️ Unable to load publications</h3>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p>This could be due to:</p>
                    <ul>
                        <li>Database connection issues</li>
                        <li>Network connectivity problems</li>
                        <li>API server issues</li>
                        <li>No publications in database yet (click "Sync from Scholar")</li>
                    </ul>
                    <div class="error-actions">
                        <button onclick="location.reload()" class="btn btn-primary">🔄 Try Again</button>
                        <a href="https://scholar.google.co.in/citations?user=CjJ84BwAAAAJ&hl=en" 
                           target="_blank" 
                           rel="noopener"
                           class="btn btn-secondary">
                            📚 Visit Google Scholar Directly
                        </a>
                    </div>
                </div>
            `;
        }
        this.hideLoading();
    }
}

// Global function for API status checking (updated for Node.js)
async function checkApiStatus() {
    try {
        const apiBaseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:5000/api' 
            : '/api';

        const response = await fetch(`${apiBaseUrl}/test-db`);
        const data = await response.json();

        console.log('✅ API Status:', data);

        const apiStatus = document.getElementById('api-status');
        if (apiStatus) {
            apiStatus.textContent = `✅ Database: ${data.total_publications} publications`;
            apiStatus.style.display = 'block';
        }

    } catch (error) {
        console.error('❌ Error checking API status:', error);
        const apiStatus = document.getElementById('api-status');
        if (apiStatus) {
            apiStatus.textContent = '❌ API Connection Failed';
            apiStatus.style.display = 'block';
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('📚 Initializing Scholar Publications System...');
    new ScholarPublications();

    // Check API status
    checkApiStatus();
});

// Export for use in other scripts if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScholarPublications;
}