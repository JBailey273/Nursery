const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function addEastMeadowUsers() {
  const client = await pool.connect();
  
  try {
    console.log('🌿 Adding East Meadow Nursery demo accounts...');
    
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    // Add admin@eastmeadow.com
    try {
      await client.query(`
        INSERT INTO users (username, email, password_hash, role) 
        VALUES ('eastmeadow_admin', 'admin@eastmeadow.com', $1, 'admin')
        ON CONFLICT (email) DO NOTHING
      `, [hashedPassword]);
      console.log('✅ admin@eastmeadow.com added/verified');
    } catch (err) {
      console.log('⚠️  admin@eastmeadow.com:', err.message);
    }
    
    // Add office@eastmeadow.com
    try {
      await client.query(`
        INSERT INTO users (username, email, password_hash, role) 
        VALUES ('eastmeadow_office', 'office@eastmeadow.com', $1, 'office')
        ON CONFLICT (email) DO NOTHING
      `, [hashedPassword]);
      console.log('✅ office@eastmeadow.com added/verified');
    } catch (err) {
      console.log('⚠️  office@eastmeadow.com:', err.message);
    }
    
    // Add driver1@eastmeadow.com
    try {
      await client.query(`
        INSERT INTO users (username, email, password_hash, role) 
        VALUES ('eastmeadow_driver1', 'driver1@eastmeadow.com', $1, 'driver')
        ON CONFLICT (email) DO NOTHING
      `, [hashedPassword]);
      console.log('✅ driver1@eastmeadow.com added/verified');
    } catch (err) {
      console.log('⚠️  driver1@eastmeadow.com:', err.message);
    }
    
    // Verify all accounts exist
    const result = await client.query(`
      SELECT username, email, role 
      FROM users 
      WHERE email IN ('admin@eastmeadow.com', 'office@eastmeadow.com', 'driver1@eastmeadow.com')
      ORDER BY role, email
    `);
    
    console.log('\n🎯 East Meadow Demo Accounts Available:');
    console.log('==========================================');
    result.rows.forEach(user => {
      console.log(`${user.role.toUpperCase().padEnd(6)} | ${user.email.padEnd(25)} | admin123`);
    });
    console.log('==========================================\n');
    
  } catch (error) {
    console.error('❌ Error adding East Meadow users:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  addEastMeadowUsers()
    .then(() => {
      console.log('✅ East Meadow user setup completed');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Failed to setup East Meadow users:', err);
      process.exit(1);
    });
}

module.exports = addEastMeadowUsers;
