const express = require('express');
const { body, validationResult, param } = require('express-validator');
const db = require('../config/database');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all products
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM products 
      ORDER BY active DESC, name ASC
    `);

    res.json({ products: result.rows });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get active products only
router.get('/active', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM products 
      WHERE active = true 
      ORDER BY name ASC
    `);

    res.json({ products: result.rows });
  } catch (error) {
    console.error('Get active products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get products with pricing for specific customer
router.get('/pricing/:customerId', auth, async (req, res) => {
  try {
    const customerId = req.params.customerId;
    
    // Get customer contractor status
    const customerResult = await db.query(
      'SELECT contractor FROM customers WHERE id = $1',
      [customerId]
    );

    const isContractor = customerResult.rows.length > 0 ? customerResult.rows[0].contractor : false;

    // Get products with appropriate pricing
    const result = await db.query(`
      SELECT 
        *,
        CASE 
          WHEN $1 = true THEN contractor_price 
          ELSE retail_price 
        END as current_price,
        CASE 
          WHEN $1 = true THEN 'contractor' 
          ELSE 'retail' 
        END as price_type
      FROM products 
      WHERE active = true 
      ORDER BY name ASC
    `, [isContractor]);

    res.json({ 
      products: result.rows,
      isContractor,
      customerId
    });
  } catch (error) {
    console.error('Get products pricing error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single product
router.get('/:id', auth, [
  param('id').isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ product: result.rows[0] });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new product
router.post('/', auth, requireRole(['office', 'admin']), [
  body('name').notEmpty().trim().escape(),
  body('unit').notEmpty().trim(),
  body('retail_price').optional().isFloat({ min: 0 }),
  body('contractor_price').optional().isFloat({ min: 0 }),
  body('active').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, unit, retail_price, contractor_price, active } = req.body;

    // Check if product already exists
    const existingProduct = await db.query(
      'SELECT id FROM products WHERE name = $1',
      [name]
    );

    if (existingProduct.rows.length > 0) {
      return res.status(400).json({ message: 'Product with this name already exists' });
    }

    const result = await db.query(`
      INSERT INTO products (name, unit, retail_price, contractor_price, active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      name, 
      unit, 
      retail_price || null, 
      contractor_price || null, 
      active !== undefined ? active : true
    ]);

    res.status(201).json({
      message: 'Product created successfully',
      product: result.rows[0]
    });

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update product
router.put('/:id', auth, requireRole(['office', 'admin']), [
  param('id').isInt(),
  body('name').optional().notEmpty().trim().escape(),
  body('unit').optional().notEmpty().trim(),
  body('retail_price').optional().isFloat({ min: 0 }),
  body('contractor_price').optional().isFloat({ min: 0 }),
  body('active').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
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
        values.push(req.body[field]);
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

    const result = await db.query(updateQuery, values);

    res.json({
      message: 'Product updated successfully',
      product: result.rows[0]
    });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete product
router.delete('/:id', auth, requireRole(['office', 'admin']), [
  param('id').isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
