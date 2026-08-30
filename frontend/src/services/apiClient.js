import axios from 'axios';

const RAW_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';
const normalizedBaseUrl = RAW_BASE_URL.replace(/\/+$/, '');
const BASE_URL = normalizedBaseUrl.endsWith('/api/v1')
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/api/v1`;

const apiClient = axios.create({
    baseURL: BASE_URL,
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log(`[ApiClient] Attaching token: ${token.substring(0, 10)}...`);
    } else {
        console.warn('[ApiClient] No token found in localStorage');
    }
    return config;
});

export default apiClient;

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.error('[ApiClient] 401 Unauthorized - Logging out');
            localStorage.removeItem('access_token');
            localStorage.removeItem('user')
        }
        return Promise.reject(error);
    }
);
