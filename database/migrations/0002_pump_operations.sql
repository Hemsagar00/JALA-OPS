PRAGMA foreign_keys = ON;

CREATE TABLE sop_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('START','STOP')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sop_items (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES sop_templates(id) ON DELETE RESTRICT,
  sequence_no INTEGER NOT NULL,
  label TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 1 CHECK (required IN (0,1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(template_id, sequence_no)
);

CREATE TABLE pump_operations (
  id TEXT PRIMARY KEY,
  client_uuid TEXT NOT NULL UNIQUE,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  pump_id TEXT NOT NULL REFERENCES pumps(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('START','STOP')),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','COMPLETED','CANCELLED')),
  started_at TEXT NOT NULL,
  stopped_at TEXT,
  opening_flow_meter REAL NOT NULL CHECK (opening_flow_meter >= 0),
  closing_flow_meter REAL CHECK (closing_flow_meter IS NULL OR closing_flow_meter >= opening_flow_meter),
  opening_energy_meter REAL NOT NULL CHECK (opening_energy_meter >= 0),
  closing_energy_meter REAL CHECK (closing_energy_meter IS NULL OR closing_energy_meter >= opening_energy_meter),
  inlet_pressure_start REAL,
  inlet_pressure_stop REAL,
  outlet_pressure_start REAL,
  outlet_pressure_stop REAL,
  tank_level_start REAL,
  tank_level_stop REAL,
  shutdown_reason TEXT,
  remarks TEXT,
  running_duration_seconds INTEGER,
  water_pumped REAL,
  energy_used_kwh REAL,
  energy_per_unit REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE INDEX operations_station ON pump_operations(station_id);
CREATE INDEX operations_pump ON pump_operations(pump_id);
CREATE INDEX operations_user ON pump_operations(user_id);
CREATE INDEX operations_started_at ON pump_operations(started_at);
CREATE INDEX operations_stopped_at ON pump_operations(stopped_at);
CREATE INDEX operations_status ON pump_operations(status);
CREATE UNIQUE INDEX idx_pump_active_operation ON pump_operations(pump_id) WHERE status = 'ACTIVE';

CREATE TABLE sop_responses (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES pump_operations(id) ON DELETE RESTRICT,
  sop_item_id TEXT NOT NULL REFERENCES sop_items(id) ON DELETE RESTRICT,
  response INTEGER NOT NULL CHECK (response IN (0,1)),
  remarks TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(operation_id, sop_item_id)
);
CREATE INDEX sop_resp_op ON sop_responses(operation_id);

INSERT INTO sop_templates (id, name, operation_type) VALUES
  ('sop-tpl-start', 'Standard Operating Checklist — Start Pump', 'START'),
  ('sop-tpl-stop', 'Standard Operating Checklist — Stop Pump', 'STOP');

INSERT INTO sop_items (id, template_id, sequence_no, label, required) VALUES
  ('sop-item-s1', 'sop-tpl-start', 1, 'Lubrication / oil condition checked', 1),
  ('sop-item-s2', 'sop-tpl-start', 2, 'Electrical panel normal', 1),
  ('sop-item-s3', 'sop-tpl-start', 3, 'Suction condition normal', 1),
  ('sop-item-s4', 'sop-tpl-start', 4, 'Discharge valve position confirmed', 1),
  ('sop-item-s5', 'sop-tpl-start', 5, 'No visible leakage', 1),
  ('sop-item-s6', 'sop-tpl-start', 6, 'Flow meter available', 1),
  ('sop-item-s7', 'sop-tpl-start', 7, 'Energy meter available', 1),
  ('sop-item-s8', 'sop-tpl-start', 8, 'Pressure gauges normal', 1),
  ('sop-item-e1', 'sop-tpl-stop', 1, 'Closing readings captured', 1),
  ('sop-item-e2', 'sop-tpl-stop', 2, 'Abnormal sound/vibration checked', 1),
  ('sop-item-e3', 'sop-tpl-stop', 3, 'Leakage checked', 1),
  ('sop-item-e4', 'sop-tpl-stop', 4, 'Shutdown reason recorded where required', 1);
