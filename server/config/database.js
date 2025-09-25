const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Ensure all database connections operate in Eastern Time
pool.on('connect', (client) => {
  client.query("SET TIME ZONE 'America/New_York'");
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
    console.log('🔄 Starting database migrations...');

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
    console.log('✅ Users table ready');

    // Customers table
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
    console.log('✅ Customers table ready');

    // Jobs table
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
        status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'to_be_scheduled')),
        driver_notes TEXT,
        payment_received DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) DEFAULT 0,
        contractor_discount BOOLEAN DEFAULT FALSE,
        created_by INTEGER REFERENCES users(id),
        assigned_driver INTEGER REFERENCES users(id),
        truck VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Jobs table ready');

    const jobColumnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'jobs' AND table_schema = 'public'
    `);
    const jobColumnNames = jobColumnsResult.rows.map(row => row.column_name);

    if (!jobColumnNames.includes('total_amount')) {
      try {
        await client.query('ALTER TABLE jobs ADD COLUMN total_amount DECIMAL(10,2) DEFAULT 0');
        console.log('✅ Added total_amount column to jobs table');
      } catch (e) {
        console.log('⚠️ total_amount column issue (may already exist):', e.message);
      }
    }

    if (!jobColumnNames.includes('truck')) {
      try {
        await client.query('ALTER TABLE jobs ADD COLUMN truck VARCHAR(100)');
        console.log('✅ Added truck column to jobs table');
      } catch (e) {
        console.log('⚠️ truck column issue (may already exist):', e.message);
      }
    }

    // Products table - SAFE MIGRATION
    console.log('🔄 Checking products table...');
    
    // Check if products table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'products'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      // Create new table with correct schema
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
      console.log('✅ Products table created successfully');
    } else {
      // Table exists - check and safely add missing columns
      console.log('📋 Products table exists, checking columns...');
      
      try {
        // Check what columns exist
        const columns = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'products' AND table_schema = 'public'
        `);
        
        const columnNames = columns.rows.map(row => row.column_name);
        console.log('📋 Current columns:', columnNames);

        // Add missing columns one by one with error handling
        if (!columnNames.includes('retail_price')) {
          try {
            await client.query('ALTER TABLE products ADD COLUMN retail_price DECIMAL(10,2)');
            console.log('✅ Added retail_price column');
            
            // If old price_per_unit exists, copy data
            if (columnNames.includes('price_per_unit')) {
              await client.query('UPDATE products SET retail_price = price_per_unit WHERE retail_price IS NULL');
              console.log('✅ Migrated data from price_per_unit to retail_price');
            }
          } catch (e) {
            console.log('⚠️ retail_price column issue (may already exist):', e.message);
          }
        }

        if (!columnNames.includes('contractor_price')) {
          try {
            await client.query('ALTER TABLE products ADD COLUMN contractor_price DECIMAL(10,2)');
            console.log('✅ Added contractor_price column');
            
            // Set contractor price to 90% of retail price
            await client.query('UPDATE products SET contractor_price = retail_price * 0.9 WHERE contractor_price IS NULL AND retail_price IS NOT NULL');
            console.log('✅ Set contractor_price to 90% of retail_price');
          } catch (e) {
            console.log('⚠️ contractor_price column issue (may already exist):', e.message);
          }
        }

        if (!columnNames.includes('active')) {
          try {
            await client.query('ALTER TABLE products ADD COLUMN active BOOLEAN DEFAULT TRUE');
            console.log('✅ Added active column');
          } catch (e) {
            console.log('⚠️ active column issue (may already exist):', e.message);
          }
        }

        if (!columnNames.includes('created_at')) {
          try {
            await client.query('ALTER TABLE products ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
            console.log('✅ Added created_at column');
          } catch (e) {
            console.log('⚠️ created_at column issue (may already exist):', e.message);
          }
        }

        if (!columnNames.includes('updated_at')) {
          try {
            await client.query('ALTER TABLE products ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
            console.log('✅ Added updated_at column');
          } catch (e) {
            console.log('⚠️ updated_at column issue (may already exist):', e.message);
          }
        }

        // Clean up old column if safe to do so
        if (columnNames.includes('price_per_unit') && columnNames.includes('retail_price')) {
          try {
            // Check if all data is migrated
            const unmigrated = await client.query('SELECT COUNT(*) FROM products WHERE price_per_unit IS NOT NULL AND retail_price IS NULL');
            if (parseInt(unmigrated.rows[0].count) === 0) {
              await client.query('ALTER TABLE products DROP COLUMN price_per_unit');
              console.log('✅ Safely removed old price_per_unit column');
            } else {
              console.log('⚠️ Not removing price_per_unit - unmigrated data exists');
            }
          } catch (e) {
            console.log('⚠️ Could not remove price_per_unit column:', e.message);
          }
        }

      } catch (schemaError) {
        console.log('⚠️ Schema check error (continuing anyway):', schemaError.message);
      }
    }

    // Job products junction table
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
    console.log('✅ Job products table ready');

    // Ensure job_products has necessary columns
    try {
      const jobProductColumnsResult = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'job_products' AND table_schema = 'public'
      `);
      const jobProductColumns = jobProductColumnsResult.rows.map(r => r.column_name);

      if (!jobProductColumns.includes('unit_price')) {
        try {
          if (jobProductColumns.includes('price_per_unit')) {
            await client.query('ALTER TABLE job_products RENAME COLUMN price_per_unit TO unit_price');
            console.log('✅ Renamed price_per_unit to unit_price in job_products');
          } else {
            await client.query('ALTER TABLE job_products ADD COLUMN unit_price DECIMAL(10,2) NOT NULL DEFAULT 0');
            console.log('✅ Added unit_price column to job_products');
          }
        } catch (e) {
          console.log('⚠️ unit_price column issue in job_products:', e.message);
        }
      }

      if (!jobProductColumns.includes('total_price')) {
        try {
          await client.query('ALTER TABLE job_products ADD COLUMN total_price DECIMAL(10,2) NOT NULL DEFAULT 0');
          console.log('✅ Added total_price column to job_products');
        } catch (e) {
          console.log('⚠️ total_price column issue in job_products:', e.message);
        }
      }
    } catch (e) {
      console.log('⚠️ Could not verify job_products schema:', e.message);
    }

    // Create indexes (with error handling)
    const indexes = [
      { name: 'idx_jobs_delivery_date', sql: 'CREATE INDEX IF NOT EXISTS idx_jobs_delivery_date ON jobs(delivery_date)' },
      { name: 'idx_jobs_status', sql: 'CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)' },
      { name: 'idx_jobs_assigned_driver', sql: 'CREATE INDEX IF NOT EXISTS idx_jobs_assigned_driver ON jobs(assigned_driver)' },
      { name: 'idx_customers_name', sql: 'CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)' },
      { name: 'idx_customers_contractor', sql: 'CREATE INDEX IF NOT EXISTS idx_customers_contractor ON customers(contractor)' },
      { name: 'idx_products_name', sql: 'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)' }
    ];

    for (const index of indexes) {
      try {
        await client.query(index.sql);
        console.log(`✅ Index ${index.name} ready`);
      } catch (e) {
        console.log(`⚠️ Index ${index.name} issue:`, e.message);
      }
    }

    console.log('✅ Database migrations completed successfully');

    // Final verification
    try {
      const finalCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'products' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      console.log('📋 Final products table columns:', finalCheck.rows.map(row => row.column_name));
    } catch (e) {
      console.log('⚠️ Could not verify final schema:', e.message);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('❌ Error details:', error.message);
    // Don't throw - let the server start anyway
    console.log('⚠️ Continuing server startup despite migration issues...');
  } finally {
    client.release();
  }
};

const insertDefaultData = async () => {
  const client = await pool.connect();
  
  try {
    // Always ensure East Meadow demo accounts exist
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    console.log('🌿 Ensuring East Meadow demo accounts exist...');
    
    const accounts = [
      { username: 'eastmeadow_admin', email: 'admin@eastmeadow.com', role: 'admin' },
      { username: 'eastmeadow_office', email: 'office@eastmeadow.com', role: 'office' },
      { username: 'eastmeadow_driver1', email: 'driver1@eastmeadow.com', role: 'driver' }
    ];

    for (const account of accounts) {
      try {
        await client.query(`
          INSERT INTO users (username, email, password_hash, role) 
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (email) DO UPDATE SET 
            password_hash = EXCLUDED.password_hash,
            updated_at = CURRENT_TIMESTAMP
        `, [account.username, account.email, hashedPassword, account.role]);
        console.log(`✅ ${account.email} ready`);
      } catch (err) {
        console.log(`⚠️ ${account.email}:`, err.message);
      }
    }

    // Check if products exist, if not add some basic ones
    try {
      const { rows: existingProducts } = await client.query('SELECT COUNT(*) FROM products');
      
      if (parseInt(existingProducts[0].count) === 0) {
        console.log('📦 Adding default products...');
        
        // Add basic products that should work with any schema
        const basicProducts = [
          ['Premium Bark Mulch', 'yards', 45.00, 40.50],
          ['Screened Topsoil', 'yards', 38.00, 34.20],
          ['Compost Blend', 'yards', 42.00, 37.80],
          ['Play Sand', 'yards', 32.00, 28.80]
        ];

        for (const [name, unit, retailPrice, contractorPrice] of basicProducts) {
          try {
            // Try new schema first
            await client.query(`
              INSERT INTO products (name, unit, retail_price, contractor_price) 
              VALUES ($1, $2, $3, $4)
            `, [name, unit, retailPrice, contractorPrice]);
          } catch (newSchemaError) {
            try {
              // Fallback to old schema
              await client.query(`
                INSERT INTO products (name, unit, price_per_unit) 
                VALUES ($1, $2, $3)
              `, [name, unit, retailPrice]);
            } catch (oldSchemaError) {
              console.log(`⚠️ Could not insert product ${name}:`, oldSchemaError.message);
            }
          }
        }
        
        console.log('✅ Default products added');
      }
    } catch (productError) {
      console.log('⚠️ Product insertion error:', productError.message);
    }

    // Add sample customers
    try {
      const { rows: existingCustomers } = await client.query('SELECT COUNT(*) FROM customers');
      
      if (parseInt(existingCustomers[0].count) === 0) {
        await client.query(`
          INSERT INTO customers (name, phone, email, addresses, contractor, notes) VALUES
          ('Pioneer Valley Landscaping', '(413) 555-0123', 'orders@pvlandscaping.com', 
           '[{"address": "456 Industrial Dr, Westfield, MA 01085", "notes": "Commercial loading dock"}]', 
           true, 'Volume contractor - 10% discount'),
          ('Johnson Residence', '(413) 555-0198', 'mjohnson@email.com', 
           '[{"address": "123 Maple Street, East Longmeadow, MA 01028", "notes": "Side driveway access"}]', 
           false, 'Residential customer')
        `);
        console.log('✅ Sample customers added');
      }
    } catch (customerError) {
      console.log('⚠️ Customer insertion error:', customerError.message);
    }

  } catch (error) {
    console.error('⚠️ Default data insertion had issues:', error.message);
    // Don't throw - let the server start anyway
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  initialize,
  query: (text, params) => pool.query(text, params)
};
