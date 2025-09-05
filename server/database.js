const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Database initialization and migration
const initialize = async () => {
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('Database connection established');
    
    // Run migrations
    await runMigrations();
    
    // Insert default data if needed
    await insertDefaultData();
    
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

const runMigrations = async () => {
  const client = await pool.connect();
  
  try {
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'driver' CHECK (role IN ('office', 'driver', 'admin')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Jobs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(100) NOT NULL,
        customer_phone VARCHAR(20),
        address TEXT NOT NULL,
        delivery_date DATE NOT NULL,
        special_instructions TEXT,
        paid BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
        driver_notes TEXT,
        payment_received DECIMAL(10,2) DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        assigned_driver INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        price_per_unit DECIMAL(10,2),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Job products junction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_products (
        id SERIAL PRIMARY KEY,
        job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        product_name VARCHAR(100) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_delivery_date ON jobs(delivery_date);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_jobs_assigned_driver ON jobs(assigned_driver);
    `);

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

const insertDefaultData = async () => {
  const client = await pool.connect();
  
  try {
    // Check if products exist
    const { rows: existingProducts } = await client.query('SELECT COUNT(*) FROM products');
    
    if (parseInt(existingProducts[0].count) === 0) {
      // Insert default products
      await client.query(`
        INSERT INTO products (name, unit, price_per_unit) VALUES
        ('Premium Mulch', 'yards', 45.00),
        ('Topsoil', 'yards', 35.00),
        ('Stone Dust', 'yards', 40.00),
        ('Sand', 'yards', 30.00),
        ('Gravel', 'yards', 38.00),
        ('Compost', 'yards', 42.00),
        ('Bark Mulch', 'bags', 4.50),
        ('Peat Moss', 'bags', 6.00)
      `);
      
      console.log('Default products inserted');
    }

    // Check if default admin user exists
    const { rows: existingUsers } = await client.query('SELECT COUNT(*) FROM users WHERE role = $1', ['admin']);
    
    if (parseInt(existingUsers[0].count) === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await client.query(`
        INSERT INTO users (username, email, password_hash, role) VALUES
        ('admin', 'admin@nursery.com', $1, 'admin'),
        ('office', 'office@nursery.com', $2, 'office'),
        ('driver1', 'driver1@nursery.com', $3, 'driver')
      `, [hashedPassword, hashedPassword, hashedPassword]);
      
      console.log('Default users created');
      console.log('Default login credentials:');
      console.log('Admin: admin@nursery.com / admin123');
      console.log('Office: office@nursery.com / admin123');
      console.log('Driver: driver1@nursery.com / admin123');
    }
    
  } catch (error) {
    console.error('Failed to insert default data:', error);
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  initialize,
  query: (text, params) => pool.query(text, params)
};