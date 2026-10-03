import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

// Remembers "this user already has a profile row" so the middleware doesn't
// re-query the database on every single request. It's only a hint to skip a
// redundant check — it holds the user's own id and nothing sensitive, and a
// forged value could at worst skip the onboarding redirect for someone who
// then can't save anything anyway (every write has a foreign key to the
// profile row), so it grants no access to anything.
const ONBOARDED_COOKIE = "vpc_onboarded";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isRootPath = pathname === "/";
  const isOnboardingPath = pathname === "/onboarding";

  // Redirects must carry any cookies Supabase just refreshed on
  // supabaseResponse, or a token refresh is silently dropped on redirect.
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c));
    return response;
  };

  if (!user && !isPublicPath && !isRootPath) {
    return redirectTo("/login");
  }

  // Enforce onboarding completion for every protected path, not just the
  // two entry points (email signup, OAuth callback) that happened to
  // redirect there directly. Found via code review: a Google OAuth sign-in
  // (and an email signup under email-confirmation) landed straight on
  // /dashboard with no public.users row ever created, and every write in
  // the app has a foreign key to that row — so "Confirm & save" failed with
  // a generic error for every such vendor, with no indication why. This
  // check is the single place that can't be bypassed by a bookmark, a
  // closed onboarding tab, or a different entry path.
  if (user && !isPublicPath && !isRootPath) {
    let hasProfile = request.cookies.get(ONBOARDED_COOKIE)?.value === user.id;

    if (!hasProfile) {
      const { data: profile } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      hasProfile = !!profile;

      if (hasProfile) {
        supabaseResponse.cookies.set(ONBOARDED_COOKIE, user.id, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      }
    }

    if (!hasProfile && !isOnboardingPath) return redirectTo("/onboarding");
    if (hasProfile && isOnboardingPath) return redirectTo("/dashboard");
  }

  return supabaseResponse;
}
