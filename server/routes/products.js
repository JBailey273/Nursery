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
    
    // Ensure all products have pricing fields mapped correctly
    const productsWithPricing = result.rows.map(product => ({
      ...product,
      current_price: product.retail_price || product.price_per_unit || product.price || 0,
      retail_price: product.retail_price || product.price_per_unit || product.price || 0,
      contractor_price: product.contractor_price || (product.retail_price || product.price_per_unit || 0) * 0.9
    }));

    console.log('Sample product pricing:', productsWithPricing.slice(0, 2).map(p => ({
      name: p.name,
      current_price: p.current_price,
      retail_price: p.retail_price,
      contractor_price: p.contractor_price
    })));

    res.json({ products: productsWithPricing });
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

    // Ensure all products have pricing fields mapped correctly
    const productsWithPricing = result.rows.map(product => ({
      ...product,
      current_price: product.retail_price || product.price_per_unit || product.price || 0,
      retail_price: product.retail_price || product.price_per_unit || product.price || 0,
      contractor_price: product.contractor_price || (product.retail_price || product.price_per_unit || 0) * 0.9
    }));

    console.log('Active products pricing sample:', productsWithPricing.slice(0, 2).map(p => ({
      name: p.name,
      current_price: p.current_price,
      retail_price: p.retail_price,
      contractor_price: p.contractor_price
    })));

    res.json({ products: productsWithPricing });
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

    // Add pricing information to each product - with proper fallbacks
    const productsWithPricing = productsResult.rows.map(product => {
      // Get retail price from various possible column names
      const retailPrice = product.retail_price || product.price_per_unit || product.price || 0;
      
      // Get contractor price, with fallback to 90% of retail
      const contractorPrice = product.contractor_price || 
                            product.wholesale_price || 
                            (retailPrice * 0.9);

      let currentPrice = 0;
      let priceType = 'retail';

      if (isContractor && contractorPrice > 0) {
        currentPrice = parseFloat(contractorPrice);
        priceType = 'contractor';
      } else if (retailPrice > 0) {
        currentPrice = parseFloat(retailPrice);
        priceType = 'retail';
      }

      const productWithPricing = {
        ...product,
        current_price: currentPrice,
        price_type: priceType,
        retail_price: parseFloat(retailPrice) || 0,
        contractor_price: parseFloat(contractorPrice) || 0
      };

      console.log(`Product ${product.name}: retail=${retailPrice}, contractor=${contractorPrice}, current=${currentPrice}`);

      return productWithPricing;
    });

    console.log('Returning products with customer pricing, contractor status:', isContractor);

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

    const product = result.rows[0];
    
    // Add pricing mapping
    const productWithPricing = {
      ...product,
      current_price: product.retail_price || product.price_per_unit || product.price || 0,
      retail_price: product.retail_price || product.price_per_unit || product.price || 0,
      contractor_price: product.contractor_price || (product.retail_price || product.price_per_unit || 0) * 0.9
    };

    res.json({ product: productWithPricing });
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

    const cleanRetailPrice = retail_price ? parseFloat(retail_price) : null;
    const cleanContractorPrice = contractor_price ? parseFloat(contractor_price) : (cleanRetailPrice ? cleanRetailPrice * 0.9 : null);

    // Try to create with explicit boolean conversion
    const result = await db.query(`
      INSERT INTO products (name, unit, retail_price, contractor_price, active)
      VALUES ($1, $2, $3, $4, $5::boolean)
      RETURNING *
    `, [
      name.trim(),
      unit.trim(),
      cleanRetailPrice,
      cleanContractorPrice,
      active === true || active === 'true' || active === 1
    ]);

    console.log('Product created successfully:', result.rows[0].id);

    // Return with pricing mapping
    const createdProduct = {
      ...result.rows[0],
      current_price: result.rows[0].retail_price || 0
    };

    res.status(201).json({
      message: 'Product created successfully',
      product: createdProduct
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

// ULTRA-SIMPLE: Update product
router.put('/:id', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== UPDATE PRODUCT REQUEST ===');
    console.log('Product ID:', req.params.id);
    console.log('Request body:', req.body);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid product ID required' });
    }

    const productId = parseInt(req.params.id);

    // Check if product exists
    const existingProduct = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (existingProduct.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const { name, unit, retail_price, contractor_price, active } = req.body;

    // Build update query dynamically
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

    // Handle retail price
    if (retail_price !== undefined) {
      let priceValue = null;
      if (retail_price !== null && retail_price !== '' && !isNaN(retail_price)) {
        priceValue = parseFloat(retail_price);
      }
      paramCount++;
      updateFields.push(`retail_price = $${paramCount}`);
      values.push(priceValue);
    }

    // Handle contractor price
    if (contractor_price !== undefined) {
      let priceValue = null;
      if (contractor_price !== null && contractor_price !== '' && !isNaN(contractor_price)) {
        priceValue = parseFloat(contractor_price);
      }
      paramCount++;
      updateFields.push(`contractor_price = $${paramCount}`);
      values.push(priceValue);
    }

    // Handle active field with explicit boolean casting
    if (active !== undefined) {
      paramCount++;
      updateFields.push(`active = $${paramCount}::boolean`);
      values.push(active === true || active === 'true' || active === 1);
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
    values.push(productId);

    const updateQuery = `
      UPDATE products 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    console.log('Update query:', updateQuery);
    console.log('Update values:', values);

    const result = await db.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found after update' });
    }

    console.log('Product updated successfully');

    // Return with pricing mapping
    const updatedProduct = {
      ...result.rows[0],
      current_price: result.rows[0].retail_price || 0
    };

    res.json({
      message: 'Product updated successfully',
      product: updatedProduct
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
