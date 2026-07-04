import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { nanoid } from "nanoid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "db.json");

let pool = null;
if (process.env.DATABASE_URL) {
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("supabase")
      ? { rejectUnauthorized: false }
      : false
  });

  // Run automatic database schema migration
  (async () => {
    try {
      const client = await pool.connect();
      try {
        console.log("[DB] Running automatic database migrations...");
        
        // 1. Create users table
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            "passwordHash" VARCHAR(255) NOT NULL,
            "createdAt" BIGINT NOT NULL
          )
        `);

        // 2. Add userId to projects
        await client.query(`
          ALTER TABLE projects ADD COLUMN IF NOT EXISTS "userId" VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE
        `);

        // 3. Add userId to media
        await client.query(`
          ALTER TABLE media ADD COLUMN IF NOT EXISTS "userId" VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE
        `);
        
        console.log("[DB] Automatic migrations completed successfully!");
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("[DB] Automatic migrations failed:", err.message);
    }
  })();
}

function defaultData() {
  return {
    projects: [
      {
        id: "project-1",
        name: "Unexpected Trickshots 2024",
        videoTitle: "Ranking Best Unexpected Trickshots",
        titleFont: "Geist Bold",
        titleFontSize: 24,
        subtitleText: "Over Excited",
        subtitleEmoji: "😂",
        backgroundMusicId: null,
        totalDurationTarget: 15,
        headerBgColor: "#000000",
        highlightWords: "",
        highlightColor1: "#ff3333",
        highlightColor2: "#ffff33",
        highlightColor3: "#33ff33",
        highlightColor4: "#33ffff",
        subtitleFont: "Geist Bold",
        subtitleFontSize: 28,
        subtitleColor: "#ffff33",
        subtitleBgColor: "rgba(0,0,0,0.8)",
        rankListSpacing: 12,
        backdropOpacity: 45,
        backdropBlur: 20,
        rankListXPos: 20,
        rankListFontSize: 36,
        shuffleBlocks: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ],
    blocks: [
      { id: "blk-1", projectId: "project-1", rank: 1, title: "Water Bottle Flip Champion", duration: 12, mediaAssetId: null },
      { id: "blk-2", projectId: "project-1", rank: 2, title: "Ranking Block #2", duration: 10, mediaAssetId: null },
      { id: "blk-3", projectId: "project-1", rank: 3, title: "Ranking Block #3", duration: 10, mediaAssetId: null }
    ],
    media: []
  };
}

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const data = defaultData();
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      if (data.project && !data.projects) {
        data.projects = [data.project];
        delete data.project;
        data.blocks.forEach((b) => {
          if (!b.projectId) b.projectId = "project-1";
        });
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.error("Failed to migrate database schema:", err.message);
    }
  }
}

export async function readDb(userId) {
  if (pool) {
    try {
      const client = await pool.connect();
      try {
        // Query projects matching user, or system default project (NULL userId)
        const projectsRes = await client.query(
          'SELECT * FROM projects WHERE "userId" = $1 OR "userId" IS NULL', 
          [userId]
        );
        
        const projects = projectsRes.rows.map(r => ({
          id: r.id,
          name: r.name,
          videoTitle: r.videoTitle,
          titleFont: r.titleFont,
          titleFontSize: r.titleFontSize,
          titleYOffset: r.titleYOffset,
          subtitleText: r.subtitleText,
          subtitleEmoji: r.subtitleEmoji,
          backgroundMusicId: r.backgroundMusicId,
          totalDurationTarget: r.totalDurationTarget,
          headerBgColor: r.headerBgColor,
          highlightWords: r.highlightWords,
          highlightColor1: r.highlightColor1,
          highlightColor2: r.highlightColor2,
          highlightColor3: r.highlightColor3,
          highlightColor4: r.highlightColor4,
          subtitleFont: r.subtitleFont,
          subtitleFontSize: r.subtitleFontSize,
          subtitleColor: r.subtitleColor,
          subtitleBgColor: r.subtitleBgColor,
          subtitleYOffset: r.subtitleYOffset,
          rankListSpacing: r.rankListSpacing,
          backdropOpacity: r.backdropOpacity,
          backdropBlur: r.backdropBlur,
          rankListXPos: r.rankListXPos,
          rankListFontSize: r.rankListFontSize,
          shuffleBlocks: r.shuffleBlocks,
          createdAt: Number(r.createdAt),
          updatedAt: Number(r.updatedAt),
          userId: r.userId
        }));

        const projectIds = projects.map(p => p.id);
        
        let blocks = [];
        if (projectIds.length > 0) {
          const placeholders = projectIds.map((_, i) => `$${i + 1}`).join(',');
          const blocksRes = await client.query(`SELECT * FROM blocks WHERE "projectId" IN (${placeholders})`, projectIds);
          blocks = blocksRes.rows.map(r => ({
            id: r.id,
            projectId: r.projectId,
            rank: r.rank,
            title: r.title,
            duration: Number(r.duration),
            mediaAssetId: r.mediaAssetId,
            playbackSpeed: Number(r.playbackSpeed),
            trimStart: Number(r.trimStart),
            transitionType: r.transitionType,
            transitionDuration: Number(r.transitionDuration)
          }));
        }

        const mediaRes = await client.query(
          'SELECT * FROM media WHERE "userId" = $1 OR "userId" IS NULL',
          [userId]
        );
        const media = mediaRes.rows.map(r => ({
          id: r.id,
          projectId: r.projectId,
          name: r.name,
          type: r.type,
          url: r.url,
          mimetype: r.mimetype,
          createdAt: Number(r.createdAt),
          userId: r.userId
        }));

        return { projects, blocks, media };
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Postgres read failed:", err.message);
      throw err;
    }
  }

  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  const userProjects = (db.projects || []).filter(p => p.userId === userId || !p.userId);
  const userProjIds = userProjects.map(p => p.id);
  const userBlocks = (db.blocks || []).filter(b => userProjIds.includes(b.projectId));
  const userMedia = (db.media || []).filter(m => userProjIds.includes(m.projectId));

  return { projects: userProjects, blocks: userBlocks, media: userMedia };
}

export async function writeDb(data, userId) {
  if (pool) {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const userProjects = data.projects.filter(p => p.userId === userId || !p.userId);
        const projectIds = userProjects.map(p => p.id);

        if (projectIds.length > 0) {
          const placeholders = projectIds.map((_, i) => '$' + (i + 2)).join(',');
          await client.query(
            `DELETE FROM projects WHERE "userId" = $1 AND id NOT IN (${placeholders})`,
            [userId, ...projectIds]
          );
        } else {
          await client.query('DELETE FROM projects WHERE "userId" = $1', [userId]);
        }

        for (const p of userProjects) {
          const pUserId = p.userId || userId;
          await client.query(`
            INSERT INTO projects (
              id, name, "videoTitle", "titleFont", "titleFontSize", "titleYOffset",
              "subtitleText", "subtitleEmoji", "backgroundMusicId", "totalDurationTarget",
              "headerBgColor", "highlightWords", "highlightColor1", "highlightColor2",
              "highlightColor3", "highlightColor4",
              "subtitleFont", "subtitleFontSize", "subtitleColor", "subtitleBgColor", "subtitleYOffset",
              "rankListSpacing", "backdropOpacity", "backdropBlur", "rankListXPos",
              "rankListFontSize", "shuffleBlocks", "createdAt", "updatedAt", "userId"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              "videoTitle" = EXCLUDED."videoTitle",
              "titleFont" = EXCLUDED."titleFont",
              "titleFontSize" = EXCLUDED."titleFontSize",
              "titleYOffset" = EXCLUDED."titleYOffset",
              "subtitleText" = EXCLUDED."subtitleText",
              "subtitleEmoji" = EXCLUDED."subtitleEmoji",
              "backgroundMusicId" = EXCLUDED."backgroundMusicId",
              "totalDurationTarget" = EXCLUDED."totalDurationTarget",
              "headerBgColor" = EXCLUDED."headerBgColor",
              "highlightWords" = EXCLUDED."highlightWords",
              "highlightColor1" = EXCLUDED."highlightColor1",
              "highlightColor2" = EXCLUDED."highlightColor2",
              "highlightColor3" = EXCLUDED."highlightColor3",
              "highlightColor4" = EXCLUDED."highlightColor4",
              "subtitleFont" = EXCLUDED."subtitleFont",
              "subtitleFontSize" = EXCLUDED."subtitleFontSize",
              "subtitleColor" = EXCLUDED."subtitleColor",
              "subtitleBgColor" = EXCLUDED."subtitleBgColor",
              "subtitleYOffset" = EXCLUDED."subtitleYOffset",
              "rankListSpacing" = EXCLUDED."rankListSpacing",
              "backdropOpacity" = EXCLUDED."backdropOpacity",
              "backdropBlur" = EXCLUDED."backdropBlur",
              "rankListXPos" = EXCLUDED."rankListXPos",
              "rankListFontSize" = EXCLUDED."rankListFontSize",
              "shuffleBlocks" = EXCLUDED."shuffleBlocks",
              "createdAt" = EXCLUDED."createdAt",
              "updatedAt" = EXCLUDED."updatedAt",
              "userId" = EXCLUDED."userId"
          `, [
            p.id, p.name, p.videoTitle || '', p.titleFont || 'Geist Bold', p.titleFontSize || 24, p.titleYOffset || 0,
            p.subtitleText || '', p.subtitleEmoji || '', p.backgroundMusicId || null, p.totalDurationTarget || 15,
            p.headerBgColor || '#000000', p.highlightWords || '', p.highlightColor1 || '#ff3333', p.highlightColor2 || '#ffff33',
            p.highlightColor3 || '#33ff33', p.highlightColor4 || '#33ffff',
            p.subtitleFont || 'Geist Bold', p.subtitleFontSize || 28, p.subtitleColor || '#ffff33', p.subtitleBgColor || 'rgba(0,0,0,0.8)', p.subtitleYOffset || 0,
            p.rankListSpacing || 12, p.backdropOpacity || 45, p.backdropBlur || 20, p.rankListXPos || 20,
            p.rankListFontSize || 36, p.shuffleBlocks || false, p.createdAt || Date.now(), p.updatedAt || Date.now(), pUserId
          ]);
        }

        const userBlocks = data.blocks.filter(b => projectIds.includes(b.projectId));
        const blockIds = userBlocks.map(b => b.id);

        if (projectIds.length > 0) {
          const placeholders = projectIds.map((_, i) => '$' + (i + 1)).join(',');
          if (blockIds.length > 0) {
            const bPlaceholders = blockIds.map((_, i) => '$' + (i + 1 + projectIds.length)).join(',');
            await client.query(
              `DELETE FROM blocks WHERE "projectId" IN (${placeholders}) AND id NOT IN (${bPlaceholders})`,
              [...projectIds, ...blockIds]
            );
          } else {
            await client.query(`DELETE FROM blocks WHERE "projectId" IN (${placeholders})`, projectIds);
          }
        }

        for (const b of userBlocks) {
          await client.query(`
            INSERT INTO blocks (
              id, "projectId", rank, title, duration, "mediaAssetId", 
              "playbackSpeed", "trimStart", "transitionType", "transitionDuration"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
              "projectId" = EXCLUDED."projectId",
              rank = EXCLUDED.rank,
              title = EXCLUDED.title,
              duration = EXCLUDED.duration,
              "mediaAssetId" = EXCLUDED."mediaAssetId",
              "playbackSpeed" = EXCLUDED."playbackSpeed",
              "trimStart" = EXCLUDED."trimStart",
              "transitionType" = EXCLUDED."transitionType",
              "transitionDuration" = EXCLUDED."transitionDuration"
          `, [
            b.id, b.projectId, b.rank, b.title || '', b.duration || 10.0, b.mediaAssetId || null,
            b.playbackSpeed || 1.0, b.trimStart || 0.0, b.transitionType || 'none', b.transitionDuration || 0.5
          ]);
        }

        const userMedia = data.media.filter(m => m.userId === userId || !m.userId);
        const mediaIds = userMedia.map(m => m.id);

        if (mediaIds.length > 0) {
          const mPlaceholders = mediaIds.map((_, i) => '$' + (i + 2)).join(',');
          await client.query(
            `DELETE FROM media WHERE "userId" = $1 AND id NOT IN (${mPlaceholders})`,
            [userId, ...mediaIds]
          );
        } else {
          await client.query('DELETE FROM media WHERE "userId" = $1', [userId]);
        }

        for (const m of userMedia) {
          const mUserId = m.userId || userId;
          await client.query(`
            INSERT INTO media (
              id, "projectId", name, type, url, mimetype, "createdAt", "userId"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO UPDATE SET
              "projectId" = EXCLUDED."projectId",
              name = EXCLUDED.name,
              type = EXCLUDED.type,
              url = EXCLUDED.url,
              mimetype = EXCLUDED.mimetype,
              "createdAt" = EXCLUDED."createdAt",
              "userId" = EXCLUDED."userId"
          `, [
            m.id, m.projectId || null, m.name, m.type, m.url, m.mimetype, m.createdAt || Date.now(), mUserId
          ]);
        }

        await client.query('COMMIT');
        return data;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Postgres write failed:", err.message);
      throw err;
    }
  }

  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  
  data.projects.forEach(p => {
    if (!p.userId) p.userId = userId;
  });

  const otherProjects = (db.projects || []).filter(p => p.userId !== userId && p.userId);
  const otherProjIds = otherProjects.map(p => p.id);
  const otherMedia = (db.media || []).filter(m => m.userId !== userId && m.userId);

  db.projects = [...otherProjects, ...data.projects];
  db.blocks = [...(db.blocks || []).filter(b => !data.projects.map(p => p.id).includes(b.projectId)), ...data.blocks];
  db.media = [...otherMedia, ...data.media];

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  return data;
}

export async function findUserByUsername(username) {
  if (pool) {
    const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return res.rows[0] || null;
  }
  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  if (!db.users) db.users = [];
  return db.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
}

export async function createUser(username, passwordHash) {
  const id = "usr-" + nanoid(10);
  const user = { id, username, passwordHash, createdAt: Date.now() };

  if (pool) {
    await pool.query(
      'INSERT INTO users (id, username, "passwordHash", "createdAt") VALUES ($1, $2, $3, $4)',
      [id, username, passwordHash, user.createdAt]
    );
    return user;
  }

  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  if (!db.users) db.users = [];
  db.users.push(user);
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  return user;
}

const locks = new Map();

export function acquireLock(userId) {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  
  const current = locks.get(userId) || Promise.resolve();
  const next = current.then(() => release);
  locks.set(userId, promise);
  
  return current;
}
