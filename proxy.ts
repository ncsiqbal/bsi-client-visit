
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isLoginPage = request.nextUrl.pathname === "/login";
  const isDashboardPage =
    request.nextUrl.pathname.startsWith("/dashboard");

  if (!supabaseUrl || !supabaseKey) {
    if (isDashboardPage) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return response;
  }

  // Simpan perubahan cookie dan header dari Supabase
  // agar bisa diteruskan juga ke respons redirect.
  const pendingCookies = new Map<
    string,
    {
      name: string;
      value: string;
      options: Parameters<typeof response.cookies.set>[2];
    }
  >();

  const pendingHeaders = new Map<string, string>();

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);

            // Pertahankan nilai kosong dan opsi penghapusan cookie.
            pendingCookies.set(name, { name, value, options });
          });

          Object.entries(headers).forEach(([name, value]) => {
            pendingHeaders.set(name, value);
          });

          response = NextResponse.next({ request });

          pendingCookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          pendingHeaders.forEach((value, name) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    if (isDashboardPage) {
      const redirectResponse = NextResponse.redirect(
        new URL("/login", request.url),
      );

      pendingCookies.forEach(({ name, value, options }) => {
        redirectResponse.cookies.set(name, value, options);
      });

      pendingHeaders.forEach((value, name) => {
        redirectResponse.headers.set(name, value);
      });

      return redirectResponse;
    }

    return response;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  const hasValidProfile =
    !profileError &&
    profile !== null &&
    profile.is_active === true &&
    ["sales", "supervisor", "management", "admin"].includes(
      profile.role,
    );

  if (!hasValidProfile) {
    await supabase.auth.signOut();

    const redirectResponse = NextResponse.redirect(
      new URL("/login?error=account_unavailable", request.url),
    );

    pendingCookies.forEach(({ name, value, options }) => {
      redirectResponse.cookies.set(name, value, options);
    });

    pendingHeaders.forEach((value, name) => {
      redirectResponse.headers.set(name, value);
    });

    return redirectResponse;
  }

  if (isLoginPage) {
    const redirectResponse = NextResponse.redirect(
      new URL("/dashboard", request.url),
    );

    pendingCookies.forEach(({ name, value, options }) => {
      redirectResponse.cookies.set(name, value, options);
    });

    pendingHeaders.forEach((value, name) => {
      redirectResponse.headers.set(name, value);
    });

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/login", "/dashboard/:path*"],
};
