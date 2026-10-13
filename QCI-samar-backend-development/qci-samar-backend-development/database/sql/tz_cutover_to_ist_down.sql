-- ============================================================================
-- Timezone cutover: Asia/Kolkata → UTC (rollback)
--
-- Run ONLY if rolling back tz_cutover_to_ist_up.sql and reverting the
-- config/app.php + config/database.php changes. Must be paired — running
-- this without the config rollback will produce 5h30m-past timestamps.
-- ============================================================================

START TRANSACTION;

UPDATE committee_meetings
SET scheduled_at = scheduled_at - INTERVAL '5:30' HOUR_MINUTE;

UPDATE committee_meetings
SET started_at = started_at - INTERVAL '5:30' HOUR_MINUTE
WHERE started_at IS NOT NULL;

UPDATE committee_meetings
SET ended_at = ended_at - INTERVAL '5:30' HOUR_MINUTE
WHERE ended_at IS NOT NULL;

UPDATE application_assessment_response_evidences
SET captured_at = captured_at - INTERVAL '5:30' HOUR_MINUTE
WHERE captured_at IS NOT NULL;

COMMIT;
