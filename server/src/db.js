import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "db.json");

let pool = null;
if (process.env.DATABASE_URL) {
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("supabase.co")
      ? { rejectUnauthorized: false }
      : false
  });
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

export async function readDb() {
  if (pool) {
    try {
      const client = await pool.connect();
      try {
        const projectsRes = await client.query('SELECT * FROM projects');
        const blocksRes = await client.query('SELECT * FROM blocks');
        const mediaRes = await client.query('SELECT * FROM media');
        
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
          updatedAt: Number(r.updatedAt)
        }));

        const blocks = blocksRes.rows.map(r => ({
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

        const media = mediaRes.rows.map(r => ({
          id: r.id,
          projectId: r.projectId,
          name: r.name,
          type: r.type,
          url: r.url,
          mimetype: r.mimetype,
          createdAt: Number(r.createdAt)
        }));

        return { projects, blocks, media };
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Postgres read failed, falling back to local JSON:", err.message);
    }
  }

  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

export async function writeDb(data) {
  if (pool) {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const projectIds = data.projects.map(p => p.id);
        if (projectIds.length > 0) {
          await client.query('DELETE FROM projects WHERE id NOT IN (' + projectIds.map((_, i) => '$' + (i + 1)).join(',') + ')', projectIds);
        } else {
          await client.query('DELETE FROM projects');
        }

        for (const p of data.projects) {
          await client.query(`
            INSERT INTO projects (
              id, name, "videoTitle", "titleFont", "titleFontSize", "titleYOffset",
              "subtitleText", "subtitleEmoji", "backgroundMusicId", "totalDurationTarget",
              "headerBgColor", "highlightWords", "highlightColor1", "highlightColor2",
              "subtitleFont", "subtitleFontSize", "subtitleColor", "subtitleBgColor", "subtitleYOffset",
              "rankListSpacing", "backdropOpacity", "backdropBlur", "rankListXPos",
              "rankListFontSize", "shuffleBlocks", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
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
              "updatedAt" = EXCLUDED."updatedAt"
          `, [
            p.id, p.name, p.videoTitle || '', p.titleFont || 'Geist Bold', p.titleFontSize || 24, p.titleYOffset || 0,
            p.subtitleText || '', p.subtitleEmoji || '', p.backgroundMusicId || null, p.totalDurationTarget || 15,
            p.headerBgColor || '#000000', p.highlightWords || '', p.highlightColor1 || '#ff3333', p.highlightColor2 || '#ffff33',
            p.subtitleFont || 'Geist Bold', p.subtitleFontSize || 28, p.subtitleColor || '#ffff33', p.subtitleBgColor || 'rgba(0,0,0,0.8)', p.subtitleYOffset || 0,
            p.rankListSpacing || 12, p.backdropOpacity || 45, p.backdropBlur || 20, p.rankListXPos || 20,
            p.rankListFontSize || 36, p.shuffleBlocks || false, p.createdAt || Date.now(), p.updatedAt || Date.now()
          ]);
        }

        const blockIds = data.blocks.map(b => b.id);
        if (blockIds.length > 0) {
          await client.query('DELETE FROM blocks WHERE id NOT IN (' + blockIds.map((_, i) => '$' + (i + 1)).join(',') + ')', blockIds);
        } else {
          await client.query('DELETE FROM blocks');
        }

        for (const b of data.blocks) {
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

        const mediaIds = data.media.map(m => m.id);
        if (mediaIds.length > 0) {
          await client.query('DELETE FROM media WHERE id NOT IN (' + mediaIds.map((_, i) => '$' + (i + 1)).join(',') + ')', mediaIds);
        } else {
          await client.query('DELETE FROM media');
        }

        for (const m of data.media) {
          await client.query(`
            INSERT INTO media (
              id, "projectId", name, type, url, mimetype, "createdAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
              "projectId" = EXCLUDED."projectId",
              name = EXCLUDED.name,
              type = EXCLUDED.type,
              url = EXCLUDED.url,
              mimetype = EXCLUDED.mimetype,
              "createdAt" = EXCLUDED."createdAt"
          `, [
            m.id, m.projectId, m.name, m.type, m.url, m.mimetype, m.createdAt || Date.now()
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
      console.error("Postgres write failed, falling back to local JSON:", err.message);
    }
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  return data;
}
