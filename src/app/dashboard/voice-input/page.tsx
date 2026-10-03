import { VoiceLogFlow } from "@/components/VoiceLogFlow";
import { isValidLogDate, todayIST } from "@/lib/date";

// A server page (rather than the client component reading the URL itself) so
// the starting date arrives as a plain prop — a client-side useSearchParams
// would force a Suspense boundary, and reading window.location in an
// initializer would hydrate differently from the server render.
export default async function VoiceInputPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const initialDate = isValidLogDate(date) ? date : todayIST();

  return <VoiceLogFlow initialDate={initialDate} />;
}
