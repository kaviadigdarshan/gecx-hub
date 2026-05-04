import { useState } from "react";
import type { ExtractedField } from "@/types/sourceContext";
import { ImportContextButton } from "@/components/common/ImportContextButton";
import PythonToolTab from "./PythonToolTab";
import OpenAPIToolTab from "./OpenAPIToolTab";

type ActiveTab = "python" | "openapi";

export default function ToolsConfiguratorPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("python");

  const handleFieldsExtracted = (_fields: ExtractedField[]) => {
    // Future: apply extracted fields to tab forms
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab("python")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "python"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Python Code
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("openapi")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "openapi"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Open API
          </button>
        </div>
        <ImportContextButton
          targetAccelerator="tools"
          onFieldsExtracted={handleFieldsExtracted}
        />
      </div>

      <div className="pt-2">
        {activeTab === "python" ? <PythonToolTab /> : <OpenAPIToolTab />}
      </div>
    </div>
  );
}
