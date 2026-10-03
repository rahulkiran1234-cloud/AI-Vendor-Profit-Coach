import { LoadingSpinner } from "@/components/LoadingSpinner";

// Shown instantly while a dashboard page's data loads on the server. Without
// this, navigating between pages showed nothing at all until the server had
// finished every query — on a slower connection that read as "the app froze".
export default function DashboardLoading() {
  return <LoadingSpinner label="Loading…" />;
}
