import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response interceptor to handle retries and catch unauthorized API calls
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    // Check for 401 unauthorized to clear cache/warn
    if (response && response.status === 401) {
      console.warn('[API Client] Unauthorized request - 401. User session may have expired.');
      return Promise.reject(error);
    }

    // Determine if we should retry: network error or 5xx server error, and config exists
    const isNetworkError = !response;
    const isServerError = response && response.status >= 500;
    const shouldRetry = config && (isNetworkError || isServerError);

    if (shouldRetry) {
      // Ensure headers object exists
      config.headers = config.headers || {};
      const retryHeader = config.headers['X-Retry-Count'];
      const retryCount = retryHeader ? parseInt(retryHeader, 10) : 0;
      const maxRetries = 3;

      if (retryCount < maxRetries) {
        const nextRetryCount = retryCount + 1;
        config.headers['X-Retry-Count'] = nextRetryCount.toString();
        
        // Calculate backoff: 500ms, 1000ms, 2000ms
        const delayMs = Math.pow(2, nextRetryCount) * 250;
        console.warn(`[API Client] Request failed: ${error.message}. Retrying request attempt ${nextRetryCount}/${maxRetries} in ${delayMs}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return api(config);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
