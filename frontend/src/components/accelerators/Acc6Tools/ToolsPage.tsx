import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Database,
  Link2,
  Package,
  Download,
  X,
  Check,
} from "lucide-react";
import { apiClient } from "@/services/api";
import { useProjectStore } from "@/store/projectStore";
import { useScaffoldContext } from "@/hooks/useScaffoldContext";
import type { ToolDefinition, ToolsetDefinition } from "@/types/scaffoldContext";

type ActiveTab = "datastore" | "openapi";

interface TemplateSet {
  vertical: string;
  tools: ToolDefinition[];
  toolsets: ToolsetDefinition[];
}

interface TemplatesResponse {
  templates: TemplateSet[];
}

interface AddDatastoreForm {
  id: string;
  dataStoreName: string;
}

interface AddOpenApiForm {
  id: string;
  openApiUrl: string;
}

interface AddToolsetForm {
  id: string;
  openApiUrl: string;
  toolIds: string[];
}

const EMPTY_DATASTORE_FORM: AddDatastoreForm = { id: "", dataStoreName: "" };
const EMPTY_OPENAPI_FORM: AddOpenApiForm = { id: "", openApiUrl: "" };
const EMPTY_TOOLSET_FORM: AddToolsetForm = { id: "", openApiUrl: "", toolIds: [] };

export default function ToolsPage() {
  const { scaffoldContext } = useProjectStore();
  const { saveContext } = useScaffoldContext();

  const [tools, setTools] = useState<ToolDefinition[]>(
    scaffoldContext?.tools ?? []
  );
  const [toolsets, setToolsets] = useState<ToolsetDefinition[]>(
    scaffoldContext?.toolsets ?? []
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>("datastore");

  const [showAddDatastore, setShowAddDatastore] = useState(false);
  const [showAddOpenApi, setShowAddOpenApi] = useState(false);
  const [showAddToolset, setShowAddToolset] = useState(false);

  const [datastoreForm, setDatastoreForm] =
    useState<AddDatastoreForm>(EMPTY_DATASTORE_FORM);
  const [openApiForm, setOpenApiForm] =
    useState<AddOpenApiForm>(EMPTY_OPENAPI_FORM);
  const [toolsetForm, setToolsetForm] =
    useState<AddToolsetForm>(EMPTY_TOOLSET_FORM);

  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<TemplateSet[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync from context when scaffoldId changes (new scaffold loaded)
  useEffect(() => {
    setTools(scaffoldContext?.tools ?? []);
    setToolsets(scaffoldContext?.toolsets ?? []);
  }, [scaffoldContext?.scaffoldId]);

  const datastoreTools = tools.filter((t) => t.type === "DATASTORE");
  const openApiTools = tools.filter((t) => t.type === "OPENAPI");

  // ── Datastore Tools ──────────────────────────────────────────────────────────

  const addDatastoreTool = () => {
    if (!datastoreForm.id.trim() || !datastoreForm.dataStoreName.trim()) return;
    const newTool: ToolDefinition = {
      id: datastoreForm.id.trim(),
      type: "DATASTORE",
      datastoreSource: { dataStoreName: datastoreForm.dataStoreName.trim() },
    };
    setTools((prev) => [...prev, newTool]);
    setDatastoreForm(EMPTY_DATASTORE_FORM);
    setShowAddDatastore(false);
  };

  const addOpenApiTool = () => {
    if (!openApiForm.id.trim() || !openApiForm.openApiUrl.trim()) return;
    const newTool: ToolDefinition = {
      id: openApiForm.id.trim(),
      type: "OPENAPI",
      openApiUrl: openApiForm.openApiUrl.trim(),
    };
    setTools((prev) => [...prev, newTool]);
    setOpenApiForm(EMPTY_OPENAPI_FORM);
    setShowAddOpenApi(false);
  };

  const removeTool = (id: string) => {
    setTools((prev) => prev.filter((t) => t.id !== id));
    setToolsets((prev) =>
      prev.map((ts) => ({
        ...ts,
        toolIds: ts.toolIds.filter((tid) => tid !== id),
      }))
    );
  };

  // ── Toolsets ─────────────────────────────────────────────────────────────────

  const addToolset = () => {
    if (!toolsetForm.id.trim() || !toolsetForm.openApiUrl.trim()) return;
    const newToolset: ToolsetDefinition = {
      id: toolsetForm.id.trim(),
      openApiUrl: toolsetForm.openApiUrl.trim(),
      toolIds: toolsetForm.toolIds,
    };
    setToolsets((prev) => [...prev, newToolset]);
    setToolsetForm(EMPTY_TOOLSET_FORM);
    setShowAddToolset(false);
  };

  const removeToolset = (id: string) => {
    setToolsets((prev) => prev.filter((ts) => ts.id !== id));
  };

  const toggleToolsetToolId = (toolId: string) => {
    setToolsetForm((prev) => ({
      ...prev,
      toolIds: prev.toolIds.includes(toolId)
        ? prev.toolIds.filter((id) => id !== toolId)
        : [...prev.toolIds, toolId],
    }));
  };

  // ── Templates ────────────────────────────────────────────────────────────────

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await apiClient.get<TemplatesResponse>(
        "/accelerators/tools/templates"
      );
      setTemplates(res.data.templates);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
      setShowTemplates(true);
    }
  };

  const importTemplate = (tpl: TemplateSet) => {
    const existingToolIds = new Set(tools.map((t) => t.id));
    const existingToolsetIds = new Set(toolsets.map((ts) => ts.id));
    setTools((prev) => [
      ...prev,
      ...tpl.tools.filter((t) => !existingToolIds.has(t.id)),
    ]);
    setToolsets((prev) => [
      ...prev,
      ...tpl.toolsets.filter((ts) => !existingToolsetIds.has(ts.id)),
    ]);
    setShowTemplates(false);
  };

  // ── Save & Sync ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!scaffoldContext) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await apiClient.post("/accelerators/tools/save", { tools, toolsets });
      await saveContext({ ...scaffoldContext, tools, toolsets });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError("Failed to save. Changes stored locally — try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={loadTemplates}
          disabled={loadingTemplates}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <Download size={14} />
          {loadingTemplates ? "Loading…" : "Load Templates"}
        </button>
        <div className="flex items-center gap-3">
          {saveError && (
            <span className="text-sm text-red-600">{saveError}</span>
          )}
          {saveSuccess && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <Check size={14} /> Saved
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !scaffoldContext}
            className="inline-flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg bg-gecx-600 text-white hover:bg-gecx-700 transition disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save & Sync"}
          </button>
        </div>
      </div>

      {/* Section A — Tools */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Tools</h2>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {(["datastore", "openapi"] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition",
                activeTab === tab
                  ? "border-gecx-600 text-gecx-700"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              {tab === "datastore" ? (
                <Database size={14} />
              ) : (
                <Link2 size={14} />
              )}
              {tab === "datastore" ? "Datastore Tools" : "OpenAPI Tools"}
              <span className="ml-1 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                {tab === "datastore" ? datastoreTools.length : openApiTools.length}
              </span>
            </button>
          ))}
        </div>

        {/* Datastore Tools panel */}
        {activeTab === "datastore" && (
          <div className="space-y-2">
            {datastoreTools.length === 0 && !showAddDatastore && (
              <p className="text-sm text-gray-400 italic py-2">
                No datastore tools defined yet.
              </p>
            )}
            {datastoreTools.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-mono font-medium text-gray-800 truncate block">
                    {tool.id}
                  </span>
                  <span className="text-gray-500 truncate block text-xs mt-0.5">
                    {tool.datastoreSource?.dataStoreName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeTool(tool.id)}
                  className="ml-3 shrink-0 text-gray-400 hover:text-red-500 transition"
                  title="Delete tool"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {showAddDatastore && (
              <div className="p-3 rounded-lg border border-gecx-200 bg-gecx-50 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. FAQ_BQ_Datastore_v3"
                      value={datastoreForm.id}
                      onChange={(e) =>
                        setDatastoreForm((f) => ({ ...f, id: e.target.value }))
                      }
                      className="w-full text-sm px-2.5 py-1.5 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gecx-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Data Store Name
                    </label>
                    <input
                      type="text"
                      placeholder="projects/…/locations/…/collections/…"
                      value={datastoreForm.dataStoreName}
                      onChange={(e) =>
                        setDatastoreForm((f) => ({
                          ...f,
                          dataStoreName: e.target.value,
                        }))
                      }
                      className="w-full text-sm px-2.5 py-1.5 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gecx-400"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={addDatastoreTool}
                    className="text-sm px-3 py-1 rounded-md bg-gecx-600 text-white hover:bg-gecx-700 transition"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddDatastore(false);
                      setDatastoreForm(EMPTY_DATASTORE_FORM);
                    }}
                    className="text-sm px-3 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!showAddDatastore && (
              <button
                type="button"
                onClick={() => setShowAddDatastore(true)}
                className="flex items-center gap-1.5 text-sm text-gecx-600 hover:text-gecx-700 transition mt-1"
              >
                <Plus size={14} /> Add Datastore Tool
              </button>
            )}
          </div>
        )}

        {/* OpenAPI Tools panel */}
        {activeTab === "openapi" && (
          <div className="space-y-2">
            {openApiTools.length === 0 && !showAddOpenApi && (
              <p className="text-sm text-gray-400 italic py-2">
                No OpenAPI tools defined yet.
              </p>
            )}
            {openApiTools.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-mono font-medium text-gray-800 truncate block">
                    {tool.id}
                  </span>
                  <span className="text-gray-500 truncate block text-xs mt-0.5">
                    {tool.openApiUrl}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeTool(tool.id)}
                  className="ml-3 shrink-0 text-gray-400 hover:text-red-500 transition"
                  title="Delete tool"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {showAddOpenApi && (
              <div className="p-3 rounded-lg border border-gecx-200 bg-gecx-50 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. order_management_api"
                      value={openApiForm.id}
                      onChange={(e) =>
                        setOpenApiForm((f) => ({ ...f, id: e.target.value }))
                      }
                      className="w-full text-sm px-2.5 py-1.5 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gecx-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      OpenAPI URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://api.example.com/openapi.json"
                      value={openApiForm.openApiUrl}
                      onChange={(e) =>
                        setOpenApiForm((f) => ({
                          ...f,
                          openApiUrl: e.target.value,
                        }))
                      }
                      className="w-full text-sm px-2.5 py-1.5 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gecx-400"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={addOpenApiTool}
                    className="text-sm px-3 py-1 rounded-md bg-gecx-600 text-white hover:bg-gecx-700 transition"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddOpenApi(false);
                      setOpenApiForm(EMPTY_OPENAPI_FORM);
                    }}
                    className="text-sm px-3 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!showAddOpenApi && (
              <button
                type="button"
                onClick={() => setShowAddOpenApi(true)}
                className="flex items-center gap-1.5 text-sm text-gecx-600 hover:text-gecx-700 transition mt-1"
              >
                <Plus size={14} /> Add OpenAPI Tool
              </button>
            )}
          </div>
        )}
      </section>

      {/* Section B — Toolsets */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Toolsets</h2>
        <div className="space-y-2">
          {toolsets.length === 0 && !showAddToolset && (
            <p className="text-sm text-gray-400 italic py-2">
              No toolsets defined yet.
            </p>
          )}
          {toolsets.map((ts) => (
            <div
              key={ts.id}
              className="flex items-start justify-between px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50 text-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Package size={13} className="text-gray-400 shrink-0" />
                  <span className="font-mono font-medium text-gray-800">
                    {ts.id}
                  </span>
                </div>
                <span className="text-gray-500 text-xs mt-0.5 block">
                  {ts.openApiUrl}
                </span>
                {ts.toolIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ts.toolIds.map((tid) => (
                      <span
                        key={tid}
                        className="text-[10px] bg-gecx-100 text-gecx-700 px-1.5 py-0.5 rounded-full font-mono"
                      >
                        {tid}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToolset(ts.id)}
                className="ml-3 shrink-0 text-gray-400 hover:text-red-500 transition"
                title="Delete toolset"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {showAddToolset && (
            <div className="p-3 rounded-lg border border-gecx-200 bg-gecx-50 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. cancel_order"
                    value={toolsetForm.id}
                    onChange={(e) =>
                      setToolsetForm((f) => ({ ...f, id: e.target.value }))
                    }
                    className="w-full text-sm px-2.5 py-1.5 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gecx-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    OpenAPI URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://api.example.com/openapi.json"
                    value={toolsetForm.openApiUrl}
                    onChange={(e) =>
                      setToolsetForm((f) => ({
                        ...f,
                        openApiUrl: e.target.value,
                      }))
                    }
                    className="w-full text-sm px-2.5 py-1.5 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gecx-400"
                  />
                </div>
              </div>
              {tools.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Tool IDs
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {tools.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleToolsetToolId(t.id)}
                        className={[
                          "text-xs font-mono px-2 py-1 rounded-md border transition",
                          toolsetForm.toolIds.includes(t.id)
                            ? "bg-gecx-600 text-white border-gecx-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gecx-400",
                        ].join(" ")}
                      >
                        {t.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={addToolset}
                  className="text-sm px-3 py-1 rounded-md bg-gecx-600 text-white hover:bg-gecx-700 transition"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddToolset(false);
                    setToolsetForm(EMPTY_TOOLSET_FORM);
                  }}
                  className="text-sm px-3 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!showAddToolset && (
            <button
              type="button"
              onClick={() => setShowAddToolset(true)}
              className="flex items-center gap-1.5 text-sm text-gecx-600 hover:text-gecx-700 transition mt-1"
            >
              <Plus size={14} /> Add Toolset
            </button>
          )}
        </div>
      </section>

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">
                Tool Templates by Vertical
              </h3>
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {templates.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-8">
                  No templates available.
                </p>
              ) : (
                templates.map((tpl) => (
                  <div
                    key={tpl.vertical}
                    className="rounded-lg border border-gray-100 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700 capitalize">
                        {tpl.vertical}
                      </h4>
                      <button
                        type="button"
                        onClick={() => importTemplate(tpl)}
                        className="text-xs px-3 py-1 rounded-md bg-gecx-600 text-white hover:bg-gecx-700 transition"
                      >
                        Import
                      </button>
                    </div>
                    <div className="space-y-1">
                      {tpl.tools.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-2 text-xs text-gray-500"
                        >
                          {t.type === "DATASTORE" ? (
                            <Database size={11} />
                          ) : (
                            <Link2 size={11} />
                          )}
                          <span className="font-mono">{t.id}</span>
                          <span className="text-gray-400">({t.type})</span>
                        </div>
                      ))}
                    </div>
                    {tpl.toolsets.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {tpl.toolsets.map((ts) => (
                          <div
                            key={ts.id}
                            className="flex items-center gap-2 text-xs text-gray-500"
                          >
                            <Package size={11} />
                            <span className="font-mono">{ts.id}</span>
                            <span className="text-gray-400">(toolset)</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
