const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const db = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all jobs with filters
router.get('/', auth, [
  query('date').optional().isISO8601(),
  query('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled']),
  query('driver_id').optional().isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if job exists
    const existingJob = await db.query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
    if (existingJob.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const job = existingJob.rows[0];

    // Permission checks
    if (req.user.role === 'driver') {
      // Drivers can only update jobs assigned to them and only certain fields
      if (job.assigned_driver !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Drivers can only update status, driver_notes, and payment_received
      const allowedFields = ['status', 'driver_notes', 'payment_received'];
      const requestedFields = Object.keys(req.body);
      const invalidFields = requestedFields.filter(field => !allowedFields.includes(field));
      
      if (invalidFields.length > 0) {
        return res.status(403).json({ 
          message: 'Drivers can only update status, driver notes, and payment received' 
        });
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    const allowedUpdates = [
      'customer_name', 'customer_phone', 'address', 'delivery_date',
      'special_instructions', 'paid', 'status', 'driver_notes', 
      'payment_received', 'assigned_driver'
    ];

    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        paramCount++;
        updateFields.push(`${field} = ${paramCount}`);
        values.push(req.body[field]);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Add updated_at timestamp
    paramCount++;
    updateFields.push(`updated_at = ${paramCount}`);
    values.push(new Date());

    // Add job ID for WHERE clause
    paramCount++;
    values.push(req.params.id);

    const updateQuery = `
      UPDATE jobs 
      SET ${updateFields.join(', ')} 
      WHERE id = ${paramCount}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);

    // Get the complete job with products
    const completeJob = await db.query(`
      SELECT 
        j.*,
        u1.username as created_by_username,
        u2.username as assigned_driver_username,
        json_agg(
          json_build_object(
            'id', jp.id,
            'product_name', jp.product_name,
            'quantity', jp.quantity,
            'unit', jp.unit
          )
        ) as products
      FROM jobs j
      LEFT JOIN users u1 ON j.created_by = u1.id
      LEFT JOIN users u2 ON j.assigned_driver = u2.id
      LEFT JOIN job_products jp ON j.id = jp.job_id
      WHERE j.id = $1
      GROUP BY j.id, u1.username, u2.username
    `, [req.params.id]);

    const responseJob = {
      ...completeJob.rows[0],
      products: completeJob.rows[0].products.filter(p => p.id !== null)
    };

    res.json({
      message: 'Job updated successfully',
      job: responseJob
    });

  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete job
router.delete('/:id', auth, [
  param('id').isInt()
], async (req, res) => {
  // Only office and admin can delete jobs
  if (!['office', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await db.query('DELETE FROM jobs WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get jobs by date range
router.get('/range/:start/:end', auth, [
  param('start').isISO8601(),
  param('end').isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let query = `
      SELECT 
        j.*,
        u1.username as created_by_username,
        u2.username as assigned_driver_username,
        json_agg(
          json_build_object(
            'id', jp.id,
            'product_name', jp.product_name,
            'quantity', jp.quantity,
            'unit', jp.unit
          )
        ) as products
      FROM jobs j
      LEFT JOIN users u1 ON j.created_by = u1.id
      LEFT JOIN users u2 ON j.assigned_driver = u2.id
      LEFT JOIN job_products jp ON j.id = jp.job_id
      WHERE j.delivery_date BETWEEN $1 AND $2
    `;

    const values = [req.params.start, req.params.end];

    // If user is a driver, only show their assigned jobs
    if (req.user.role === 'driver') {
      query += ' AND j.assigned_driver = $3';
      values.push(req.user.userId);
    }

    query += ` 
      GROUP BY j.id, u1.username, u2.username 
      ORDER BY j.delivery_date ASC, j.created_at ASC
    `;

    const result = await db.query(query, values);
    
    const jobs = result.rows.map(job => ({
      ...job,
      products: job.products.filter(p => p.id !== null)
    }));

    res.json({ jobs });
  } catch (error) {
    console.error('Get jobs by range error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let query = `
      SELECT 
        j.*,
        u1.username as created_by_username,
        u2.username as assigned_driver_username,
        json_agg(
          json_build_object(
            'id', jp.id,
            'product_name', jp.product_name,
            'quantity', jp.quantity,
            'unit', jp.unit
          )
        ) as products
      FROM jobs j
      LEFT JOIN users u1 ON j.created_by = u1.id
      LEFT JOIN users u2 ON j.assigned_driver = u2.id
      LEFT JOIN job_products jp ON j.id = jp.job_id
    `;

    const conditions = [];
    const values = [];
    let paramCount = 0;

    if (req.query.date) {
      paramCount++;
      conditions.push(`j.delivery_date = $${paramCount}`);
      values.push(req.query.date);
    }

    if (req.query.status) {
      paramCount++;
      conditions.push(`j.status = $${paramCount}`);
      values.push(req.query.status);
    }

    if (req.query.driver_id) {
      paramCount++;
      conditions.push(`j.assigned_driver = $${paramCount}`);
      values.push(req.query.driver_id);
    }

    // If user is a driver, only show their assigned jobs
    if (req.user.role === 'driver') {
      paramCount++;
      conditions.push(`j.assigned_driver = $${paramCount}`);
      values.push(req.user.userId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` 
      GROUP BY j.id, u1.username, u2.username 
      ORDER BY j.delivery_date ASC, j.created_at ASC
    `;

    const result = await db.query(query, values);
    
    // Format the response
    const jobs = result.rows.map(job => ({
      ...job,
      products: job.products.filter(p => p.id !== null) // Remove null products from empty left joins
    }));

    res.json({ jobs });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single job
router.get('/:id', auth, [
  param('id').isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await db.query(`
      SELECT 
        j.*,
        u1.username as created_by_username,
        u2.username as assigned_driver_username,
        json_agg(
          json_build_object(
            'id', jp.id,
            'product_name', jp.product_name,
            'quantity', jp.quantity,
            'unit', jp.unit
          )
        ) as products
      FROM jobs j
      LEFT JOIN users u1 ON j.created_by = u1.id
      LEFT JOIN users u2 ON j.assigned_driver = u2.id
      LEFT JOIN job_products jp ON j.id = jp.job_id
      WHERE j.id = $1
      GROUP BY j.id, u1.username, u2.username
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const job = {
      ...result.rows[0],
      products: result.rows[0].products.filter(p => p.id !== null)
    };

    // Check if driver can access this job
    if (req.user.role === 'driver' && job.assigned_driver !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ job });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new job
router.post('/', auth, [
  body('customer_name').notEmpty().trim().escape(),
  body('customer_phone').optional().trim(),
  body('address').notEmpty().trim(),
  body('delivery_date').isISO8601(),
  body('special_instructions').optional().trim(),
  body('paid').isBoolean(),
  body('products').isArray({ min: 1 }),
  body('products.*.product_name').notEmpty().trim(),
  body('products.*.quantity').isFloat({ min: 0.01 }),
  body('products.*.unit').notEmpty().trim(),
  body('assigned_driver').optional().isInt()
], async (req, res) => {
  // Only office and admin can create jobs
  if (!['office', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const client = await db.pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await client.query('BEGIN');

    const {
      customer_name,
      customer_phone,
      address,
      delivery_date,
      special_instructions,
      paid,
      products,
      assigned_driver
    } = req.body;

    // Create job
    const jobResult = await client.query(`
      INSERT INTO jobs (
        customer_name, customer_phone, address, delivery_date, 
        special_instructions, paid, created_by, assigned_driver
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      customer_name,
      customer_phone || null,
      address,
      delivery_date,
      special_instructions || null,
      paid,
      req.user.userId,
      assigned_driver || null
    ]);

    const job = jobResult.rows[0];

    // Add products
    for (const product of products) {
      await client.query(`
        INSERT INTO job_products (job_id, product_name, quantity, unit)
        VALUES ($1, $2, $3, $4)
      `, [job.id, product.product_name, product.quantity, product.unit]);
    }

    await client.query('COMMIT');

    // Get the complete job with products
    const completeJob = await db.query(`
      SELECT 
        j.*,
        u1.username as created_by_username,
        u2.username as assigned_driver_username,
        json_agg(
          json_build_object(
            'id', jp.id,
            'product_name', jp.product_name,
            'quantity', jp.quantity,
            'unit', jp.unit
          )
        ) as products
      FROM jobs j
      LEFT JOIN users u1 ON j.created_by = u1.id
      LEFT JOIN users u2 ON j.assigned_driver = u2.id
      LEFT JOIN job_products jp ON j.id = jp.job_id
      WHERE j.id = $1
      GROUP BY j.id, u1.username, u2.username
    `, [job.id]);

    const responseJob = {
      ...completeJob.rows[0],
      products: completeJob.rows[0].products.filter(p => p.id !== null)
    };

    res.status(201).json({
      message: 'Job created successfully',
      job: responseJob
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create job error:', error);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// Update job
router.put('/:id', auth, [
  param('id').isInt(),
  body('customer_name').optional().notEmpty().trim().escape(),
  body('customer_phone').optional().trim(),
  body('address').optional().notEmpty().trim(),
  body('delivery_date').optional().isISO8601(),
  body('special_instructions').optional().trim(),
  body('paid').optional().isBoolean(),
  body('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled']),
  body('driver_notes').optional().trim(),
  body('payment_received').optional().isFloat({ min: 0 }),
  body('assigned_driver').optional().isInt()
], async