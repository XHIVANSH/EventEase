DROP TABLE IF EXISTS registrations;
DROP TABLE IF EXISTS participants;
DROP TABLE IF EXISTS events;

CREATE TABLE events (
  event_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL CHECK (category IN ('TECH', 'CULTURAL', 'SPORTS')),
  venue      TEXT NOT NULL,
  event_date TEXT NOT NULL,             
  start_time TEXT NOT NULL,              
  end_time   TEXT NOT NULL,
  capacity   INTEGER NOT NULL CHECK (capacity > 0),
  fee        INTEGER NOT NULL DEFAULT 0 CHECK (fee >= 0),
  CHECK (end_time > start_time)
);

CREATE TABLE participants (
  participant_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL,
  email   TEXT NOT NULL UNIQUE,
  college TEXT NOT NULL,
  phone   TEXT
);

CREATE TABLE registrations (
  reg_id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id       INTEGER NOT NULL REFERENCES events(event_id),
  participant_id INTEGER NOT NULL REFERENCES participants(participant_id),
  status         TEXT NOT NULL CHECK (status IN ('CONFIRMED', 'WAITLISTED', 'CANCELLED', 'CHECKED_IN')),
  ticket_code    TEXT UNIQUE,
  registered_at  TEXT NOT NULL
);

CREATE UNIQUE INDEX one_active_registration
  ON registrations (event_id, participant_id) WHERE status <> 'CANCELLED';

CREATE INDEX idx_reg_event ON registrations (event_id, status);
CREATE INDEX idx_reg_participant ON registrations (participant_id, status);
