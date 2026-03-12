// api/publications.js
const DatabaseManager = require('./lib/database');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const db = new DatabaseManager();
  const startTime = Date.now();

  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 5;
    const yearFilter = req.query.year || 'all';

    console.log(`📊 Request - page ${page}, per_page ${perPage}, year ${yearFilter}`);

    // Get publications from database
    const result = await db.getPublications(page, perPage, yearFilter);

    // Get profile (only on first page)
    const profile = page === 1 ? await db.getProfile() : null;

    const responseTime = Date.now() - startTime;
    console.log(`⚡ Response time: ${responseTime}ms`);

    res.status(200).json({
      profile: profile,
      publications: result.publications,
      pagination: result.pagination,
      response_time: responseTime,
      source: 'vercel_serverless_postgresql',
      last_updated: profile?.last_updated || new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Publications API error:', error);
    res.status(500).json({
      error: error.message,
      message: 'Failed to fetch publications from database'
    });
  } finally {
    await db.close();
  }
};