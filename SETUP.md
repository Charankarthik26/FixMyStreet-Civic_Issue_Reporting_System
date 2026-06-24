# Civic Issue Reporting System - Setup Guide

This guide will help you set up the Civic Issue Reporting and Resolution System for the Smart India Hackathon.

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **PostgreSQL** (v12 or higher) with **PostGIS** extension
- **Git**
- **npm** or **yarn**

## Quick Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repository-url>
cd civic-issue-reporting-system

# Install all dependencies (root, server, and client)
npm run install-all
```

### 2. Database Setup

#### Install PostgreSQL with PostGIS

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib postgis
```

**macOS (using Homebrew):**
```bash
brew install postgresql postgis
```

**Windows:**
Download and install from [PostgreSQL official website](https://www.postgresql.org/download/windows/)

#### Create Database and User

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE civic_issues;

# Create user (optional)
CREATE USER civic_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE civic_issues TO civic_user;

# Exit PostgreSQL
\q
```

#### Run Database Schema

```bash
# Navigate to database directory
cd database

# Run the schema
psql -U postgres -d civic_issues < schema.sql

# Or if using custom user
psql -U civic_user -d civic_issues < schema.sql
```

### 3. Environment Configuration

```bash
# Copy environment template
cp server/env.example server/.env

# Edit the environment file
nano server/.env
```

**Required Environment Variables:**

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=civic_issues
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_EXPIRES_IN=7d

# UIDAI Aadhar API Configuration (for production)
UIDAI_API_URL=https://stage1.uidai.gov.in/unifiedAppAuthService/api/v2/auth
UIDAI_API_KEY=your_uidai_api_key
UIDAI_SECRET_KEY=your_uidai_secret_key

# File Upload Configuration
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp

# External APIs
OPENSTREETMAP_API_URL=https://nominatim.openstreetmap.org
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Notification Services (optional for development)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=noreply@civicissues.gov.in

# Geolocation Validation
MAX_DISTANCE_KM=2
UPVOTE_RADIUS_KM=5

# Priority Algorithm Weights
BASE_PRIORITY_WEIGHT=1
UPVOTE_WEIGHT=2
TIME_WEIGHT=0.5
CATEGORY_WEIGHT=3
```

### 4. Create Upload Directory

```bash
# Create uploads directory for file storage
mkdir server/uploads
chmod 755 server/uploads
```

### 5. Start the Application

```bash
# Start both server and client in development mode
npm run dev

# Or start them separately:
# Terminal 1 - Server
npm run server

# Terminal 2 - Client
npm run client
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

## Production Setup

### 1. Build the Application

```bash
# Build the React frontend
npm run build

# The built files will be in client/build/
```

### 2. Environment Configuration

Set `NODE_ENV=production` in your environment variables.

### 3. Start Production Server

```bash
# Start the production server
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration with Aadhar verification
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/verify-aadhar` - Verify Aadhar number

### Issues
- `POST /api/issues/submit` - Submit new civic issue
- `GET /api/issues` - Get issues with filtering and pagination
- `GET /api/issues/:id` - Get issue details
- `POST /api/issues/:id/vote` - Vote on issue
- `POST /api/issues/:id/comments` - Add comment to issue
- `GET /api/issues/nearby/:lat/:lng` - Get nearby issues

### Admin
- `GET /api/admin/dashboard` - Admin dashboard overview
- `GET /api/admin/issues` - Manage issues
- `PUT /api/admin/issues/:id/status` - Update issue status
- `PUT /api/admin/issues/:id/assign` - Assign issue to admin
- `GET /api/admin/analytics` - Analytics data

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read
- `PUT /api/notifications/mark-all-read` - Mark all notifications as read

## Features

### ✅ Implemented Features

1. **User Authentication & Aadhar Verification**
   - Secure user registration with Aadhar verification
   - JWT-based authentication
   - Password hashing with bcrypt

2. **Civic Issue Reporting**
   - Photo upload with image processing
   - Geolocation capture and validation
   - Category-based issue classification
   - Real-time location validation

3. **Crowdsourced Prioritization**
   - Upvote/downvote system
   - Severity scoring algorithm
   - Priority calculation based on multiple factors

4. **Admin Dashboard**
   - Department-specific issue management
   - Status updates and assignment
   - Auto-assignment based on categories
   - Real-time notifications

5. **Geolocation Services**
   - PostGIS integration for spatial queries
   - Distance validation between user and issue
   - Reverse geocoding for address lookup
   - Nearby issues discovery

6. **Real-time Features**
   - Socket.io integration
   - Live notifications
   - Real-time issue updates

7. **Multilingual Support**
   - English, Hindi, and Santhali languages
   - i18next integration
   - Language detection and switching

8. **Analytics & Reporting**
   - Comprehensive analytics dashboard
   - Resolution time tracking
   - Department performance metrics
   - Data export functionality

### 🔧 Technical Stack

**Backend:**
- Node.js with Express.js
- PostgreSQL with PostGIS
- JWT authentication
- Socket.io for real-time features
- Multer for file uploads
- Sharp for image processing

**Frontend:**
- React 18 with hooks
- Material-UI for components
- React Query for state management
- Leaflet for maps
- i18next for internationalization

**External Services:**
- UIDAI Aadhar API
- OpenStreetMap for geocoding
- Twilio for SMS notifications
- SendGrid for email notifications

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Ensure PostgreSQL is running
   - Check database credentials in .env
   - Verify PostGIS extension is installed

2. **File Upload Issues**
   - Check uploads directory permissions
   - Verify file size limits
   - Ensure allowed file types are correct

3. **Geolocation Not Working**
   - Check browser permissions
   - Verify HTTPS in production
   - Test with different browsers

4. **Aadhar Verification Failing**
   - Check UIDAI API credentials
   - Verify network connectivity
   - Use mock verification for development

### Development Tips

1. **Mock Aadhar Verification**
   - Use OTP `123456` or `000000` for testing
   - Aadhar numbers are validated for format only

2. **Location Testing**
   - Use coordinates within Jharkhand state bounds
   - Test with different distance scenarios

3. **File Upload Testing**
   - Use images under 10MB
   - Test with different formats (JPEG, PNG, WebP)

## Contributing

This project is developed for the Smart India Hackathon. To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

For support or questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

---

**Built for Smart India Hackathon 2024** 🚀
