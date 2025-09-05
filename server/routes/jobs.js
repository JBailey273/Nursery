const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const db = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all jobs with filters
router.get('/', auth, [
  query('date').optional().isISO8601().withMessage('Invalid date format'),
  query('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid status'),
  query('driver_id').optional().isInt().withMessage('Driver ID must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
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
            'unit', jp.unit,
            'unit_price', jp.unit_price,
            'total_price', jp.total_price,
            'price_type', jp.price_type
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single job
router.get('/:id', auth, [
  param('id').isInt().withMessage('Job ID must be a valid number')
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
        j.*,
        u1.username as created_by_username,
        u2.username as assigned_driver_username,
        json_agg(
          json_build_object(
            'id', jp.id,
            'product_name', jp.product_name,
            'quantity', jp.quantity,
            'unit', jp.unit,
            'unit_price', jp.unit_price,
            'total_price', jp.total_price,
            'price_type', jp.price_type
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new job - FIXED VALIDATION AND ERROR HANDLING
router.post('/', auth, [
  body('customer_name').notEmpty().withMessage('Customer name is required').trim().escape(),
  body('customer_phone').optional({ nullable: true, checkFalsy: true }).trim(),
  body('address').notEmpty().withMessage('Delivery address is required').trim(),
  body('delivery_date').isISO8601().withMessage('Invalid delivery date format'),
  body('special_instructions').optional({ nullable: true, checkFalsy: true }).trim(),
  body('paid').isBoolean().withMessage('Paid status must be true or false'),
  body('products').isArray({ min: 1 }).withMessage('At least one product is required'),
  body('products.*.product_name').notEmpty().withMessage('Product name is required').trim(),
  body('products.*.quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be greater than 0'),
  body('products.*.unit').notEmpty().withMessage('Unit is required').trim(),
  body('products.*.unit_price').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Unit price must be 0 or greater'),
  body('products.*.total_price').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Total price must be 0 or greater'),
  body('assigned_driver').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('Assigned driver must be a valid user ID'),
  body('customer_id').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('Customer ID must be a valid number'),
  body('total_amount').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Total amount must be 0 or greater'),
  body('contractor_discount').optional().isBoolean().withMessage('Contractor discount must be true or false')
], async (req, res) => {
  // Only office and admin can create jobs
  if (!['office', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const client = await db.pool.connect();
  
  try {
    console.log('Creating job with data:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
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
      assigned_driver,
      customer_id,
      total_amount,
      contractor_discount
    } = req.body;

    // Clean up data - convert empty strings to null
    const cleanCustomerPhone = (customer_phone === '' || customer_phone === undefined) ? null : customer_phone;
    const cleanSpecialInstructions = (special_instructions === '' || special_instructions === undefined) ? null : special_instructions;
    const cleanAssignedDriver = (assigned_driver === '' || assigned_driver === undefined) ? null : parseInt(assigned_driver);
    const cleanCustomerId = (customer_id === '' || customer_id === undefined) ? null : parseInt(customer_id);
    const cleanTotalAmount = (total_amount === '' || total_amount === undefined) ? 0 : parseFloat(total_amount);
    const isContractorDiscount = contractor_discount !== undefined ? contractor_discount : false;

    // Validate products array
    if (!products || products.length === 0) {
      return res.status(400).json({ message: 'At least one product is required' });
    }

    // Clean and validate each product
    const cleanProducts = [];
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      if (!product.product_name || !product.quantity || !product.unit) {
        return res.status(400).json({ 
          message: `Product ${i + 1}: name, quantity, and unit are required` 
        });
      }

      const cleanProduct = {
        product_name: product.product_name.trim(),
        quantity: parseFloat(product.quantity),
        unit: product.unit.trim(),
        unit_price: (product.unit_price === '' || product.unit_price === undefined) ? 0 : parseFloat(product.unit_price),
        total_price: (product.total_price === '' || product.total_price === undefined) ? 0 : parseFloat(product.total_price),
        price_type: product.price_type || 'retail'
      };

      // Calculate total_price if not provided
      if (cleanProduct.total_price === 0 && cleanProduct.unit_price > 0) {
        cleanProduct.total_price = cleanProduct.unit_price * cleanProduct.quantity;
      }

      cleanProducts.push(cleanProduct);
    }

    console.log('Processed values:', {
      customer_name,
      cleanCustomerPhone,
      address,
      delivery_date,
      cleanSpecialInstructions,
      paid,
      cleanAssignedDriver,
      cleanCustomerId,
      cleanTotalAmount,
      isContractorDiscount,
      cleanProducts
    });

    // Create job
    const jobResult = await client.query(`
      INSERT INTO jobs (
        customer_id, customer_name, customer_phone, address, delivery_date, 
        special_instructions, paid, total_amount, contractor_discount,
        created_by, assigned_driver
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      cleanCustomerId,
      customer_name,
      cleanCustomerPhone,
      address,
      delivery_date,
      cleanSpecialInstructions,
      paid,
      cleanTotalAmount,
      isContractorDiscount,
      req.user.userId,
      cleanAssignedDriver
    ]);

    const job = jobResult.rows[0];
    console.log('Job created with ID:', job.id);

    // Add products
    for (const product of cleanProducts) {
      await client.query(`
        INSERT INTO job_products (job_id, product_name, quantity, unit, unit_price, total_price, price_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        job.id, 
        product.product_name, 
        product.quantity, 
        product.unit,
        product.unit_price,
        product.total_price,
        product.price_type
      ]);
    }

    await client.query('COMMIT');
    console.log('Job and products created successfully');

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
            'unit', jp.unit,
            'unit_price', jp.unit_price,
            'total_price', jp.total_price,
            'price_type', jp.price_type
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
    console.error('Create job error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    
    // Handle specific PostgreSQL errors
    if (error.code === '23503') { // Foreign key violation
      return res.status(400).json({ message: 'Invalid customer ID or assigned driver ID' });
    }
    
    if (error.code === '22P02') { // Invalid input syntax
      return res.status(400).json({ message: 'Invalid data format provided' });
    }
    
    res.status(500).json({ 
      message: 'Server error creating job',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Update job - ALSO FIXED
router.put('/:id', auth, [
  param('id').isInt().withMessage('Job ID must be a valid number'),
  body('customer_name').optional().notEmpty().withMessage('Customer name cannot be empty').trim().escape(),
  body('customer_phone').optional({ nullable: true, checkFalsy: true }).trim(),
  body('address').optional().notEmpty().withMessage('Address cannot be empty').trim(),
  body('delivery_date').optional().isISO8601().withMessage('Invalid delivery date format'),
  body('special_instructions').optional({ nullable: true, checkFalsy: true }).trim(),
  body('paid').optional().isBoolean().withMessage('Paid status must be true or false'),
  body('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('driver_notes').optional({ nullable: true, checkFalsy: true }).trim(),
  body('payment_received').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('Payment received must be 0 or greater'),
  body('assigned_driver').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('Assigned driver must be a valid user ID')
], async (req, res) => {
  try {
    console.log('Updating job with data:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
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
        updateFields.push(`${field} = $${paramCount}`);
        
        // Handle special cases for nullable fields
        if (field === 'customer_phone' || field === 'special_instructions' || field === 'driver_notes') {
          const value = req.body[field];
          values.push((value === '' || value === undefined) ? null : value);
        } else if (field === 'payment_received') {
          const value = req.body[field];
          values.push((value === '' || value === undefined) ? null : parseFloat(value));
        } else if (field === 'assigned_driver') {
          const value = req.body[field];
          values.push((value === '' || value === undefined) ? null : parseInt(value));
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

    // Add job ID for WHERE clause
    paramCount++;
    values.push(req.params.id);

    const updateQuery = `
      UPDATE jobs 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    console.log('Update query:', updateQuery);
    console.log('Update values:', values);

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
            'unit', jp.unit,
            'unit_price', jp.unit_price,
            'total_price', jp.total_price,
            'price_type', jp.price_type
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

    console.log('Job updated successfully');

    res.json({
      message: 'Job updated successfully',
      job: responseJob
    });

  } catch (error) {
    console.error('Update job error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    
    res.status(500).json({ 
      message: 'Server error updating job',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Delete job
router.delete('/:id', auth, [
  param('id').isInt().withMessage('Job ID must be a valid number')
], async (req, res) => {
  // Only office and admin can delete jobs
  if (!['office', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const result = await db.query('DELETE FROM jobs WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get jobs by date range
router.get('/range/:start/:end', auth, [
  param('start').isISO8601().withMessage('Invalid start date format'),
  param('end').isISO8601().withMessage('Invalid end date format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
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
            'unit', jp.unit,
            'unit_price', jp.unit_price,
            'total_price', jp.total_price,
            'price_type', jp.price_type
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
