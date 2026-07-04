import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { MediaAsset, Project, RankingBlock } from "../types";

interface Snapshot {
  project: Project;
  blocks: RankingBlock[];
}

interface Ctx {
  project: Project | null;
  projects: Project[];
  blocks: RankingBlock[];
  media: MediaAsset[];
  loading: boolean;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updateProject: (patch: Partial<Project>, opts?: { commit?: boolean }) => void;
  addBlock: () => Promise<void>;
  updateBlock: (id: string, patch: Partial<RankingBlock>) => void;
  deleteBlock: (id: string) => Promise<void>;
  splitBlock: (blockId: string, splitOffset: number) => Promise<void>;
  moveBlock: (id: string, direction: "up" | "down") => Promise<void>;
  uploadMedia: (file: File) => Promise<MediaAsset>;
  importMediaFromUrl: (url: string) => Promise<MediaAsset>;
  deleteMedia: (id: string) => Promise<void>;
  saveNow: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  reorderBlocks: (draggedId: string, hoverId: string) => Promise<void>;
  selectProject: (id: string) => Promise<void>;
  createNewProject: (name?: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

const ProjectCtx = createContext<Ctx | null>(null);

export function useProject() {
  const ctx = useContext(ProjectCtx);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem("auth_token"));
  const [username, setUsername] = useState<string | null>(localStorage.getItem("username"));
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [blocks, setBlocks] = useState<RankingBlock[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const history = useRef<Snapshot[]>([]);
  const historyIndex = useRef(-1);
  const [historyTick, setHistoryTick] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("username");
    localStorage.removeItem("activeProjectId");
    setUsername(null);
    setIsAuthenticated(false);
    setProject(null);
    setProjects([]);
    setBlocks([]);
    setMedia([]);
    history.current = [];
    historyIndex.current = -1;
  }, []);

  const login = useCallback(async (u: string, p: string) => {
    const res = await api.login(u, p);
    localStorage.setItem("auth_token", res.token);
    localStorage.setItem("username", res.username);
    setUsername(res.username);
    setIsAuthenticated(true);
  }, []);

  const register = useCallback(async (u: string, p: string) => {
    const res = await api.register(u, p);
    localStorage.setItem("auth_token", res.token);
    localStorage.setItem("username", res.username);
    setUsername(res.username);
    setIsAuthenticated(true);
  }, []);

  const pushHistory = useCallback((snap: Snapshot) => {
    const truncated = history.current.slice(0, historyIndex.current + 1);
    truncated.push(snap);
    if (truncated.length > 50) truncated.shift();
    history.current = truncated;
    historyIndex.current = truncated.length - 1;
    setHistoryTick((t) => t + 1);
  }, []);

  const createNewProject = useCallback(async (name?: string) => {
    setLoading(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      const created = await api.createProject(name || "New Video Project");
      setProjects((prev) => [...prev, created]);
      const defaultBlock = await api.createBlock({ projectId: created.id });
      setProject(created);
      setBlocks([defaultBlock]);
      localStorage.setItem("activeProjectId", created.id);
      history.current = [{ project: created, blocks: [defaultBlock] }];
      historyIndex.current = 0;
      setHistoryTick((t) => t + 1);
    } catch (err) {
      console.error("Failed to create new project:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectProject = useCallback(async (id: string) => {
    setLoading(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      const targetProj = await api.getProject(id);
      const b = await api.getBlocks(id);
      setProject(targetProj);
      setBlocks(b);
      localStorage.setItem("activeProjectId", id);
      history.current = [{ project: targetProj, blocks: b }];
      historyIndex.current = 0;
      setHistoryTick((t) => t + 1);
    } catch (err) {
      console.error("Failed to select project:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    try {
      await api.deleteProject(id);
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== id);
        if (project && project.id === id) {
          const nextActive = next[0];
          if (nextActive) {
            selectProject(nextActive.id);
          } else {
            createNewProject("funny babies movements");
          }
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  }, [project, createNewProject, selectProject]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    (async () => {
      try {
        let list = await api.getProjectsList();
        if (list.length === 0) {
          const defaultProj = await api.createProject("funny babies movements");
          list = [defaultProj];
        }
        setProjects(list);

        const storedId = localStorage.getItem("activeProjectId");
        const activeProj = list.find((p) => p.id === storedId) || list[0];
        setProject(activeProj);
        localStorage.setItem("activeProjectId", activeProj.id);

        const [b, m] = await Promise.all([
          api.getBlocks(activeProj.id),
          api.getMedia()
        ]);
        setBlocks(b);
        setMedia(m);

        history.current = [{ project: activeProj, blocks: b }];
        historyIndex.current = 0;
      } catch (err: any) {
        console.error("Initialization failed:", err);
        const msg = err.message || "";
        if (msg.includes("401") || msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("token")) {
          logout();
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, logout]);

  const persist = useCallback(async (p: Project, b: RankingBlock[]) => {
    setSaving(true);
    try {
      await api.updateProject(p.id, p);
      setProjects((prev) => prev.map((x) => (x.id === p.id ? p : x)));
      await Promise.all(
        b.map((blk) =>
          api.updateBlock(blk.id, {
            rank: blk.rank,
            title: blk.title,
            duration: blk.duration,
            mediaAssetId: blk.mediaAssetId,
            playbackSpeed: blk.playbackSpeed,
            trimStart: blk.trimStart,
            transitionType: blk.transitionType,
            transitionDuration: blk.transitionDuration
          })
        )
      );
    } finally {
      setSaving(false);
    }
  }, []);

  const scheduleSave = useCallback(
    (p: Project, b: RankingBlock[], commitHistory: boolean) => {
      if (commitHistory) pushHistory({ project: p, blocks: b });
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(p, b), 700);
    },
    [persist, pushHistory]
  );

  const updateProject = useCallback(
    (patch: Partial<Project>, opts?: { commit?: boolean }) => {
      setProject((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        scheduleSave(next, blocks, opts?.commit !== false);
        return next;
      });
    },
    [blocks, scheduleSave]
  );

  const updateBlock = useCallback(
    (id: string, patch: Partial<RankingBlock>) => {
      setBlocks((prev) => {
        const next = prev.map((b) => (b.id === id ? { ...b, ...patch } : b));
        if (project) scheduleSave(project, next, true);
        return next;
      });
    },
    [project, scheduleSave]
  );

  const addBlock = useCallback(async () => {
    if (!project) return;
    const created = await api.createBlock({ projectId: project.id });
    setBlocks((prev) => {
      const sorted = [...prev, created].sort((a, b) => a.rank - b.rank);
      const next = sorted.map((b, i) => {
        return { ...b, rank: i + 1 };
      });
      scheduleSave(project, next, true);
      return next;
    });
  }, [project, scheduleSave]);

  const deleteBlock = useCallback(
    async (id: string) => {
      await api.deleteBlock(id);
      setBlocks((prev) => {
        const filtered = prev.filter((b) => b.id !== id);
        const sorted = [...filtered].sort((a, b) => a.rank - b.rank);
        const next = sorted.map((b, i) => {
          return { ...b, rank: i + 1 };
        });
        if (project) scheduleSave(project, next, true);
        return next;
      });
    },
    [project, scheduleSave]
  );

  const splitBlock = useCallback(
    async (blockId: string, splitOffset: number) => {
      if (!project) return;
      const target = blocks.find((b) => b.id === blockId);
      if (!target) return;

      const speed = target.playbackSpeed || 1.0;
      const trimStart = target.trimStart || 0;

      const durationA = Number(splitOffset.toFixed(2));
      const durationB = Number((target.duration - splitOffset).toFixed(2));
      const trimStartB = Number((trimStart + splitOffset * speed).toFixed(2));

      // Update block A on backend
      await api.updateBlock(target.id, { duration: durationA });

      // Create block B on backend
      const created = await api.createBlock({
        projectId: project.id,
        title: target.title === `Ranking Block #${target.rank}`
          ? `Ranking Block #${target.rank + 1}`
          : target.title + " Part 2",
        duration: durationB,
        mediaAssetId: target.mediaAssetId,
        playbackSpeed: speed,
        trimStart: trimStartB,
        rank: target.rank + 1,
        transitionType: "none",
        transitionDuration: 0.5
      });

      // Shift ranks and update locally
      setBlocks((prev) => {
        const sorted = [...prev].sort((a, b) => a.rank - b.rank);
        const idx = sorted.findIndex((b) => b.id === blockId);
        
        // Update local A
        sorted[idx] = { ...target, duration: durationA };

        // Increment subsequent ranks
        for (let i = idx + 1; i < sorted.length; i++) {
          sorted[i].rank += 1;
        }

        // Insert B
        sorted.splice(idx + 1, 0, created);

        // Update ranks order on server
        api.reorderBlocks(project.id, sorted.map((b) => ({ id: b.id, rank: b.rank })));
        
        if (project) scheduleSave(project, sorted, true);
        return sorted;
      });
    },
    [project, blocks, scheduleSave]
  );

  const moveBlock = useCallback(
    async (id: string, direction: "up" | "down") => {
      if (!project) return;
      setBlocks((prev) => {
        const sorted = [...prev].sort((a, b) => a.rank - b.rank);
        const idx = sorted.findIndex((b) => b.id === id);
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return prev;
        const a = sorted[idx];
        const c = sorted[swapIdx];
        const tmp = a.rank;
        a.rank = c.rank;
        c.rank = tmp;
        const next = [...sorted].sort((x, y) => x.rank - y.rank);
        api.reorderBlocks(project.id, next.map((b) => ({ id: b.id, rank: b.rank })));
        pushHistory({ project, blocks: next });
        return next;
      });
    },
    [project, pushHistory]
  );

  const reorderBlocks = useCallback(
    async (draggedId: string, hoverId: string) => {
      if (!project) return;
      setBlocks((prev) => {
        const sorted = [...prev].sort((a, b) => a.rank - b.rank);
        const dragIdx = sorted.findIndex((b) => b.id === draggedId);
        const hoverIdx = sorted.findIndex((b) => b.id === hoverId);
        if (dragIdx === -1 || hoverIdx === -1 || dragIdx === hoverIdx) return prev;
        
        const result = [...sorted];
        const [removed] = result.splice(dragIdx, 1);
        result.splice(hoverIdx, 0, removed);
        
        const next = result.map((b, i) => {
          return { ...b, rank: i + 1 };
        });
        
        api.reorderBlocks(project.id, next.map((b) => ({ id: b.id, rank: b.rank })));
        pushHistory({ project, blocks: next });
        return next;
      });
    },
    [project, pushHistory]
  );

  const uploadMedia = useCallback(async (file: File) => {
    const asset = await api.uploadMedia(file);
    setMedia((prev) => [...prev, asset]);
    return asset;
  }, []);

  const importMediaFromUrl = useCallback(async (url: string) => {
    const asset = await api.importMediaFromUrl(url);
    setMedia((prev) => [...prev, asset]);
    return asset;
  }, []);

  const deleteMedia = useCallback(async (id: string) => {
    await api.deleteMedia(id);
    setMedia((prev) => prev.filter((m) => m.id !== id));
    setBlocks((prev) => prev.map((b) => (b.mediaAssetId === id ? { ...b, mediaAssetId: null } : b)));
    setProject((prev) => (prev && prev.backgroundMusicId === id ? { ...prev, backgroundMusicId: null } : prev));
  }, []);

  const saveNow = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (project) await persist(project, blocks);
  }, [project, blocks, persist]);

  const undo = useCallback(() => {
    if (historyIndex.current <= 0) return;
    historyIndex.current -= 1;
    const snap = history.current[historyIndex.current];
    setProject(snap.project);
    setBlocks(snap.blocks);
    persist(snap.project, snap.blocks);
    setHistoryTick((t) => t + 1);
  }, [persist]);

  const redo = useCallback(() => {
    if (historyIndex.current >= history.current.length - 1) return;
    historyIndex.current += 1;
    const snap = history.current[historyIndex.current];
    setProject(snap.project);
    setBlocks(snap.blocks);
    persist(snap.project, snap.blocks);
    setHistoryTick((t) => t + 1);
  }, [persist]);

  const value: Ctx = {
    project,
    projects,
    blocks,
    media,
    loading,
    saving,
    canUndo: historyIndex.current > 0,
    canRedo: historyIndex.current < history.current.length - 1,
    isAuthenticated,
    username,
    login,
    register,
    logout,
    updateProject,
    addBlock,
    updateBlock,
    deleteBlock,
    splitBlock,
    moveBlock,
    uploadMedia,
    importMediaFromUrl,
    deleteMedia,
    saveNow,
    undo,
    redo,
    reorderBlocks,
    selectProject,
    createNewProject,
    deleteProject
  };

  void historyTick;

  return <ProjectCtx.Provider value={value}>{children}</ProjectCtx.Provider>;
}
