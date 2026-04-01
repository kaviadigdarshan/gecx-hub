import Topbar from "@/components/layout/Topbar";
import Sidebar from "@/components/layout/Sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Topbar />
      {/* pt-16 offsets the fixed TopBar */}
      <div className="flex flex-1 overflow-hidden pt-16">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
