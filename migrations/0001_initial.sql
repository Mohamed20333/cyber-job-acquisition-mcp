CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  url TEXT NOT NULL,
  location TEXT,
  source TEXT NOT NULL,
  remote INTEGER NOT NULL DEFAULT 0,
  fit_score INTEGER,
  matched_skills TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'DISCOVERED',
  recruiter TEXT,
  recruiter_url TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opportunities_status
  ON opportunities(status);

CREATE INDEX IF NOT EXISTS idx_opportunities_company
  ON opportunities(company);

CREATE INDEX IF NOT EXISTS idx_opportunities_fit_score
  ON opportunities(fit_score);
