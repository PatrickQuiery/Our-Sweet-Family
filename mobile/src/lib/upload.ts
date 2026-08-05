import { ApiError } from './api';
import { API_ROOT } from './config';

export interface UploadPart {
  uri: string;
  name: string;
  mimeType: string;
}

/**
 * Multipart upload via XMLHttpRequest. RN's XHR streams the `{ uri, name, type }`
 * file-part shape natively, whereas the spec-compliant global fetch in RN 0.86 /
 * Expo 57 rejects it or drops the connection on Blob multipart bodies. Shared by
 * memory uploads and child-avatar uploads.
 */
export function xhrUpload<T>(
  getToken: () => Promise<string | null>,
  method: 'POST' | 'PUT',
  path: string,
  file: UploadPart,
  fields: Record<string, string> = {},
  fileField = 'file',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    getToken()
      .then((token) => {
        const form = new FormData();
        form.append(fileField, {
          uri: file.uri,
          name: file.name,
          type: file.mimeType,
        } as unknown as Blob);
        for (const [k, v] of Object.entries(fields)) form.append(k, v);

        const xhr = new XMLHttpRequest();
        xhr.open(method, `${API_ROOT}${path}`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.onload = () => {
          let body: any = null;
          try {
            body = JSON.parse(xhr.responseText);
          } catch {
            body = null;
          }
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(body as T);
          } else {
            reject(new ApiError(xhr.status, body?.error || body?.message || `HTTP ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new ApiError(0, 'Network request failed'));
        xhr.send(form);
      })
      .catch(reject);
  });
}
