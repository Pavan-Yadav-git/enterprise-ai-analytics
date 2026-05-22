import { create } from "zustand";
import axios from "axios";

// Automatically config API URL base
export const API_BASE = "http://localhost:8000/api/v1";

// Create pre-configured axios instance
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // enables HTTP-only cookies transmission
});

// Axios Request Interceptor injecting Access JWT token and context Org ID
api.interceptors.request.use((config) => {
  const state = useStore.getState();
  if (state.token) {
    config.headers.Authorization = `Bearer ${state.token}`;
  }
  if (state.organization) {
    config.headers["X-Org-ID"] = state.organization.id;
  }
  return config;
});

// Axios Response Interceptor handling token refresh automatically
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Fetch new access token using the HTTP-only cookie
        const res = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        const newToken = res.data.access_token;
        
        useStore.getState().setToken(newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (err) {
        // Refresh token has expired, trigger logout
        useStore.getState().logout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

interface User {
  id: string;
  email: string;
}

interface Organization {
  id: string;
  name: string;
}

interface StoreState {
  user: User | null;
  token: string | null;
  organization: Organization | null;
  organizations: Organization[];
  setUser: (user: User | null, token: string | null) => void;
  setToken: (token: string) => void;
  setOrganization: (org: Organization | null) => void;
  setOrganizations: (orgs: Organization[]) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useStore = create<StoreState>((set) => ({
  user: null,
  token: null,
  organization: null,
  organizations: [],

  setUser: (user, token) => set({ user, token }),
  setToken: (token) => set({ token }),
  setOrganization: (org) => {
    set({ organization: org });
    if (typeof window !== "undefined" && org) {
      localStorage.setItem("active_org_id", org.id);
    }
  },
  setOrganizations: (organizations) => set({ organizations }),

  logout: async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`, {}, { withCredentials: true });
    } catch (e) {
      // Ignored
    }
    set({ user: null, token: null, organization: null, organizations: [] });
    if (typeof window !== "undefined") {
      localStorage.removeItem("active_org_id");
    }
  },

  initialize: async () => {
    try {
      // 1. Fetch new access token via HTTP-only cookie
      const res = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
      const token = res.data.access_token;
      
      // 2. Fetch profile
      const userRes = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const user = userRes.data;

      // 3. Fetch Orgs
      const orgsRes = await axios.get(`${API_BASE}/auth/organizations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const organizations = orgsRes.data;

      // Determine active organization
      let activeOrg = null;
      if (organizations.length > 0) {
        const savedOrgId = localStorage.getItem("active_org_id");
        activeOrg = organizations.find((o: any) => o.id === savedOrgId) || organizations[0];
      }

      set({ user, token, organizations, organization: activeOrg });
    } catch (e) {
      // Unauthenticated, fail silently
    }
  }
}));
