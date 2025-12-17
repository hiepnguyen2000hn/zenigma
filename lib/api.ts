import ApiClient from './api-client';

// Key để lưu token trong localStorage
const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Tạo instance chính của API client
const apiClient = new ApiClient(process.env.NEXT_PUBLIC_API_URL || '', {
  'Content-Type': 'application/json',
});

// Set token getter - lấy token từ localStorage
apiClient.setTokenGetter(async () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
});

// Thêm error interceptor để xử lý lỗi và refresh token
apiClient.addErrorInterceptor(async (error) => {
  console.error('API Error:', {
    message: error.message,
    status: error.status,
    data: error.data,
  });

  // Nếu lỗi 401 (Unauthorized), thử refresh token
  if (error.status === 401 && typeof window !== 'undefined') {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (refreshToken) {
      try {
        // Gọi API refresh token
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (response.ok) {
          const data = await response.json();

          // Lưu token mới
          localStorage.setItem(TOKEN_KEY, data.accessToken);
          if (data.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
          }

          // Có thể retry request cũ ở đây nếu muốn
          console.log('Token refreshed successfully');
        } else {
          // Refresh token failed, xóa tokens và redirect về login
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);

          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    }
  }

  return error;
});

// Thêm request interceptor để log requests (optional)
apiClient.addRequestInterceptor(async (config) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('API Request:', config.method, config);
  }
  return config;
});

// Thêm response interceptor để log responses (optional)
apiClient.addResponseInterceptor(async (response) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('API Response:', response.status, response.data);
  }
  return response;
});

// Helper functions để quản lý token
export const auth = {
  setTokens: (accessToken: string, refreshToken?: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  },

  getToken: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  getRefreshToken: () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  clearTokens: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  isAuthenticated: () => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(TOKEN_KEY);
  },
};

export default apiClient;