const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
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

// ULTRA-SIMPLE: Get all customers
router.get('/', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== CUSTOMERS GET REQUEST ===');
    console.log('User:', req.user.userId, req.user.role);
    
    // Simplest possible query
    const result = await db.query('SELECT * FROM customers ORDER BY name ASC');

    console.log(`Found ${result.rows.length} customers`);
    
    // Add total_deliveries as 0 for now to match expected format
    const customers = result.rows.map(customer => ({
      ...customer,
      total_deliveries: 0
    }));

    res.json({ customers });
  } catch (error) {
    console.error('=== CUSTOMERS GET ERROR ===');
    console.error('Full error object:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      message: 'Server error getting customers',
      error: error.message,
      code: error.code
    });
  }
});

// ULTRA-SIMPLE: Search customers
router.get('/search', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== CUSTOMERS SEARCH REQUEST ===');
    console.log('Search query:', req.query.q);
    
    if (!req.query.q) {
      return res.status(400).json({ message: 'Search query required' });
    }

    const searchTerm = `%${req.query.q}%`;
    
    const result = await db.query(`
      SELECT * FROM customers
      WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1
      ORDER BY name ASC
      LIMIT 10
    `, [searchTerm]);

    console.log(`Found ${result.rows.length} customers matching search`);
    
    const customers = result.rows.map(customer => ({
      ...customer,
      total_deliveries: 0
    }));

    res.json({ customers });
  } catch (error) {
    console.error('=== CUSTOMERS SEARCH ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Server error searching customers',
      error: error.message 
    });
  }
});

// ULTRA-SIMPLE: Get single customer
router.get('/:id', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== GET SINGLE CUSTOMER ===');
    console.log('Customer ID:', req.params.id);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid customer ID required' });
    }

    const result = await db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const customer = {
      ...result.rows[0],
      total_deliveries: 0
    };

    res.json({ customer });
  } catch (error) {
    console.error('=== GET CUSTOMER ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Server error getting customer',
      error: error.message 
    });
  }
});

// ULTRA-SIMPLE: Create new customer
router.post('/', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== CREATE CUSTOMER REQUEST ===');
    console.log('Request body:', req.body);
    
    const { name, phone, email, addresses, notes, contractor } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    // Clean up data - convert empty strings to null
    const cleanPhone = (phone && phone.trim()) ? phone.trim() : null;
    const cleanEmail = (email && email.trim()) ? email.trim() : null;
    const cleanNotes = (notes && notes.trim()) ? notes.trim() : null;
    const isContractor = contractor === true;
    const cleanAddresses = addresses || [];

    console.log('Creating customer:', {
      name: name.trim(),
      cleanPhone,
      cleanEmail,
      cleanNotes,
      isContractor,
      addressCount: cleanAddresses.length
    });

    const result = await db.query(`
      INSERT INTO customers (name, phone, email, addresses, notes, contractor)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      name.trim(),
      cleanPhone,
      cleanEmail,
      JSON.stringify(cleanAddresses),
      cleanNotes,
      isContractor
    ]);

    console.log('Customer created successfully:', result.rows[0].id);

    res.status(201).json({
      message: 'Customer created successfully',
      customer: result.rows[0]
    });

  } catch (error) {
    console.error('=== CREATE CUSTOMER ERROR ===');
    console.error('Full error object:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Error stack:', error.stack);
    
    // Handle specific database errors
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Customer already exists' });
    }
    
    res.status(500).json({ 
      message: 'Server error creating customer',
      error: error.message,
      code: error.code
    });
  }
});

// ULTRA-SIMPLE: Update customer
router.put('/:id', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== UPDATE CUSTOMER REQUEST ===');
    console.log('Customer ID:', req.params.id);
    console.log('Update data:', req.body);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid customer ID required' });
    }

    // Check if customer exists
    const existingCustomer = await db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (existingCustomer.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const { name, phone, email, addresses, notes, contractor } = req.body;

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ message: 'Customer name cannot be empty' });
      }
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      values.push(name.trim());
    }

    if (phone !== undefined) {
      paramCount++;
      updateFields.push(`phone = $${paramCount}`);
      values.push(phone && phone.trim() ? phone.trim() : null);
    }

    if (email !== undefined) {
      paramCount++;
      updateFields.push(`email = $${paramCount}`);
      values.push(email && email.trim() ? email.trim() : null);
    }

    if (addresses !== undefined) {
      paramCount++;
      updateFields.push(`addresses = $${paramCount}`);
      values.push(JSON.stringify(addresses || []));
    }

    if (notes !== undefined) {
      paramCount++;
      updateFields.push(`notes = $${paramCount}`);
      values.push(notes && notes.trim() ? notes.trim() : null);
    }

    if (contractor !== undefined) {
      paramCount++;
      updateFields.push(`contractor = $${paramCount}`);
      values.push(contractor === true);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    // Add updated_at
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

    console.log('Customer updated successfully');

    res.json({
      message: 'Customer updated successfully',
      customer: result.rows[0]
    });

  } catch (error) {
    console.error('=== UPDATE CUSTOMER ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({ 
      message: 'Server error updating customer',
      error: error.message 
    });
  }
});

// ULTRA-SIMPLE: Delete customer
router.delete('/:id', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== DELETE CUSTOMER REQUEST ===');
    console.log('Customer ID:', req.params.id);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid customer ID required' });
    }

    const result = await db.query('DELETE FROM customers WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    console.log('Customer deleted successfully');

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('=== DELETE CUSTOMER ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Server error deleting customer',
      error: error.message 
    });
  }
});

module.exports = router;
