import { Router } from "express";
import { nanoid } from "nanoid";
import { readDb, writeDb } from "../db.js";

const router = Router();

function normalizeRanks(db, projectId) {
  const projectBlocks = db.blocks.filter(b => b.projectId === projectId);
  projectBlocks.sort((a, b) => a.rank - b.rank);
  projectBlocks.forEach((b, idx) => {
    b.rank = idx + 1;
  });
}

router.get("/", async (req, res) => {
  const db = await readDb();
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: "projectId is required" });
  normalizeRanks(db, projectId);
  await writeDb(db);
  const filtered = db.blocks.filter(b => b.projectId === projectId).sort((a, b) => a.rank - b.rank);
  res.json(filtered);
});

router.post("/", async (req, res) => {
  const db = await readDb();
  const projectId = req.body.projectId || req.query.projectId;
  if (!projectId) return res.status(400).json({ error: "projectId is required" });
  const projectBlocks = db.blocks.filter(b => b.projectId === projectId);
  const maxRank = projectBlocks.reduce((m, b) => Math.max(m, b.rank), 0);
  const block = {
    id: "blk-" + nanoid(8),
    projectId,
    rank: req.body.rank || maxRank + 1,
    title: req.body.title || `Ranking Block #${maxRank + 1}`,
    duration: req.body.duration || 10,
    mediaAssetId: req.body.mediaAssetId || null,
    playbackSpeed: req.body.playbackSpeed || 1.0,
    trimStart: req.body.trimStart || 0,
    transitionType: req.body.transitionType || "none",
    transitionDuration: req.body.transitionDuration || 0.5
  };
  db.blocks.push(block);
  normalizeRanks(db, projectId);
  await writeDb(db);
  const savedBlock = db.blocks.find((b) => b.id === block.id);
  res.status(201).json(savedBlock || block);
});

router.put("/:id", async (req, res) => {
  const db = await readDb();
  const idx = db.blocks.findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Block not found" });
  const projectId = db.blocks[idx].projectId;
  db.blocks[idx] = { ...db.blocks[idx], ...req.body, id: db.blocks[idx].id };
  normalizeRanks(db, projectId);
  await writeDb(db);
  const updatedBlock = db.blocks.find((b) => b.id === req.params.id);
  res.json(updatedBlock || db.blocks[idx]);
});

router.delete("/:id", async (req, res) => {
  const db = await readDb();
  const block = db.blocks.find(b => b.id === req.params.id);
  if (!block) return res.status(404).json({ error: "Block not found" });
  const { projectId } = block;
  db.blocks = db.blocks.filter((b) => b.id !== req.params.id);
  normalizeRanks(db, projectId);
  await writeDb(db);
  res.status(204).end();
});

// bulk reorder: [{id, rank}, ...]
router.post("/reorder", async (req, res) => {
  const db = await readDb();
  const projectId = req.body.projectId || req.query.projectId;
  if (!projectId) return res.status(400).json({ error: "projectId is required" });
  const order = req.body.order || [];
  order.forEach(({ id, rank }) => {
    const b = db.blocks.find((x) => x.id === id);
    if (b) b.rank = rank;
  });
  normalizeRanks(db, projectId);
  await writeDb(db);
  const filtered = db.blocks.filter(b => b.projectId === projectId).sort((a, b) => a.rank - b.rank);
  res.json(filtered);
});

export default router;
