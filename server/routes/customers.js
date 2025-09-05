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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Search customers
router.get('/search', auth, requireRole(['office', 'admin']), [
  query('q').notEmpty().withMessage('Search query is required').trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single customer
router.get('/:id', auth, requireRole(['office', 'admin']), [
  param('id').isInt().withMessage('Customer ID must be a valid number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new customer - FIXED VALIDATION AND ERROR HANDLING
router.post('/', auth, requireRole(['office', 'admin']), [
  body('name').notEmpty().withMessage('Customer name is required').trim().escape(),
  body('phone').optional({ nullable: true, checkFalsy: true }).trim(),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Invalid email format').normalizeEmail(),
  body('addresses').isArray({ min: 1 }).withMessage('At least one address is required'),
  body('addresses.*.address').notEmpty().withMessage('Address cannot be empty').trim(),
  body('addresses.*.notes').optional({ nullable: true, checkFalsy: true }).trim(),
  body('notes').optional({ nullable: true, checkFalsy: true }).trim(),
  body('contractor').optional().isBoolean().withMessage('Contractor must be true or false')
], async (req, res) => {
  try {
    console.log('Creating customer with data:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { name, phone, email, addresses, notes, contractor } = req.body;

    // Clean up data - convert empty strings to null
    const cleanPhone = (phone === '' || phone === undefined) ? null : phone;
    const cleanEmail = (email === '' || email === undefined) ? null : email;
    const cleanNotes = (notes === '' || notes === undefined) ? null : notes;
    const isContractor = contractor !== undefined ? contractor : false;

    // Validate and clean addresses
    if (!addresses || addresses.length === 0) {
      return res.status(400).json({ message: 'At least one address is required' });
    }

    const cleanAddresses = addresses.map(addr => ({
      address: addr.address.trim(),
      notes: (addr.notes === '' || addr.notes === undefined) ? null : addr.notes.trim()
    })).filter(addr => addr.address); // Remove any empty addresses

    if (cleanAddresses.length === 0) {
      return res.status(400).json({ message: 'At least one valid address is required' });
    }

    console.log('Processed values:', {
      name,
      cleanPhone,
      cleanEmail,
      cleanAddresses,
      cleanNotes,
      isContractor
    });

    // Check if customer with same name and phone already exists (to prevent duplicates)
    if (cleanPhone) {
      const existingCustomer = await db.query(
        'SELECT id FROM customers WHERE name = $1 AND phone = $2',
        [name, cleanPhone]
      );

      if (existingCustomer.rows.length > 0) {
        return res.status(400).json({ 
          message: 'Customer with this name and phone number already exists' 
        });
      }
    }

    const result = await db.query(`
      INSERT INTO customers (name, phone, email, addresses, notes, contractor)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      name,
      cleanPhone,
      cleanEmail,
      JSON.stringify(cleanAddresses),
      cleanNotes,
      isContractor
    ]);

    console.log('Customer created successfully:', result.rows[0]);

    res.status(201).json({
      message: 'Customer created successfully',
      customer: result.rows[0]
    });

  } catch (error) {
    console.error('Create customer error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    
    // Handle specific PostgreSQL errors
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ message: 'Customer with this information already exists' });
    }
    
    if (error.code === '22P02') { // Invalid input syntax
      return res.status(400).json({ message: 'Invalid data format provided' });
    }

    if (error.code === '22008') { // Invalid JSON
      return res.status(400).json({ message: 'Invalid address format provided' });
    }
    
    res.status(500).json({ 
      message: 'Server error creating customer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update customer - ALSO FIXED
router.put('/:id', auth, requireRole(['office', 'admin']), [
  param('id').isInt().withMessage('Customer ID must be a valid number'),
  body('name').optional().notEmpty().withMessage('Customer name cannot be empty').trim().escape(),
  body('phone').optional({ nullable: true, checkFalsy: true }).trim(),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Invalid email format').normalizeEmail(),
  body('addresses').optional().isArray({ min: 1 }).withMessage('At least one address is required'),
  body('addresses.*.address').optional().notEmpty().withMessage('Address cannot be empty').trim(),
  body('addresses.*.notes').optional({ nullable: true, checkFalsy: true }).trim(),
  body('notes').optional({ nullable: true, checkFalsy: true }).trim(),
  body('contractor').optional().isBoolean().withMessage('Contractor must be true or false')
], async (req, res) => {
  try {
    console.log('Updating customer with data:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
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
          // Clean and validate addresses
          const addresses = req.body[field];
          const cleanAddresses = addresses.map(addr => ({
            address: addr.address.trim(),
            notes: (addr.notes === '' || addr.notes === undefined) ? null : addr.notes.trim()
          })).filter(addr => addr.address);
          
          if (cleanAddresses.length === 0) {
            return res.status(400).json({ message: 'At least one valid address is required' });
          }
          
          values.push(JSON.stringify(cleanAddresses));
        } else if (field === 'phone' || field === 'email' || field === 'notes') {
          // Convert empty strings to null
          const value = req.body[field];
          values.push((value === '' || value === undefined) ? null : value);
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

    console.log('Update query:', updateQuery);
    console.log('Update values:', values);

    const result = await db.query(updateQuery, values);

    console.log('Customer updated successfully:', result.rows[0]);

    res.json({
      message: 'Customer updated successfully',
      customer: result.rows[0]
    });

  } catch (error) {
    console.error('Update customer error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    
    res.status(500).json({ 
      message: 'Server error updating customer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Delete customer
router.delete('/:id', auth, requireRole(['office', 'admin']), [
  param('id').isInt().withMessage('Customer ID must be a valid number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const result = await db.query('DELETE FROM customers WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
