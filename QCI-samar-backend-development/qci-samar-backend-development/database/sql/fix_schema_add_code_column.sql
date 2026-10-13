-- ============================================================================
-- SCHEMA FIX: Add missing 'code' column to assessment_parameters table
-- Run this FIRST before running development_seed_data.sql
-- ============================================================================

-- Step 1: Add the code column to assessment_parameters (if it doesn't exist)
ALTER TABLE assessment_parameters
ADD COLUMN code VARCHAR(50) NULL AFTER name;

-- Step 2: Update existing records with generated codes
-- Format: DISCIPLINE_ABBR-SECTOR_INITIAL-ID (e.g., QMS-M-1, SQM-S-45)
UPDATE assessment_parameters ap
LEFT JOIN disciplines d ON ap.discipline_id = d.id
SET ap.code = CONCAT(
    CASE
        WHEN d.name = 'Quality Management System' THEN 'QMS'
        WHEN d.name = 'Production Management' THEN 'PM'
        WHEN d.name = 'Safety & Environment' THEN 'SE'
        WHEN d.name = 'Service Quality Management' THEN 'SQM'
        WHEN d.name = 'Service Delivery' THEN 'SD'
        ELSE 'GEN'
    END,
    '-',
    UPPER(LEFT(ap.sector, 1)),
    '-',
    ap.id
);

-- Step 3: Make the column NOT NULL after populating
-- (Optional - uncomment if you want to enforce this)
-- ALTER TABLE assessment_parameters MODIFY COLUMN code VARCHAR(50) NOT NULL;

-- Verify the update
SELECT id, code, name, sector, enterprise_size, is_mandatory
FROM assessment_parameters
ORDER BY sector, enterprise_size, id
LIMIT 20;
