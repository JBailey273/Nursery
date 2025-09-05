console.log('=== EAST MEADOW NURSERY SERVER STARTING ===');

const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

// CORS middleware - handle preflight requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

app.get('/', (req, res) => {
  console.log('EAST MEADOW SERVER: Root request received');
  res.json({ 
    message: 'EAST MEADOW NURSERY DELIVERY SCHEDULER API',
    company: 'East Meadow Nursery',
    phone: '413-566-TREE',
    version: '2.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    company: 'East Meadow Nursery',
    version: '2.0' 
  });
});

app.post('/api/auth/login', (req, res) => {
  console.log('EAST MEADOW SERVER: Login request received:', req.body);
  
  const { email, password } = req.body;
  
  // East Meadow Nursery login credentials
  if (email === 'admin@eastmeadow.com' && password === 'admin123') {
    res.json({
      message: 'Login successful',
      token: 'fake-token-for-testing',
      user: {
        id: 1,
        username: 'admin',
        email: 'admin@eastmeadow.com',
        role: 'admin'
      }
    });
  } else if (email === 'office@eastmeadow.com' && password === 'admin123') {
    res.json({
      message: 'Login successful',
      token: 'fake-token-for-testing',
      user: {
        id: 2,
        username: 'office',
        email: 'office@eastmeadow.com',
        role: 'office'
      }
    });
  } else if (email === 'driver1@eastmeadow.com' && password === 'admin123') {
    res.json({
      message: 'Login successful',
      token: 'fake-token-for-testing',
      user: {
        id: 3,
        username: 'driver1',
        email: 'driver1@eastmeadow.com',
        role: 'driver'
      }
    });
  } else {
    res.status(401).json({
      message: 'Invalid credentials'
    });
  }
});

// Test endpoint to verify CORS
app.get('/api/test', (req, res) => {
  res.json({
    message: 'CORS test successful - East Meadow Nursery',
    timestamp: new Date().toISOString()
  });
});

// In-memory sample data to satisfy front-end requests
const customers = [
  {
    id: 1,
    name: 'Pioneer Valley Landscaping',
    phone: '(413) 555-0123',
    email: 'orders@pvlandscaping.com',
    addresses: [{ address: '456 Industrial Dr, Westfield, MA 01085', notes: 'Commercial loading dock - rear entrance' }],
    notes: 'Volume contractor - established 2015',
    contractor: true,
    total_deliveries: 12
  },
  {
    id: 2,
    name: 'Johnson Residence',
    phone: '(413) 555-0198',
    email: 'mjohnson@email.com',
    addresses: [{ address: '123 Maple Street, East Longmeadow, MA 01028', notes: 'Side driveway access only' }],
    notes: 'Residential customer - regular orders',
    contractor: false,
    total_deliveries: 3
  }
];

const products = [
  {
    id: 1,
    name: 'Premium Bark Mulch',
    unit: 'yards',
    retail_price: 45.0,
    contractor_price: 40.5,
    active: true
  },
  {
    id: 2,
    name: 'Screened Topsoil',
    unit: 'yards',
    retail_price: 38.0,
    contractor_price: 34.2,
    active: true
  },
  {
    id: 3,
    name: 'Compost Blend',
    unit: 'yards',
    retail_price: 42.0,
    contractor_price: 37.8,
    active: true
  },
  {
    id: 4,
    name: 'Hardwood Mulch',
    unit: 'bags',
    retail_price: 4.5,
    contractor_price: 4.05,
    active: true
  }
];

let nextProductId = products.length + 1;

const jobs = [
  {
    id: 1,
    customer_name: 'Johnson Residence',
    customer_phone: '(413) 555-0198',
    address: '123 Maple Street, East Longmeadow, MA 01028',
    delivery_date: new Date().toISOString().split('T')[0],
    status: 'scheduled',
    paid: false,
    products: [
      { product_name: 'Premium Bark Mulch', quantity: 3, unit: 'yards' }
    ]
  }
];

// Simple API endpoints returning sample data
app.get('/api/customers', (req, res) => {
  res.json({ customers });
});

// Customer search endpoint
app.get('/api/customers/search', (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.json({ customers });
  }

  const query = q.toLowerCase();
  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(query) ||
    (c.phone && c.phone.toLowerCase().includes(query)) ||
    (c.email && c.email.toLowerCase().includes(query))
  );

  res.json({ customers: filtered });
});

app.get('/api/products', (req, res) => {
  res.json({ products });
});

app.get('/api/products/active', (req, res) => {
  res.json({ products: products.filter(p => p.active) });
});

app.get('/api/products/pricing/:customerId', (req, res) => {
  const customerId = parseInt(req.params.customerId, 10);
  const customer = customers.find(c => c.id === customerId);
  const isContractor = customer ? customer.contractor : false;
  const pricedProducts = products
    .filter(p => p.active)
    .map(p => ({
      ...p,
      current_price: isContractor ? p.contractor_price : p.retail_price,
      price_type: isContractor ? 'contractor' : 'retail',
    }));
  res.json({ products: pricedProducts, isContractor, customerId });
});

app.post('/api/products', (req, res) => {
  const { name, unit, retail_price, contractor_price, active = true } = req.body;
  if (!name || !unit) {
    return res.status(400).json({ message: 'Name and unit are required' });
  }
  const newProduct = {
    id: nextProductId++,
    name,
    unit,
    retail_price: retail_price ?? null,
    contractor_price: contractor_price ?? null,
    active,
  };
  products.push(newProduct);
  res.status(201).json({ message: 'Product created successfully', product: newProduct });
});

app.put('/api/products/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const product = products.find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  const { name, unit, retail_price, contractor_price, active } = req.body;
  if (name !== undefined) product.name = name;
  if (unit !== undefined) product.unit = unit;
  if (retail_price !== undefined) product.retail_price = retail_price;
  if (contractor_price !== undefined) product.contractor_price = contractor_price;
  if (active !== undefined) product.active = active;
  res.json({ message: 'Product updated successfully', product });
});

app.delete('/api/products/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = products.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ message: 'Product not found' });
  }
  products.splice(index, 1);
  res.json({ message: 'Product deleted successfully' });
});

app.get('/api/jobs', (req, res) => {
  const { date } = req.query;
  let result = jobs;
  if (date) {
    result = jobs.filter(job => job.delivery_date === date);
  }
  res.json({ jobs: result });
});

app.listen(PORT, () => {
  console.log('=== EAST MEADOW NURSERY SERVER RUNNING ON PORT', PORT, '===');
  console.log('Company: East Meadow Nursery');
  console.log('Phone: 413-566-TREE');
});
