PRAGMA foreign_keys = ON;

CREATE TABLE roles (
  code TEXT PRIMARY KEY CHECK (code IN ('OPERATOR','TECHNICIAN','AE','DE','EE','SE','COLLECTOR','SYSTEM_ADMIN')),
  name TEXT NOT NULL UNIQUE
);
INSERT INTO roles VALUES
 ('OPERATOR','Operator'),('TECHNICIAN','Technician'),('AE','Assistant Engineer'),
 ('DE','Deputy Executive Engineer'),('EE','Executive Engineer'),('SE','Superintending Engineer'),
 ('COLLECTOR','Collector / District Administration'),('SYSTEM_ADMIN','System Administrator');

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT,
  role_code TEXT NOT NULL REFERENCES roles(code) ON DELETE RESTRICT,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (active = 0 OR password_hash IS NOT NULL)
);
CREATE INDEX users_role_active ON users(role_code, active);

CREATE TABLE stations (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  locality TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE user_station_assignments (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, station_id)
);
CREATE INDEX assignments_station ON user_station_assignments(station_id, user_id);

CREATE TABLE pumps (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  rated_power_kw REAL NOT NULL CHECK (rated_power_kw > 0),
  capacity_m3_h REAL NOT NULL CHECK (capacity_m3_h > 0),
  status TEXT NOT NULL DEFAULT 'STOPPED' CHECK (status IN ('STOPPED','RUNNING','BREAKDOWN','MAINTENANCE')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX pumps_station_status ON pumps(station_id, status);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  revoked_at INTEGER
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  before_json TEXT CHECK (before_json IS NULL OR json_valid(before_json)),
  after_json TEXT CHECK (after_json IS NULL OR json_valid(after_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX audit_entity_time ON audit_logs(entity_type, entity_id, created_at);
CREATE INDEX audit_actor_time ON audit_logs(actor_id, created_at);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT, 'Audit records are immutable'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT, 'Audit records are immutable'); END;
