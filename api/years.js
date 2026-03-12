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
    const yearCounts = await db.getYearsWithCounts();
    res.status(200).json(yearCounts);
  } catch (error) {
    console.error('❌ Years API error:', error);
    res.status(500).json({
      error: error.message
    });
  } finally {
    await db.close();
  }
};