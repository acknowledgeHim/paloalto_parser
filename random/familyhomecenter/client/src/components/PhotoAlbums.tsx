import { useEffect, useState } from 'react';
import { api, type PhotoAlbum } from '../api/client.js';
import { useFamilyMembers } from '../state/FamilyMemberContext.js';

export const FAVORITES_ID = 'favorites';

/**
 * Albums and which photos are in them (server/src/routes/albums.ts). Albums live only in the app's
 * database — adding a photo to one never moves or copies the file.
 */
export function useAlbums() {
  const { activeProfile } = useFamilyMembers();
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  /** photo id → album ids it's in */
  const [memberships, setMemberships] = useState<Record<string, string[]>>({});

  const reload = async () => {
    const [a, m] = await Promise.all([
      api.get<PhotoAlbum[]>('/albums').catch(() => [] as PhotoAlbum[]),
      api.get<Record<string, string[]>>('/albums/memberships').catch(() => ({})),
    ]);
    setAlbums(a);
    setMemberships(m);
  };
  useEffect(() => {
    reload();
  }, []);

  const change = async (albumId: string, body: { add?: string[]; remove?: string[] }) => {
    // Optimistic, so a star tap feels instant; the reload right after corrects counts.
    setMemberships((cur) => {
      const next = { ...cur };
      for (const id of body.add ?? []) next[id] = [...new Set([...(next[id] ?? []), albumId])];
      for (const id of body.remove ?? []) next[id] = (next[id] ?? []).filter((a) => a !== albumId);
      return next;
    });
    await api.post(`/albums/${albumId}/photos`, body);
    await reload();
  };

  return {
    albums,
    memberships,
    reload,
    isIn: (photoId: string, albumId: string) => (memberships[photoId] ?? []).includes(albumId),
    add: (albumId: string, ids: string[]) => change(albumId, { add: ids }),
    remove: (albumId: string, ids: string[]) => change(albumId, { remove: ids }),
    create: async (name: string): Promise<PhotoAlbum> => {
      const album = await api.post<PhotoAlbum>('/albums', { name, created_by_id: activeProfile?.id ?? null });
      await reload();
      return album;
    },
  };
}

export type AlbumsApi = ReturnType<typeof useAlbums>;

/**
 * A checklist of albums for one or more photos. For one photo, each album's box shows whether it's
 * in it (tap to add/remove); for several, tapping adds them all (or removes them all if every one
 * is already in it). Plus "New album" to make one and add straight away.
 */
export function AlbumChecklist({ albumsApi, photoIds, onDone }: { albumsApi: AlbumsApi; photoIds: string[]; onDone?: () => void }) {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const allIn = (albumId: string) => photoIds.length > 0 && photoIds.every((id) => albumsApi.isIn(id, albumId));

  const toggle = async (albumId: string) => {
    setError(null);
    try {
      if (allIn(albumId)) await albumsApi.remove(albumId, photoIds);
      else await albumsApi.add(albumId, photoIds);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const createAndAdd = async () => {
    setError(null);
    try {
      const album = await albumsApi.create(newName.trim());
      await albumsApi.add(album.id, photoIds);
      setNewName('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="album-checklist" onClick={(e) => e.stopPropagation()}>
      {/* Done sits in the header so it's always on screen; only the album list scrolls. */}
      <div className="album-checklist__head">
        <strong>Albums</strong>
        {onDone && (
          <button type="button" onClick={onDone}>Done</button>
        )}
      </div>
      <div className="album-checklist__list">
        {albumsApi.albums.map((a) => (
          <label key={a.id} title={a.name}>
            <input type="checkbox" checked={allIn(a.id)} onChange={() => toggle(a.id)} />
            <span>
              {a.is_favorites ? '⭐ ' : ''}
              {a.name}
            </span>
          </label>
        ))}
      </div>
      {error && <div className="settings-login__error">{error}</div>}
      {/* At the bottom: picking existing albums is the common case; making one is rarer. */}
      <form
        className="album-checklist__new"
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) createAndAdd();
        }}
      >
        <input placeholder="New album name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" disabled={!newName.trim()}>Create</button>
      </form>
    </div>
  );
}
