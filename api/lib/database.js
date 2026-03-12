
const { Pool } = require('pg');

class DatabaseManager {
  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Create connection pool
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      max: 5, // Supabase session pooler prefers fewer connections per instance
      idleTimeoutMillis: 60000, // 60 seconds
      connectionTimeoutMillis: 30000, // 30 seconds
      keepAlive: true
    });

    console.log('✅ PostgreSQL connection pool initialized');
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log(`⚡ Query executed in ${duration}ms`);
      return res;
    } catch (error) {
      console.error('❌ Database query error:', error.message);
      throw error;
    }
  }

  async getPublications(page = 1, perPage = 5, yearFilter = null) {
    try {
      let whereClause = '';
      const params = [];

      if (yearFilter && yearFilter !== 'all') {
        if (yearFilter === 'Unknown') {
          whereClause = 'WHERE year IS NULL';
        } else {
          whereClause = 'WHERE year = $1';
          params.push(parseInt(yearFilter));
        }
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM publications ${whereClause}`;
      const countResult = await this.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const offset = (page - 1) * perPage;
      const query = `
        SELECT id, title, authors, venue,
               COALESCE(CAST(year AS TEXT), 'Unknown') as year,
               citations, scholar_url, pub_number
        FROM publications
        ${whereClause}
        ORDER BY pub_number ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      params.push(perPage, offset);
      const result = await this.query(query, params);

      return {
        publications: result.rows,
        pagination: {
          page,
          per_page: perPage,
          total,
          total_pages: Math.ceil(total / perPage),
          has_next: offset + perPage < total
        }
      };
    } catch (error) {
      console.error('❌ Error fetching publications:', error);
      throw error;
    }
  }

  async getProfile() {
    try {
      const query = 'SELECT * FROM scholar_profile ORDER BY last_updated DESC LIMIT 1';
      const result = await this.query(query);

      if (result.rows.length > 0) {
        return result.rows[0];
      } else {
        // Return default profile
        return {
          name: 'Dr. Abhishek Dixit',
          affiliation: 'Indian Institute of Technology Delhi',
          scholar_url: 'https://scholar.google.co.in/citations?user=CjJ84BwAAAAJ&hl=en',
          total_citations: 0,
          h_index: 0,
          i10_index: 0,
          total_publications: 0
        };
      }
    } catch (error) {
      console.error('❌ Error fetching profile:', error);
      throw error;
    }
  }

  async updateProfile(profileData) {
    try {
      // Check if profile exists
      const checkQuery = 'SELECT id FROM scholar_profile LIMIT 1';
      const checkResult = await this.query(checkQuery);

      if (checkResult.rows.length > 0) {
        // Update existing
        const updateQuery = `
          UPDATE scholar_profile
          SET name = $1, affiliation = $2, scholar_url = $3,
              total_citations = $4, h_index = $5, i10_index = $6,
              total_publications = $7, last_updated = NOW()
          WHERE id = $8
        `;
        await this.query(updateQuery, [
          profileData.name,
          profileData.affiliation,
          profileData.scholar_url,
          profileData.total_citations || 0,
          profileData.h_index || 0,
          profileData.i10_index || 0,
          profileData.total_publications || 0,
          checkResult.rows[0].id
        ]);
      } else {
        // Insert new
        const insertQuery = `
          INSERT INTO scholar_profile
          (name, affiliation, scholar_url, total_citations, h_index, i10_index, total_publications)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        await this.query(insertQuery, [
          profileData.name,
          profileData.affiliation,
          profileData.scholar_url,
          profileData.total_citations || 0,
          profileData.h_index || 0,
          profileData.i10_index || 0,
          profileData.total_publications || 0
        ]);
      }

      console.log('✅ Profile updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      return false;
    }
  }

  async bulkInsertPublications(publications) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Instead of clearing, we will upsert
      console.log('🔄 Upserting publications without deleting existing records');

      // Fetch existing to compare
      const existingQuery = await client.query('SELECT id, title, citations FROM publications');
      const existingByTitle = {};
      existingQuery.rows.forEach(row => {
          // Normalize titles somewhat for matching
          const normTitle = row.title ? row.title.toLowerCase().trim() : '';
          existingByTitle[normTitle] = row;
      });

      const insertQuery = `
        INSERT INTO publications
        (title, authors, venue, year, citations, scholar_url, pub_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      const updateQuery = `
        UPDATE publications
        SET citations = $1, pub_number = $2, scholar_url = $3
        WHERE id = $4
      `;

      let inserted = 0;
      let updated = 0;

      for (const pub of publications) {
        const normTitle = pub.title ? pub.title.toLowerCase().trim() : '';
        const year = pub.year && !isNaN(pub.year) ? parseInt(pub.year) : null;
        
        if (existingByTitle[normTitle]) {
            // Update existing
            await client.query(updateQuery, [
                pub.citations || 0,
                pub.pub_number || 0,
                pub.scholar_url || '',
                existingByTitle[normTitle].id
            ]);
            updated++;
        } else {
            // Insert new
            await client.query(insertQuery, [
                pub.title || '',
                pub.authors || '',
                pub.venue || '',
                year,
                pub.citations || 0,
                pub.scholar_url || '',
                pub.pub_number || 0
            ]);
            inserted++;
        }
      }

      await client.query('COMMIT');
      console.log(`✅ Upsert completed: ${inserted} inserted, ${updated} updated`);
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error bulk upserting publications:', error);
      return false;
    } finally {
      client.release();
    }
  }

  async getYearsWithCounts() {
    try {
      const query = `
        SELECT
          CASE
            WHEN year IS NULL THEN 'Unknown'
            ELSE CAST(year AS TEXT)
          END as year,
          COUNT(*) as count
        FROM publications
        GROUP BY year
        ORDER BY
          CASE WHEN year IS NULL THEN 1 ELSE 0 END,
          year DESC
      `;
      const result = await this.query(query);

      const yearCounts = {};
      result.rows.forEach(row => {
        yearCounts[row.year] = parseInt(row.count);
      });

      return yearCounts;
    } catch (error) {
      console.error('❌ Error fetching year counts:', error);
      return {};
    }
  }

  async searchPublications(searchQuery, page = 1, perPage = 10) {
    try {
      const searchPattern = `%${searchQuery}%`;

      // Count total results
      const countQuery = `
        SELECT COUNT(*) as total FROM publications
        WHERE title ILIKE $1 OR authors ILIKE $1 OR venue ILIKE $1
      `;
      const countResult = await this.query(countQuery, [searchPattern]);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const offset = (page - 1) * perPage;
      const searchSql = `
        SELECT * FROM publications
        WHERE title ILIKE $1 OR authors ILIKE $1 OR venue ILIKE $1
        ORDER BY year DESC NULLS LAST, citations DESC
        LIMIT $2 OFFSET $3
      `;
      const result = await this.query(searchSql, [searchPattern, perPage, offset]);

      return {
        publications: result.rows,
        query: searchQuery,
        total,
        page,
        per_page: perPage
      };
    } catch (error) {
      console.error('❌ Error searching publications:', error);
      throw error;
    }
  }

  async close() {
    await this.pool.end();
    console.log('🔒 Database pool closed');
  }
}

module.exports = DatabaseManager;