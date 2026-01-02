ALTER TABLE C_CONTACTS
ADD COLUMN FIRST_NAME VARCHAR(100) NOT NULL DEFAULT '' AFTER ACCOUNT_ID,
ADD COLUMN LAST_NAME VARCHAR(100) NOT NULL DEFAULT '' AFTER FIRST_NAME,
ADD COLUMN JOB_TITLE VARCHAR(100) AFTER LAST_NAME,
ADD COLUMN DEPARTMENT VARCHAR(100) AFTER JOB_TITLE,
ADD COLUMN IS_PRIMARY TINYINT(1) DEFAULT 0 AFTER DEPARTMENT;

INSERT INTO C_GENERIC_NAMES (g_id, Name, cutting, active, description, single_value, category, child_gid)
VALUES (43, 'Contact Type', 0, 1, 'Type of contact - Primary or Secondary', NULL, 'contacts', NULL);

INSERT INTO C_GENERIC_VALUES (g_id, orgid, Name, display_order, isactive)
SELECT 43, orgid, 'Primary', 1, 1 FROM C_ORG WHERE status = 1;

INSERT INTO C_GENERIC_VALUES (g_id, orgid, Name, display_order, isactive)
SELECT 43, orgid, 'Secondary', 2, 1 FROM C_ORG WHERE status = 1;
