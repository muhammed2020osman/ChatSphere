import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = any>(
  url: string,
  options?: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  }
): Promise<T> {
  const { method = "GET", body, headers = {} } = options || {};
  
  // Don't set Content-Type for FormData, let the browser set it with boundary
  const isFormData = body instanceof FormData;
  const requestHeaders = isFormData 
    ? headers 
    : body ? { "Content-Type": "application/json", ...headers } : headers;
  
  const res = await fetch(url, {
    method,
    headers: requestHeaders,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // Handle empty responses (204, 205)
  if (res.status === 204 || res.status === 205) {
    return undefined as T;
  }
  
  // Check if response has content
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      return await res.json();
    } catch (error) {
      console.error("JSON parsing error:", error);
      const text = await res.text();
      console.error("Response text:", text);
      throw new Error(`Invalid JSON response: ${text}`);
    }
  }
  
  // For other content types or empty body, return undefined
  const text = await res.text();
  return (text ? text : undefined) as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL from queryKey
    let url = queryKey[0] as string;
    
    // If there are query params (second element in array), append them
    if (queryKey.length > 1 && queryKey[1]) {
      const params = queryKey[1] as Record<string, any>;
      const searchParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => searchParams.append(key, String(v)));
          } else {
            searchParams.append(key, String(value));
          }
        }
      });
      
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
