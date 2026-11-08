-- ============================================================================
-- CHRONICLE v1.0 — Master Relational Schema & Security Invariants
-- Migration: 20261108000001_chronicle_v1_schema.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. organizations
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. organization_memberships
CREATE TABLE IF NOT EXISTS organization_memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  org_role TEXT NOT NULL CHECK (org_role IN ('OWNER', 'ADMIN', 'MEMBER', 'GUEST')),
  max_clearance_tier INTEGER NOT NULL CHECK (max_clearance_tier BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

-- 3. projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  repository_url TEXT NOT NULL,
  departing_lead_handle TEXT NOT NULL,
  incoming_lead_handle TEXT NOT NULL,
  last_reconstruction_mode TEXT CHECK (last_reconstruction_mode IN ('DETERMINISTIC', 'AI_ENRICHED', 'AI_FALLBACK')),
  last_reconstructed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug),
  UNIQUE (id, organization_id)
);

-- 4. project_memberships
CREATE TABLE IF NOT EXISTS project_memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('MAINTAINER', 'REVIEWER', 'INCOMING_OWNER', 'EXTERNAL_AUDITOR')),
  clearance_tier INTEGER NOT NULL CHECK (clearance_tier BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, user_id) REFERENCES organization_memberships(organization_id, user_id) ON DELETE CASCADE
);

-- 5. contributors
CREATE TABLE IF NOT EXISTS contributors (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  handle TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role_title TEXT NOT NULL,
  departure_status TEXT NOT NULL CHECK (departure_status IN ('DEPARTING', 'ACTIVE', 'INCOMING', 'EXTERNAL')),
  primary_domains JSONB NOT NULL DEFAULT '[]'::jsonb,
  access_tier INTEGER NOT NULL CHECK (access_tier BETWEEN 1 AND 3),
  UNIQUE (project_id, handle),
  UNIQUE (project_id, id),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id) ON DELETE CASCADE
);

-- 6. source_artifacts
CREATE TABLE IF NOT EXISTS source_artifacts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('GITHUB_PR', 'SLACK_THREAD', 'JIRA_TICKET', 'NOTION_DOC', 'CUSTOM_NOTE')),
  external_ref TEXT NOT NULL,
  title TEXT NOT NULL,
  author_handle TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_tier INTEGER NOT NULL CHECK (access_tier BETWEEN 1 AND 3),
  sanitized_content TEXT NOT NULL,
  redaction_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
  redacted_count INTEGER NOT NULL DEFAULT 0 CHECK (redacted_count >= 0),
  module_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (project_id, id),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id) ON DELETE CASCADE
);

-- 10. exit_interviews (created before claims so claims can reference interview_id with composite FK)
CREATE TABLE IF NOT EXISTS exit_interviews (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  contributor_handle TEXT NOT NULL,
  contributor_name TEXT NOT NULL,
  topic_key TEXT NOT NULL,
  module_path TEXT NOT NULL,
  question TEXT NOT NULL,
  context_summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED')),
  access_tier INTEGER NOT NULL CHECK (access_tier BETWEEN 1 AND 3),
  answer_transcript TEXT,
  generated_claim_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completed_by_user_id TEXT,
  UNIQUE (project_id, id),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id) ON DELETE CASCADE
);

-- 7. claims
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('DECISION', 'UNFINISHED_WORK', 'RISK_BLOCKER', 'DEPENDENCY', 'OWNERSHIP_CONTACT', 'NEXT_ACTION')),
  topic_key TEXT NOT NULL,
  stance_value TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('EXTRACTED', 'VERIFIED', 'MISSING_EVIDENCE', 'CONFLICTED', 'HUMAN_APPROVED', 'SUPERSEDED', 'REJECTED')),
  extraction_origin TEXT NOT NULL CHECK (extraction_origin IN ('DETERMINISTIC', 'AI_ENRICHED', 'HUMAN_AUTHORED')),
  confidence_score NUMERIC(4,3) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  access_tier INTEGER NOT NULL CHECK (access_tier BETWEEN 1 AND 3),
  owner_handle TEXT,
  module_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  interview_id TEXT,
  synthesized_from_claim_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  superseded_by_claim_id TEXT,
  state_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, id),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, interview_id) REFERENCES exit_interviews(project_id, id) ON DELETE SET NULL
);

-- 8. claim_citations (composite FKs ensure claim and source belong to the exact same project)
CREATE TABLE IF NOT EXISTS claim_citations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_title TEXT,
  source_external_ref TEXT,
  verbatim_quote TEXT NOT NULL,
  char_start INTEGER NOT NULL CHECK (char_start >= 0),
  char_end INTEGER NOT NULL CHECK (char_end > char_start),
  verification_status TEXT NOT NULL CHECK (verification_status IN ('VERIFIED', 'MISSING_EVIDENCE')),
  access_tier INTEGER NOT NULL CHECK (access_tier BETWEEN 1 AND 3),
  FOREIGN KEY (project_id, claim_id) REFERENCES claims(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, source_id) REFERENCES source_artifacts(project_id, id) ON DELETE CASCADE
);

-- Enforce that citation access tier does not exceed its source or claim access tier
CREATE OR REPLACE FUNCTION enforce_citation_clearance_bounds()
RETURNS TRIGGER AS $$
DECLARE
  v_source_tier INTEGER;
  v_claim_tier INTEGER;
BEGIN
  SELECT access_tier INTO v_source_tier FROM source_artifacts WHERE project_id = NEW.project_id AND id = NEW.source_id;
  SELECT access_tier INTO v_claim_tier FROM claims WHERE project_id = NEW.project_id AND id = NEW.claim_id;

  IF NEW.access_tier > v_claim_tier OR NEW.access_tier < v_source_tier THEN
    RAISE EXCEPTION 'Citation access_tier (%) violates source (%) or claim (%) tier bounds', NEW.access_tier, v_source_tier, v_claim_tier;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_citation_clearance_bounds ON claim_citations;
CREATE TRIGGER trg_citation_clearance_bounds
BEFORE INSERT OR UPDATE ON claim_citations
FOR EACH ROW EXECUTE FUNCTION enforce_citation_clearance_bounds();

-- 9. conflicts (composite FKs to both associated claims in the same project)
CREATE TABLE IF NOT EXISTS conflicts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  topic_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  claim_a_id TEXT NOT NULL,
  claim_b_id TEXT NOT NULL,
  claim_a_previous_status TEXT NOT NULL,
  claim_b_previous_status TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'RESOLVED')),
  access_tier INTEGER NOT NULL CHECK (access_tier BETWEEN 1 AND 3),
  resolution_option TEXT CHECK (resolution_option IN ('CLAIM_A', 'CLAIM_B', 'SYNTHESIZE')),
  winning_claim_id TEXT,
  losing_claim_id TEXT,
  synthesized_claim_id TEXT,
  follow_up_next_action_claim_id TEXT,
  resolution_rationale TEXT,
  resolved_by_user_id TEXT,
  resolved_by_display_name TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CHECK (claim_a_id <> claim_b_id),
  UNIQUE (project_id, id),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, claim_a_id) REFERENCES claims(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, claim_b_id) REFERENCES claims(project_id, id) ON DELETE CASCADE
);

-- 11. dependency_edges
CREATE TABLE IF NOT EXISTS dependency_edges (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('OWNS_MODULE', 'DEPENDS_ON', 'EVIDENCES_CLAIM', 'IMPACTS_SERVICE', 'BLOCKS_WORK', 'INTERVIEW_GAP')),
  access_tier INTEGER NOT NULL CHECK (access_tier BETWEEN 1 AND 3),
  weight INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id) ON DELETE CASCADE
);

-- 12. handover_snapshots (Immutable after creation)
CREATE TABLE IF NOT EXISTS handover_snapshots (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  version_tag TEXT NOT NULL,
  access_tier INTEGER NOT NULL CHECK (access_tier BETWEEN 1 AND 3),
  canonical_payload JSONB NOT NULL,
  sha256_digest TEXT NOT NULL CHECK (char_length(sha256_digest) = 64),
  created_by_user_id TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, version_tag),
  UNIQUE (project_id, id),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION prevent_snapshot_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'handover_snapshots are immutable after creation. Updates and deletes are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_snapshots ON handover_snapshots;
CREATE TRIGGER trg_immutable_snapshots
BEFORE UPDATE OR DELETE ON handover_snapshots
FOR EACH ROW EXECUTE FUNCTION prevent_snapshot_mutation();

-- 13. snapshot_acknowledgements (Stored separately from immutable snapshots)
CREATE TABLE IF NOT EXISTS snapshot_acknowledgements (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  acknowledged_by_user_id TEXT NOT NULL,
  acknowledged_by_name TEXT NOT NULL,
  acknowledged_by_role TEXT NOT NULL,
  notes TEXT NOT NULL,
  verified_digest TEXT NOT NULL CHECK (char_length(verified_digest) = 64),
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (project_id, snapshot_id) REFERENCES handover_snapshots(project_id, id) ON DELETE RESTRICT
);

-- 14. audit_logs (Append-only with unique sequence number per project)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  sequence_number BIGINT NOT NULL,
  organization_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  actor_display_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  effective_clearance_tier INTEGER NOT NULL CHECK (effective_clearance_tier BETWEEN 1 AND 3),
  action TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  access_tier INTEGER NOT NULL CHECK (access_tier BETWEEN 1 AND 3),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, sequence_number),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are append-only. Historical audit events cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_append_only_audit_logs ON audit_logs;
CREATE TRIGGER trg_append_only_audit_logs
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
