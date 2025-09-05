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

    res.json({ products: result.rows });
  } catch (error) {
    console.error('=== PRODUCTS GET ERROR ===');
    console.error('Full error object:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    
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

    // Add pricing information to each product
    const productsWithPricing = productsResult.rows.map(product => {
      let currentPrice = 0;
      let priceType = 'retail';

      if (isContractor && product.contractor_price !== null) {
        currentPrice = parseFloat(product.contractor_price);
        priceType = 'contractor';
      } else if (product.retail_price !== null) {
        currentPrice = parseFloat(product.retail_price);
        priceType = 'retail';
      }

      return {
        ...product,
        current_price: currentPrice,
        price_type: priceType
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
    console.error('Full error object:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    
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

    const result = await db.query(`
      INSERT INTO products (name, unit, retail_price, contractor_price, active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [cleanName, cleanUnit, retailPrice, contractorPrice, isActive]);

    console.log('Product created successfully:', result.rows[0].id);

    res.status(201).json({
      message: 'Product created successfully',
      product: result.rows[0]
    });

  } catch (error) {
    console.error('=== CREATE PRODUCT ERROR ===');
    console.error('Full error object:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Error stack:', error.stack);
    
    // Handle specific PostgreSQL errors
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Product with this name already exists' });
    }
    
    res.status(500).json({ 
      message: 'Server error creating product',
      error: error.message,
      code: error.code
    });
  }
});

// ULTRA-SIMPLE: Update product - WITH EXTENSIVE DEBUGGING
router.put('/:id', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== UPDATE PRODUCT REQUEST START ===');
    console.log('Product ID:', req.params.id);
    console.log('Raw request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', req.headers);
    console.log('User:', req.user.userId, req.user.role);
    
    // Step 1: Validate product ID
    if (!req.params.id || isNaN(req.params.id)) {
      console.log('❌ Invalid product ID');
      return res.status(400).json({ message: 'Valid product ID required' });
    }

    const productId = parseInt(req.params.id);
    console.log('✅ Product ID validated:', productId);

    // Step 2: Check if product exists
    console.log('🔍 Checking if product exists...');
    const existingProduct = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (existingProduct.rows.length === 0) {
      console.log('❌ Product not found');
      return res.status(404).json({ message: 'Product not found' });
    }
    
    console.log('✅ Product exists:', existingProduct.rows[0]);

    // Step 3: Process request body
    const { name, unit, retail_price, contractor_price, active } = req.body;
    console.log('📥 Processing fields:', { name, unit, retail_price, contractor_price, active });

    // Step 4: Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    console.log('🔧 Building update query...');

    if (name !== undefined) {
      console.log('Processing name:', name);
      if (!name || !name.trim()) {
        console.log('❌ Name cannot be empty');
        return res.status(400).json({ message: 'Product name cannot be empty' });
      }
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      values.push(name.trim());
      console.log(`✅ Added name: ${name.trim()}`);
    }

    if (unit !== undefined) {
      console.log('Processing unit:', unit);
      if (!unit || !unit.trim()) {
        console.log('❌ Unit cannot be empty');
        return res.status(400).json({ message: 'Unit cannot be empty' });
      }
      paramCount++;
      updateFields.push(`unit = $${paramCount}`);
      values.push(unit.trim());
      console.log(`✅ Added unit: ${unit.trim()}`);
    }

    if (retail_price !== undefined) {
      console.log('Processing retail_price:', retail_price, typeof retail_price);
      let processedRetailPrice = null;
      
      if (retail_price !== null && retail_price !== '' && !isNaN(retail_price)) {
        processedRetailPrice = parseFloat(retail_price);
        console.log(`✅ Processed retail price: ${processedRetailPrice}`);
      } else {
        console.log('✅ Retail price set to null');
      }
      
      paramCount++;
      updateFields.push(`retail_price = $${paramCount}`);
      values.push(processedRetailPrice);
    }

    if (contractor_price !== undefined) {
      console.log('Processing contractor_price:', contractor_price, typeof contractor_price);
      let processedContractorPrice = null;
      
      if (contractor_price !== null && contractor_price !== '' && !isNaN(contractor_price)) {
        processedContractorPrice = parseFloat(contractor_price);
        console.log(`✅ Processed contractor price: ${processedContractorPrice}`);
      } else {
        console.log('✅ Contractor price set to null');
      }
      
      paramCount++;
      updateFields.push(`contractor_price = $${paramCount}`);
      values.push(processedContractorPrice);
    }

    if (active !== undefined) {
      console.log('Processing active:', active, typeof active);
      paramCount++;
      updateFields.push(`active = $${paramCount}`);
      values.push(active === true);
      console.log(`✅ Added active: ${active === true}`);
    }

    if (updateFields.length === 0) {
      console.log('❌ No fields to update');
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Step 5: Add updated_at timestamp
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    values.push(new Date());
    console.log('✅ Added updated_at timestamp');

    // Step 6: Add product ID for WHERE clause
    paramCount++;
    values.push(productId);

    const updateQuery = `
      UPDATE products 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    console.log('🚀 Final update query:', updateQuery);
    console.log('🚀 Final update values:', JSON.stringify(values, null, 2));

    // Step 7: Execute the query
    console.log('💾 Executing database update...');
    const result = await db.query(updateQuery, values);

    if (result.rows.length === 0) {
      console.log('❌ Update returned no rows');
      return res.status(404).json({ message: 'Product not found after update' });
    }

    console.log('✅ Product updated successfully:', result.rows[0]);

    res.json({
      message: 'Product updated successfully',
      product: result.rows[0]
    });

  } catch (error) {
    console.error('=== UPDATE PRODUCT ERROR ===');
    console.error('❌ FULL ERROR OBJECT:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error detail:', error.detail);
    console.error('❌ Error constraint:', error.constraint);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Request body was:', JSON.stringify(req.body, null, 2));
    console.error('❌ Product ID was:', req.params.id);
    
    // Handle specific PostgreSQL errors
    if (error.code === '23505') {
      console.log('❌ Unique constraint violation');
      return res.status(400).json({ message: 'Product with this name already exists' });
    }

    if (error.code === '22P02') {
      console.log('❌ Invalid input syntax');
      return res.status(400).json({ message: 'Invalid data format provided' });
    }

    res.status(500).json({ 
      message: 'Server error updating product',
      error: error.message,
      code: error.code,
      detail: error.detail,
      productId: req.params.id,
      requestBody: req.body
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
