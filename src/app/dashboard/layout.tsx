import { NavBar } from "@/components/NavBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      <NavBar />
      <div className="flex flex-1 flex-col">
        <ErrorBoundary>
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6 sm:px-8 sm:py-10">
            {children}
          </main>
        </ErrorBoundary>
      </div>
    </div>
  );
}
