const DatabaseManager = require('./lib/database');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const db = new DatabaseManager();

  try {
    const query = req.query.q || '';
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;

    if (!query) {
      res.status(400).json({ error: 'Search query required' });
      return;
    }

    const result = await db.searchPublications(query, page, perPage);
    res.status(200).json(result);
  } catch (error) {
    console.error('❌ Search API error:', error);
    res.status(500).json({
      error: error.message
    });
  } finally {
    await db.close();
  }
};