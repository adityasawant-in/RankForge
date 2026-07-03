import { useProject } from "../store/ProjectContext";
import { api } from "../api";
import { useState } from "react";

export default function Header() {
  const {
    project,
    projects,
    updateProject,
    saving,
    saveNow,
    undo,
    redo,
    canUndo,
    canRedo,
    selectProject,
    createNewProject,
    deleteProject
  } = useProject();
  
  const [exporting, setExporting] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);

  if (!project) return null;

  const handleExport = async () => {
    setExporting(true);
    try {
      await saveNow();
      const res = await fetch(`/api/export?projectId=${project.id}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to start export job");
      }
      const { jobId } = await res.json();
      
      // Poll for job completion
      await new Promise<void>((resolve, reject) => {
        const intervalId = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/export/status?jobId=${jobId}`);
            if (!statusRes.ok) {
              clearInterval(intervalId);
              reject(new Error("Failed to check export status"));
              return;
            }
            const job = await statusRes.json();
            if (job.status === "completed") {
              clearInterval(intervalId);
              
              const downloadUrl = `/api/export/download?jobId=${jobId}`;
              const link = document.createElement("a");
              link.href = downloadUrl;
              link.download = job.filename || `${project.name.replace(/\s+/g, "_")}.mp4`;
              document.body.appendChild(link);
              link.click();
              link.remove();
              resolve();
            } else if (job.status === "failed") {
              clearInterval(intervalId);
              reject(new Error(job.error || "Video compilation failed on server"));
            }
          } catch (err) {
            clearInterval(intervalId);
            reject(err);
          }
        }, 2000);
      });

    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to export video. Please make sure all video links are downloaded correctly.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <header className="h-14 bg-surface-dim border-b border-outline/30 flex items-center justify-between px-2 sm:px-4 z-50 shrink-0">
        <div className="flex items-center gap-2 sm:gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-xl">bolt</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">RankForge</h1>
          </div>
          
          <div className="h-6 w-px bg-outline/30 mx-1 hidden xs:block" />
          
          {/* Projects Switcher button */}
          <button
            type="button"
            onClick={() => setShowProjectsModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container border border-outline/20 hover:border-outline/40 hover:bg-surface-variant text-white transition-all text-[11px] sm:text-xs font-semibold"
          >
            <span className="material-symbols-outlined text-base text-primary">folder</span>
            <span className="hidden xs:inline">Projects ({projects.length})</span>
            <span className="inline xs:hidden">({projects.length})</span>
            <span className="material-symbols-outlined text-xs opacity-60">expand_more</span>
          </button>

          <div className="h-6 w-px bg-outline/30 mx-1 hidden md:block" />
          
          <div className="flex flex-col gap-0.5 hidden md:flex">
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Project Name</span>
            <div className="flex items-center gap-1.5 group/name">
              <input
                className="text-sm font-bold bg-surface-container/30 border border-outline/20 hover:border-outline/40 focus:border-primary/50 focus:bg-surface-container/70 rounded-lg px-2.5 py-1 outline-none text-white transition-all w-36 sm:w-48"
                value={project.name}
                onChange={(e) => updateProject({ name: e.target.value })}
              />
              <span className="material-symbols-outlined text-sm text-white/30 group-hover/name:text-white/60 transition-colors pointer-events-none">
                edit
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-[11px] text-on-surface-variant font-mono w-16 hidden lg:block text-right">{saving ? "Saving…" : "Saved"}</span>
          <div className="hidden sm:flex items-center bg-surface-container rounded-lg p-1 border border-outline/30">
            <button
              disabled={!canUndo}
              onClick={undo}
              className="p-1 hover:bg-surface-variant rounded text-on-surface-variant hover:text-white transition-colors disabled:opacity-30"
              title="Undo"
            >
              <span className="material-symbols-outlined text-xl">undo</span>
            </button>
            <button
              disabled={!canRedo}
              onClick={redo}
              className="p-1 hover:bg-surface-variant rounded text-on-surface-variant hover:text-white transition-colors disabled:opacity-30"
              title="Redo"
            >
              <span className="material-symbols-outlined text-xl">redo</span>
            </button>
          </div>
          <div className="h-6 w-px bg-outline/30 hidden sm:block" />
          <button
            onClick={saveNow}
            className="text-sm font-medium px-3.5 py-1.5 hover:bg-surface-container rounded-lg transition-all border border-outline/30 hidden sm:block"
          >
            Save
          </button>
          <button
            disabled={exporting}
            onClick={handleExport}
            className="bg-primary text-on-primary text-xs sm:text-sm font-bold px-3 sm:px-6 py-1.5 rounded-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 sm:gap-2 disabled:opacity-50"
          >
            {exporting ? (
              <>
                <span className="material-symbols-outlined text-base sm:text-lg animate-spin">sync</span>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base sm:text-lg">movie</span>
                <span>Export</span>
              </>
            )}
          </button>
          <div className="w-8 h-8 rounded-full bg-surface-variant border border-outline/50 flex items-center justify-center text-xs hidden md:flex">
            🧑
          </div>
        </div>
      </header>

      {/* Projects History Switcher Modal Overlay */}
      {showProjectsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline/25 rounded-2xl w-full max-w-xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline/15 bg-surface-dim">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">folder_shared</span>
                <h2 className="text-base font-bold text-white uppercase tracking-wider">Video Projects Library</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowProjectsModal(false)}
                className="p-1.5 hover:bg-surface-container rounded-lg text-on-surface-variant hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Modal Body / Scrollable Projects List */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="flex justify-between items-center pb-2">
                <span className="text-xs text-on-surface-variant/70 font-semibold uppercase tracking-wider">
                  Total Saved Projects: {projects.length}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await createNewProject();
                    setShowProjectsModal(false);
                  }}
                  className="flex items-center gap-1.5 bg-primary text-on-primary hover:brightness-110 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm font-bold">add</span>
                  <span>NEW PROJECT</span>
                </button>
              </div>

              <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
                {projects.map((p) => {
                  const isActive = p.id === project.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        selectProject(p.id);
                        setShowProjectsModal(false);
                      }}
                      className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all hover:bg-surface-container/60 hover:-translate-y-0.5 ${
                        isActive
                          ? "bg-primary/10 border-primary shadow-md shadow-primary/5"
                          : "bg-surface-container/30 border-outline/10"
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${isActive ? "text-primary" : "text-white"}`}>
                            {p.name}
                          </span>
                          {isActive && (
                            <span className="text-[9px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest leading-none">
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-on-surface-variant/50 font-mono">
                          Last Saved: {new Date(p.updatedAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectProject(p.id);
                            setShowProjectsModal(false);
                          }}
                          className="px-3 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-surface-variant border border-outline/35 hover:bg-surface-container-highest hover:text-white transition-colors"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`Are you sure you want to delete project "${p.name}"?`)) {
                              await deleteProject(p.id);
                            }
                          }}
                          className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-on-surface-variant/40 transition-colors"
                          title="Delete Project"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-surface-dim border-t border-outline/15 text-center">
              <p className="text-[10px] text-on-surface-variant/40 leading-normal max-w-xs mx-auto">
                RankForge automatically saves changes as you type. Creating a new project creates a fresh workspace workspace while preserving all other project templates.
              </p>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
