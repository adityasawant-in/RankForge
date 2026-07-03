-- RankForge PostgreSQL Schema for Supabase with Case-Sensitive Column Names

-- Drop tables if they exist
DROP TABLE IF EXISTS media CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- Create Projects Table
CREATE TABLE projects (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  "videoTitle" TEXT DEFAULT '',
  "titleFont" VARCHAR(100) DEFAULT 'Geist Bold',
  "titleFontSize" INTEGER DEFAULT 24,
  "titleYOffset" INTEGER DEFAULT 0,
  "subtitleText" VARCHAR(255) DEFAULT '',
  "subtitleEmoji" VARCHAR(10) DEFAULT '',
  "backgroundMusicId" VARCHAR(255) DEFAULT NULL,
  "totalDurationTarget" INTEGER DEFAULT 15,
  "headerBgColor" VARCHAR(50) DEFAULT '#000000',
  "highlightWords" TEXT DEFAULT '',
  "highlightColor1" VARCHAR(50) DEFAULT '#ff3333',
  "highlightColor2" VARCHAR(50) DEFAULT '#ffff33',
  "subtitleFont" VARCHAR(100) DEFAULT 'Geist Bold',
  "subtitleFontSize" INTEGER DEFAULT 28,
  "subtitleColor" VARCHAR(50) DEFAULT '#ffff33',
  "subtitleBgColor" VARCHAR(50) DEFAULT 'rgba(0,0,0,0.8)',
  "subtitleYOffset" INTEGER DEFAULT 0,
  "rankListSpacing" INTEGER DEFAULT 12,
  "backdropOpacity" INTEGER DEFAULT 45,
  "backdropBlur" INTEGER DEFAULT 20,
  "rankListXPos" INTEGER DEFAULT 20,
  "rankListFontSize" INTEGER DEFAULT 36,
  "shuffleBlocks" BOOLEAN DEFAULT FALSE,
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT NOT NULL
);

-- Create Blocks Table
CREATE TABLE blocks (
  id VARCHAR(255) PRIMARY KEY,
  "projectId" VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  title VARCHAR(255) DEFAULT '',
  duration REAL DEFAULT 10.0,
  "mediaAssetId" VARCHAR(255) DEFAULT NULL,
  "playbackSpeed" REAL DEFAULT 1.0,
  "trimStart" REAL DEFAULT 0.0,
  "transitionType" VARCHAR(50) DEFAULT 'none',
  "transitionDuration" REAL DEFAULT 0.5
);

-- Create Media Table
CREATE TABLE media (
  id VARCHAR(255) PRIMARY KEY,
  "projectId" VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  url TEXT NOT NULL,
  mimetype VARCHAR(100) NOT NULL,
  "createdAt" BIGINT NOT NULL
);

-- Insert Default Project seed
INSERT INTO projects (
  id, name, "videoTitle", "titleFont", "titleFontSize", "titleYOffset", 
  "subtitleText", "subtitleEmoji", "totalDurationTarget", "headerBgColor", 
  "highlightWords", "highlightColor1", "highlightColor2", "subtitleFont", 
  "subtitleFontSize", "subtitleColor", "subtitleBgColor", "subtitleYOffset", 
  "rankListSpacing", "backdropOpacity", "backdropBlur", "rankListXPos", 
  "rankListFontSize", "shuffleBlocks", "createdAt", "updatedAt"
) VALUES (
  'project-1', 
  'Unexpected Trickshots 2024', 
  'Ranking Best Unexpected Trickshots', 
  'Geist Bold', 24, 0, 
  'Over Excited', '😂', 15, '#000000', 
  '', '#ff3333', '#ffff33', 'Geist Bold', 
  28, '#ffff33', 'rgba(0,0,0,0.8)', 0, 
  12, 45, 20, 20, 
  36, FALSE, 1783060492117, 1783060492117
) ON CONFLICT (id) DO NOTHING;

-- Insert default blocks for the default project
INSERT INTO blocks (id, "projectId", rank, title, duration, "mediaAssetId", "playbackSpeed", "trimStart", "transitionType", "transitionDuration") VALUES
  ('blk-1', 'project-1', 1, 'Water Bottle Flip Champion', 12.0, NULL, 1.0, 0.0, 'none', 0.5),
  ('blk-2', 'project-1', 2, 'Ranking Block #2', 10.0, NULL, 1.0, 0.0, 'none', 0.5),
  ('blk-3', 'project-1', 3, 'Ranking Block #3', 10.0, NULL, 1.0, 0.0, 'none', 0.5)
ON CONFLICT (id) DO NOTHING;
