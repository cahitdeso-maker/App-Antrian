import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { sessions, users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

// Server-functie die een NEXT_REDIRECT naar /login gooit. Deze wordt NIET in een
// try/catch gevangen, zodat Next.js de redirect correct kan afhandelen.
function gotoLogin(): never {
  redirect("/login");
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("antrian.session_token")?.value;

    if (!sessionToken) {
      console.error("[admin-layout] STEP=NO_TOKEN (cookie antrian.session_token ontbreekt)");
      return gotoLogin();
    }
    console.log("[admin-layout] STEP=TOKEN_OK len=" + sessionToken.length);

    const db = await getDb();
    if (!db) {
      console.error("[admin-layout] STEP=NO_DB (geen database verbinding)");
      return gotoLogin();
    }

    // Find session by token
    console.log("[admin-layout] STEP=QUERY token=" + sessionToken);
    const session = await db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        user: users,
      })
      .from(sessions)
      .where(eq(sessions.token, sessionToken))
      .innerJoin(users, eq(sessions.userId, users.id))
      .limit(1);

    if (session.length === 0) {
      console.error("[admin-layout] STEP=NO_SESSION: token=" + sessionToken);
      return gotoLogin();
    }

    const foundSession = session[0];
    console.log(
      "[admin-layout] STEP=SESSION_FOUND expiresAt=" + foundSession.expiresAt + " now=" + new Date().toISOString()
    );

    // Check if session is expired
    if (new Date(foundSession.expiresAt).getTime() < Date.now()) {
      console.error("[admin-layout] STEP=EXPIRED: expiresAt=" + foundSession.expiresAt);
      return gotoLogin();
    }

    console.log("[admin-layout] STEP=VALID user=" + foundSession.user.username);
  } catch (error) {
    // errors anders dan NEXT_REDIRECT doorgeven voor debugging
    const err = error as Error & { digest?: string };
    if (err.digest && err.digest.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("[admin-layout] STEP=THREW:", error);
    return gotoLogin();
  }

  return <>{children}</>;
}
