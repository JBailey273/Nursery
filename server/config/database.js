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

    // Customers table with contractor field
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(100),
        addresses JSONB,
        notes TEXT,
        contractor BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Jobs table (updated to reference customers)
    await client.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        customer_name VARCHAR(100) NOT NULL,
        customer_phone VARCHAR(20),
        address TEXT NOT NULL,
        delivery_date DATE NOT NULL,
        special_instructions TEXT,
        paid BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
        driver_notes TEXT,
        payment_received DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) DEFAULT 0,
        contractor_discount BOOLEAN DEFAULT FALSE,
        created_by INTEGER REFERENCES users(id),
        assigned_driver INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Products table with dual pricing
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        retail_price DECIMAL(10,2),
        contractor_price DECIMAL(10,2),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Job products junction table with pricing details
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_products (
        id SERIAL PRIMARY KEY,
        job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        product_name VARCHAR(100) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        price_type VARCHAR(20) DEFAULT 'retail' CHECK (price_type IN ('retail', 'contractor')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Handle migration from old schema if needed
    try {
      // Check if old price_per_unit column exists
      const oldPriceColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='products' AND column_name='price_per_unit'
      `);

      if (oldPriceColumn.rows.length > 0) {
        console.log('Migrating old price_per_unit to new pricing structure...');
        
        // Copy old prices to retail_price if retail_price is null
        await client.query(`
          UPDATE products 
          SET retail_price = price_per_unit 
          WHERE retail_price IS NULL AND price_per_unit IS NOT NULL
        `);

        // Set contractor_price to 90% of retail_price if not set
        await client.query(`
          UPDATE products 
          SET contractor_price = retail_price * 0.9 
          WHERE contractor_price IS NULL AND retail_price IS NOT NULL
        `);

        // Drop old column
        await client.query('ALTER TABLE products DROP COLUMN IF EXISTS price_per_unit');
        console.log('Price migration completed');
      }
    } catch (migrationError) {
      console.log('Price migration not needed or already completed');
    }

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

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customers_contractor ON customers(contractor);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
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
      // Insert default products with dual pricing
      await client.query(`
        INSERT INTO products (name, unit, retail_price, contractor_price) VALUES
        ('Premium Mulch', 'yards', 45.00, 40.50),
        ('Topsoil', 'yards', 35.00, 31.50),
        ('Stone Dust', 'yards', 40.00, 36.00),
        ('Sand', 'yards', 30.00, 27.00),
        ('Gravel', 'yards', 38.00, 34.20),
        ('Compost', 'yards', 42.00, 37.80),
        ('Bark Mulch', 'bags', 4.50, 4.05),
        ('Peat Moss', 'bags', 6.00, 5.40)
      `);
      
      console.log('Default products with contractor pricing inserted');
    }

    // Check if users exist
    const { rows: existingUsers } = await client.query('SELECT COUNT(*) FROM users');
    
    if (parseInt(existingUsers[0].count) === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      console.log('Creating default users...');
      
      try {
        await client.query(`
          INSERT INTO users (username, email, password_hash, role) VALUES
          ('admin', 'admin@nursery.com', $1, 'admin')
        `, [hashedPassword]);
        console.log('Admin user created');
      } catch (err) {
        console.error('Error creating admin user:', err);
      }

      try {
        await client.query(`
          INSERT INTO users (username, email, password_hash, role) VALUES
          ('office', 'office@nursery.com', $1, 'office')
        `, [hashedPassword]);
        console.log('Office user created');
      } catch (err) {
        console.error('Error creating office user:', err);
      }

      try {
        await client.query(`
          INSERT INTO users (username, email, password_hash, role) VALUES
          ('driver1', 'driver1@nursery.com', $1, 'driver')
        `, [hashedPassword]);
        console.log('Driver user created');
      } catch (err) {
        console.error('Error creating driver user:', err);
      }
      
      console.log('Default login credentials:');
      console.log('Admin: admin@nursery.com / admin123');
      console.log('Office: office@nursery.com / admin123');
      console.log('Driver: driver1@nursery.com / admin123');
    }

    // Insert sample customers with contractor examples
    const { rows: existingCustomers } = await client.query('SELECT COUNT(*) FROM customers');
    
    if (parseInt(existingCustomers[0].count) === 0) {
      await client.query(`
        INSERT INTO customers (name, phone, email, addresses, contractor, notes) VALUES
        ('ABC Landscaping Co.', '(555) 111-2222', 'orders@abclandscaping.com', 
         '[{"address": "456 Business Park Dr, Springfield, MA 01103", "notes": "Loading dock in rear"}]', 
         true, 'Volume contractor - 10% discount on all orders'),
        ('Smith Residence', '(555) 333-4444', 'john.smith@email.com', 
         '[{"address": "123 Oak Street, Springfield, MA 01103", "notes": "Gate code 1234"}]', 
         false, 'Residential customer')
      `);
      
      console.log('Sample customers created with contractor examples');
    }
    
  } catch (error) {
    console.error('Failed to insert default data:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  initialize,
  query: (text, params) => pool.query(text, params)
};
