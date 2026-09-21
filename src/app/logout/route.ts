import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAuthClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return new NextResponse("Unable to sign out. Please try again.", { status: 503 });
  (await cookies()).delete("tcs_session");
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
