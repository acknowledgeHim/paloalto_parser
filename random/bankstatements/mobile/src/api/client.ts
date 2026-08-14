import axios from "axios";
import * as SecureStore from "expo-secure-store";

// Point this at your Django backend. For local dev with a physical device,
// use your machine's LAN IP instead of localhost.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

export const tokenStorage = {
  async getAccess() {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },
  async getRefresh() {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },
  async set(access: string, refresh: string) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
  },
  async clear() {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On a 401, try once to refresh the access token before giving up.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = await tokenStorage.getRefresh();
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
            refresh,
          });
          await tokenStorage.set(data.access, refresh);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          await tokenStorage.clear();
        }
      }
    }
    return Promise.reject(error);
  }
);

export async function login(username: string, password: string) {
  const { data } = await axios.post(`${API_BASE_URL}/auth/token/`, {
    username,
    password,
  });
  await tokenStorage.set(data.access, data.refresh);
}

export async function logout() {
  await tokenStorage.clear();
}
