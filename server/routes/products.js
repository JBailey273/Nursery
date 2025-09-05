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

// ULTRA-SIMPLE: Update product
router.put('/:id', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== UPDATE PRODUCT REQUEST ===');
    console.log('Product ID:', req.params.id);
    console.log('Update data:', req.body);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid product ID required' });
    }

    // Check if product exists
    const existingProduct = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (existingProduct.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    const allowedUpdates = ['name', 'unit', 'retail_price', 'contractor_price', 'active'];

    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        paramCount++;
        updateFields.push(`${field} = $${paramCount}`);
        
        // Handle price fields specially
        if (field === 'retail_price' || field === 'contractor_price') {
          const value = req.body[field];
          values.push((value !== undefined && value !== null && value !== '') ? parseFloat(value) : null);
        } else if (field === 'name' || field === 'unit') {
          const value = req.body[field];
          if (!value || !value.trim()) {
            return res.status(400).json({ message: `${field} cannot be empty` });
          }
          values.push(value.trim());
        } else {
          values.push(req.body[field]);
        }
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Add updated_at timestamp
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    // Add product ID for WHERE clause
    paramCount++;
    values.push(req.params.id);

    const updateQuery = `
      UPDATE products 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    console.log('Update query:', updateQuery);
    console.log('Update values:', values);

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
      error: error.message 
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
