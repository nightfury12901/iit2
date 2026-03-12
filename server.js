// server.js - Main server with Publications + CMS
require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

// Image upload: keep files in memory (no disk I/O needed, we upload to Supabase)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Supabase client for Storage
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SECRET_KEY
);

// Enable JSON parsing & CORS
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, PUT');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

console.log('🔄 Loading API routes...');

try {
    const DatabaseManager = require('./api/lib/database');
    const db = new DatabaseManager();

    // =========================================================
    // STARTUP: Auto-create CMS tables if they don't exist
    // =========================================================
    async function initCMSTables() {
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS team_members (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    role VARCHAR(255) NOT NULL,
                    details TEXT,
                    image_url TEXT,
                    category VARCHAR(100) NOT NULL DEFAULT 'PhD Scholars',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    order_index INTEGER DEFAULT 0
                )
            `);
            await db.query(`
                CREATE TABLE IF NOT EXISTS gallery (
                    id SERIAL PRIMARY KEY,
                    category VARCHAR(100) DEFAULT 'Lab',
                    image_url TEXT NOT NULL,
                    caption TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    order_index INTEGER DEFAULT 0
                )
            `);
            await db.query(`
                CREATE TABLE IF NOT EXISTS projects (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(500) NOT NULL,
                    description TEXT,
                    agency VARCHAR(255),
                    duration VARCHAR(100),
                    role VARCHAR(100) DEFAULT 'PI',
                    type VARCHAR(50) DEFAULT 'Project',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    order_index INTEGER DEFAULT 0
                )
            `);
            console.log('✅ CMS tables ready');
        } catch (err) {
            console.error('❌ Error initializing CMS tables:', err.message);
        }
    }
    initCMSTables();

    // =========================================================
    // HELPERS
    // =========================================================

    // Upload image buffer to Supabase Storage bucket
    async function uploadImageToSupabase(fileBuffer, mimetype, folder) {
        const ext = mimetype.split('/')[1] || 'jpg';
        const filename = `${folder}/${Date.now()}.${ext}`;

        const { data, error } = await supabase.storage
            .from('website_images')
            .upload(filename, fileBuffer, {
                contentType: mimetype,
                upsert: true
            });

        if (error) {
            // Bucket might not exist yet – create it and retry once
            if (error.message && error.message.includes('Bucket not found')) {
                await supabase.storage.createBucket('website_images', { public: true });
                const { data: d2, error: e2 } = await supabase.storage
                    .from('website_images')
                    .upload(filename, fileBuffer, { contentType: mimetype, upsert: true });
                if (e2) throw new Error(e2.message);
                return `${process.env.SUPABASE_URL}/storage/v1/object/public/website_images/${d2.path}`;
            }
            throw new Error(error.message);
        }
        return `${process.env.SUPABASE_URL}/storage/v1/object/public/website_images/${data.path}`;
    }

    // =========================================================
    // PUBLICATIONS ROUTES (kept intact)
    // =========================================================
    app.get('/api/publications', async (req, res) => {
        console.log('📡 GET /api/publications');
        const startTime = Date.now();
        try {
            const page = parseInt(req.query.page) || 1;
            const perPage = parseInt(req.query.per_page) || 5;
            const yearFilter = req.query.year || 'all';
            const result = await db.getPublications(page, perPage, yearFilter);
            const profile = page === 1 ? await db.getProfile() : null;
            const responseTime = Date.now() - startTime;
            res.json({
                profile, publications: result.publications,
                pagination: result.pagination,
                response_time: responseTime,
                source: 'local_dev_server',
                last_updated: profile?.last_updated || new Date().toISOString()
            });
        } catch (error) {
            console.error('❌', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/years', async (req, res) => {
        try { res.json(await db.getYearsWithCounts()); }
        catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/search', async (req, res) => {
        try {
            const q = req.query.q || '';
            if (!q) return res.status(400).json({ error: 'query required' });
            res.json(await db.searchPublications(q, parseInt(req.query.page)||1, parseInt(req.query.per_page)||10));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.get('/api/test-db', async (req, res) => {
        try {
            const c = await db.query('SELECT COUNT(*) as total FROM publications');
            const v = await db.query('SELECT version() as db_version');
            res.json({ status:'success', total_publications: c.rows[0].total, database_version: v.rows[0].db_version.substring(0,50)+'...' });
        } catch (e) { res.status(500).json({ status:'error', message: e.message }); }
    });

    app.post('/api/admin/sync-scholar', async (req, res) => {
        console.log('📡 POST /api/admin/sync-scholar');
        try {
            const { fetchScholarData } = require('./api/lib/scholarScraper');
            const { profile, publications } = await fetchScholarData('https://scholar.google.com/citations?user=CjJ84BwAAAAJ&hl=en');
            await db.updateProfile(profile);
            await db.bulkInsertPublications(publications);
            res.json({ message: 'Sync completed successfully', total_publications: publications.length, profile });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // =========================================================
    // CMS: TEAM MEMBERS
    // =========================================================
    app.get('/api/content/team', async (req, res) => {
        try {
            const result = await db.query('SELECT * FROM team_members ORDER BY order_index ASC, created_at ASC');
            res.json(result.rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/content/team', upload.single('image'), async (req, res) => {
        try {
            const { name, role, details, category, order_index } = req.body;
            let image_url = req.body.image_url || null;
            if (req.file) {
                image_url = await uploadImageToSupabase(req.file.buffer, req.file.mimetype, 'team');
            }
            const result = await db.query(
                'INSERT INTO team_members (name, role, details, image_url, category, order_index) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
                [name, role, details || '', image_url, category || 'PhD Scholars', parseInt(order_index)||0]
            );
            res.json({ success: true, member: result.rows[0] });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/admin/content/team/:id', async (req, res) => {
        try {
            await db.query('DELETE FROM team_members WHERE id=$1', [req.params.id]);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // =========================================================
    // CMS: GALLERY
    // =========================================================
    app.get('/api/content/gallery', async (req, res) => {
        try {
            const result = await db.query('SELECT * FROM gallery ORDER BY order_index ASC, created_at DESC');
            res.json(result.rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/content/gallery', upload.single('image'), async (req, res) => {
        try {
            const { caption, category } = req.body;
            if (!req.file) return res.status(400).json({ error: 'Image file required' });
            const image_url = await uploadImageToSupabase(req.file.buffer, req.file.mimetype, 'gallery');
            const result = await db.query(
                'INSERT INTO gallery (image_url, caption, category) VALUES ($1,$2,$3) RETURNING *',
                [image_url, caption || '', category || 'Lab']
            );
            res.json({ success: true, item: result.rows[0] });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/admin/content/gallery/:id', async (req, res) => {
        try {
            await db.query('DELETE FROM gallery WHERE id=$1', [req.params.id]);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // =========================================================
    // CMS: PROJECTS / RESEARCH / PATENTS
    // =========================================================
    app.get('/api/content/projects', async (req, res) => {
        try {
            const result = await db.query('SELECT * FROM projects ORDER BY order_index ASC, created_at DESC');
            res.json(result.rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post('/api/admin/content/projects', async (req, res) => {
        try {
            const { title, description, agency, duration, role, type } = req.body;
            const result = await db.query(
                'INSERT INTO projects (title, description, agency, duration, role, type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
                [title, description||'', agency||'', duration||'', role||'PI', type||'Project']
            );
            res.json({ success: true, project: result.rows[0] });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.delete('/api/admin/content/projects/:id', async (req, res) => {
        try {
            await db.query('DELETE FROM projects WHERE id=$1', [req.params.id]);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    console.log('✅ API routes loaded');

} catch (error) {
    console.error('❌ Failed to load API routes:', error);
}

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index9.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 LOCAL DEVELOPMENT SERVER RUNNING');
    console.log('='.repeat(60));
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`📚 Website: http://localhost:${PORT}`);
    console.log(`🔗 Test DB: http://localhost:${PORT}/api/test-db`);
    console.log(`🛠️  Admin: http://localhost:${PORT}/admin.html`);
    console.log('='.repeat(60));
    console.log('\n💡 Press Ctrl+C to stop\n');
});