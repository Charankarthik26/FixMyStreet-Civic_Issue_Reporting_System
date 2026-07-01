# FixmyStreet - Deployment Guide

This guide provides step-by-step instructions to deploy the crowdsourced civic issue reporting system. 

We will deploy the components as follows:
1. **Database**: Managed PostgreSQL on Neon or Render.
2. **Backend**: Node.js Express server on Render.
3. **Frontend**: React application on Vercel.

---

## Stage 1: Deploy and Initialize the Database (PostgreSQL)

You can use **Neon.tech** (serverless Postgres) or **Render Database** for a free hosting tier.

### Steps:
1. Go to [Neon.tech](https://neon.tech/) (Recommended for speed) or [Render](https://render.com/) and create a free account.
2. Create a new **Project / PostgreSQL Database** named `civic_issues`.
3. Locate your database connection URL (often called **Connection String** or **External Database URL**). It looks like this:
   `postgresql://username:password@hostname:port/civic_issues?sslmode=require`
4. Connect to your database using a PostgreSQL client tool (like **pgAdmin**, **DBeaver**, or **Neon Console Query Editor**).
5. Open and execute the SQL initialization script located in:
   [database/schema_enhanced.sql](file:///c:/Users/saran/Desktop/ch/Civic%20Issue/database/schema_enhanced.sql)
   This will initialize all roles, custom types, tables, triggers, indices, and severity triggers.
6. Keep your database connection string handy for the next stage.

---

## Stage 2: Deploy the Backend API (Render)

Render is the simplest free hosting platform for Node.js Express servers.

### Steps:
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
2. Connect your GitHub repository: `Charankarthik26/FixMyStreet-Civic_Issue_Reporting_System`.
3. In the Web Service configuration, set the following:
   - **Name**: `fixmystreet-backend` (or similar)
   - **Region**: Select the closest region to your target users (e.g., Singapore/Mumbai)
   - **Branch**: `main`
   - **Root Directory**: `server` (Important: This points Render to the backend folder)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Under **Instance Type**, select the **Free** tier.
5. Click **Advanced** to add the required **Environment Variables**:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *Your PostgreSQL Connection String from Stage 1*
   - `JWT_SECRET`: *Generate a secure random string (e.g. `your-sih-jwt-super-secret-key`)*
   - `JWT_EXPIRES_IN`: `7d`
   - `CLIENT_URL`: `https://your-frontend-domain.vercel.app` (You can update this after Stage 3 is deployed)
   - `UPLOAD_DIR`: `uploads`
   - `MAX_FILE_SIZE`: `10485760` (10MB)
6. Click **Create Web Service**.
7. Once deployed, Render will provide you with a backend URL (e.g., `https://fixmystreet-backend.onrender.com`). Copy this URL.

---

## Stage 3: Deploy the Frontend (Vercel)

Vercel is the optimal hosting platform for React.js single-page applications.

### Steps:
1. Go to [Vercel Dashboard](https://vercel.com/) and click **Add New** -> **Project**.
2. Import your GitHub repository: `Charankarthik26/FixMyStreet-Civic_Issue_Reporting_System`.
3. In the project setup panel:
   - **Framework Preset**: `Create React App`
   - **Root Directory**: `client` (Important: This points Vercel to the React app folder)
4. Under **Build and Development Settings**, leave the defaults:
   - Build Command: `npm run build`
   - Output Directory: `build`
   - Install Command: `npm install`
5. Expand **Environment Variables** and add:
   - Name: `REACT_APP_API_URL`
   - Value: `https://fixmystreet-backend.onrender.com` (Your backend Render URL from Stage 2)
6. Click **Deploy**.
7. Vercel will build and deploy your React frontend, providing a public URL (e.g., `https://your-project.vercel.app`).

---

## Stage 4: Connect Frontend & Backend (Final Sync)

To allow the frontend to securely make API requests and connect to WebSockets without CORS errors, update the CORS configuration:

### Steps:
1. Go back to your Render backend web service dashboard.
2. Under **Environment Variables**, update the `CLIENT_URL` value to match your live Vercel URL (e.g., `https://your-project.vercel.app`).
3. Save the changes. Render will automatically trigger a clean deploy.
4. Your application is now fully deployed and connected!
