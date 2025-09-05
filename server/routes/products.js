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
    console.log('First product structure:', result.rows[0]);

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

// ULTRA-SIMPLE: Create new product - DETECT COLUMN NAMES
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

    // Clean up data
    const cleanName = name.trim();
    const cleanUnit = unit.trim();
    const retailPrice = (retail_price !== undefined && retail_price !== null && retail_price !== '') 
      ? parseFloat(retail_price) : null;
    const contractorPrice = (contractor_price !== undefined && contractor_price !== null && contractor_price !== '') 
      ? parseFloat(contractor_price) : null;
    const isActive = active !== false; // Default to true

    console.log('Creating product with cleaned data:', {
      cleanName,
      cleanUnit,
      retailPrice,
      contractorPrice,
      isActive
    });

    // Check if product already exists
    const existingProduct = await db.query(
      'SELECT id FROM products WHERE name = $1',
      [cleanName]
    );

    if (existingProduct.rows.length > 0) {
      return res.status(400).json({ message: 'Product with this name already exists' });
    }

    // Try different column names based on what might exist
    let insertQuery;
    let insertValues;

    // First try the current schema
    try {
      insertQuery = `
        INSERT INTO products (name, unit, retail_price, contractor_price, active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      insertValues = [cleanName, cleanUnit, retailPrice, contractorPrice, isActive];
      
      const result = await db.query(insertQuery, insertValues);
      console.log('Product created successfully with retail_price/contractor_price:', result.rows[0].id);
      return res.status(201).json({
        message: 'Product created successfully',
        product: result.rows[0]
      });
    } catch (columnError) {
      console.log('retail_price/contractor_price columns dont exist, trying alternative...');
      
      // Try with price_per_unit
      try {
        insertQuery = `
          INSERT INTO products (name, unit, price_per_unit, active)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
        insertValues = [cleanName, cleanUnit, retailPrice, isActive];
        
        const result = await db.query(insertQuery, insertValues);
        console.log('Product created successfully with price_per_unit:', result.rows[0].id);
        return res.status(201).json({
          message: 'Product created successfully',
          product: result.rows[0]
        });
      } catch (pricePerUnitError) {
        console.log('price_per_unit column also doesnt exist, checking schema...');
        throw columnError; // Throw original error
      }
    }

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

// ULTRA-SIMPLE: Update product - DETECT COLUMN NAMES DYNAMICALLY
router.put('/:id', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== UPDATE PRODUCT REQUEST START ===');
    console.log('Product ID:', req.params.id);
    console.log('Request body:', req.body);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid product ID required' });
    }

    const productId = parseInt(req.params.id);

    // First, get the existing product to see what columns actually exist
    const existingProduct = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (existingProduct.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const currentProduct = existingProduct.rows[0];
    const availableColumns = Object.keys(currentProduct);
    console.log('Available columns in products table:', availableColumns);

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
    }

    if (unit !== undefined) {
      if (!unit || !unit.trim()) {
        return res.status(400).json({ message: 'Unit cannot be empty' });
      }
      paramCount++;
      updateFields.push(`unit = $${paramCount}`);
      values.push(unit.trim());
    }

    // Handle price fields based on what columns actually exist
    if (retail_price !== undefined) {
      let priceValue = null;
      if (retail_price !== null && retail_price !== '' && !isNaN(retail_price)) {
        priceValue = parseFloat(retail_price);
      }
      
      if (availableColumns.includes('retail_price')) {
        paramCount++;
        updateFields.push(`retail_price = $${paramCount}`);
        values.push(priceValue);
        console.log('Using retail_price column');
      } else if (availableColumns.includes('price_per_unit')) {
        paramCount++;
        updateFields.push(`price_per_unit = $${paramCount}`);
        values.push(priceValue);
        console.log('Using price_per_unit column for retail price');
      }
    }

    if (contractor_price !== undefined) {
      let priceValue = null;
      if (contractor_price !== null && contractor_price !== '' && !isNaN(contractor_price)) {
        priceValue = parseFloat(contractor_price);
      }
      
      if (availableColumns.includes('contractor_price')) {
        paramCount++;
        updateFields.push(`contractor_price = $${paramCount}`);
        values.push(priceValue);
        console.log('Using contractor_price column');
      } else {
        console.log('contractor_price column not available, skipping');
      }
    }

    if (active !== undefined) {
      paramCount++;
      updateFields.push(`active = $${paramCount}`);
      values.push(active === true);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Add updated_at if column exists
    if (availableColumns.includes('updated_at')) {
      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      values.push(new Date());
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

    console.log('Final update query:', updateQuery);
    console.log('Final update values:', values);

    const result = await db.query(updateQuery, values);

    console.log('Product updated successfully');

    res.json({
      message: 'Product updated successfully',
      product: result.rows[0]
    });

  } catch (error) {
    console.error('=== UPDATE PRODUCT ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({ 
      message: 'Server error updating product',
      error: error.message,
      code: error.code
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
