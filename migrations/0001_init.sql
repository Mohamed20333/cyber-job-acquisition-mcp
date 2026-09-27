CREATE TABLE IF NOT EXISTS candidate_profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  education TEXT,
  target_roles TEXT NOT NULL,
  locations TEXT,
  verified_skills TEXT NOT NULL,
  projects TEXT,
  certifications TEXT,
  experience TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  external_id TEXT,
  canonical_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  remote INTEGER DEFAULT 0,
  description TEXT,
  posted_at TEXT,
  discovered_at TEXT NOT NULL,
  verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'DISCOVERED',
  match_score INTEGER,
  match_evidence TEXT,
  verification_evidence TEXT,
  last_checked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opportunities_status
ON opportunities(status);

CREATE INDEX IF NOT EXISTS idx_opportunities_company
ON opportunities(company);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER,
  name TEXT NOT NULL,
  company TEXT,
  role TEXT,
  public_profile_url TEXT,
  source TEXT,
  evidence TEXT,
  status TEXT NOT NULL DEFAULT 'RESEARCHED',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(opportunity_id) REFERENCES opportunities(id)
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  applied_at TEXT,
  cv_shared INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(opportunity_id) REFERENCES opportunities(id)
);

CREATE TABLE IF NOT EXISTS followups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER,
  contact_id INTEGER,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  message TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(opportunity_id) REFERENCES opportunities(id),
  FOREIGN KEY(contact_id) REFERENCES contacts(id)
);

CREATE TABLE IF NOT EXISTS discovery_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  sources TEXT,
  discovered_count INTEGER DEFAULT 0,
  new_count INTEGER DEFAULT 0,
  verified_count INTEGER DEFAULT 0,
  error TEXT
);