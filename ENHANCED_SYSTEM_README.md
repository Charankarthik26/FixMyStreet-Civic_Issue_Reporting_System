# Enhanced Civic Issue Reporting System

## 🚀 New Features

### Role-Based Authentication System
- **Users**: Can report issues and track their progress
- **Admins**: Can manage issues for specific categories
- **Super Admins**: Can manage all issues and users

### Category-Specific Admin Access
- Admins can be assigned to specific categories (electricity, water, sanitation, roads, streetlights, other)
- Each admin only sees and can manage issues from their assigned categories
- Super admins have access to all categories

### Ticket Tracking System
- **Auto-generated ticket numbers**: Format TKT-YYYY-XXXXXX
- **Timeline tracking**: Every status change is recorded with timestamp and user
- **Department assignment**: Issues are automatically assigned to appropriate departments
- **Progress visibility**: Users can see exactly where their ticket is in the process

### Enhanced User Experience
- **User Timeline**: Citizens can track their issue progress in real-time
- **Admin Dashboard**: Category-specific dashboards with statistics and issue management
- **Status updates**: Real-time notifications when issue status changes
- **Comments system**: Users and admins can add comments to issues

## 🏗️ System Architecture

### Database Schema
- **Enhanced users table**: Added role and admin_categories fields
- **Departments table**: Maps categories to departments
- **Ticket timeline table**: Tracks all status changes and actions
- **Auto-generated ticket numbers**: Unique identifier for each issue

### API Endpoints
- `/api/admin/*`: Admin-specific endpoints for issue management
- `/api/user-timeline/*`: User timeline and issue tracking
- Enhanced authentication with role-based access control

### Frontend Components
- **AdminDashboard**: Category-specific admin interface
- **UserTimeline**: User's issue tracking and timeline view
- **Role-based navigation**: Different menus for users and admins
- **Enhanced registration**: Role and category selection

## 📋 Setup Instructions

### 1. Database Setup
```bash
# Run the enhanced database setup
./update-database-enhanced.bat
```

### 2. Environment Configuration
Update `server/.env` with your configuration:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=civic_issues
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# API Keys (optional for full functionality)
UIDAI_API_KEY=your_uidai_key
GOOGLE_MAPS_API_KEY=your_google_maps_key
EMAILJS_PUBLIC_KEY=your_emailjs_key
```

### 3. Start the System
```bash
# Start backend
npm run server

# Start frontend (in new terminal)
npm run client
```

## 👥 User Roles and Permissions

### Regular Users
- Register and login
- Report civic issues
- View all public issues
- Track their own issues with timeline
- Add comments to their issues
- Receive notifications on status updates

### Department Admins
- All user permissions
- Access to admin dashboard
- Manage issues for assigned categories only
- Update issue status (acknowledged, in_progress, resolved, rejected)
- Assign issues to other admins
- Add internal comments
- View statistics for their categories

### Super Admins
- All admin permissions
- Access to all categories
- Manage all users and admins
- View system-wide statistics
- Full administrative control

## 🎯 Workflow

### Issue Reporting Flow
1. **User reports issue** → System generates ticket number
2. **Issue assigned to department** → Based on category
3. **Admin acknowledges** → Timeline entry created
4. **Work in progress** → Status updated with timeline
5. **Issue resolved** → Final timeline entry and notification

### Admin Management Flow
1. **Admin logs in** → Sees dashboard for their categories
2. **Views new issues** → Filtered by assigned categories
3. **Updates status** → Timeline automatically updated
4. **Assigns to team** → Other admins can take over
5. **Resolves issue** → User gets notification

## 🔧 API Documentation

### Admin Endpoints
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET /api/admin/issues` - Get issues for admin's categories
- `GET /api/admin/issues/:id` - Get issue details with timeline
- `PATCH /api/admin/issues/:id/status` - Update issue status
- `PATCH /api/admin/issues/:id/assign` - Assign issue to admin

### User Timeline Endpoints
- `GET /api/user-timeline/my-issues` - Get user's issues
- `GET /api/user-timeline/issues/:id/timeline` - Get issue timeline
- `POST /api/user-timeline/issues/:id/comments` - Add comment

## 🎨 Frontend Routes

### Public Routes
- `/` - Home page
- `/login` - Login page
- `/register` - Registration with role selection
- `/map` - Public map view

### User Routes
- `/my-issues` - User's issue timeline
- `/report` - Report new issue
- `/issues` - View all issues
- `/issues/:id` - Issue details
- `/profile` - User profile

### Admin Routes
- `/admin` - Admin dashboard
- `/admin/issues/:id` - Admin issue management

## 🔐 Security Features

- **Role-based access control**: Users can only access authorized features
- **Category-specific permissions**: Admins only see their assigned categories
- **JWT authentication**: Secure token-based authentication
- **Input validation**: All inputs validated on both frontend and backend
- **SQL injection protection**: Parameterized queries used throughout

## 📊 Monitoring and Analytics

### Admin Dashboard Statistics
- Total issues by category
- Issues by status (reported, acknowledged, in_progress, resolved)
- Recent issues
- Performance metrics

### User Timeline Features
- Issue progress tracking
- Status change history
- Comment system
- Real-time updates

## 🚀 Future Enhancements

- **Mobile app**: React Native version
- **Push notifications**: Real-time mobile notifications
- **Advanced analytics**: Detailed reporting and insights
- **Multi-language support**: Full i18n implementation
- **File attachments**: Support for images and documents
- **Geolocation services**: Advanced mapping and location features

## 🐛 Troubleshooting

### Common Issues
1. **Database connection errors**: Check PostgreSQL is running and credentials are correct
2. **Role access denied**: Ensure user has correct role and category assignments
3. **Timeline not updating**: Check database triggers are properly installed
4. **Admin dashboard empty**: Verify admin has assigned categories

### Support
For issues and questions, check the logs in the server console and browser developer tools.

---

**Built for Smart India Hackathon 2024** 🏆
