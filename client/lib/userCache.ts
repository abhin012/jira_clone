import axiosInstance from "@/lib/Axiosinstance";

type CachedUser = {
  id: string;
  name: string;
  avatar?: string;
  [key: string]: any;
};

const cache = new Map<string, CachedUser>();
const inFlight = new Map<string, Promise<CachedUser | null>>();

export async function getUserById(id: string | null | undefined): Promise<CachedUser | null> {
  if (!id) return null;

  if (cache.has(id)) {
    return cache.get(id) as CachedUser;
  }

  if (inFlight.has(id)) {
    return inFlight.get(id) as Promise<CachedUser | null>;
  }

  const promise = axiosInstance
    .get(`/api/users/${id}`)
    .then((res) => {
      cache.set(id, res.data);
      inFlight.delete(id);
      return res.data as CachedUser;
    })
    .catch((err) => {
      inFlight.delete(id);
      console.error("Failed to load user", id, err);
      return null;
    });

  inFlight.set(id, promise);
  return promise;
}