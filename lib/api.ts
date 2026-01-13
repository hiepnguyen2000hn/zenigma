import ApiClient from './api-client';
import { getCookie } from './cookies';

// Key để lưu token trong cookies
const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Tạo instance chính của API client
const apiClient = new ApiClient(process.env.NEXT_PUBLIC_API_URL || '', {
  'Content-Type': 'application/json',
});

// Set token getter - lấy token từ cookies
apiClient.setTokenGetter(async () => {
  if (typeof window === 'undefined') return null;
  return getCookie(TOKEN_KEY);
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
    const { getCookie: getRefreshCookie, deleteCookie, setCookie } = await import('./cookies');
    const refreshToken = getRefreshCookie(REFRESH_TOKEN_KEY);

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

          // Lưu token mới vào cookies
          setCookie(TOKEN_KEY, data.access_token || data.accessToken, {
            expires: 7,
            secure: true,
            sameSite: 'Lax',
          });

          if (data.refresh_token || data.refreshToken) {
            setCookie(REFRESH_TOKEN_KEY, data.refresh_token || data.refreshToken, {
              expires: 30,
              secure: true,
              sameSite: 'Lax',
            });
          }

          // Có thể retry request cũ ở đây nếu muốn
          console.log('Token refreshed successfully');
        } else {
          // Refresh token failed, xóa tokens và redirect về login
          deleteCookie(TOKEN_KEY);
          deleteCookie(REFRESH_TOKEN_KEY);

          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError);
        deleteCookie(TOKEN_KEY);
        deleteCookie(REFRESH_TOKEN_KEY);
      }
    }
  }

  return error;
});

// Thêm request interceptor để log requests (optional)
apiClient.addRequestInterceptor(async (config) => {
  if (process.env.NODE_ENV === 'development') {
  }
  return config;
});

// Thêm response interceptor để log responses (optional)
apiClient.addResponseInterceptor(async (response) => {
  if (process.env.NODE_ENV === 'development') {
  }
  return response;
});

// Helper functions để quản lý token
export const auth = {
  setTokens: async (accessToken: string, refreshToken?: string) => {
    if (typeof window === 'undefined') return;
    const { setCookie } = await import('./cookies');

    // Lưu access token (expires 7 days)
    setCookie(TOKEN_KEY, accessToken, {
      expires: 7,
      secure: true,
      sameSite: 'Lax',
    });

    // Lưu refresh token (expires 30 days)
    if (refreshToken) {
      setCookie(REFRESH_TOKEN_KEY, refreshToken, {
        expires: 30,
        secure: true,
        sameSite: 'Lax',
      });
    }
  },

  getToken: () => {
    if (typeof window === 'undefined') return null;
    return getCookie(TOKEN_KEY);
  },

  getRefreshToken: () => {
    if (typeof window === 'undefined') return null;
    return getCookie(REFRESH_TOKEN_KEY);
  },

  clearTokens: async () => {
    if (typeof window === 'undefined') return;
    const { deleteCookie } = await import('./cookies');
    deleteCookie(TOKEN_KEY);
    deleteCookie(REFRESH_TOKEN_KEY);
  },

  isAuthenticated: () => {
    if (typeof window === 'undefined') return false;
    return !!getCookie(TOKEN_KEY);
  },
};

export default apiClient;