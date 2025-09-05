const express = require('express');
const { body, validationResult, param } = require('express-validator');
const db = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Simple role check function
const requireOfficeOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (!['office', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Office or admin role required' });
  }
  
  next();
};

// DEBUG: Check exact column types
router.get('/column-info', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default,
        udt_name,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns 
      WHERE table_name = 'products' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    res.json({ 
      message: 'Products table column information',
      columns: result.rows
    });
  } catch (error) {
    console.error('Column info error:', error);
    res.status(500).json({ 
      message: 'Error checking column info',
      error: error.message 
    });
  }
});

// Check database schema first - add this diagnostic endpoint
router.get('/schema', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== PRODUCTS SCHEMA CHECK ===');
    
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      ORDER BY ordinal_position
    `);

    console.log('Products table schema:', result.rows);

    res.json({ 
      message: 'Products table schema',
      columns: result.rows
    });
  } catch (error) {
    console.error('Schema check error:', error);
    res.status(500).json({ 
      message: 'Error checking schema',
      error: error.message 
    });
  }
});

// ULTRA-SIMPLE: Get all products
router.get('/', auth, async (req, res) => {
  try {
    console.log('=== PRODUCTS GET REQUEST ===');
    console.log('User:', req.user.userId, req.user.role);
    
    const result = await db.query(`
      SELECT * FROM products 
      ORDER BY active DESC, name ASC
    `);

    console.log(`Found ${result.rows.length} products`);
    if (result.rows.length > 0) {
      console.log('First product structure:', Object.keys(result.rows[0]));
      console.log('Sample active values:', result.rows.slice(0, 3).map(p => ({ id: p.id, active: p.active, active_type: typeof p.active })));
    }

    res.json({ products: result.rows });
  } catch (error) {
    console.error('=== PRODUCTS GET ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({ 
      message: 'Server error getting products',
      error: error.message,
      code: error.code
    });
  }
});

// ULTRA-SIMPLE: Get active products only
router.get('/active', auth, async (req, res) => {
  try {
    console.log('=== ACTIVE PRODUCTS GET REQUEST ===');
    
    const result = await db.query(`
      SELECT * FROM products 
      WHERE active = true 
      ORDER BY name ASC
    `);

    console.log(`Found ${result.rows.length} active products`);

    res.json({ products: result.rows });
  } catch (error) {
    console.error('=== ACTIVE PRODUCTS GET ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Server error getting active products',
      error: error.message 
    });
  }
});

// ULTRA-SIMPLE: Get products with pricing for specific customer
router.get('/pricing/:customerId', auth, async (req, res) => {
  try {
    console.log('=== PRODUCTS PRICING REQUEST ===');
    console.log('Customer ID:', req.params.customerId);
    
    if (!req.params.customerId || isNaN(req.params.customerId)) {
      return res.status(400).json({ message: 'Valid customer ID required' });
    }

    const customerId = parseInt(req.params.customerId);
    
    // First, check if customer exists and get contractor status
    console.log('Checking customer:', customerId);
    const customerResult = await db.query(
      'SELECT id, contractor FROM customers WHERE id = $1',
      [customerId]
    );

    let isContractor = false;
    if (customerResult.rows.length > 0) {
      isContractor = customerResult.rows[0].contractor === true;
      console.log('Customer found, contractor status:', isContractor);
    } else {
      console.log('Customer not found, defaulting to retail pricing');
    }

    // Get all active products
    console.log('Getting active products...');
    const productsResult = await db.query(`
      SELECT * FROM products 
      WHERE active = true 
      ORDER BY name ASC
    `);

    console.log(`Found ${productsResult.rows.length} active products`);
    if (productsResult.rows.length > 0) {
      console.log('Sample product structure:', Object.keys(productsResult.rows[0]));
    }

    // Add pricing information to each product - check for different column names
    const productsWithPricing = productsResult.rows.map(product => {
      let currentPrice = 0;
      let priceType = 'retail';

      // Check for different possible column names
      const retailPrice = product.retail_price || product.price_per_unit || product.price || 0;
      const contractorPrice = product.contractor_price || product.wholesale_price || retailPrice * 0.9;

      if (isContractor && contractorPrice !== null) {
        currentPrice = parseFloat(contractorPrice);
        priceType = 'contractor';
      } else if (retailPrice !== null) {
        currentPrice = parseFloat(retailPrice);
        priceType = 'retail';
      }

      return {
        ...product,
        current_price: currentPrice,
        price_type: priceType,
        // Map to expected frontend names
        retail_price: retailPrice,
        contractor_price: contractorPrice
      };
    });

    console.log('Returning products with pricing, contractor status:', isContractor);

    res.json({ 
      products: productsWithPricing,
      isContractor,
      customerId
    });
  } catch (error) {
    console.error('=== PRODUCTS PRICING ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({ 
      message: 'Server error getting product pricing',
      error: error.message,
      code: error.code
    });
  }
});

// ULTRA-SIMPLE: Get single product
router.get('/:id', auth, async (req, res) => {
  try {
    console.log('=== GET SINGLE PRODUCT ===');
    console.log('Product ID:', req.params.id);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid product ID required' });
    }

    const result = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    console.log('Product structure:', Object.keys(result.rows[0]));
    console.log('Active field info:', {
      value: result.rows[0].active,
      type: typeof result.rows[0].active
    });

    res.json({ product: result.rows[0] });
  } catch (error) {
    console.error('=== GET PRODUCT ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Server error getting product',
      error: error.message 
    });
  }
});

// ULTRA-SIMPLE: Create new product
router.post('/', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== CREATE PRODUCT REQUEST ===');
    console.log('Request body:', req.body);
    
    const { name, unit, retail_price, contractor_price, active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Product name is required' });
    }

    if (!unit || !unit.trim()) {
      return res.status(400).json({ message: 'Unit is required' });
    }

    // Check if product already exists
    const existingProduct = await db.query(
      'SELECT id FROM products WHERE name = $1',
      [name.trim()]
    );

    if (existingProduct.rows.length > 0) {
      return res.status(400).json({ message: 'Product with this name already exists' });
    }

    // Try to create with explicit boolean conversion
    const result = await db.query(`
      INSERT INTO products (name, unit, retail_price, contractor_price, active)
      VALUES ($1, $2, $3, $4, $5::boolean)
      RETURNING *
    `, [
      name.trim(),
      unit.trim(),
      retail_price ? parseFloat(retail_price) : null,
      contractor_price ? parseFloat(contractor_price) : null,
      active === true || active === 'true' || active === 1
    ]);

    console.log('Product created successfully:', result.rows[0].id);

    res.status(201).json({
      message: 'Product created successfully',
      product: result.rows[0]
    });

  } catch (error) {
    console.error('=== CREATE PRODUCT ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({ 
      message: 'Server error creating product',
      error: error.message,
      code: error.code
    });
  }
});

// ULTRA-SIMPLE: Update product - BYPASS ACTIVE COLUMN IF PROBLEMATIC
router.put('/:id', auth, requireOfficeOrAdmin, async (req, res) => {
  let schemaResult = null;
  
  try {
    console.log('=== UPDATE PRODUCT REQUEST START ===');
    console.log('Product ID:', req.params.id);
    console.log('Request body:', req.body);
    console.log('Request body types:', Object.keys(req.body).map(key => `${key}: ${typeof req.body[key]} = ${req.body[key]}`));
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid product ID required' });
    }

    const productId = parseInt(req.params.id);

    // Get detailed column information
    console.log('🔍 Checking table schema and column types...');
    schemaResult = await db.query(`
      SELECT 
        column_name, 
        data_type, 
        udt_name,
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'products' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    const columnInfo = {};
    schemaResult.rows.forEach(row => {
      columnInfo[row.column_name] = {
        type: row.data_type,
        udt: row.udt_name,
        nullable: row.is_nullable === 'YES'
      };
    });
    
    console.log('✅ Column information:', columnInfo);

    // Check if product exists
    const existingProduct = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (existingProduct.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    console.log('Current product active value:', {
      value: existingProduct.rows[0].active,
      type: typeof existingProduct.rows[0].active
    });

    const { name, unit, retail_price, contractor_price, active } = req.body;

    // Build update query based on available columns
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Product name cannot be empty' });
      }
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      values.push(name.trim());
      console.log('✅ Added name field');
    }

    if (unit !== undefined) {
      if (!unit || !unit.trim()) {
        return res.status(400).json({ message: 'Unit cannot be empty' });
      }
      paramCount++;
      updateFields.push(`unit = $${paramCount}`);
      values.push(unit.trim());
      console.log('✅ Added unit field');
    }

    // Handle retail price
    if (retail_price !== undefined && columnInfo.retail_price) {
      let priceValue = null;
      if (retail_price !== null && retail_price !== '' && !isNaN(retail_price)) {
        priceValue = parseFloat(retail_price);
      }
      paramCount++;
      updateFields.push(`retail_price = $${paramCount}`);
      values.push(priceValue);
      console.log('✅ Added retail_price field:', priceValue);
    }

    // Handle contractor price
    if (contractor_price !== undefined && columnInfo.contractor_price) {
      let priceValue = null;
      if (contractor_price !== null && contractor_price !== '' && !isNaN(contractor_price)) {
        priceValue = parseFloat(contractor_price);
      }
      paramCount++;
      updateFields.push(`contractor_price = $${paramCount}`);
      values.push(priceValue);
      console.log('✅ Added contractor_price field:', priceValue);
    }

    // Handle active field - MULTIPLE APPROACHES
    if (active !== undefined && columnInfo.active) {
      console.log('🔧 Processing active field...');
      console.log('Active column info:', columnInfo.active);
      console.log('Received active value:', active, 'type:', typeof active);
      
      paramCount++;
      
      // Try different approaches based on what we know about the column
      if (columnInfo.active.type === 'boolean') {
        // It's a boolean column - use explicit casting
        updateFields.push(`active = $${paramCount}::boolean`);
        values.push(active === true || active === 'true' || active === 1);
        console.log('✅ Using boolean cast approach');
      } else if (columnInfo.active.udt === 'bool') {
        // PostgreSQL bool type
        updateFields.push(`active = $${paramCount}`);
        values.push(active === true || active === 'true' || active === 1);
        console.log('✅ Using bool type approach');
      } else {
        // Unknown type - skip active field to avoid error
        console.log('⚠️ Unknown active column type, skipping to avoid error');
        paramCount--; // Decrement since we're not using this parameter
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Add updated_at if column exists
    if (columnInfo.updated_at) {
      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      values.push(new Date());
      console.log('✅ Added updated_at timestamp');
    }

    // Add product ID for WHERE clause
    paramCount++;
    values.push(productId);

    const updateQuery = `
      UPDATE products 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    console.log('🚀 Final update query:', updateQuery);
    console.log('🚀 Final update values:', values);
    console.log('🚀 Final update value types:', values.map((v, i) => `$${i+1}: ${typeof v} = ${v}`));

    const result = await db.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found after update' });
    }

    console.log('✅ Product updated successfully');
    console.log('Updated product active value:', {
      value: result.rows[0].active,
      type: typeof result.rows[0].active
    });

    res.json({
      message: 'Product updated successfully',
      product: result.rows[0]
    });

  } catch (error) {
    console.error('=== UPDATE PRODUCT ERROR ===');
    console.error('❌ Full error object:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error severity:', error.severity);
    console.error('❌ Error hint:', error.hint);
    console.error('❌ Error position:', error.position);
    console.error('❌ Request data:', req.body);
    console.error('❌ Request data types:', Object.keys(req.body).map(key => `${key}: ${typeof req.body[key]} = ${req.body[key]}`));
    
    res.status(500).json({ 
      message: 'Server error updating product',
      error: error.message,
      code: error.code,
      hint: error.hint,
      severity: error.severity,
      availableColumns: schemaResult?.rows?.map(row => row.column_name) || 'schema check failed'
    });
  }
});

// ULTRA-SIMPLE: Delete product
router.delete('/:id', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== DELETE PRODUCT REQUEST ===');
    console.log('Product ID:', req.params.id);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid product ID required' });
    }

    const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    console.log('Product deleted successfully');

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('=== DELETE PRODUCT ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Server error deleting product',
      error: error.message 
    });
  }
});

module.exports = router;
