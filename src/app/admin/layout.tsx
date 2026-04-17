import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { sessions, users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("better-auth.session_token")?.value;

    if (!sessionToken) {
      console.log("[admin-layout] No session token found");
      redirect("/login");
    }

    const db = await getDb();
    if (!db) {
      console.error("[admin-layout] Database not available");
      redirect("/login");
    }

    // Find session by token
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
      console.log("[admin-layout] Session not found in database");
      redirect("/login");
    }

    const foundSession = session[0];

    // Check if session is expired
    if (new Date(foundSession.expiresAt) < new Date()) {
      console.log("[admin-layout] Session expired");
      redirect("/login");
    }

    console.log(
      "[admin-layout] Valid session for user:",
      foundSession.user.username,
    );
  } catch (error) {
    console.error("[admin-layout] Session check error:", error);
    redirect("/login");
  }

  return <>{children}</>;
}
