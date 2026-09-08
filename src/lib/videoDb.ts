import { asc, eq } from 'drizzle-orm';
import { getDb } from './db';
import { youtubeVideos } from './schema';

// Data access untuk YouTube playlist. Video-config blijft de "bron van waarheid"
// voor de actieve playback state (type, activeSource, currentUrlIndex),
// maarkan de playlist rijen (url + titel) worden bijgewerkt in de database.
// Rijen worden "soft deleted" (is_deleted = true) zodat er geen data verloren
// gaat en de audit-historie bewaard blijft.

export interface YoutubeEntry {
  url: string;
  title: string;
  sortOrder: number;
}

const ensureDb = async () => {
  const db = await getDb();
  if (!db) {
    throw new Error('Database connection not available');
  }
  return db;
};

// Load non-deleted YouTube playlist entries, ordered by sortOrder (then id).
export const loadYoutubeEntries = async (): Promise<YoutubeEntry[]> => {
  try {
    const db = await ensureDb();
    const rows = await db
      .select({ url: youtubeVideos.url, title: youtubeVideos.title, sortOrder: youtubeVideos.sortOrder })
      .from(youtubeVideos)
      .where(eq(youtubeVideos.isDeleted, false))
      .orderBy(asc(youtubeVideos.sortOrder), asc(youtubeVideos.id));
    return rows.map((r: { url: string; title: string; sortOrder: number }) => ({
      url: r.url,
      title: r.title,
      sortOrder: r.sortOrder,
    }));
  } catch (error) {
    console.warn('[videoDb] Could not load YouTube entries from DB:', error);
    return [];
  }
};

// Replace the entire playlist: soft-delete the current rows, then insert the
// new entries. Existing (deleted) rows stay in the table for history.
export const saveYoutubeEntries = async (entries: { url: string; title: string }[]): Promise<void> => {
  try {
    const db = await ensureDb();
    await db.update(youtubeVideos).set({ isDeleted: true });
    if (entries.length === 0) return;
    await db.insert(youtubeVideos).values(
      entries.map((e, i) => ({
        url: e.url,
        title: e.title,
        sortOrder: i,
        isDeleted: false,
      })),
    );
  } catch (error) {
    console.warn('[videoDb] Could not save YouTube entries to DB:', error);
  }
};