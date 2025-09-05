const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const db = require('../config/database');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all customers
router.get('/', auth, requireRole(['office', 'admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        c.*,
        COUNT(j.id) as total_deliveries
      FROM customers c
      LEFT JOIN jobs j ON c.id = j.customer_id
      GROUP BY c.id
      ORDER BY c.contractor DESC, c.name ASC
    `);

    res.json({ customers: result.rows });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search customers
router.get('/search', auth, requireRole(['office', 'admin']), [
  query('q').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const searchTerm = `%${req.query.q}%`;
    const result = await db.query(`
      SELECT 
        c.*,
        COUNT(j.id) as total_deliveries
      FROM customers c
      LEFT JOIN jobs j ON c.id = j.customer_id
      WHERE 
        c.name ILIKE $1 OR 
        c.phone ILIKE $1 OR 
        c.email ILIKE $1
      GROUP BY c.id
      ORDER BY c.contractor DESC, c.name ASC
      LIMIT 10
    `, [searchTerm]);

    res.json({ customers: result.rows });
  } catch (error) {
    console.error('Search customers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single customer
router.get('/:id', auth, requireRole(['office', 'admin']), [
  param('id').isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await db.query(`
      SELECT 
        c.*,
        COUNT(j.id) as total_deliveries
      FROM customers c
      LEFT JOIN jobs j ON c.id = j.customer_id
      WHERE c.id = $1
      GROUP BY c.id
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({ customer: result.rows[0] });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new customer
router.post('/', auth, requireRole(['office', 'admin']), [
  body('name').notEmpty().trim().escape(),
  body('phone').optional().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('addresses').isArray({ min: 1 }),
  body('addresses.*.address').notEmpty().trim(),
  body('addresses.*.notes').optional().trim(),
  body('notes').optional().trim(),
  body('contractor').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phone, email, addresses, notes, contractor } = req.body;

    const result = await db.query(`
      INSERT INTO customers (name, phone, email, addresses, notes, contractor)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      name,
      phone || null,
      email || null,
      JSON.stringify(addresses),
      notes || null,
      contractor || false
    ]);

    res.status(201).json({
      message: 'Customer created successfully',
      customer: result.rows[0]
    });

  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update customer
router.put('/:id', auth, requireRole(['office', 'admin']), [
  param('id').isInt(),
  body('name').optional().notEmpty().trim().escape(),
  body('phone').optional().trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('addresses').optional().isArray({ min: 1 }),
  body('addresses.*.address').optional().notEmpty().trim(),
  body('addresses.*.notes').optional().trim(),
  body('notes').optional().trim(),
  body('contractor').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if customer exists
    const existingCustomer = await db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (existingCustomer.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    const allowedUpdates = ['name', 'phone', 'email', 'addresses', 'notes', 'contractor'];

    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        paramCount++;
        updateFields.push(`${field} = $${paramCount}`);
        if (field === 'addresses') {
          values.push(JSON.stringify(req.body[field]));
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

    // Add customer ID for WHERE clause
    paramCount++;
    values.push(req.params.id);

    const updateQuery = `
      UPDATE customers 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);

    res.json({
      message: 'Customer updated successfully',
      customer: result.rows[0]
    });

  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete customer
router.delete('/:id', auth, requireRole(['office', 'admin']), [
  param('id').isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await db.query('DELETE FROM customers WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
