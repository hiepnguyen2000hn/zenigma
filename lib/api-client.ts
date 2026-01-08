/* eslint-disable @typescript-eslint/no-explicit-any */
type RequestConfig = RequestInit & {
  params?: Record<string, string | number | boolean | (string | number)[]>;
  timeout?: number;
};

type ApiResponse<T = any> = {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
};

type ApiError = {
  message: string;
  status: number;
  statusText: string;
  data?: any;
};

type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
type ResponseInterceptor = <T>(response: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>;
type ErrorInterceptor = (error: ApiError) => Promise<ApiError>;

class ApiClient {
  private baseURL: string;
  private defaultHeaders: HeadersInit;
  private getAccessToken: (() => Promise<string | null>) | null = null;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  constructor(baseURL: string = '', defaultHeaders: HeadersInit = {}) {
    this.baseURL = baseURL;
    this.defaultHeaders = defaultHeaders;
  }

  /**
   * Set function để lấy access token (dùng với Privy hoặc auth provider khác)
   */
  setTokenGetter(getter: () => Promise<string | null>) {
    this.getAccessToken = getter;
  }

  /**
   * Thêm request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor) {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Thêm response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor) {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Thêm error interceptor
   */
  addErrorInterceptor(interceptor: ErrorInterceptor) {
    this.errorInterceptors.push(interceptor);
  }

  /**
   * Build URL với query params
   * Hỗ trợ array values: status=value1&status=value2
   */
  private buildURL(endpoint: string, params?: Record<string, string | number | boolean | (string | number)[]>): string {
    const url = new URL(endpoint, this.baseURL);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        // ✅ Nếu value là array, append từng giá trị với cùng key
        if (Array.isArray(value)) {
          value.forEach((item) => {
            url.searchParams.append(key, String(item));
          });
        } else {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Xử lý request với timeout
   */
  private async fetchWithTimeout(url: string, config: RequestConfig): Promise<Response> {
    const { timeout = 30000, ...fetchConfig } = config;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchConfig,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Apply request interceptors
   */
  private async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    let finalConfig = config;

    for (const interceptor of this.requestInterceptors) {
      finalConfig = await interceptor(finalConfig);
    }

    return finalConfig;
  }

  /**
   * Apply response interceptors
   */
  private async applyResponseInterceptors<T>(response: ApiResponse<T>): Promise<ApiResponse<T>> {
    let finalResponse = response;

    for (const interceptor of this.responseInterceptors) {
      finalResponse = await interceptor(finalResponse);
    }

    return finalResponse;
  }

  /**
   * Apply error interceptors
   */
  private async applyErrorInterceptors(error: ApiError): Promise<ApiError> {
    let finalError = error;

    for (const interceptor of this.errorInterceptors) {
      finalError = await interceptor(finalError);
    }

    return finalError;
  }

  /**
   * Main request method
   */
  async request<T = any>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    try {
      // Build URL với params nếu có
      const url = this.buildURL(endpoint, config.params);

      // Merge headers
      const headers = new Headers(this.defaultHeaders);

      // Thêm token nếu có
      if (this.getAccessToken) {
        const token = await this.getAccessToken();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      }

      // Merge với headers từ config
      if (config.headers) {
        const configHeaders = new Headers(config.headers);
        configHeaders.forEach((value, key) => {
          headers.set(key, value);
        });
      }

      // Tạo final config
      let finalConfig: RequestConfig = {
        ...config,
        headers,
      };

      // Apply request interceptors
      finalConfig = await this.applyRequestInterceptors(finalConfig);

      // Thực hiện request
      const response = await this.fetchWithTimeout(url, finalConfig);

      // Parse response
      let data: T;
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else if (contentType?.includes('text/')) {
        data = await response.text() as T;
      } else {
        data = await response.blob() as T;
      }

      // Tạo response object
      let apiResponse: ApiResponse<T> = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      };

      // Kiểm tra error status
      if (!response.ok) {
        const error: ApiError = {
          message: typeof data === 'string' ? data : (data as any)?.message || response.statusText,
          status: response.status,
          statusText: response.statusText,
          data,
        };

        // Apply error interceptors
        const finalError = await this.applyErrorInterceptors(error);
        throw finalError;
      }

      // Apply response interceptors
      apiResponse = await this.applyResponseInterceptors(apiResponse);

      return apiResponse;
    } catch (error: any) {
      // Nếu là ApiError thì throw luôn
      if (error.status !== undefined) {
        throw error;
      }

      // Convert các error khác thành ApiError
      const apiError: ApiError = {
        message: error.message || 'Network Error',
        status: 0,
        statusText: 'Network Error',
        data: null,
      };

      const finalError = await this.applyErrorInterceptors(apiError);
      throw finalError;
    }
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    const headers = new Headers(config?.headers);

    let body: BodyInit | undefined;

    if (data instanceof FormData) {
      body = data;
      // Không set Content-Type cho FormData, browser sẽ tự set với boundary
    } else if (data) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(data);
    }

    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      headers,
      body,
    });
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    const headers = new Headers(config?.headers);

    let body: BodyInit | undefined;

    if (data instanceof FormData) {
      body = data;
    } else if (data) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(data);
    }

    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      headers,
      body,
    });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    const headers = new Headers(config?.headers);

    let body: BodyInit | undefined;

    if (data instanceof FormData) {
      body = data;
    } else if (data) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(data);
    }

    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      headers,
      body,
    });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }
}

export default ApiClient;
export type { ApiResponse, ApiError, RequestConfig };