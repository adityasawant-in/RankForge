import { MediaAsset, Project, RankingBlock } from "./types";

export const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "") || "/api";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: options?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options
  });
  if (!res.ok) {
    let errMsg = `Request failed: ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson && errJson.error) errMsg = errJson.error;
    } catch {}
    throw new Error(errMsg);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export const api = {
  getProjectsList: () => req<Project[]>("/project/list"),
  getProject: (id: string) => req<Project>(`/project/${id}`),
  createProject: (name?: string) => req<Project>("/project", { method: "POST", body: JSON.stringify({ name }) }),
  updateProject: (id: string, data: Partial<Project>) => req<Project>(`/project/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProject: (id: string) => req<void>(`/project/${id}`, { method: "DELETE" }),

  getBlocks: (projectId: string) => req<RankingBlock[]>(`/blocks?projectId=${projectId}`),
  createBlock: (data: Partial<RankingBlock> & { projectId: string }) => req<RankingBlock>("/blocks", { method: "POST", body: JSON.stringify(data) }),
  updateBlock: (id: string, data: Partial<RankingBlock>) => req<RankingBlock>(`/blocks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteBlock: (id: string) => req<void>(`/blocks/${id}`, { method: "DELETE" }),
  reorderBlocks: (projectId: string, order: { id: string; rank: number }[]) => req<RankingBlock[]>(`/blocks/reorder?projectId=${projectId}`, { method: "POST", body: JSON.stringify({ order }) }),

  getMedia: () => req<MediaAsset[]>("/media"),
  uploadMedia: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", file.name);
    return req<MediaAsset>("/media/upload", { method: "POST", body: fd });
  },
  importMediaFromUrl: (url: string) => req<MediaAsset>("/media/import-url", { method: "POST", body: JSON.stringify({ url }) }),
  deleteMedia: (id: string) => req<void>(`/media/${id}`, { method: "DELETE" }),

  exportManifest: (projectId: string) => `${BASE}/export?projectId=${projectId}`
};

export function getAssetUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  const apiBase = import.meta.env.VITE_API_URL || "";
  const serverRoot = apiBase.replace(/\/api\/?$/, "").replace(/\/$/, "");
  return `${serverRoot}${url}`;
}
