import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

// Products
export const listProducts = (params = {}) => api.get("/products", { params }).then(r => r.data);
export const getProductByBarcode = (barcode) => api.get(`/products/by-barcode/${barcode}`).then(r => r.data);
export const createProduct = (data) => api.post("/products", data).then(r => r.data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data).then(r => r.data);
export const deleteProduct = (id) => api.delete(`/products/${id}`).then(r => r.data);
export const generateBarcode = (id) => api.post(`/products/${id}/generate-barcode`).then(r => r.data);
export const importProductsCSV = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/products/import-csv", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then(r => r.data);
};

// Categories
export const listCategories = () => api.get("/categories").then(r => r.data);
export const createCategory = (data) => api.post("/categories", data).then(r => r.data);
export const updateCategory = (id, data) => api.put(`/categories/${id}`, data).then(r => r.data);
export const deleteCategory = (id) => api.delete(`/categories/${id}`).then(r => r.data);
export const seedDentalCategories = () => api.post("/categories/seed-dental").then(r => r.data);

// Suppliers
export const listSuppliers = () => api.get("/suppliers").then(r => r.data);
export const createSupplier = (data) => api.post("/suppliers", data).then(r => r.data);
export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data).then(r => r.data);
export const deleteSupplier = (id) => api.delete(`/suppliers/${id}`).then(r => r.data);

// Movements
export const listMovements = (params = {}) => api.get("/movements", { params }).then(r => r.data);
export const createMovement = (data) => api.post("/movements", data).then(r => r.data);
export const scanAction = (data) => api.post("/scan", data).then(r => r.data);

// Alerts & Dashboard
export const getAlerts = () => api.get("/alerts").then(r => r.data);
export const getDashboardStats = () => api.get("/dashboard/stats").then(r => r.data);

// Reorder
export const getReorderSuggestions = (horizon_days = 14) => api.get("/reorder/suggestions", { params: { horizon_days } }).then(r => r.data);

// Backup / Restore
export const downloadBackup = () => `${API}/backup`;
export const restoreBackup = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/restore", fd, { headers: { "Content-Type": "multipart/form-data" } }).then(r => r.data);
};
