# Nursery Delivery Scheduler

A complete web application for managing nursery delivery operations, designed for seamless communication between office staff and drivers.

## 🚀 Features

### For Office Staff
- **Schedule Management**: Create and manage delivery schedules with calendar view
- **Customer Management**: Store customer information, addresses, and contact details
- **Product Tracking**: Manage mulch, topsoil, and other landscape products
- **Payment Tracking**: Track payment status and amounts
- **Driver Assignment**: Assign deliveries to specific drivers
- **Real-time Updates**: See delivery status updates from drivers

### For Drivers
- **Mobile-Optimized Interface**: Responsive design perfect for smartphones
- **Job View**: See assigned deliveries with all relevant details
- **Status Updates**: Mark jobs as completed with notes
- **Payment Collection**: Record payments received during delivery
- **Navigation Details**: Access customer addresses and special instructions

### Technical Features
- **Authentication & Authorization**: Role-based access (Office, Driver, Admin)
- **Real-time Data**: PostgreSQL database with optimized queries
- **Mobile-First Design**: Touch-friendly interface for drivers
- **Secure API**: JWT authentication with proper validation
- **Production Ready**: Configured for Render deployment

## 🛠 Tech Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** database
- **JWT** authentication
- **bcryptjs** for password hashing
- **Express Rate Limiting** for API protection

### Frontend
- **React 18** with modern hooks
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API calls
- **React Hot Toast** for notifications

### Deployment
- **Render** hosting platform
- **Blueprint configuration** for easy deployment
- **Environment-based configuration**

## 🚀 Quick Deploy to Render

1. **Fork this repository** to your GitHub account

2. **Create a new Blueprint** on Render:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Select this repository

3. **Render will automatically**:
   - Create a PostgreSQL database
   - Deploy the backend API
   - Build and deploy the frontend
   - Set up environment variables

4. **Access your app** at the provided Render URL

## 🔧 Local Development

### Prerequisites
- Node.js 18.x or higher
- PostgreSQL 12.x or higher
- npm or yarn

### Setup

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd nursery-delivery-scheduler
```

2. **Install dependencies**
```bash
npm run install:all
```

3. **Set up environment variables**

Create `server/.env`:
```env
NODE_ENV=development
PORT=10000
DATABASE_URL=postgresql://username:password@localhost:5432/nursery_scheduler
JWT_SECRET=your-super-secret-jwt-key-here
```

4. **Set up the database**
```bash
# Create database
createdb nursery_scheduler

# The app will automatically run migrations on startup
```

5. **Start development servers**
```bash
npm run dev
```

This starts:
- Backend API at `http://localhost:10000`
- Frontend at `http://localhost:5173`

## 👥 Default User Accounts

The application creates default accounts on first run:

| Role | Email | Password | Access |
|------|-------|----------|---------|
| Admin | admin@nursery.com | admin123 | Full system access |
| Office | office@nursery.com | admin123 | Create/manage deliveries |
| Driver | driver1@nursery.com | admin123 | View assigned deliveries |

## 📱 Usage Guide

### Office Workflow
1. **Login** with office credentials
2. **Add Delivery** - Enter customer details, products, and delivery date
3. **Assign Driver** - Select which driver handles the delivery
4. **Monitor Progress** - Track delivery status and completion

### Driver Workflow
1. **Login** with driver credentials on mobile device
2. **View Schedule** - See assigned deliveries for each day
3. **Access Details** - Get customer info, address, and special instructions
4. **Complete Delivery** - Mark as delivered with notes and payment info

## 🗂 Project Structure

```
nursery-delivery-scheduler/
├── render.yaml                 # Render blueprint configuration
├── package.json               # Root package.json
├── server/                    # Backend API
│   ├── index.js              # Main server file
│   ├── config/
│   │   └── database.js       # Database configuration
│   ├── routes/
│   │   ├── auth.js           # Authentication routes
│   │   ├── jobs.js           # Job/delivery routes
│   │   └── users.js          # User management routes
│   ├── middleware/
│   │   └── auth.js           # Authentication middleware
│   └── package.json          # Backend dependencies
└── client/                   # Frontend React app
    ├── src/
    │   ├── components/       # Reusable components
    │   ├── contexts/         # React contexts
    │   ├── pages/           # Page components
    │   └── main.jsx         # App entry point
    ├── package.json         # Frontend dependencies
    └── vite.config.js       # Build configuration
```

## 🔒 Security Features

- **JWT Authentication** with secure token handling
- **Password Hashing** using bcryptjs with salt rounds
- **Role-Based Access Control** (RBAC) for different user types
- **Input Validation** using express-validator
- **Rate Limiting** to prevent API abuse
- **CORS Protection** with environment-specific origins
- **SQL Injection Prevention** using parameterized queries
- **Helmet.js** for security headers

## 📊 Database Schema

### Users Table
- `id` - Primary key
- `username` - Unique username
- `email` - Unique email address
- `password_hash` - Encrypted password
- `role` - User role (admin/office/driver)
- `created_at` - Account creation timestamp

### Jobs Table
- `id` - Primary key
- `customer_name` - Customer name
- `customer_phone` - Contact number
- `address` - Delivery address
- `delivery_date` - Scheduled delivery date
- `special_instructions` - Delivery notes
- `paid` - Payment status
- `status` - Job status (scheduled/in_progress/completed/cancelled)
- `driver_notes` - Driver completion notes
- `payment_received` - Amount collected by driver
- `created_by` - Office user who created the job
- `assigned_driver` - Driver assigned to the job

### Products Table
- `id` - Primary key
- `name` - Product name
- `unit` - Unit of measurement
- `price_per_unit` - Base price
- `active` - Whether product is available

### Job Products Table
- `id` - Primary key
- `job_id` - Reference to job
- `product_name` - Product name (at time of order)
- `quantity` - Amount ordered
- `unit` - Unit of measurement

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh JWT token

### Jobs
- `GET /api/jobs` - Get all jobs (with filters)
- `GET /api/jobs/:id` - Get specific job
- `POST /api/jobs` - Create new job (office only)
- `PUT /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job (office only)
- `GET /api/jobs/range/:start/:end` - Get jobs by date range

### Users
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/drivers` - Get all drivers
- `GET /api/users/:id` - Get specific user
- `PUT /api/users/:id` - Update user
- `PUT /api/users/:id/password` - Change password
- `DELETE /api/users/:id` - Delete user (admin only)

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://user:pass@host:port/dbname
JWT_SECRET=your-jwt-secret-key
```

#### Frontend (Render auto-configures)
```env
VITE_API_URL=https://your-api-domain.onrender.com
```

### Render Blueprint
The `render.yaml` file configures:
- **Web Service** for the API (Node.js)
- **Static Site** for the frontend (React/Vite)
- **PostgreSQL Database** for data storage
- **Redis** for caching (optional)

## 📱 Mobile Optimization

### Touch-Friendly Interface
- Minimum 44px touch targets
- Optimized button spacing
- Swipe gestures for navigation

### Performance
- Lazy loading of components
- Optimized bundle splitting
- Compressed assets
- Service worker ready

### PWA Features
- Responsive design
- Offline capability (future enhancement)
- App-like experience on mobile

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Update default passwords
- [ ] Set strong JWT secret
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS
- [ ] Set up database backups
- [ ] Configure monitoring
- [ ] Test all user roles
- [ ] Verify mobile responsiveness

## 🔄 Development Workflow

### Adding New Features
1. Create feature branch
2. Develop backend API endpoints
3. Add frontend components
4. Test with all user roles
5. Update documentation
6. Submit pull request

### Database Changes
1. Create migration in `server/config/database.js`
2. Test migration locally
3. Deploy to staging first
4. Verify data integrity
5. Deploy to production

## 📞 Support

### Common Issues

**Login Issues**
- Verify credentials match default accounts
- Check network connectivity
- Clear browser cache

**Mobile Performance**
- Ensure good network connection
- Close other browser tabs
- Update to latest browser version

**Database Errors**
- Check DATABASE_URL format
- Verify database permissions
- Ensure database is running

### Getting Help
- Check the issues page on GitHub
- Review API documentation
- Verify environment variables

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🎯 Roadmap

### Phase 1 (Current)
- ✅ Basic scheduling system
- ✅ User authentication
- ✅ Mobile-responsive design
- ✅ Render deployment

### Phase 2 (Future)
- [ ] Real-time notifications
- [ ] GPS tracking integration
- [ ] Advanced reporting
- [ ] Customer portal
- [ ] Inventory management
- [ ] Photo uploads for deliveries

### Phase 3 (Advanced)
- [ ] Route optimization
- [ ] Integration with accounting software
- [ ] Advanced analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Multi-location support

---

**Built with ❤️ for efficient nursery operations**