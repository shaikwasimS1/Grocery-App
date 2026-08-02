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

// Supplier API Calls
export const fetchSuppliers = () => api.get('/suppliers');
export const addSupplier = (data) => api.post('/suppliers', data);
export const fetchSupplierBalance = (id) => api.get(`/suppliers/${id}/balance`);
export const addSupplierPayment = (id, data) => api.post(`/suppliers/${id}/payments`, data);

// Customer / Credit Book API Calls
export const fetchCustomers = () => api.get('/customers');
export const addCustomer = (data) => api.post('/customers', data);
export const fetchCustomerBalance = (id) => api.get(`/customers/${id}/balance`);
export const fetchCustomerSales = (id) => api.get(`/customers/${id}/sales`);
export const fetchCustomerPayments = (id) => api.get(`/customers/${id}/payments`);
export const addCreditSale = (id, data) => api.post(`/customers/${id}/sales`, data);
export const addCreditPayment = (id, data) => api.post(`/customers/${id}/payments`, data);

// Expenses API Calls
export const fetchExpenses = () => api.get('/expenses');
export const addExpense = (data) => api.post('/expenses', data);
export const deleteExpense = (id) => api.delete(`/expenses/${id}`);

export default api;

