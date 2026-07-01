# Civic Issue Reporting and Resolution System

A comprehensive web-based platform for crowdsourced civic issue reporting with Aadhar verification, geolocation validation, and intelligent priority algorithms.

## 🚀 Features

- **Aadhar Verification**: Secure citizen authentication using UIDAI API
- **Geolocation Validation**: Automatic location capture and validation
- **Crowdsourced Prioritization**: Community upvoting system for issue severity
- **Smart Algorithms**: Priority and severity algorithms for efficient issue management
- **Department Routing**: Automated issue assignment to relevant departments
- **Real-time Notifications**: Email/SMS/Push notifications for status updates
- **Multilingual Support**: Hindi, English, and local language support
- **Transparency Dashboard**: Public heatmap of civic issues
- **Analytics**: Comprehensive reporting and trend analysis

## 🛠️ Tech Stack

### Frontend
- React 18 with TypeScript
- Material-UI for responsive design
- Leaflet for interactive maps
- React Query for state management
- i18next for internationalization

### Backend
- Node.js with Express
- PostgreSQL with PostGIS extension
- JWT authentication
- Multer for file uploads
- Socket.io for real-time updates

### External APIs
- UIDAI Aadhar API for verification
- OpenStreetMap for mapping
- Twilio for SMS notifications
- SendGrid for email notifications

## 📁 Project Structure

```
civic-issue-reporting-system/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── utils/         # Utility functions
│   │   └── locales/       # Translation files
├── server/                # Node.js backend
│   ├── controllers/       # Route controllers
│   ├── models/           # Database models
│   ├── middleware/       # Custom middleware
│   ├── routes/           # API routes
│   └── utils/            # Utility functions
├── database/             # Database schemas and migrations
└── docs/                # Documentation
```

## 🚀 Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd civic-issue-reporting-system
   npm run install-all
   ```

2. **Database Setup**
   ```bash
   # Install PostgreSQL with PostGIS
   # Create database and run migrations
   cd database
   psql -U postgres -d civic_issues < schema.sql
   ```

3. **Environment Configuration**
   ```bash
   cp server/.env.example server/.env
   # Configure your environment variables
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

## 🌍 Multilingual Support

The system supports multiple languages:
- English (default)
- Hindi (हिंदी)
- Santhali (ᱥᱟᱱᱛᱟᱲᱤ) - Local to Jharkhand
- Bengali (বাংলা) - Regional language

## 🔐 Security Features

- Aadhar-based citizen verification
- JWT token authentication
- Geolocation validation
- File upload security
- SQL injection prevention
- XSS protection

## 📊 Analytics Dashboard

- Issue reporting trends
- Department response times
- Resolution rates by category
- Geographic distribution of issues
- Citizen engagement metrics

## 🤝 Contributing
Contributions are welcome!


