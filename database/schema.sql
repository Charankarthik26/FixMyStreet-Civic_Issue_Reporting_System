-- Civic Issue Reporting System Unified Database Schema
-- PostgreSQL with PostGIS extension and UUID primary keys

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create custom types
CREATE TYPE user_status AS ENUM ('pending', 'verified', 'suspended', 'rejected', 'banned');
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE issue_status AS ENUM ('reported', 'acknowledged', 'in_progress', 'resolved', 'rejected');
CREATE TYPE issue_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE issue_category AS ENUM (
    'road_infrastructure', 'street_lighting', 'water_supply', 'drainage', 
    'waste_management', 'public_transport', 'parks_gardens', 'public_safety',
    'healthcare', 'education', 'other'
);
CREATE TYPE department_type AS ENUM (
    'public_works', 'electricity', 'water_board', 'sanitation', 
    'transport', 'health', 'education', 'police', 'municipal_corporation'
);

-- Departments table
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) UNIQUE NOT NULL, -- Maps to issue categories
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table with Aadhar verification and roles
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    aadhar_hash VARCHAR(255) NOT NULL, -- Hash of Aadhar number for privacy
    aadhar_last_four VARCHAR(4) NOT NULL, -- Last 4 digits for identification
    verification_token VARCHAR(255),
    verification_expires TIMESTAMP,
    status user_status DEFAULT 'pending',
    role user_role DEFAULT 'user',
    is_admin BOOLEAN DEFAULT FALSE, -- Compatibility
    admin_categories TEXT[], -- Array of categories this admin can handle
    department department_type, -- Compatibility
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    profile_image VARCHAR(255),
    preferred_language VARCHAR(10) DEFAULT 'en'
);

-- User locations for geolocation validation
CREATE TABLE user_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    location GEOMETRY(POINT, 4326) NOT NULL, -- PostGIS geometry
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100) DEFAULT 'Jharkhand',
    pincode VARCHAR(10),
    accuracy DECIMAL(10,2), -- GPS accuracy in meters
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_current BOOLEAN DEFAULT TRUE
);

-- Civic issues table
CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- Category as string to match routes
    status issue_status DEFAULT 'reported',
    priority issue_priority DEFAULT 'medium',
    severity_score INTEGER DEFAULT 0,
    location GEOMETRY(POINT, 4326) NOT NULL,
    latitude DECIMAL(10, 8), -- Compatibility with decimal coordinates
    longitude DECIMAL(11, 8), -- Compatibility with decimal coordinates
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100) DEFAULT 'Jharkhand',
    pincode VARCHAR(10),
    images TEXT[], -- Array of image URLs
    assigned_department department_type, -- Compatibility
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    assigned_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ticket_number VARCHAR(20) UNIQUE, -- Auto-generated ticket number
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    estimated_resolution_date DATE,
    actual_resolution_date DATE,
    resolution_notes TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_distance DECIMAL(10,2), -- Distance between user and issue location
    upvote_count INTEGER DEFAULT 0,
    downvote_count INTEGER DEFAULT 0
);

-- Issue upvotes/downvotes
CREATE TABLE issue_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vote_type VARCHAR(10) CHECK (vote_type IN ('upvote', 'downvote')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(issue_id, user_id) -- One vote per user per issue
);

-- Comments table (unifying issue_comments and comments)
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE, -- Internal admin comments
    is_deleted BOOLEAN DEFAULT FALSE,
    parent_comment_id UUID REFERENCES comments(id), -- Nested comments compatibility
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ticket timeline table for tracking progress
CREATE TABLE ticket_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL, -- 'created', 'assigned', 'acknowledged', 'in_progress', 'resolved', 'rejected'
    description TEXT NOT NULL,
    old_status issue_status,
    new_status issue_status,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'status_update', 'new_comment', 'upvote', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- Analytics and reporting tables
CREATE TABLE analytics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    total_issues INTEGER DEFAULT 0,
    resolved_issues INTEGER DEFAULT 0,
    avg_resolution_time DECIMAL(10,2), -- in hours
    category_breakdown JSONB,
    department_performance JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date)
);

-- System configuration
CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default system configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
('max_distance_km', '2', 'Maximum allowed distance between user and issue location'),
('upvote_radius_km', '5', 'Radius within which users can upvote issues'),
('base_priority_weight', '1', 'Base weight for priority calculation'),
('upvote_weight', '2', 'Weight multiplier for upvotes in priority calculation'),
('time_weight', '0.5', 'Weight multiplier for time in priority calculation'),
('category_weight', '3', 'Weight multiplier for category in priority calculation'),
('auto_assign_enabled', 'true', 'Enable automatic issue assignment to departments'),
('notification_enabled', 'true', 'Enable real-time notifications'),
('public_map_enabled', 'true', 'Enable public issue map');

-- Insert default departments
INSERT INTO departments (name, description, category) VALUES
('Electricity Department', 'Handles all electrical and power-related issues', 'electricity'),
('Water Department', 'Manages water supply and drainage', 'water'),
('Sanitation Department', 'Oversees waste management and cleanliness', 'sanitation'),
('Public Works Department', 'Handles roads and infrastructure', 'roads'),
('Public Works Department', 'Manages street lighting', 'streetlights'),
('Municipal Corporation', 'General municipal services', 'other');

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_aadhar_hash ON users(aadhar_hash);

CREATE INDEX idx_user_locations_user_id ON user_locations(user_id);
CREATE INDEX idx_user_locations_location ON user_locations USING GIST(location);
CREATE INDEX idx_user_locations_current ON user_locations(is_current);

CREATE INDEX idx_issues_reporter ON issues(reporter_id);
CREATE INDEX idx_issues_category ON issues(category);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_priority ON issues(priority);
CREATE INDEX idx_issues_location ON issues USING GIST(location);
CREATE INDEX idx_issues_created_at ON issues(created_at);
CREATE INDEX idx_issues_assigned_admin ON issues(assigned_admin_id);
CREATE INDEX idx_issues_ticket_number ON issues(ticket_number);

CREATE INDEX idx_issue_votes_issue ON issue_votes(issue_id);
CREATE INDEX idx_issue_votes_user ON issue_votes(user_id);

CREATE INDEX idx_comments_issue ON comments(issue_id);
CREATE INDEX idx_comments_user ON comments(user_id);

CREATE INDEX idx_ticket_timeline_issue ON ticket_timeline(issue_id);
CREATE INDEX idx_ticket_timeline_user ON ticket_timeline(user_id);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

CREATE INDEX idx_analytics_daily_date ON analytics_daily(date);

-- Create functions for geolocation calculations
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DECIMAL, lon1 DECIMAL, 
    lat2 DECIMAL, lon2 DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    RETURN ST_Distance(
        ST_GeogFromText('POINT(' || lon1 || ' ' || lat1 || ')'),
        ST_GeogFromText('POINT(' || lon2 || ' ' || lat2 || ')')
    ) / 1000; -- Convert meters to kilometers
END;
$$ LANGUAGE plpgsql;

-- Function to update issue severity score
CREATE OR REPLACE FUNCTION update_issue_severity(issue_uuid UUID)
RETURNS VOID AS $$
DECLARE
    upvotes INTEGER;
    downvotes INTEGER;
    base_score INTEGER;
BEGIN
    SELECT COUNT(*) INTO upvotes FROM issue_votes 
    WHERE issue_id = issue_uuid AND vote_type = 'upvote';
    
    SELECT COUNT(*) INTO downvotes FROM issue_votes 
    WHERE issue_id = issue_uuid AND vote_type = 'downvote';
    
    base_score := 10; -- Base severity score
    
    UPDATE issues SET 
        severity_score = base_score + (upvotes * 2) - (downvotes * 1),
        upvote_count = upvotes,
        downvote_count = downvotes
    WHERE id = issue_uuid;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update severity score when votes change
CREATE OR REPLACE FUNCTION trigger_update_severity()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_issue_severity(COALESCE(NEW.issue_id, OLD.issue_id));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_severity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON issue_votes
    FOR EACH ROW EXECUTE FUNCTION trigger_update_severity();

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
    SELECT COALESCE(MAX(CAST(SPLIT_PART(ticket_number, '-', 3) AS INTEGER)), 0) + 1
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

-- Function to calculate priority score
CREATE OR REPLACE FUNCTION calculate_priority_score(issue_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    issue_record RECORD;
    priority_score INTEGER := 0;
    days_open INTEGER;
BEGIN
    SELECT * INTO issue_record FROM issues WHERE id = issue_uuid;
    
    -- Base priority by category
    CASE issue_record.category
        WHEN 'public_safety' THEN priority_score := priority_score + 50;
        WHEN 'water_supply' THEN priority_score := priority_score + 40;
        WHEN 'electricity' THEN priority_score := priority_score + 35;
        WHEN 'road_infrastructure' THEN priority_score := priority_score + 30;
        WHEN 'waste_management' THEN priority_score := priority_score + 25;
        WHEN 'street_lighting' THEN priority_score := priority_score + 20;
        ELSE priority_score := priority_score + 10;
    END CASE;
    
    -- Add severity score
    priority_score := priority_score + issue_record.severity_score;
    
    -- Add time factor (older issues get higher priority)
    days_open := EXTRACT(DAYS FROM (CURRENT_TIMESTAMP - issue_record.created_at));
    priority_score := priority_score + (days_open * 2);
    
    RETURN priority_score;
END;
$$ LANGUAGE plpgsql;

-- Create views for common queries
CREATE OR REPLACE VIEW active_issues AS
SELECT 
    i.*,
    u.first_name || ' ' || u.last_name as reporter_name,
    u.phone as reporter_phone,
    calculate_priority_score(i.id) as calculated_priority_score
FROM issues i
JOIN users u ON i.reporter_id = u.id
WHERE i.status NOT IN ('resolved', 'rejected');

CREATE OR REPLACE VIEW department_stats AS
SELECT 
    assigned_department,
    COUNT(*) as total_issues,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_issues,
    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_issues,
    AVG(CASE WHEN resolved_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
        END) as avg_resolution_hours
FROM issues
WHERE assigned_department IS NOT NULL
GROUP BY assigned_department;

-- Backwards compatibility view for issue_comments
CREATE OR REPLACE VIEW issue_comments AS
SELECT 
    id,
    issue_id,
    user_id,
    comment,
    parent_comment_id,
    created_at,
    updated_at,
    is_deleted
FROM comments;
