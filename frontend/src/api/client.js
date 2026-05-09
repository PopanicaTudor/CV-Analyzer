const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const TOKEN_KEY = "cvap_tokens";
const USER_KEY = "cvap_user";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

export function getStoredTokens() {
  return readJson(TOKEN_KEY);
}

export function getStoredUser() {
  return readJson(USER_KEY);
}

export function storeAuth(tokens, user) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("cvap-auth-change"));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("cvap-auth-change"));
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

async function refreshAccessToken() {
  const tokens = getStoredTokens();
  if (!tokens?.refresh) {
    return null;
  }

  const response = await fetch(`${API_URL}/auth/token/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: tokens.refresh }),
  });

  if (!response.ok) {
    clearAuth();
    return null;
  }

  const data = await response.json();
  const nextTokens = {
    access: data.access,
    refresh: data.refresh || tokens.refresh,
  };
  storeAuth(nextTokens, getStoredUser());
  return nextTokens.access;
}

async function request(path, options = {}, retry = true) {
  const tokens = getStoredTokens();
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (tokens?.access) {
    headers.set("Authorization", `Bearer ${tokens.access}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && retry) {
    const access = await refreshAccessToken();
    if (access) {
      return request(path, options, false);
    }
  }

  const data = await parseResponse(response);
  if (!response.ok) {
    const message = data?.detail || data?.non_field_errors?.[0] || "Request failed.";
    throw new ApiError(message, response.status, data);
  }
  return data;
}

export const api = {
  login: (payload) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  register: (payload) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  me: () => request("/auth/me"),
  uploadCV: (file, targetJobs = []) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("target_jobs", JSON.stringify(targetJobs));
    return request("/cv/upload", {
      method: "POST",
      body: formData,
    });
  },
  cvStatus: (id) => request(`/cv/${id}/status`),
  cvResult: (id) => request(`/cv/${id}/result`),
  deleteCV: (id) =>
    request(`/cv/${id}`, {
      method: "DELETE",
    }),
  history: () => request("/cv/history"),
};
