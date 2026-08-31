import type { Database } from '@/db/client';

/**
 * Первая миграция: полная схема.
 * ВАЖНО: этот файл нельзя редактировать после того, как он уехал на устройство.
 * Любое изменение схемы — только новая миграция с новым номером.
 */
export const SCHEMA_SQL = `
-- ═══════════════ КАТАЛОГ ═══════════════

CREATE TABLE IF NOT EXISTS exercise (
  id                TEXT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  name_ru           TEXT NOT NULL,
  name_en           TEXT,
  family_id         TEXT,
  category          TEXT NOT NULL,
  movement_pattern  TEXT,
  metric_type       TEXT NOT NULL,
  difficulty        TEXT,
  is_compound       INTEGER NOT NULL DEFAULT 0,
  push_pull         TEXT,
  laterality        TEXT,
  default_rest_sec  INTEGER,
  popularity        INTEGER NOT NULL DEFAULT 0,
  is_custom         INTEGER NOT NULL DEFAULT 0,
  source            TEXT NOT NULL DEFAULT 'builtin',
  image_uri         TEXT,
  license           TEXT,
  attribution       TEXT,
  search_blob       TEXT NOT NULL DEFAULT '',
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER
);

CREATE TABLE IF NOT EXISTS exercise_alias (
  id          TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  name        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exercise_muscle (
  exercise_id TEXT NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  muscle      TEXT NOT NULL,
  role        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (exercise_id, muscle, role)
);

CREATE TABLE IF NOT EXISTS exercise_equipment (
  exercise_id TEXT NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  equipment   TEXT NOT NULL,
  is_primary  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (exercise_id, equipment)
);

CREATE TABLE IF NOT EXISTS exercise_tag (
  exercise_id TEXT NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL,
  PRIMARY KEY (exercise_id, tag)
);

CREATE TABLE IF NOT EXISTS exercise_instruction (
  id          TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  text        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exercise_media (
  id           TEXT PRIMARY KEY,
  exercise_id  TEXT NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  position     INTEGER NOT NULL DEFAULT 0,
  local_asset  TEXT,
  remote_url   TEXT,
  width        INTEGER,
  height       INTEGER,
  asset_source TEXT,
  license      TEXT NOT NULL,
  attribution  TEXT
);

-- ═══════════════ ШАБЛОНЫ ═══════════════

CREATE TABLE IF NOT EXISTS template_folder (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS workout_template (
  id               TEXT PRIMARY KEY,
  folder_id        TEXT REFERENCES template_folder(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  notes            TEXT,
  is_favorite      INTEGER NOT NULL DEFAULT 0,
  position         INTEGER NOT NULL DEFAULT 0,
  default_rest_sec INTEGER,
  last_used_at     INTEGER,
  use_count        INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  deleted_at       INTEGER
);

CREATE TABLE IF NOT EXISTS template_exercise (
  id              TEXT PRIMARY KEY,
  template_id     TEXT NOT NULL REFERENCES workout_template(id) ON DELETE CASCADE,
  exercise_id     TEXT NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  superset_group  INTEGER,
  target_sets     INTEGER,
  target_reps_min INTEGER,
  target_reps_max INTEGER,
  target_rir      REAL,
  rest_sec        INTEGER,
  notes           TEXT
);

-- ═══════════════ ТРЕНИРОВКИ ═══════════════

CREATE TABLE IF NOT EXISTS workout_session (
  id                     TEXT PRIMARY KEY,
  template_id            TEXT REFERENCES workout_template(id) ON DELETE SET NULL,
  template_name_snapshot TEXT,
  title                  TEXT NOT NULL,
  status                 TEXT NOT NULL CHECK (status IN ('active','completed','discarded')),
  started_at             INTEGER NOT NULL,
  finished_at            INTEGER,
  duration_sec           INTEGER,
  local_date             TEXT NOT NULL,
  notes                  TEXT,
  total_volume_kg        REAL,
  total_sets             INTEGER,
  total_reps             INTEGER,
  total_exercises        INTEGER,
  pr_count               INTEGER,
  body_weight_kg         REAL,
  created_at             INTEGER NOT NULL,
  updated_at             INTEGER NOT NULL,
  deleted_at             INTEGER
);

CREATE TABLE IF NOT EXISTS workout_exercise (
  id                      TEXT PRIMARY KEY,
  session_id              TEXT NOT NULL REFERENCES workout_session(id) ON DELETE CASCADE,
  exercise_id             TEXT REFERENCES exercise(id) ON DELETE SET NULL,
  exercise_name_snapshot  TEXT NOT NULL,
  metric_type_snapshot    TEXT NOT NULL,
  equipment_snapshot      TEXT,
  primary_muscle_snapshot TEXT,
  position                INTEGER NOT NULL,
  superset_group          INTEGER,
  rest_sec                INTEGER,
  notes                   TEXT,
  created_at              INTEGER NOT NULL,
  updated_at              INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_set (
  id                  TEXT PRIMARY KEY,
  workout_exercise_id TEXT NOT NULL REFERENCES workout_exercise(id) ON DELETE CASCADE,
  set_index           INTEGER NOT NULL,
  set_type            TEXT NOT NULL DEFAULT 'working'
                      CHECK (set_type IN ('warmup','working','dropset','failure','backoff')),
  weight_kg           REAL,
  reps                INTEGER,
  duration_sec        INTEGER,
  distance_m          REAL,
  assist_kg           REAL,
  added_weight_kg     REAL,
  rir                 REAL,
  rpe                 REAL,
  is_completed        INTEGER NOT NULL DEFAULT 0,
  completed_at        INTEGER,
  volume_kg           REAL,
  est_1rm_kg          REAL,
  is_pr               INTEGER NOT NULL DEFAULT 0,
  notes               TEXT,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_record (
  id              TEXT PRIMARY KEY,
  exercise_id     TEXT NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  rep_target      INTEGER,
  value           REAL NOT NULL,
  unit            TEXT NOT NULL,
  previous_value  REAL,
  session_id      TEXT REFERENCES workout_session(id) ON DELETE CASCADE,
  workout_set_id  TEXT REFERENCES workout_set(id) ON DELETE CASCADE,
  achieved_at     INTEGER NOT NULL,
  local_date      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS body_weight_entry (
  id          TEXT PRIMARY KEY,
  measured_at INTEGER NOT NULL,
  local_date  TEXT NOT NULL UNIQUE,
  weight_kg   REAL NOT NULL,
  note        TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted_at  INTEGER
);

CREATE TABLE IF NOT EXISTS recovery_checkin (
  id         TEXT PRIMARY KEY,
  session_id TEXT REFERENCES workout_session(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  mood       INTEGER,
  sleep      INTEGER,
  energy     INTEGER,
  motivation INTEGER,
  note       TEXT,
  created_at INTEGER NOT NULL
);

-- ═══════════════ AI ═══════════════

CREATE TABLE IF NOT EXISTS ai_chat (
  id         TEXT PRIMARY KEY,
  title      TEXT,
  scope      TEXT NOT NULL DEFAULT 'general',
  ref_id     TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_message (
  id                TEXT PRIMARY KEY,
  chat_id           TEXT NOT NULL REFERENCES ai_chat(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('user','assistant','tool')),
  content           TEXT,
  tool_name         TEXT,
  tool_payload_json TEXT,
  status            TEXT NOT NULL DEFAULT 'done',
  created_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_memory (
  id         TEXT PRIMARY KEY,
  text       TEXT NOT NULL,
  category   TEXT,
  origin     TEXT NOT NULL DEFAULT 'user',
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_analysis (
  id             TEXT PRIMARY KEY,
  session_id     TEXT NOT NULL REFERENCES workout_session(id) ON DELETE CASCADE,
  model          TEXT,
  prompt_version TEXT,
  context_json   TEXT,
  content        TEXT,
  created_at     INTEGER NOT NULL
);

-- ═══════════════ СЛУЖЕБНОЕ ═══════════════

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_cache (
  url_hash      TEXT PRIMARY KEY,
  media_id      TEXT,
  remote_url    TEXT NOT NULL,
  local_path    TEXT,
  bytes         INTEGER,
  state         TEXT NOT NULL DEFAULT 'pending',
  downloaded_at INTEGER,
  last_used_at  INTEGER
);

-- ═══════════════ ИНДЕКСЫ ═══════════════

CREATE INDEX IF NOT EXISTS idx_set_by_exercise      ON workout_set(workout_exercise_id, set_index);
CREATE INDEX IF NOT EXISTS idx_wexercise_by_session ON workout_exercise(session_id, position);
CREATE INDEX IF NOT EXISTS idx_wexercise_by_ex      ON workout_exercise(exercise_id);
CREATE INDEX IF NOT EXISTS idx_session_started      ON workout_session(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_status       ON workout_session(status);
CREATE INDEX IF NOT EXISTS idx_session_localdate    ON workout_session(local_date);
CREATE INDEX IF NOT EXISTS idx_pr_by_exercise       ON personal_record(exercise_id, kind, achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_by_date           ON personal_record(achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_name_ru     ON exercise(name_ru);
CREATE INDEX IF NOT EXISTS idx_exercise_family      ON exercise(family_id);
CREATE INDEX IF NOT EXISTS idx_exercise_popularity  ON exercise(popularity DESC);
CREATE INDEX IF NOT EXISTS idx_alias_name           ON exercise_alias(name);
CREATE INDEX IF NOT EXISTS idx_exmuscle_by_muscle   ON exercise_muscle(muscle, role);
CREATE INDEX IF NOT EXISTS idx_exequip              ON exercise_equipment(equipment);
CREATE INDEX IF NOT EXISTS idx_instruction_by_ex    ON exercise_instruction(exercise_id, position);
CREATE INDEX IF NOT EXISTS idx_template_ex          ON template_exercise(template_id, position);
CREATE INDEX IF NOT EXISTS idx_bw_date              ON body_weight_entry(local_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_message_chat      ON ai_message(chat_id, created_at);
`;

export async function up(db: Database): Promise<void> {
  await db.execAsync(SCHEMA_SQL);
}
