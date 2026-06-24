-- Enhanced Database Schema for Civic Issue Reporting System
-- Supports role-based access and ticket tracking

-- Create database (run this first if not exists)
-- CREATE DATABASE civic_issues;

-- Connect to the database
-- \c civic_issues;

-- Create custom ENUM types
CREATE TYPE user_status AS ENUM ('pending', 'verified', 'suspended', 'banned');
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE issue_status AS ENUM ('reported', 'acknowledged', 'in_progress', 'resolved', 'rejected');
CREATE TYPE issue_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- Users table with enhanced role support
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    aadhar_hash VARCHAR(255) NOT NULL,
    aadhar_last_four VARCHAR(4) NOT NULL,
    status user_status DEFAULT 'pending',
    role user_role DEFAULT 'user',
    admin_categories TEXT[], -- Array of categories this admin can handle
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Departments table
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) UNIQUE NOT NULL, -- Maps to issue categories
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Issues table with ticket tracking
CREATE TABLE issues (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    status issue_status DEFAULT 'reported',
    priority issue_priority DEFAULT 'medium',
    severity_score INTEGER DEFAULT 0,
    reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    assigned_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    ticket_number VARCHAR(20) UNIQUE, -- Auto-generated ticket number
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Ticket timeline table for tracking progress
CREATE TABLE ticket_timeline (
    id SERIAL PRIMARY KEY,
    issue_id INTEGER REFERENCES issues(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL, -- 'created', 'assigned', 'acknowledged', 'in_progress', 'resolved', 'rejected'
    description TEXT NOT NULL,
    old_status issue_status,
    new_status issue_status,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comments table
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    issue_id INTEGER REFERENCES issues(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE, -- Internal admin comments
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attachments table
CREATE TABLE attachments (
    id SERIAL PRIMARY KEY,
    issue_id INTEGER REFERENCES issues(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    issue_id INTEGER REFERENCES issues(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default departments
INSERT INTO departments (name, description, category) VALUES
('Electricity Department', 'Handles all electrical and power-related issues', 'electricity'),
('Water Department', 'Manages water supply and drainage', 'water'),
('Sanitation Department', 'Oversees waste management and cleanliness', 'sanitation'),
('Public Works Department', 'Handles roads and infrastructure', 'roads'),
('Public Works Department', 'Manages street lighting', 'streetlights'),
('Municipal Corporation', 'General municipal services', 'other');

-- Create indexes for better performance
CREATE INDEX idx_issues_location ON issues(latitude, longitude);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_priority ON issues(priority);
CREATE INDEX idx_issues_category ON issues(category);
CREATE INDEX idx_issues_reporter ON issues(reporter_id);
CREATE INDEX idx_issues_assigned_admin ON issues(assigned_admin_id);
CREATE INDEX idx_issues_ticket_number ON issues(ticket_number);
CREATE INDEX idx_issues_created_at ON issues(created_at);
CREATE INDEX idx_ticket_timeline_issue ON ticket_timeline(issue_id);
CREATE INDEX idx_ticket_timeline_user ON ticket_timeline(user_id);
CREATE INDEX idx_ticket_timeline_created_at ON ticket_timeline(created_at);
CREATE INDEX idx_comments_issue ON comments(issue_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

-- Create function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
    ticket_num VARCHAR(20);
    year_part VARCHAR(4);
    sequence_num INTEGER;
BEGIN
    -- Get current year
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    
    -- Get next sequence number for this year
    SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 6) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM issues 
    WHERE ticket_number LIKE 'TKT-' || year_part || '-%';
    
    -- Format ticket number: TKT-YYYY-XXXXXX
    ticket_num := 'TKT-' || year_part || '-' || LPAD(sequence_num::VARCHAR, 6, '0');
    
    NEW.ticket_number := ticket_num;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-generate ticket numbers
CREATE TRIGGER generate_ticket_number_trigger
    BEFORE INSERT ON issues
    FOR EACH ROW
    EXECUTE FUNCTION generate_ticket_number();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_issues_updated_at BEFORE UPDATE ON issues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to add timeline entry when issue status changes
CREATE OR REPLACE FUNCTION add_timeline_entry()
RETURNS TRIGGER AS $$
DECLARE
    action_text VARCHAR(100);
    description_text TEXT;
BEGIN
    -- Only add timeline entry if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Determine action and description based on status change
        CASE NEW.status
            WHEN 'acknowledged' THEN
                action_text := 'acknowledged';
                description_text := 'Issue has been acknowledged by the department';
            WHEN 'in_progress' THEN
                action_text := 'in_progress';
                description_text := 'Work has started on this issue';
            WHEN 'resolved' THEN
                action_text := 'resolved';
                description_text := 'Issue has been resolved';
            WHEN 'rejected' THEN
                action_text := 'rejected';
                description_text := 'Issue has been rejected';
            ELSE
                action_text := 'status_changed';
                description_text := 'Issue status updated to ' || NEW.status;
        END CASE;
        
        -- Insert timeline entry
        INSERT INTO ticket_timeline (issue_id, user_id, action, description, old_status, new_status)
        VALUES (NEW.id, COALESCE(NEW.assigned_admin_id, NEW.reporter_id), action_text, description_text, OLD.status, NEW.status);
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to add timeline entries
CREATE TRIGGER add_timeline_entry_trigger
    AFTER UPDATE ON issues
    FOR EACH ROW
    EXECUTE FUNCTION add_timeline_entry();
