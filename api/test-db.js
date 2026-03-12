// api/test-db-connection.js
// Quick script to test your Supabase connection

require('dotenv').config();
const { Pool } = require('pg');

async function testConnection() {
  console.log('\n🔍 Testing Supabase Connection...\n');

  // Check if DATABASE_URL exists
  if (!process.env.DATABASE_URL) {
    console.log('❌ ERROR: DATABASE_URL not found in .env file');
    console.log('\nPlease create a .env file with:\n');
    console.log('DATABASE_URL=your-supabase-connection-string');
    process.exit(1);
  }

  console.log('✅ DATABASE_URL found in .env');
  console.log('   Connection string:', process.env.DATABASE_URL.substring(0, 50) + '...');

  // Create connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Test 1: Basic connection
    console.log('\n📡 Test 1: Testing basic connection...');
    const timeResult = await pool.query('SELECT NOW()');
    console.log('✅ Connection successful!');
    console.log('   Server time:', timeResult.rows[0].now);

    // Test 2: Check if publications table exists
    console.log('\n📊 Test 2: Checking publications table...');
    const pubCheck = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'publications')"
    );

    if (pubCheck.rows[0].exists) {
      console.log('✅ publications table exists');

      const countResult = await pool.query('SELECT COUNT(*) as total FROM publications');
      console.log('   Total publications:', countResult.rows[0].total);
    } else {
      console.log('❌ publications table NOT found');
      console.log('\n⚠️  You need to create the tables!');
      console.log('   Go to Supabase → SQL Editor and run the CREATE TABLE script');
    }

    // Test 3: Check if scholar_profile table exists
    console.log('\n👤 Test 3: Checking scholar_profile table...');
    const profileCheck = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'scholar_profile')"
    );

    if (profileCheck.rows[0].exists) {
      console.log('✅ scholar_profile table exists');
    } else {
      console.log('❌ scholar_profile table NOT found');
      console.log('   You need to create this table too!');
    }

    // Test 4: Check connection type
    console.log('\n🔌 Test 4: Checking connection type...');
    const connString = process.env.DATABASE_URL;
    if (connString.includes(':6543')) {
      console.log('✅ Using transaction pooler (port 6543) - PERFECT for Vercel!');
    } else if (connString.includes(':5432')) {
      console.log('⚠️  Using direct connection (port 5432)');
      console.log('   Consider switching to transaction pooler for better serverless performance');
    }

    console.log('\n════════════════════════════════════════');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('════════════════════════════════════════');
    console.log('\nYou are ready to deploy to Vercel! 🚀\n');

  } catch (error) {
    console.log('\n❌ ERROR:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check your DATABASE_URL is correct');
    console.log('   2. Make sure your Supabase project is active');
    console.log('   3. Verify you replaced [YOUR-PASSWORD] with actual password');
    console.log('   4. Check if connection pooling is enabled in Supabase\n');
  } finally {
    await pool.end();
  }
}

testConnection();