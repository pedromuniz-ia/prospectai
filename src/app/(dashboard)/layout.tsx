import { Sidebar } from "@/components/sidebar";
import { StatusBar } from "@/components/status-bar";
import { UserNav } from "@/components/user-nav";
import { NotificationBell } from "@/components/notification-bell";
import { CommandPalette } from "@/components/command-palette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-end gap-2 border-b border-border px-4">
          <NotificationBell />
          <UserNav />
        </header>
        <StatusBar />
        <main className="flex-1 overflow-auto">{children}</main>
        <CommandPalette />
      </div>
    </div>
  );
}
