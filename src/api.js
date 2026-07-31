import axios from 'axios';

// Create an Axios instance with base URL pointing to the Node.js backend
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Inventory API Calls
export const fetchInventory = () => api.get('/inventory');
export const addInventoryItem = (itemData) => api.post('/inventory', itemData);
export const updateInventoryItem = (id, itemData) => api.put(`/inventory/${id}`, itemData);
export const deleteInventoryItem = (id) => api.delete(`/inventory/${id}`);

// Sales API Calls
export const fetchSales = () => api.get('/sales');
export const recordSale = (saleData) => api.post('/sales', saleData);

// Wastage API Calls
export const fetchWastage = () => api.get('/wastage');
export const recordWastage = (wastageData) => api.post('/wastage', wastageData);
export const deleteWastage = (id) => api.delete(`/wastage/${id}`);

export default api;
