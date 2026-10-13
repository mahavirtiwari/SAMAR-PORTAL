-- ============================================================================
-- Timezone cutover: UTC → Asia/Kolkata (forward migration)
--
-- Run during the planned maintenance window AFTER taking a DB backup,
-- and BEFORE deploying the config/app.php + config/database.php changes.
-- See: docs/50-deployment/tz-cutover-to-ist.md for the full runbook.
--
-- Why only these columns:
--   MySQL TIMESTAMP is tz-aware — values are stored internally as UTC and
--   converted to/from the session timezone automatically. Setting the new
--   mysql connection 'timezone' => '+05:30' in config/database.php makes
--   every TIMESTAMP column display and accept IST without any data change.
--
--   MySQL DATETIME is tz-naive — values are stored as literal strings with
--   no timezone awareness. Existing rows were written interpreted as UTC
--   (because app.timezone was 'UTC'). After app.timezone switches to
--   'Asia/Kolkata' those literals would be read as IST and appear 5h30m
--   in the past. These columns must be shifted forward by 05:30.
--
-- Scope: 4 DATETIME columns across 2 tables.
-- ============================================================================

START TRANSACTION;

UPDATE committee_meetings
SET scheduled_at = scheduled_at + INTERVAL '5:30' HOUR_MINUTE;

UPDATE committee_meetings
SET started_at = started_at + INTERVAL '5:30' HOUR_MINUTE
WHERE started_at IS NOT NULL;

UPDATE committee_meetings
SET ended_at = ended_at + INTERVAL '5:30' HOUR_MINUTE
WHERE ended_at IS NOT NULL;

UPDATE application_assessment_response_evidences
SET captured_at = captured_at + INTERVAL '5:30' HOUR_MINUTE
WHERE captured_at IS NOT NULL;

COMMIT;
