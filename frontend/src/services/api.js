import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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

export const loginAPI = (email, password) => api.post("/login", { email, password });
export const registerAPI = (name, email, password) => api.post("/register", { name, email, password });
export const logoutAPI = () => api.post("/logout");
export const getMeAPI = () => api.get("/me");

export const sendMessageAPI = (message) => api.post("/chat", { message });
export const getChatHistoryAPI = () => api.get("/history");

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

export const getDocumentsAPI = () => api.get("/admin/documents");
export const deleteDocumentAPI = (id) => api.delete("/admin/documents/" + id);

export default api;
