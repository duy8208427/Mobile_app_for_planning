import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";
export const API_BASE = `${BACKEND_URL}/api`;

const TOKEN_KEY = "qh_token";
const USER_KEY = "qh_user";

export async function saveAuth(token: string, user: any) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}
export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function getUser(): Promise<any | null> {
  const v = await AsyncStorage.getItem(USER_KEY);
  return v ? JSON.parse(v) : null;
}
export async function clearAuth() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}

export async function api(
  path: string,
  options: { method?: string; body?: any; auth?: boolean } = {}
) {
  const { method = "GET", body, auth = true } = options;
  const headers: any = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    throw new Error(data?.detail || `Lỗi ${res.status}`);
  }
  return data;
}
