PRAGMA foreign_keys = ON;

CREATE TABLE station_readings (
  id TEXT PRIMARY KEY,
  client_uuid TEXT NOT NULL UNIQUE,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE RESTRICT,
  pump_id TEXT REFERENCES pumps(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recorded_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  flow_meter REAL NOT NULL CHECK (flow_meter >= 0),
  energy_meter REAL NOT NULL CHECK (energy_meter >= 0),
  inlet_pressure REAL NOT NULL CHECK (inlet_pressure >= 0),
  outlet_pressure REAL NOT NULL CHECK (outlet_pressure >= 0),
  tank_level_pct REAL NOT NULL CHECK (tank_level_pct >= 0 AND tank_level_pct <= 100),
  residual_chlorine REAL CHECK (residual_chlorine IS NULL OR residual_chlorine >= 0),
  turbidity REAL CHECK (turbidity IS NULL OR turbidity >= 0),
  remarks TEXT,
  latitude REAL CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude REAL CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  gps_accuracy_m REAL CHECK (gps_accuracy_m IS NULL OR gps_accuracy_m >= 0),
  gps_status TEXT NOT NULL CHECK (gps_status IN ('CAPTURED', 'NOT_AVAILABLE', 'PERMISSION_DENIED', 'LOW_ACCURACY')),
  photo_key TEXT,
  source_type TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source_type IN ('MANUAL', 'SENSOR', 'SCADA', 'API')),
  sync_source TEXT NOT NULL DEFAULT 'ONLINE' CHECK (sync_source IN ('ONLINE', 'OFFLINE_QUEUE')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE INDEX readings_station ON station_readings(station_id);
CREATE INDEX readings_pump ON station_readings(pump_id);
CREATE INDEX readings_user ON station_readings(user_id);
CREATE INDEX readings_recorded_at ON station_readings(recorded_at);
CREATE INDEX readings_source_type ON station_readings(source_type);
CREATE INDEX readings_client_uuid ON station_readings(client_uuid);
