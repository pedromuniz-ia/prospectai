import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { StatusBar } from "@/components/status-bar";
import { UserNav } from "@/components/user-nav";
import { NotificationBell } from "@/components/notification-bell";
import { CommandPalette } from "@/components/command-palette";
import { OnboardingGuard } from "@/components/onboarding-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingGuard>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
            <MobileSidebar />
            <span className="md:hidden font-display text-lg tracking-tight">
              ProspectAI
            </span>
            <div className="ml-auto flex items-center gap-2">
              <NotificationBell />
              <UserNav />
            </div>
          </header>
          <StatusBar />
          <main id="main-content" className="flex-1 overflow-auto">{children}</main>
          <CommandPalette />
        </div>
      </div>
    </OnboardingGuard>
  );
}
