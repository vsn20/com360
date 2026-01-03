-- ==========================================
-- INVOICE EMAIL TRACKING - SETUP INSTRUCTIONS
-- ==========================================

-- Execute this file to set up all required database infrastructure
-- for invoice email tracking and service activity types

-- ==========================================
-- Step 1: Create C_INVOICES_SENT Table
-- ==========================================

CREATE TABLE IF NOT EXISTS C_INVOICES_SENT (
  SENT_ID INT AUTO_INCREMENT PRIMARY KEY,
  INVOICE_ID VARCHAR(255) NOT NULL COMMENT 'Unique identifier for the invoice',
  SENT_BY VARCHAR(255) NOT NULL COMMENT 'Employee ID who sent the email',
  SENT_DATE DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Date/time when email was sent',
  INVOICE_PERIOD VARCHAR(255) NOT NULL COMMENT 'Invoice period (e.g., 01/01/2025 - 01/31/2025)',
  ACCOUNT_NAME VARCHAR(255) NOT NULL COMMENT 'Account/Vendor name',
  ACCOUNT_ID VARCHAR(255) COMMENT 'Account ID or Vendor ID',
  TOTAL_AMOUNT DECIMAL(12, 2) NOT NULL COMMENT 'Invoice total amount',
  PDF_PATH VARCHAR(500) NOT NULL COMMENT 'Path to the PDF/Excel file in storage',
  EMAIL_SUBJECT VARCHAR(500) COMMENT 'Email subject line',
  STATUS VARCHAR(50) DEFAULT 'SENT' COMMENT 'Email status: SENT, PENDING, FAILED, RESENT',
  RESENT_FROM INT COMMENT 'SENT_ID of original email if this is a resend',
  ORG_ID INT NOT NULL COMMENT 'Organization ID',
  CREATED TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  LAST_UPD TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_invoice_id (INVOICE_ID),
  INDEX idx_org_id (ORG_ID),
  INDEX idx_sent_date (SENT_DATE),
  INDEX idx_account_name (ACCOUNT_NAME)
);

-- ==========================================
-- Step 2: Create C_INVOICES_SENT_DETAIL Table
-- ==========================================

CREATE TABLE IF NOT EXISTS C_INVOICES_SENT_DETAIL (
  SENT_DETAIL_ID INT AUTO_INCREMENT PRIMARY KEY,
  SENT_ID INT NOT NULL COMMENT 'Foreign key to C_INVOICES_SENT',
  RECIPIENT_EMAIL VARCHAR(255) NOT NULL COMMENT 'Email address of recipient',
  RECIPIENT_NAME VARCHAR(255) COMMENT 'Name of recipient',
  DELIVERY_STATUS VARCHAR(50) DEFAULT 'SENT' COMMENT 'SENT, BOUNCED, OPENED, etc.',
  CREATED TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (SENT_ID) REFERENCES C_INVOICES_SENT(SENT_ID) ON DELETE CASCADE,
  INDEX idx_sent_id (SENT_ID),
  INDEX idx_recipient_email (RECIPIENT_EMAIL)
);

-- ==========================================
-- Step 3: Insert Service Activity Generic Names
-- ==========================================

-- Insert g_id 44 for Service Activity Type
INSERT INTO C_GENERIC_NAMES (g_id, Name, Description, isactive)
VALUES (44, 'Service Activity Type', 'Activity Type for Service Request Activities', 1)
ON DUPLICATE KEY UPDATE isactive = 1;

-- Insert g_id 45 for Service Activity Subtype
INSERT INTO C_GENERIC_NAMES (g_id, Name, Description, isactive)
VALUES (45, 'Service Activity Subtype', 'Activity Subtype for Service Request Activities', 1)
ON DUPLICATE KEY UPDATE isactive = 1;

-- ==========================================
-- Step 4: Insert Service Activity Type Values
-- ==========================================

-- NOTE: Replace orgid = 1 with your actual organization IDs

INSERT INTO C_GENERIC_VALUES (g_id, orgid, Name, Description, isactive)
VALUES 
  (44, 1, 'Analysis', 'Investigation and analysis of issue', 1),
  (44, 1, 'Development', 'Development of solution', 1),
  (44, 1, 'Testing', 'Testing of solution', 1),
  (44, 1, 'Deployment', 'Deployment to production', 1),
  (44, 1, 'Support', 'End user support and training', 1),
  (44, 1, 'Documentation', 'Documentation of solution', 1),
  (44, 1, 'Meeting', 'Meeting with stakeholders', 1),
  (44, 1, 'Review', 'Code or design review', 1)
ON DUPLICATE KEY UPDATE isactive = 1;

-- ==========================================
-- Step 5: Insert Service Activity Subtype Values
-- ==========================================

-- NOTE: Replace orgid = 1 with your actual organization IDs

INSERT INTO C_GENERIC_VALUES (g_id, orgid, Name, Description, isactive)
VALUES 
  (45, 1, 'Root Cause Analysis', 'Analyzing root cause of issue', 1),
  (45, 1, 'Brainstorming', 'Brainstorming session for solutions', 1),
  (45, 1, 'Requirements Review', 'Review of requirements', 1),
  (45, 1, 'Design', 'Solution design', 1),
  (45, 1, 'Implementation', 'Actual coding/implementation', 1),
  (45, 1, 'Unit Testing', 'Unit testing of components', 1),
  (45, 1, 'Integration Testing', 'Integration testing', 1),
  (45, 1, 'UAT', 'User Acceptance Testing', 1),
  (45, 1, 'Deployment Planning', 'Planning deployment', 1),
  (45, 1, 'Live Deployment', 'Deploying to production', 1),
  (45, 1, 'Post-Deployment Support', 'Support after deployment', 1),
  (45, 1, 'User Training', 'Training end users', 1),
  (45, 1, 'Technical Documentation', 'Writing technical documentation', 1),
  (45, 1, 'Code Review', 'Reviewing code', 1),
  (45, 1, 'Design Review', 'Reviewing design', 1),
  (45, 1, 'Stakeholder Meeting', 'Meeting with stakeholders', 1),
  (45, 1, 'Team Sync', 'Team synchronization meeting', 1)
ON DUPLICATE KEY UPDATE isactive = 1;

-- ==========================================
-- VERIFY SETUP
-- ==========================================

-- Run these queries to verify setup was successful:

-- Check if C_INVOICES_SENT table exists and has correct structure
-- SELECT * FROM C_INVOICES_SENT LIMIT 1;

-- Check if C_INVOICES_SENT_DETAIL table exists
-- SELECT * FROM C_INVOICES_SENT_DETAIL LIMIT 1;

-- Check if generic names were created
-- SELECT g_id, Name FROM C_GENERIC_NAMES WHERE g_id IN (44, 45);

-- Check if activity type values were inserted
-- SELECT g_id, orgid, Name FROM C_GENERIC_VALUES WHERE g_id = 44 ORDER BY Name;

-- Check if activity subtype values were inserted
-- SELECT g_id, orgid, Name FROM C_GENERIC_VALUES WHERE g_id = 45 ORDER BY Name;

-- ==========================================
-- TROUBLESHOOTING
-- ==========================================

-- If you get "Duplicate Key" errors on INSERT:
-- This is normal and expected (ON DUPLICATE KEY UPDATE handles it)
-- Just make sure all rows are created

-- If you need to clean up and start over:
-- DELETE FROM C_INVOICES_SENT_DETAIL;
-- DELETE FROM C_INVOICES_SENT;
-- DELETE FROM C_GENERIC_VALUES WHERE g_id IN (44, 45);
-- DELETE FROM C_GENERIC_NAMES WHERE g_id IN (44, 45);

-- ==========================================
-- NOTES
-- ==========================================

-- 1. Replace "1" with your actual organization ID(s) in the INSERT statements
-- 2. You can repeat steps 4-5 for additional organization IDs
-- 3. The invoice tracking will work across all organizations
-- 4. Each organization can have its own set of activity types/subtypes
-- 5. Generic names are shared across orgs, but values are org-specific

-- ==========================================
-- EXECUTION ORDER
-- ==========================================

-- 1. Create C_INVOICES_SENT table (Step 1)
-- 2. Create C_INVOICES_SENT_DETAIL table (Step 2)
-- 3. Insert generic names (Step 3) - runs once, no org-id needed
-- 4. Insert activity type values (Step 4) - repeat for each org-id
-- 5. Insert activity subtype values (Step 5) - repeat for each org-id
-- 6. Run verification queries to confirm setup

-- Total execution time: < 1 second
-- Tables will be ready for immediate use
