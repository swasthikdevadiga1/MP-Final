import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
// const BASE_URL = "http://10.97.88.107:5000";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// Auth
export const loginAPI    = (email, password) => api.post("/login", { email, password });
export const registerAPI = (name, email, password) => api.post("/register", { name, email, password });
export const logoutAPI   = () => api.post("/logout");
export const getMeAPI    = () => api.get("/me");

// Chat — now supports optional image_b64
export const sendMessageAPI = (message, image_b64 = null) =>
  api.post("/chat", { message, ...(image_b64 ? { image_b64 } : {}) });

export const getChatHistoryAPI = () => api.get("/history");
export const getAnalyticsAPI  = () => api.get("/admin/analytics/overview");
export const getChatLogsAPI   = (page = 1, search = "", agent = "") =>
  api.get("/admin/analytics/chat-history", {
    params: { page, search, agent },
  });

export const getStudentsAPI       = () => api.get("/admin/students");
export const toggleStudentAPI     = (id) => api.patch(`/admin/students/${id}/toggle`);
export const resetPasswordAPI     = (id, new_password) =>
  api.post(`/admin/students/${id}/reset-password`, { new_password });
export const deleteStudentAPI     = (id) => api.delete(`/admin/students/${id}`);

export const getSystemHealthAPI   = () => api.get("/admin/system/health");
export const queryTestAPI         = (query, k = 5) => api.post("/admin/system/query-test", { query, k });
export const getDocPreviewAPI     = (docId, chunks = 5) =>
  api.get(`/admin/system/doc-preview/${docId}`, { params: { chunks } });

export const getAdminNoticesAPI   = () => api.get("/admin/notices");
export const createNoticeAPI      = (payload) => api.post("/admin/notices", payload);
export const updateNoticeAPI      = (id, payload) => api.patch(`/admin/notices/${id}`, payload);
export const toggleNoticeAPI      = (id) => api.patch(`/admin/notices/${id}/toggle`);
export const deleteNoticeAPI      = (id) => api.delete(`/admin/notices/${id}`);

// Admin — upload PDF or image
export const uploadDocumentAPI = (file, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/admin/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  });
};

export const getDocumentsAPI  = () => api.get("/admin/documents");
export const deleteDocumentAPI = (id) => api.delete("/admin/documents/" + id);
export const reprocessDocAPI   = (id) => api.post("/admin/reprocess/" + id);
export const exportCsvAPI      = () => api.get("/admin/analytics/export-csv", { responseType: "blob" });

export default api;
