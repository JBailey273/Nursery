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

    // Products table - CHECK CURRENT SCHEMA AND MIGRATE
    console.log('🔄 Checking products table schema...');
    
    // First check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'products'
      )
    `);

    if (!tableExists.rows[0].exists) {
      console.log('📋 Creating products table with new schema...');
      await client.query(`
        CREATE TABLE products (
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
      console.log('✅ Products table created with new schema');
    } else {
      // Check current columns
      const columns = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'products' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      const columnNames = columns.rows.map(row => row.column_name);
      console.log('📋 Current products table columns:', columnNames);

      // Migration logic
      if (columnNames.includes('price_per_unit') && !columnNames.includes('retail_price')) {
        console.log('🔄 Migrating from old schema (price_per_unit) to new schema...');
        
        // Add new columns
        try {
          await client.query('ALTER TABLE products ADD COLUMN retail_price DECIMAL(10,2)');
          console.log('✅ Added retail_price column');
        } catch (e) {
          console.log('⚠️ retail_price column already exists or error:', e.message);
        }

        try {
          await client.query('ALTER TABLE products ADD COLUMN contractor_price DECIMAL(10,2)');
          console.log('✅ Added contractor_price column');
        } catch (e) {
          console.log('⚠️ contractor_price column already exists or error:', e.message);
        }

        // Migrate data
        await client.query(`
          UPDATE products 
          SET retail_price = price_per_unit 
          WHERE retail_price IS NULL AND price_per_unit IS NOT NULL
        `);
        console.log('✅ Migrated price_per_unit to retail_price');

        // Set contractor_price to 90% of retail_price if not set
        await client.query(`
          UPDATE products 
          SET contractor_price = retail_price * 0.9 
          WHERE contractor_price IS NULL AND retail_price IS NOT NULL
        `);
        console.log('✅ Set contractor_price to 90% of retail_price');

        // Drop old column
        try {
          await client.query('ALTER TABLE products DROP COLUMN IF EXISTS price_per_unit');
          console.log('✅ Dropped old price_per_unit column');
        } catch (e) {
          console.log('⚠️ Could not drop price_per_unit column:', e.message);
        }

        console.log('✅ Products table migration completed');
      } else if (!columnNames.includes('retail_price') && !columnNames.includes('price_per_unit')) {
        console.log('🔄 Adding missing price columns...');
        
        try {
          await client.query('ALTER TABLE products ADD COLUMN retail_price DECIMAL(10,2)');
          console.log('✅ Added retail_price column');
        } catch (e) {
          console.log('⚠️ Error adding retail_price:', e.message);
        }

        try {
          await client.query('ALTER TABLE products ADD COLUMN contractor_price DECIMAL(10,2)');
          console.log('✅ Added contractor_price column');
        } catch (e) {
          console.log('⚠️ Error adding contractor_price:', e.message);
        }
      } else {
        console.log('✅ Products table schema is up to date');
      }

      // Ensure other required columns exist
      if (!columnNames.includes('active')) {
        try {
          await client.query('ALTER TABLE products ADD COLUMN active BOOLEAN DEFAULT TRUE');
          console.log('✅ Added active column');
        } catch (e) {
          console.log('⚠️ Error adding active column:', e.message);
        }
      }

      if (!columnNames.includes('created_at')) {
        try {
          await client.query('ALTER TABLE products ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
          console.log('✅ Added created_at column');
        } catch (e) {
          console.log('⚠️ Error adding created_at column:', e.message);
        }
      }

      if (!columnNames.includes('updated_at')) {
        try {
          await client.query('ALTER TABLE products ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
          console.log('✅ Added updated_at column');
        } catch (e) {
          console.log('⚠️ Error adding updated_at column:', e.message);
        }
      }
    }

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

    console.log('✅ Database migrations completed successfully');

    // Final verification of products table
    const finalColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('📋 Final products table columns:', finalColumns.rows.map(row => row.column_name));

  } catch (error) {
    console.error('❌ Migration failed:', error);
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
      // Insert default products with dual pricing - East Meadow Nursery specific
      await client.query(`
        INSERT INTO products (name, unit, retail_price, contractor_price) VALUES
        ('Premium Bark Mulch', 'yards', 45.00, 40.50),
        ('Screened Topsoil', 'yards', 38.00, 34.20),
        ('Compost Blend', 'yards', 42.00, 37.80),
        ('Play Sand', 'yards', 32.00, 28.80),
        ('Stone Dust', 'yards', 40.00, 36.00),
        ('3/4" Crushed Stone', 'yards', 45.00, 40.50),
        ('Decorative Stone', 'yards', 55.00, 49.50),
        ('Organic Compost', 'yards', 48.00, 43.20),
        ('Hardwood Mulch', 'bags', 4.50, 4.05),
        ('Peat Moss', 'bags', 6.00, 5.40),
        ('Potting Soil', 'bags', 8.00, 7.20),
        ('Garden Soil', 'bags', 5.50, 4.95)
      `);
      
      console.log('✅ East Meadow Nursery products with contractor pricing inserted');
    }

    // Always ensure East Meadow demo accounts exist
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    console.log('🌿 Ensuring East Meadow demo accounts exist...');
    
    // Use ON CONFLICT to avoid duplicate key errors
    try {
      await client.query(`
        INSERT INTO users (username, email, password_hash, role) 
        VALUES ('eastmeadow_admin', 'admin@eastmeadow.com', $1, 'admin')
        ON CONFLICT (email) DO UPDATE SET 
          password_hash = EXCLUDED.password_hash,
          updated_at = CURRENT_TIMESTAMP
      `, [hashedPassword]);
      console.log('✅ admin@eastmeadow.com ready');
    } catch (err) {
      console.log('⚠️ admin account:', err.message);
    }
    
    try {
      await client.query(`
        INSERT INTO users (username, email, password_hash, role) 
        VALUES ('eastmeadow_office', 'office@eastmeadow.com', $1, 'office')
        ON CONFLICT (email) DO UPDATE SET 
          password_hash = EXCLUDED.password_hash,
          updated_at = CURRENT_TIMESTAMP
      `, [hashedPassword]);
      console.log('✅ office@eastmeadow.com ready');
    } catch (err) {
      console.log('⚠️ office account:', err.message);
    }
    
    try {
      await client.query(`
        INSERT INTO users (username, email, password_hash, role) 
        VALUES ('eastmeadow_driver1', 'driver1@eastmeadow.com', $1, 'driver')
        ON CONFLICT (email) DO UPDATE SET 
          password_hash = EXCLUDED.password_hash,
          updated_at = CURRENT_TIMESTAMP
      `, [hashedPassword]);
      console.log('✅ driver1@eastmeadow.com ready');
    } catch (err) {
      console.log('⚠️ driver account:', err.message);
    }

    // Insert sample customers with contractor examples for East Meadow area
    const { rows: existingCustomers } = await client.query('SELECT COUNT(*) FROM customers');
    
    if (parseInt(existingCustomers[0].count) === 0) {
      await client.query(`
        INSERT INTO customers (name, phone, email, addresses, contractor, notes) VALUES
        ('Pioneer Valley Landscaping', '(413) 555-0123', 'orders@pvlandscaping.com', 
         '[{"address": "456 Industrial Dr, Westfield, MA 01085", "notes": "Commercial loading dock - rear entrance"}]', 
         true, 'Volume contractor - established 2015, 10% discount applies'),
        ('Green Valley Contractors', '(413) 555-0156', 'supplies@greenvalleyma.com', 
         '[{"address": "789 Commerce Way, Holyoke, MA 01040", "notes": "Call ahead for deliveries"}]', 
         true, 'Licensed contractor - special pricing tier'),
        ('Johnson Residence', '(413) 555-0198', 'mjohnson@email.com', 
         '[{"address": "123 Maple Street, East Longmeadow, MA 01028", "notes": "Side driveway access only"}]', 
         false, 'Residential customer - regular orders'),
        ('Springfield Gardens HOA', '(413) 555-0134', 'manager@springfieldgardens.org', 
         '[{"address": "555 Garden View Lane, Springfield, MA 01108", "notes": "Main office - coordinate with property manager"}]', 
         false, 'Community association - seasonal orders')
      `);
      
      console.log('✅ Sample East Meadow Nursery customers created');
    }

    // Final verification
    const verifyUsers = await client.query(`
      SELECT email, role FROM users 
      WHERE email LIKE '%@eastmeadow.com' 
      ORDER BY role, email
    `);
    
    console.log('\n🎯 EAST MEADOW DEMO ACCOUNTS AVAILABLE:');
    console.log('=========================================');
    verifyUsers.rows.forEach(user => {
      console.log(`${user.role.toUpperCase().padEnd(6)} | ${user.email.padEnd(25)} | admin123`);
    });
    console.log('=========================================\n');
    
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
