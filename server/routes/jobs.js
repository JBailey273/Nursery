const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const db = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Simple role check functions
const requireOfficeOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (!['office', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Office or admin role required' });
  }
  
  next();
};

// ULTRA-SIMPLE: Get all jobs with filters
router.get('/', auth, async (req, res) => {
  try {
    console.log('=== JOBS GET REQUEST ===');
    console.log('User:', req.user.userId, req.user.role);
    console.log('Query params:', req.query);
    
    let query = 'SELECT * FROM jobs';
    const conditions = [];
    const values = [];
    let paramCount = 0;

    // Simple date filter
    if (req.query.date) {
      paramCount++;
      conditions.push(`delivery_date = $${paramCount}`);
      values.push(req.query.date);
    }

    // Simple status filter
    if (req.query.status) {
      paramCount++;
      conditions.push(`status = $${paramCount}`);
      values.push(req.query.status);
    }

    // If user is a driver, only show their assigned jobs
    if (req.user.role === 'driver') {
      paramCount++;
      conditions.push(`assigned_driver = $${paramCount}`);
      values.push(req.user.userId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY delivery_date ASC, created_at ASC';

    console.log('Query:', query);
    console.log('Values:', values);

    const result = await db.query(query, values);
    
    console.log(`Found ${result.rows.length} jobs`);
    
    // For now, return jobs without products to simplify
    const jobs = result.rows.map(job => ({
      ...job,
      products: [] // Empty products array for now
    }));

    res.json({ jobs });
  } catch (error) {
    console.error('=== JOBS GET ERROR ===');
    console.error('Full error object:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      message: 'Server error getting jobs',
      error: error.message,
      code: error.code
    });
  }
});

// ULTRA-SIMPLE: Get single job
router.get('/:id', auth, async (req, res) => {
  try {
    console.log('=== GET SINGLE JOB ===');
    console.log('Job ID:', req.params.id);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid job ID required' });
    }

    const result = await db.query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const job = result.rows[0];

    // Check if driver can access this job
    if (req.user.role === 'driver' && job.assigned_driver !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Add empty products array for now
    const jobWithProducts = {
      ...job,
      products: []
    };

    res.json({ job: jobWithProducts });
  } catch (error) {
    console.error('=== GET JOB ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Server error getting job',
      error: error.message 
    });
  }
});

// ULTRA-SIMPLE: Create new job
router.post('/', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== CREATE JOB REQUEST ===');
    console.log('Request body:', req.body);
    
    const {
      customer_name,
      customer_phone,
      address,
      delivery_date,
      special_instructions,
      paid,
      assigned_driver,
      customer_id,
      total_amount,
      contractor_discount
    } = req.body;

    // Basic validation
    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    if (!address || !address.trim()) {
      return res.status(400).json({ message: 'Delivery address is required' });
    }

    if (!delivery_date) {
      return res.status(400).json({ message: 'Delivery date is required' });
    }

    // Clean up data
    const cleanCustomerPhone = (customer_phone && customer_phone.trim()) ? customer_phone.trim() : null;
    const cleanSpecialInstructions = (special_instructions && special_instructions.trim()) ? special_instructions.trim() : null;
    const cleanAssignedDriver = (assigned_driver && !isNaN(assigned_driver)) ? parseInt(assigned_driver) : null;
    const cleanCustomerId = (customer_id && !isNaN(customer_id)) ? parseInt(customer_id) : null;
    const cleanTotalAmount = (total_amount && !isNaN(total_amount)) ? parseFloat(total_amount) : 0;
    const isContractorDiscount = contractor_discount === true;
    const isPaid = paid === true;

    console.log('Creating job with cleaned data:', {
      customer_name: customer_name.trim(),
      cleanCustomerPhone,
      address: address.trim(),
      delivery_date,
      cleanSpecialInstructions,
      isPaid,
      cleanAssignedDriver,
      cleanCustomerId,
      cleanTotalAmount,
      isContractorDiscount
    });

    // Create job
    const result = await db.query(`
      INSERT INTO jobs (
        customer_id, customer_name, customer_phone, address, delivery_date, 
        special_instructions, paid, total_amount, contractor_discount,
        created_by, assigned_driver
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      cleanCustomerId,
      customer_name.trim(),
      cleanCustomerPhone,
      address.trim(),
      delivery_date,
      cleanSpecialInstructions,
      isPaid,
      cleanTotalAmount,
      isContractorDiscount,
      req.user.userId,
      cleanAssignedDriver
    ]);

    const job = result.rows[0];
    console.log('Job created successfully:', job.id);

    // Add empty products array for response
    const responseJob = {
      ...job,
      products: []
    };

    res.status(201).json({
      message: 'Job created successfully',
      job: responseJob
    });

  } catch (error) {
    console.error('=== CREATE JOB ERROR ===');
    console.error('Full error object:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      message: 'Server error creating job',
      error: error.message,
      code: error.code
    });
  }
});

// ULTRA-SIMPLE: Update job
router.put('/:id', auth, async (req, res) => {
  try {
    console.log('=== UPDATE JOB REQUEST ===');
    console.log('Job ID:', req.params.id);
    console.log('Update data:', req.body);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid job ID required' });
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
          values.push((value && value.trim()) ? value.trim() : null);
        } else if (field === 'payment_received') {
          const value = req.body[field];
          values.push((value !== undefined && value !== null && !isNaN(value)) ? parseFloat(value) : null);
        } else if (field === 'assigned_driver') {
          const value = req.body[field];
          values.push((value && !isNaN(value)) ? parseInt(value) : null);
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

    const responseJob = {
      ...result.rows[0],
      products: []
    };

    console.log('Job updated successfully');

    res.json({
      message: 'Job updated successfully',
      job: responseJob
    });

  } catch (error) {
    console.error('=== UPDATE JOB ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({ 
      message: 'Server error updating job',
      error: error.message 
    });
  }
});

// ULTRA-SIMPLE: Delete job
router.delete('/:id', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== DELETE JOB REQUEST ===');
    console.log('Job ID:', req.params.id);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid job ID required' });
    }

    const result = await db.query('DELETE FROM jobs WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }

    console.log('Job deleted successfully');

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('=== DELETE JOB ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Server error deleting job',
      error: error.message 
    });
  }
});

module.exports = router;
