import { API_ROOT } from './config';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

type GetToken = () => Promise<string | null>;

interface ApiDeps {
  root?: string;
  getToken: GetToken;
  fetchImpl?: typeof fetch;
}

export interface Api {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  put<T = unknown>(path: string, body?: unknown): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown): Promise<T>;
  del<T = unknown>(path: string): Promise<T>;
  postForm<T = unknown>(path: string, form: FormData): Promise<T>;
}

export function createApi({ root = API_ROOT, getToken, fetchImpl = fetch }: ApiDeps): Api {
  async function request<T>(
    method: string,
    path: string,
    opts: { body?: unknown; form?: FormData } = {},
  ): Promise<T> {
    const token = await getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let body: BodyInit | undefined;
    if (opts.form) {
      body = opts.form as unknown as BodyInit; // let fetch set the multipart boundary
    } else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }

    const res = await fetchImpl(`${root}${path}`, { method, headers, body });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (json && (json.error || json.message)) || `HTTP ${res.status}`;
      throw new ApiError(res.status, message);
    }
    return json as T;
  }

  return {
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, { body: b }),
    put: (p, b) => request('PUT', p, { body: b }),
    patch: (p, b) => request('PATCH', p, { body: b }),
    del: (p) => request('DELETE', p),
    postForm: (p, form) => request('POST', p, { form }),
  };
}
