-- ============================================================================
-- QCI SAMAR BACKEND - DEVELOPMENT SEED DATA
-- Run this SQL directly on Azure MySQL development server
-- ============================================================================

-- ============================================================================
-- STEP 1: FIX SCHEMA - Add missing 'code' column to assessment_parameters
-- ============================================================================

-- Check if code column exists, if not add it
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'assessment_parameters'
    AND COLUMN_NAME = 'code'
);

-- Add code column if it doesn't exist (run this separately if needed)
-- ALTER TABLE assessment_parameters ADD COLUMN code VARCHAR(50) AFTER name;

-- Update existing parameters with generated codes
UPDATE assessment_parameters ap
JOIN disciplines d ON ap.discipline_id = d.id
SET ap.code = CONCAT(
    UPPER(LEFT(REPLACE(d.name, ' ', ''), 3)),
    '-',
    UPPER(LEFT(ap.sector, 1)),
    '-',
    ap.id
)
WHERE ap.code IS NULL OR ap.code = '';

-- ============================================================================
-- STEP 2: CREATE TEST ORGANIZATIONS
-- ============================================================================

INSERT INTO organizations (
    id, name, email, alternate_email, mobile_number, landline_number, pan,
    registered_address, registered_state, registered_district, registered_pincode,
    owner_name, owner_designation, owner_email, owner_mobile_number,
    status, is_verified, verified_at, profile_completed, profile_completed_at,
    created_at, updated_at
) VALUES
-- Organization 1: Manufacturing (Large)
(1001, 'Tata Advanced Systems Limited', 'contact@tataadvanced.com', 'info@tataadvanced.com',
 '9876543210', '02027654321', 'AABCT1234A',
 'Plot No. 45, MIDC Industrial Area, Hinjewadi Phase III', 'Maharashtra', 'Pune', '411057',
 'Rajesh Kumar', 'Managing Director', 'rajesh.kumar@tataadvanced.com', '9876543211',
 'active', 1, NOW(), 1, NOW(), NOW(), NOW()),

-- Organization 2: Manufacturing (Medium)
(1002, 'Bharat Electronics Manufacturing Pvt Ltd', 'info@bharatelectronics.com', NULL,
 '9123456789', '08026789012', 'AABCB5678B',
 'No. 123, Electronic City Phase 2, Hosur Road', 'Karnataka', 'Bengaluru Urban', '560100',
 'Suresh Menon', 'CEO', 'suresh.menon@bharatelectronics.com', '9123456790',
 'active', 1, NOW(), 1, NOW(), NOW(), NOW()),

-- Organization 3: Service (AMC Provider)
(1003, 'TechServe Solutions India Ltd', 'support@techserve.in', 'sales@techserve.in',
 '9234567890', '01124567890', 'AABCT9012C',
 'Tower B, DLF Cyber City, Sector 25A', 'Haryana', 'Gurugram', '122002',
 'Priya Sharma', 'Director Operations', 'priya.sharma@techserve.in', '9234567891',
 'active', 1, NOW(), 1, NOW(), NOW(), NOW()),

-- Organization 4: Service (Critical Service Provider)
(1004, 'DefenseCore Services Pvt Ltd', 'contact@defensecore.in', NULL,
 '9345678901', '04044567890', 'AABCD3456D',
 'No. 78, IT Corridor, Old Mahabalipuram Road', 'Tamil Nadu', 'Chennai', '600119',
 'Arun Krishnan', 'Founder & CEO', 'arun.krishnan@defensecore.in', '9345678902',
 'active', 1, NOW(), 1, NOW(), NOW(), NOW()),

-- Organization 5: Manufacturing (Startup)
(1005, 'NanoTech Innovations Pvt Ltd', 'hello@nanotechinno.com', NULL,
 '9456789012', NULL, 'AABCN7890E',
 'Startup Hub, IIT Delhi Campus, Hauz Khas', 'Delhi', 'South Delhi', '110016',
 'Dr. Amit Verma', 'Founder', 'amit.verma@nanotechinno.com', '9456789013',
 'active', 1, NOW(), 1, NOW(), NOW(), NOW())

ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ============================================================================
-- STEP 3: CREATE TEST UNITS
-- ============================================================================

INSERT INTO units (
    id, organization_id, email, mobile_number, landline_number,
    contact_person_name, contact_person_designation, contact_person_email, contact_person_mobile_number,
    address, state, district, pincode, unit_type, commencement_date, status,
    created_at, updated_at
) VALUES
-- Units for Organization 1 (Tata Advanced)
(2001, 1001, 'pune.unit@tataadvanced.com', '9876543220', '02027654322',
 'Vikram Singh', 'Plant Manager', 'vikram.singh@tataadvanced.com', '9876543221',
 'Plot No. 45, MIDC Industrial Area, Hinjewadi Phase III', 'Maharashtra', 'Pune', '411057',
 'manufacturing', '2015-06-15', 'active', NOW(), NOW()),

(2002, 1001, 'nagpur.unit@tataadvanced.com', '9876543230', '07127654323',
 'Rahul Patil', 'Unit Head', 'rahul.patil@tataadvanced.com', '9876543231',
 'Plot No. 78, MIHAN SEZ, Nagpur', 'Maharashtra', 'Nagpur', '441108',
 'manufacturing', '2018-03-20', 'active', NOW(), NOW()),

-- Units for Organization 2 (Bharat Electronics)
(2003, 1002, 'blr.unit@bharatelectronics.com', '9123456799', '08026789013',
 'Deepak Rao', 'Production Manager', 'deepak.rao@bharatelectronics.com', '9123456800',
 'No. 123, Electronic City Phase 2', 'Karnataka', 'Bengaluru Urban', '560100',
 'manufacturing', '2012-01-10', 'active', NOW(), NOW()),

-- Units for Organization 3 (TechServe - Service)
(2004, 1003, 'delhi.unit@techserve.in', '9234567899', '01124567891',
 'Neha Gupta', 'Service Manager', 'neha.gupta@techserve.in', '9234567900',
 'Tower B, DLF Cyber City, Sector 25A', 'Haryana', 'Gurugram', '122002',
 'service', '2016-08-01', 'active', NOW(), NOW()),

(2005, 1003, 'mumbai.unit@techserve.in', '9234567909', '02224567892',
 'Rohan Deshmukh', 'Branch Manager', 'rohan.deshmukh@techserve.in', '9234567910',
 'Unit 501, Hiranandani Business Park, Powai', 'Maharashtra', 'Mumbai', '400076',
 'service', '2019-02-15', 'active', NOW(), NOW()),

-- Units for Organization 4 (DefenseCore - Service)
(2006, 1004, 'chennai.unit@defensecore.in', '9345678910', '04044567891',
 'Karthik Rajan', 'Operations Head', 'karthik.rajan@defensecore.in', '9345678911',
 'No. 78, IT Corridor, OMR', 'Tamil Nadu', 'Chennai', '600119',
 'service', '2017-11-01', 'active', NOW(), NOW()),

-- Units for Organization 5 (NanoTech - Startup)
(2007, 1005, 'delhi.unit@nanotechinno.com', '9456789022', NULL,
 'Sneha Kapoor', 'R&D Lead', 'sneha.kapoor@nanotechinno.com', '9456789023',
 'Startup Hub, IIT Delhi Campus', 'Delhi', 'South Delhi', '110016',
 'manufacturing', '2022-05-01', 'active', NOW(), NOW())

ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ============================================================================
-- STEP 4: CREATE TEST APPLICATIONS
-- ============================================================================

INSERT INTO applications (
    id, organization_id, unit_id, application_number, application_type,
    sector, drdo_vendor_category, is_existing_drdo_vendor, enterprise_classification, enterprise_name,
    registered_office_address, registered_office_state, registered_office_district, registered_office_pin_code,
    registered_office_mobile, registered_office_email,
    unit_address, unit_state, unit_district, unit_pin_code, unit_mobile, unit_email,
    contact_person_name, contact_person_designation, contact_person_mobile, contact_person_email,
    ownership_type, male_employees_count, female_employees_count, other_employees_count,
    gst_number, svc_provider_type,
    mfg_products, mfg_key_processes, svc_services, svc_key_resources, customers,
    status, submitted_at, payment_completed_at,
    created_at, updated_at
) VALUES
-- ===== MANUFACTURING APPLICATIONS (5 - one per enterprise size) =====

-- App 1: Manufacturing - Large
(3001, 1001, 2001, 'APP-2025-00001', 'new',
 'manufacturing', 'Category A - Defense Equipment', 0, 'large', 'Tata Advanced Systems Limited',
 'Plot No. 45, MIDC Industrial Area, Hinjewadi Phase III', 'Maharashtra', 'Pune', '411057',
 '9876543210', 'contact@tataadvanced.com',
 'Plot No. 45, MIDC Industrial Area, Hinjewadi Phase III', 'Maharashtra', 'Pune', '411057',
 '9876543220', 'pune.unit@tataadvanced.com',
 'Vikram Singh', 'Plant Manager', '9876543221', 'vikram.singh@tataadvanced.com',
 'private_limited', 400, 95, 5,
 '27AABCT1234A1ZW', NULL,
 '[{"product_name":"Aerospace Components","total_production_capacity":"1000","capacity_unit":"units/month"}]',
 '[{"process_name":"CNC Machining"},{"process_name":"Heat Treatment"}]',
 NULL, NULL,
 '[{"customer_name":"DRDO","customer_type":"government"},{"customer_name":"HAL","customer_type":"psu"}]',
 'payment_completed', NOW(), NOW(), NOW(), NOW()),

-- App 2: Manufacturing - Medium
(3002, 1002, 2003, 'APP-2025-00002', 'new',
 'manufacturing', 'Category B - Electronics', 0, 'medium', 'Bharat Electronics Manufacturing Pvt Ltd',
 'No. 123, Electronic City Phase 2', 'Karnataka', 'Bengaluru Urban', '560100',
 '9123456789', 'info@bharatelectronics.com',
 'No. 123, Electronic City Phase 2', 'Karnataka', 'Bengaluru Urban', '560100',
 '9123456799', 'blr.unit@bharatelectronics.com',
 'Deepak Rao', 'Production Manager', '9123456800', 'deepak.rao@bharatelectronics.com',
 'private_limited', 120, 28, 2,
 '29AABCB5678B1ZX', NULL,
 '[{"product_name":"Electronic Control Systems","total_production_capacity":"500","capacity_unit":"units/month"}]',
 '[{"process_name":"PCB Assembly"},{"process_name":"Testing & QC"}]',
 NULL, NULL,
 '[{"customer_name":"Indian Navy","customer_type":"government"}]',
 'payment_completed', NOW(), NOW(), NOW(), NOW()),

-- App 3: Manufacturing - Small
(3003, 1001, 2002, 'APP-2025-00003', 'new',
 'manufacturing', 'Category C - Precision Parts', 0, 'small', 'Tata Advanced Systems - Nagpur Division',
 'Plot No. 45, MIDC Industrial Area, Hinjewadi Phase III', 'Maharashtra', 'Pune', '411057',
 '9876543210', 'contact@tataadvanced.com',
 'Plot No. 78, MIHAN SEZ, Nagpur', 'Maharashtra', 'Nagpur', '441108',
 '9876543230', 'nagpur.unit@tataadvanced.com',
 'Rahul Patil', 'Unit Head', '9876543231', 'rahul.patil@tataadvanced.com',
 'private_limited', 38, 6, 1,
 '27AABCT1234A2ZV', NULL,
 '[{"product_name":"Precision Machined Parts","total_production_capacity":"200","capacity_unit":"units/month"}]',
 '[{"process_name":"Precision Machining"}]',
 NULL, NULL,
 '[{"customer_name":"ISRO","customer_type":"government"}]',
 'payment_completed', NOW(), NOW(), NOW(), NOW()),

-- App 4: Manufacturing - Micro
(3004, 1005, 2007, 'APP-2025-00004', 'new',
 'manufacturing', 'Category D - R&D Equipment', 0, 'micro', 'NanoTech Innovations - Lab Unit',
 'Startup Hub, IIT Delhi Campus', 'Delhi', 'South Delhi', '110016',
 '9456789012', 'hello@nanotechinno.com',
 'Startup Hub, IIT Delhi Campus', 'Delhi', 'South Delhi', '110016',
 '9456789022', 'delhi.unit@nanotechinno.com',
 'Sneha Kapoor', 'R&D Lead', '9456789023', 'sneha.kapoor@nanotechinno.com',
 'private_limited', 5, 3, 0,
 '07AABCN7890E1ZY', NULL,
 '[{"product_name":"Nano Sensors","total_production_capacity":"50","capacity_unit":"units/month"}]',
 '[{"process_name":"Nano Fabrication"}]',
 NULL, NULL,
 '[{"customer_name":"DRDO Lab","customer_type":"government"}]',
 'payment_completed', NOW(), NOW(), NOW(), NOW()),

-- App 5: Manufacturing - Startup
(3005, 1005, 2007, 'APP-2025-00005', 'new',
 'manufacturing', 'Category E - Prototypes', 0, 'startup', 'NanoTech Innovations Pvt Ltd',
 'Startup Hub, IIT Delhi Campus', 'Delhi', 'South Delhi', '110016',
 '9456789012', 'hello@nanotechinno.com',
 'Startup Hub, IIT Delhi Campus', 'Delhi', 'South Delhi', '110016',
 '9456789022', 'delhi.unit@nanotechinno.com',
 'Dr. Amit Verma', 'Founder', '9456789013', 'amit.verma@nanotechinno.com',
 'private_limited', 2, 1, 0,
 '07AABCN7890E2ZX', NULL,
 '[{"product_name":"Defense Prototypes","total_production_capacity":"10","capacity_unit":"units/month"}]',
 '[{"process_name":"Prototyping"}]',
 NULL, NULL,
 '[{"customer_name":"Defense Research","customer_type":"government"}]',
 'payment_completed', NOW(), NOW(), NOW(), NOW()),

-- ===== SERVICE APPLICATIONS (8 - various size/provider combinations) =====

-- App 6: Service - Large - AMC
(3006, 1003, 2004, 'APP-2025-00006', 'new',
 'service', 'Service Category A', 0, 'large', 'TechServe Solutions India Ltd',
 'Tower B, DLF Cyber City, Sector 25A', 'Haryana', 'Gurugram', '122002',
 '9234567890', 'support@techserve.in',
 'Tower B, DLF Cyber City, Sector 25A', 'Haryana', 'Gurugram', '122002',
 '9234567899', 'delhi.unit@techserve.in',
 'Neha Gupta', 'Service Manager', '9234567900', 'neha.gupta@techserve.in',
 'private_limited', 220, 75, 5,
 '06AABCT9012C1ZW', 'annual_maintenance_contract',
 NULL, NULL,
 '[{"service_name":"IT Infrastructure Maintenance","total_services_capacity":"100","capacity_unit":"contracts/year"}]',
 '[{"resource_name":"Certified Engineers","is_imported":false}]',
 '[{"customer_name":"Ministry of Defense","customer_type":"government"}]',
 'payment_completed', NOW(), NOW(), NOW(), NOW()),

-- App 7: Service - Medium - Critical Service Provider
(3007, 1004, 2006, 'APP-2025-00007', 'new',
 'service', 'Service Category B', 0, 'medium', 'DefenseCore Services Pvt Ltd',
 'No. 78, IT Corridor, OMR', 'Tamil Nadu', 'Chennai', '600119',
 '9345678901', 'contact@defensecore.in',
 'No. 78, IT Corridor, OMR', 'Tamil Nadu', 'Chennai', '600119',
 '9345678910', 'chennai.unit@defensecore.in',
 'Karthik Rajan', 'Operations Head', '9345678911', 'karthik.rajan@defensecore.in',
 'private_limited', 95, 23, 2,
 '33AABCD3456D1ZV', 'critical_service_provider',
 NULL, NULL,
 '[{"service_name":"System Integration Services","total_services_capacity":"50","capacity_unit":"projects/year"}]',
 '[{"resource_name":"Defense Security Cleared Staff","is_imported":false}]',
 '[{"customer_name":"Indian Air Force","customer_type":"government"}]',
 'payment_completed', NOW(), NOW(), NOW(), NOW()),

-- App 8: Service - Small - Civil Works
(3008, 1003, 2005, 'APP-2025-00008', 'new',
 'service', 'Service Category C', 0, 'small', 'TechServe Solutions - Mumbai Branch',
 'Tower B, DLF Cyber City, Sector 25A', 'Haryana', 'Gurugram', '122002',
 '9234567890', 'support@techserve.in',
 'Unit 501, Hiranandani Business Park, Powai', 'Maharashtra', 'Mumbai', '400076',
 '9234567909', 'mumbai.unit@techserve.in',
 'Rohan Deshmukh', 'Branch Manager', '9234567910', 'rohan.deshmukh@techserve.in',
 'private_limited', 28, 6, 1,
 '27AABCT9012C2ZU', 'civil_works_contractor',
 NULL, NULL,
 '[{"service_name":"Facility Management","total_services_capacity":"20","capacity_unit":"contracts/year"}]',
 '[{"resource_name":"Civil Engineers","is_imported":false}]',
 '[{"customer_name":"Naval Dockyard","customer_type":"government"}]',
 'payment_completed', NOW(), NOW(), NOW(), NOW()),

-- App 9: Service - Micro - AMC
(3009, 1004, 2006, 'APP-2025-00009', 'new',
 'service', 'Service Category D', 0, 'micro', 'DefenseCore - Specialized Unit',
 'No. 78, IT Corridor, OMR', 'Tamil Nadu', 'Chennai', '600119',
 '9345678901', 'contact@defensecore.in',
 'No. 78, IT Corridor, OMR', 'Tamil Nadu', 'Chennai', '600119',
 '9345678910', 'chennai.unit@defensecore.in',
 'Karthik Rajan', 'Operations Head', '9345678911', 'karthik.rajan@defensecore.in',
 'private_limited', 7, 2, 0,
 '33AABCD3456D2ZT', 'annual_maintenance_contract',
 NULL, NULL,
 '[{"service_name":"Specialized Equipment Maintenance","total_services_capacity":"15","capacity_unit":"contracts/year"}]',
 '[{"resource_name":"Technical Specialists","is_imported":false}]',
 '[{"customer_name":"DRDO Lab Chennai","customer_type":"government"}]',
 'payment_completed', NOW(), NOW(), NOW(), NOW()),

-- App 10: Service - Startup - Critical Service Provider
(3010, 1003, 2004, 'APP-2025-00010', 'new',
 'service', 'Service Category E', 0, 'startup', 'TechServe - Innovation Division',
 'Tower B, DLF Cyber City, Sector 25A', 'Haryana', 'Gurugram', '122002',
 '9234567890', 'support@techserve.in',
 'Tower B, DLF Cyber City, Sector 25A', 'Haryana', 'Gurugram', '122002',
 '9234567899', 'delhi.unit@techserve.in',
 'Neha Gupta', 'Service Manager', '9234567900', 'neha.gupta@techserve.in',
 'private_limited', 3, 1, 0,
 '06AABCT9012C3ZS', 'critical_service_provider',
 NULL, NULL,
 '[{"service_name":"AI-based Defense Analytics","total_services_capacity":"5","capacity_unit":"projects/year"}]',
 '[{"resource_name":"Data Scientists","is_imported":false}]',
 '[{"customer_name":"Defense Ministry","customer_type":"government"}]',
 'payment_completed', NOW(), NOW(), NOW(), NOW())

ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ============================================================================
-- STEP 5: CREATE ASSESSMENTS
-- ============================================================================

INSERT INTO application_assessments (
    id, application_id, organization_id, unit_id,
    status, step_progress, scheduled_start_date, scheduled_end_date,
    allocated_at, started_at, created_at, updated_at
) VALUES
-- Assessment for App 1 (Mfg - Large) - IN PROGRESS
(4001, 3001, 1001, 2001,
 'in_progress', '{"parameter_allocation":"completed","site_pictures":"in_progress"}',
 '2025-01-15', '2025-01-20', NOW(), NOW(), NOW(), NOW()),

-- Assessment for App 2 (Mfg - Medium) - IN PROGRESS
(4002, 3002, 1002, 2003,
 'in_progress', '{"parameter_allocation":"completed","site_pictures":"pending"}',
 '2025-01-18', '2025-01-23', NOW(), NOW(), NOW(), NOW()),

-- Assessment for App 3 (Mfg - Small) - IN PROGRESS
(4003, 3003, 1001, 2002,
 'in_progress', '{"parameter_allocation":"in_progress"}',
 '2025-01-20', '2025-01-25', NOW(), NOW(), NOW(), NOW()),

-- Assessment for App 4 (Mfg - Micro) - SCHEDULED
(4004, 3004, 1005, 2007,
 'scheduled', '{"parameter_allocation":"pending"}',
 '2025-01-25', '2025-01-28', NOW(), NULL, NOW(), NOW()),

-- Assessment for App 5 (Mfg - Startup) - SCHEDULED
(4005, 3005, 1005, 2007,
 'scheduled', '{"parameter_allocation":"pending"}',
 '2025-01-28', '2025-01-30', NOW(), NULL, NOW(), NOW()),

-- Assessment for App 6 (Svc - Large - AMC) - IN PROGRESS
(4006, 3006, 1003, 2004,
 'in_progress', '{"parameter_allocation":"completed","site_pictures":"completed","opening_meeting":"in_progress"}',
 '2025-01-10', '2025-01-15', NOW(), NOW(), NOW(), NOW()),

-- Assessment for App 7 (Svc - Medium - CSP) - IN PROGRESS
(4007, 3007, 1004, 2006,
 'in_progress', '{"parameter_allocation":"completed"}',
 '2025-01-12', '2025-01-17', NOW(), NOW(), NOW(), NOW()),

-- Assessment for App 8 (Svc - Small - CWC) - IN PROGRESS
(4008, 3008, 1003, 2005,
 'in_progress', '{"parameter_allocation":"completed"}',
 '2025-01-22', '2025-01-27', NOW(), NOW(), NOW(), NOW())

ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ============================================================================
-- STEP 6: CREATE ASSESSMENT TEAM MEMBERS
-- Uses actual user IDs from users table (assessor@webority.dev)
-- ============================================================================

-- Get the assessor user ID
SET @assessor_id = (SELECT id FROM users WHERE email = 'assessor@webority.dev' LIMIT 1);
SET @ops_manager_id = (SELECT id FROM users WHERE email = 'operations.manager@webority.dev' LIMIT 1);
SET @ops_admin_id = (SELECT id FROM users WHERE email = 'operations.admin@webority.dev' LIMIT 1);

-- Use first available user if specific users don't exist
SET @assessor_id = COALESCE(@assessor_id, (SELECT id FROM users LIMIT 1));
SET @ops_manager_id = COALESCE(@ops_manager_id, @assessor_id);
SET @ops_admin_id = COALESCE(@ops_admin_id, @assessor_id);

-- Team for Assessment 4001
INSERT INTO application_assessment_team_members (assessment_id, user_id, role, created_at, updated_at)
VALUES (4001, @assessor_id, 'lead_assessor', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

INSERT INTO application_assessment_team_members (assessment_id, user_id, role, created_at, updated_at)
VALUES (4001, @ops_manager_id, 'co_assessor', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Team for Assessment 4002
INSERT INTO application_assessment_team_members (assessment_id, user_id, role, created_at, updated_at)
VALUES (4002, @assessor_id, 'lead_assessor', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Team for Assessment 4003
INSERT INTO application_assessment_team_members (assessment_id, user_id, role, created_at, updated_at)
VALUES (4003, @assessor_id, 'lead_assessor', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Team for Assessment 4004
INSERT INTO application_assessment_team_members (assessment_id, user_id, role, created_at, updated_at)
VALUES (4004, @assessor_id, 'lead_assessor', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Team for Assessment 4005
INSERT INTO application_assessment_team_members (assessment_id, user_id, role, created_at, updated_at)
VALUES (4005, @assessor_id, 'lead_assessor', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Team for Assessment 4006
INSERT INTO application_assessment_team_members (assessment_id, user_id, role, created_at, updated_at)
VALUES (4006, @assessor_id, 'lead_assessor', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

INSERT INTO application_assessment_team_members (assessment_id, user_id, role, created_at, updated_at)
VALUES (4006, @ops_manager_id, 'co_assessor', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Team for Assessment 4007
INSERT INTO application_assessment_team_members (assessment_id, user_id, role, created_at, updated_at)
VALUES (4007, @assessor_id, 'lead_assessor', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Team for Assessment 4008
INSERT INTO application_assessment_team_members (assessment_id, user_id, role, created_at, updated_at)
VALUES (4008, @assessor_id, 'lead_assessor', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ============================================================================
-- STEP 7: COPY PARAMETERS TO APPLICATION_ASSESSMENT_PARAMETERS
-- This is what startAssessment() would do - copying from master table
-- ============================================================================

-- For Assessment 4001 (Manufacturing - Large)
INSERT INTO application_assessment_parameters (assessment_id, discipline_name, code, name, is_mandatory, created_at, updated_at)
SELECT 4001, d.name, CONCAT('P', ap.id), ap.name, ap.is_mandatory, NOW(), NOW()
FROM assessment_parameters ap
LEFT JOIN disciplines d ON ap.discipline_id = d.id
WHERE ap.sector = 'manufacturing'
  AND ap.enterprise_size = 'large'
  AND ap.service_provider_type IS NULL
  AND ap.is_active = 1;

-- For Assessment 4002 (Manufacturing - Medium)
INSERT INTO application_assessment_parameters (assessment_id, discipline_name, code, name, is_mandatory, created_at, updated_at)
SELECT 4002, d.name, CONCAT('P', ap.id), ap.name, ap.is_mandatory, NOW(), NOW()
FROM assessment_parameters ap
LEFT JOIN disciplines d ON ap.discipline_id = d.id
WHERE ap.sector = 'manufacturing'
  AND ap.enterprise_size = 'medium'
  AND ap.service_provider_type IS NULL
  AND ap.is_active = 1;

-- For Assessment 4003 (Manufacturing - Small)
INSERT INTO application_assessment_parameters (assessment_id, discipline_name, code, name, is_mandatory, created_at, updated_at)
SELECT 4003, d.name, CONCAT('P', ap.id), ap.name, ap.is_mandatory, NOW(), NOW()
FROM assessment_parameters ap
LEFT JOIN disciplines d ON ap.discipline_id = d.id
WHERE ap.sector = 'manufacturing'
  AND ap.enterprise_size = 'small'
  AND ap.service_provider_type IS NULL
  AND ap.is_active = 1;

-- For Assessment 4006 (Service - Large - AMC)
INSERT INTO application_assessment_parameters (assessment_id, discipline_name, code, name, is_mandatory, created_at, updated_at)
SELECT 4006, d.name, CONCAT('P', ap.id), ap.name, ap.is_mandatory, NOW(), NOW()
FROM assessment_parameters ap
LEFT JOIN disciplines d ON ap.discipline_id = d.id
WHERE ap.sector = 'service'
  AND ap.enterprise_size = 'large'
  AND ap.service_provider_type = 'annual_maintenance_contract'
  AND ap.is_active = 1;

-- For Assessment 4007 (Service - Medium - Critical Service Provider)
INSERT INTO application_assessment_parameters (assessment_id, discipline_name, code, name, is_mandatory, created_at, updated_at)
SELECT 4007, d.name, CONCAT('P', ap.id), ap.name, ap.is_mandatory, NOW(), NOW()
FROM assessment_parameters ap
LEFT JOIN disciplines d ON ap.discipline_id = d.id
WHERE ap.sector = 'service'
  AND ap.enterprise_size = 'medium'
  AND ap.service_provider_type = 'critical_service_provider'
  AND ap.is_active = 1;

-- For Assessment 4008 (Service - Small - Civil Works)
INSERT INTO application_assessment_parameters (assessment_id, discipline_name, code, name, is_mandatory, created_at, updated_at)
SELECT 4008, d.name, CONCAT('P', ap.id), ap.name, ap.is_mandatory, NOW(), NOW()
FROM assessment_parameters ap
LEFT JOIN disciplines d ON ap.discipline_id = d.id
WHERE ap.sector = 'service'
  AND ap.enterprise_size = 'small'
  AND ap.service_provider_type = 'civil_works_contractor'
  AND ap.is_active = 1;

-- ============================================================================
-- VERIFICATION QUERIES - Run these to verify data
-- ============================================================================

-- Check organizations
SELECT id, name, status FROM organizations WHERE id >= 1001;

-- Check units
SELECT id, organization_id, unit_type, state FROM units WHERE id >= 2001;

-- Check applications
SELECT id, application_number, sector, enterprise_classification, svc_provider_type, status
FROM applications WHERE id >= 3001;

-- Check assessments
SELECT id, application_id, status FROM application_assessments WHERE id >= 4001;

-- Check copied parameters (THE MAIN FIX)
SELECT
    aap.assessment_id,
    COUNT(*) as total_params,
    SUM(CASE WHEN aap.is_mandatory = 1 THEN 1 ELSE 0 END) as mandatory_count,
    SUM(CASE WHEN aap.is_mandatory = 0 THEN 1 ELSE 0 END) as optional_count
FROM application_assessment_parameters aap
JOIN application_assessments aa ON aap.assessment_id = aa.id
GROUP BY aap.assessment_id;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
