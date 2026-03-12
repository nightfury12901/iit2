const DatabaseManager = require('../lib/database');
const axios = require('axios');
const cheerio = require('cheerio');

class ScholarFetcher {
  constructor() {
    this.baseUrl = 'https://scholar.google.com';
  }

  async fetchScholarData(scholarId) {
    try {
      console.log('🔄 Fetching scholar data...');

      // Note: This is a simplified version. Google Scholar scraping is complex
      // and may require more robust handling or use of scholarly package equivalent
      const url = `${this.baseUrl}/citations?user=${scholarId}&hl=en`;

      // You may need to use a proxy or API service for production
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);

      // Extract profile data
      const name = $('#gsc_prf_in').text().trim();
      const affiliation = $('.gsc_prf_il').first().text().trim();

      // Extract metrics
      const citations = parseInt($('.gsc_rsb_std').eq(0).text().replace(/,/g, '')) || 0;
      const hIndex = parseInt($('.gsc_rsb_std').eq(2).text()) || 0;
      const i10Index = parseInt($('.gsc_rsb_std').eq(4).text()) || 0;

      // Extract publications (simplified - you'll need to handle pagination)
      const publications = [];
      $('.gsc_a_tr').each((i, elem) => {
        const title = $(elem).find('.gsc_a_at').text().trim();
        const authors = $(elem).find('.gsc_a_at').next().text().trim();
        const venue = $(elem).find('.gs_gray').last().text().trim();
        const year = $(elem).find('.gsc_a_y span').text().trim();
        const citationCount = parseInt($(elem).find('.gsc_a_c').text()) || 0;
        const pubUrl = $(elem).find('.gsc_a_at').attr('href');

        if (title) {
          publications.push({
            title,
            authors,
            venue,
            year: year || 'Unknown',
            citations: citationCount,
            scholar_url: pubUrl ? `${this.baseUrl}${pubUrl}` : '',
            pub_number: i + 1
          });
        }
      });

      return {
        profile: {
          name: name || 'Dr. Abhishek Dixit',
          affiliation: affiliation || 'Indian Institute of Technology Delhi',
          scholar_url: url,
          total_citations: citations,
          h_index: hIndex,
          i10_index: i10Index
        },
        publications,
        total_publications: publications.length
      };
    } catch (error) {
      console.error('❌ Scholar fetch error:', error);
      return null;
    }
  }
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const db = new DatabaseManager();

  try {
    console.log('🔄 Starting Scholar data sync...');

    const fetcher = new ScholarFetcher();
    const scholarData = await fetcher.fetchScholarData('CjJ84BwAAAAJ');

    if (!scholarData) {
      res.status(500).json({ error: 'Failed to fetch Scholar data' });
      return;
    }

    // Flatten publications with proper year handling
    const allPublications = scholarData.publications.map((pub, index) => ({
      ...pub,
      year: pub.year && pub.year !== 'Unknown' ? pub.year : null,
      pub_number: index + 1
    }));

    // Insert publications into PostgreSQL
    const success = await db.bulkInsertPublications(allPublications);

    if (success) {
      // Update profile
      await db.updateProfile({
        name: scholarData.profile.name,
        affiliation: scholarData.profile.affiliation,
        scholar_url: scholarData.profile.scholar_url,
        total_citations: scholarData.profile.total_citations,
        h_index: scholarData.profile.h_index,
        i10_index: scholarData.profile.i10_index,
        total_publications: scholarData.total_publications
      });

      console.log('✅ Scholar data synced successfully');
      res.status(200).json({
        message: 'Data synced successfully',
        total_publications: allPublications.length
      });
    } else {
      res.status(500).json({ error: 'Failed to sync data' });
    }
  } catch (error) {
    console.error('❌ Sync error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await db.close();
  }
};