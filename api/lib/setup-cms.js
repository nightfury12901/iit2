require('dotenv').config();
const { Pool } = require('pg');

async function setupCMS() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ missing DATABASE_URL');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Team Members Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL,
        details TEXT,
        image_url TEXT,
        category VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        order_index INTEGER DEFAULT 0
      )
    `);
    console.log('✅ Created team_members table');

    // 2. Gallery Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS gallery (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100) DEFAULT 'Lab',
        image_url TEXT NOT NULL,
        caption TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        order_index INTEGER DEFAULT 0
      )
    `);
    console.log('✅ Created gallery table');

    // 3. Projects & Research Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        agency VARCHAR(255),
        duration VARCHAR(100),
        role VARCHAR(100),
        type VARCHAR(50) DEFAULT 'Project',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        order_index INTEGER DEFAULT 0
      )
    `);
    console.log('✅ Created projects table');

    await client.query('COMMIT');
    console.log('🎉 CMS Database Tables Set Up Successfully!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error setting up tables:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

setupCMS();
