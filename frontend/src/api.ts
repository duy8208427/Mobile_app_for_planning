import AsyncStorage from "@react-native-async-storage/async-storage";

/** Render Blueprint service name `quyhoach-api` → this host. Railway URL cũ đang 404. */
export const RENDER_API_ORIGIN = "https://quyhoach-api.onrender.com";

function resolveBackendUrl(raw: string): string {
  const url = (raw || "").replace(/\/$/, "");
  if (!url || url.includes("railway.app")) return RENDER_API_ORIGIN;
  return url;
}

const BACKEND_URL = resolveBackendUrl(process.env.EXPO_PUBLIC_BACKEND_URL || "");
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

function formatDetail(data: any, status?: number): string {
  const detail = data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    if (detail.trim().startsWith("<") || detail.includes("<!DOCTYPE")) {
      return "Máy chủ API không phản hồi đúng. Kiểm tra EXPO_PUBLIC_BACKEND_URL.";
    }
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (typeof item === "object" && item?.msg ? item.msg : String(item)))
      .filter(Boolean)
      .join("; ");
  }
  if (
    status === 404 &&
    (data?.status === "error" || String(data?.message || "").toLowerCase().includes("not found"))
  ) {
    return "Máy chủ API đang tắt hoặc không tìm thấy. Liên hệ quản trị để bật lại backend.";
  }
  return status ? `Lỗi ${status}` : "Lỗi không xác định";
}

function isNetworkError(err: any): boolean {
  const msg = String(err?.message || "");
  return (
    err?.name === "TypeError" ||
    msg === "Failed to fetch" ||
    msg === "Network request failed" ||
    msg.includes("Network request failed") ||
    msg.includes("Failed to fetch")
  );
}

export async function api(
  path: string,
  options: { method?: string; body?: any; auth?: boolean } = {}
) {
  if (!BACKEND_URL) {
    throw new Error("Chưa cấu hình API. Thiếu EXPO_PUBLIC_BACKEND_URL.");
  }
  const { method = "GET", body, auth = true } = options;
  const headers: any = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err: any) {
    if (isNetworkError(err)) {
      throw new Error("Không kết nối được máy chủ. Kiểm tra API hoặc mạng.");
    }
    throw err;
  }
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    throw new Error(formatDetail(data, res.status));
  }
  return data;
}
