import { useState, useRef, useCallback, useEffect } from "react";
import { RefreshCw, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { apiClient } from "@/services/api";
import type { ScaffoldContext } from "@/types/scaffoldContext";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TaskModuleCardData {
  name: string;
  trigger: string;
  action: string;
  /** The exact original XML string used to splice updates back into the instruction */
  originalRaw: string;
}

interface RegenerateTaskResponse {
  task_module_xml: string;
  task_module: { name: string; trigger: string; action: string };
  demo_mode: boolean;
}

interface TaskModuleEditorProps {
  instruction: string;
  onChange: (newInstruction: string) => void;
  agentId: string;
  agentName: string;
  vertical: string;
  scaffoldContext?: ScaffoldContext | null;
}

// ── Autocomplete ───────────────────────────────────────────────────────────────

interface AutocompleteItem {
  label: string;
  insertText: string;
  section: "SESSION VARS" | "AGENTS" | "TOOLS";
}

function buildItems(scaffoldContext: ScaffoldContext | null | undefined): AutocompleteItem[] {
  const items: AutocompleteItem[] = [];
  for (const v of scaffoldContext?.variableDeclarations ?? []) {
    items.push({ label: v.name, insertText: `{${v.name}}`, section: "SESSION VARS" });
  }
  for (const a of scaffoldContext?.agents ?? []) {
    items.push({ label: a.name, insertText: `{${a.name}}`, section: "AGENTS" });
  }
  for (const t of scaffoldContext?.tools ?? []) {
    items.push({ label: t.id, insertText: `{${t.id}}`, section: "TOOLS" });
  }
  for (const ts of scaffoldContext?.toolsets ?? []) {
    items.push({ label: ts.id, insertText: `{${ts.id}}`, section: "TOOLS" });
  }
  return items;
}

interface AutocompleteState {
  open: boolean;
  query: string;
  triggerPos: number; // index of the '{' that opened the popup
  selectedIndex: number;
}

function useReferenceAutocomplete(
  value: string,
  onChange: (val: string) => void,
  items: AutocompleteItem[]
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [ac, setAc] = useState<AutocompleteState>({
    open: false,
    query: "",
    triggerPos: -1,
    selectedIndex: 0,
  });

  const filtered = ac.open
    ? items.filter((it) => it.label.toLowerCase().includes(ac.query.toLowerCase()))
    : [];

  const close = useCallback(() => {
    setAc((s) => ({ ...s, open: false, query: "", triggerPos: -1, selectedIndex: 0 }));
  }, []);

  const insert = useCallback(
    (item: AutocompleteItem) => {
      const ta = textareaRef.current;
      if (!ta || ac.triggerPos < 0) return;
      // Replace from '{' through current cursor with the full insert text
      const before = value.slice(0, ac.triggerPos);
      const after = value.slice(ta.selectionStart);
      const next = before + item.insertText + after;
      onChange(next);
      // Move cursor to end of inserted text
      const newCaret = ac.triggerPos + item.insertText.length;
      requestAnimationFrame(() => {
        ta.setSelectionRange(newCaret, newCaret);
        ta.focus();
      });
      close();
    },
    [value, onChange, ac.triggerPos, close]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!ac.open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAc((s) => ({ ...s, selectedIndex: Math.min(s.selectedIndex + 1, filtered.length - 1) }));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setAc((s) => ({ ...s, selectedIndex: Math.max(s.selectedIndex - 1, 0) }));
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (filtered.length > 0) {
          e.preventDefault();
          insert(filtered[ac.selectedIndex]);
        } else {
          close();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    },
    [ac.open, ac.selectedIndex, filtered, insert, close]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value;
      onChange(newVal);
      const caret = e.target.selectionStart ?? 0;
      // Find the most recent '{' before the caret that hasn't been closed
      const textBeforeCaret = newVal.slice(0, caret);
      const lastOpen = textBeforeCaret.lastIndexOf("{");
      if (lastOpen !== -1 && !textBeforeCaret.slice(lastOpen).includes("}")) {
        const query = textBeforeCaret.slice(lastOpen + 1);
        setAc({ open: true, query, triggerPos: lastOpen, selectedIndex: 0 });
      } else {
        if (ac.open) close();
      }
    },
    [onChange, ac.open, close]
  );

  return { textareaRef, ac, filtered, handleKeyDown, handleChange, insert, close };
}

const SECTION_ORDER: AutocompleteItem["section"][] = ["SESSION VARS", "AGENTS", "TOOLS"];

function ReferenceDropdown({
  items,
  selectedIndex,
  onSelect,
}: {
  items: AutocompleteItem[];
  selectedIndex: number;
  onSelect: (item: AutocompleteItem) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (items.length === 0) {
    return (
      <div className="absolute z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg py-2 px-3 text-xs text-gray-400">
        No matches
      </div>
    );
  }

  const sections = SECTION_ORDER.filter((s) => items.some((i) => i.section === s));

  return (
    <div
      ref={listRef}
      className="absolute z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg max-h-52 overflow-y-auto"
    >
      {sections.map((section) => (
        <div key={section}>
          <div className="px-3 pt-2 pb-0.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
            {section}
          </div>
          {items
            .filter((it) => it.section === section)
            .map((item) => {
              const globalIdx = items.indexOf(item);
              return (
                <button
                  key={item.insertText}
                  data-idx={globalIdx}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep textarea focus
                    onSelect(item);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-mono transition ${
                    globalIdx === selectedIndex
                      ? "bg-gecx-50 text-gecx-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {item.insertText}
                </button>
              );
            })}
        </div>
      ))}
    </div>
  );
}

interface ReferenceTextareaProps {
  value: string;
  onChange: (val: string) => void;
  rows?: number;
  placeholder?: string;
  items: AutocompleteItem[];
  ariaLabel?: string;
}

function ReferenceTextarea({ value, onChange, rows = 2, placeholder, items, ariaLabel }: ReferenceTextareaProps) {
  const { textareaRef, ac, filtered, handleKeyDown, handleChange, insert } =
    useReferenceAutocomplete(value, onChange, items);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={rows}
        aria-label={ariaLabel}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 font-mono placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 resize-none transition"
        placeholder={placeholder}
      />
      {ac.open && (
        <ReferenceDropdown items={filtered} selectedIndex={ac.selectedIndex} onSelect={insert} />
      )}
    </div>
  );
}

// ── Parsing helpers ────────────────────────────────────────────────────────────

function parseTaskModules(instruction: string): TaskModuleCardData[] {
  // Handles both <task_module> and <task_module name="...">
  const re = /<task_module([^>]*)>([\s\S]*?)<\/task_module>/g;
  const modules: TaskModuleCardData[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(instruction)) !== null) {
    const attrs = match[1];
    const body = match[2];
    const nameMatch = /name="([^"]*)"/.exec(attrs);
    const triggerMatch = /<trigger>([\s\S]*?)<\/trigger>/.exec(body);
    const actionMatch = /<action>([\s\S]*?)<\/action>/.exec(body);
    modules.push({
      name: nameMatch?.[1] ?? "",
      trigger: triggerMatch?.[1]?.trim() ?? body.trim(),
      action: actionMatch?.[1]?.trim() ?? "",
      originalRaw: match[0],
    });
  }
  return modules;
}

function serializeModule(m: TaskModuleCardData): string {
  return (
    `<task_module name="${m.name}">\n` +
    `  <trigger>${m.trigger}</trigger>\n` +
    `  <action>${m.action}</action>\n` +
    `</task_module>`
  );
}

function applyModuleUpdates(
  instruction: string,
  originalRaws: string[],
  updatedModules: TaskModuleCardData[]
): string {
  let result = instruction;
  originalRaws.forEach((raw, i) => {
    result = result.replace(raw, serializeModule(updatedModules[i]));
  });
  return result;
}

function deleteModule(instruction: string, originalRaw: string): string {
  return instruction.replace(originalRaw, "").replace(/\n{3,}/g, "\n\n").trim();
}

// ── Card component ─────────────────────────────────────────────────────────────

function TaskModuleCard({
  module,
  index,
  agentId,
  agentName,
  vertical,
  scaffoldContext,
  onUpdate,
  onDelete,
}: {
  module: TaskModuleCardData;
  index: number;
  agentId: string;
  agentName: string;
  vertical: string;
  scaffoldContext?: ScaffoldContext | null;
  onUpdate: (updated: TaskModuleCardData) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const acItems = buildItems(scaffoldContext);

  const set = (field: keyof Omit<TaskModuleCardData, "originalRaw">, val: string) =>
    onUpdate({ ...module, [field]: val });

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setRegenError(null);
    try {
      const res = await apiClient.post<RegenerateTaskResponse>(
        "/accelerators/instructions/regenerate-task",
        {
          agent_id: agentId,
          agent_name: agentName,
          vertical,
          task_index: index,
          task_title: module.name,
        }
      );
      const { task_module } = res.data;
      onUpdate({
        ...module,
        name: task_module.name,
        trigger: task_module.trigger,
        action: task_module.action,
      });
    } catch {
      setRegenError("Regeneration failed — check your connection and try again.");
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <span className="w-5 h-5 rounded-full bg-gecx-100 text-gecx-700 text-[10px] font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>

        <input
          type="text"
          value={module.name}
          onChange={(e) => set("name", e.target.value)}
          className="flex-1 bg-transparent font-mono text-sm font-medium text-gray-700 focus:outline-none focus:ring-0 min-w-0"
          placeholder="taskModuleName"
          aria-label="Task module name"
        />

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            title="Regenerate this task module with AI"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-gecx-600 hover:bg-gecx-50 border border-gecx-200 disabled:opacity-50 transition"
          >
            <RefreshCw size={11} className={isRegenerating ? "animate-spin" : ""} />
            {isRegenerating ? "Regenerating…" : "Regenerate"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Remove this task module"
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition"
          >
            <Trash2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Card body */}
      {expanded && (
        <div className="p-4 space-y-3">
          {regenError && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {regenError}
            </p>
          )}

          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Trigger
            </label>
            <ReferenceTextarea
              value={module.trigger}
              onChange={(val) => set("trigger", val)}
              rows={2}
              placeholder="Condition that activates this task… (type { to insert a reference)"
              items={acItems}
              ariaLabel="Task module trigger"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Action
            </label>
            <ReferenceTextarea
              value={module.action}
              onChange={(val) => set("action", val)}
              rows={2}
              placeholder="What the agent should do… (type { to insert a reference)"
              items={acItems}
              ariaLabel="Task module action"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── TaskModuleEditor ───────────────────────────────────────────────────────────

export default function TaskModuleEditor({
  instruction,
  onChange,
  agentId,
  agentName,
  vertical,
  scaffoldContext,
}: TaskModuleEditorProps) {
  const parsed = parseTaskModules(instruction);

  if (parsed.length === 0) return null;

  // Keep the original raw strings stable for replacement — they come from the
  // instruction prop so no local state needed.
  const originalRaws = parsed.map((m) => m.originalRaw);

  const handleUpdate = (index: number, updated: TaskModuleCardData) => {
    const updatedModules = parsed.map((m, i) => (i === index ? updated : m));
    onChange(applyModuleUpdates(instruction, originalRaws, updatedModules));
  };

  const handleDelete = (index: number) => {
    onChange(deleteModule(instruction, parsed[index].originalRaw));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">Task Modules</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          {parsed.length} module{parsed.length !== 1 ? "s" : ""} · edit inline or regenerate with AI
        </p>
      </div>

      <div className="p-4 space-y-3">
        {parsed.map((module, i) => (
          <TaskModuleCard
            key={`${module.name}-${i}`}
            module={module}
            index={i}
            agentId={agentId}
            agentName={agentName}
            vertical={vertical}
            scaffoldContext={scaffoldContext}
            onUpdate={(updated) => handleUpdate(i, updated)}
            onDelete={() => handleDelete(i)}
          />
        ))}
      </div>
    </div>
  );
}
