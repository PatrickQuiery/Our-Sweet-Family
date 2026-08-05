import { createApi } from '../api';

describe('createApi', () => {
  const okJson = (body: unknown) =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

  it('attaches the bearer token and hits root + path', async () => {
    const fetchMock = jest.fn().mockReturnValue(okJson({ hello: 'world' }));
    const api = createApi({ root: 'https://x/api', getToken: async () => 'tok_9', fetchImpl: fetchMock });

    const res = await api.get('/auth/me');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://x/api/auth/me');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok_9');
    expect(res).toEqual({ hello: 'world' });
  });

  it('omits Authorization when there is no token', async () => {
    const fetchMock = jest.fn().mockReturnValue(okJson({}));
    const api = createApi({ root: 'https://x/api', getToken: async () => null, fetchImpl: fetchMock });
    await api.get('/public');
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('sends JSON body with content-type on post', async () => {
    const fetchMock = jest.fn().mockReturnValue(okJson({ ok: true }));
    const api = createApi({ root: 'https://x/api', getToken: async () => 't', fetchImpl: fetchMock });
    await api.post('/things', { a: 1 });
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it('sends FormData without forcing content-type on postForm', async () => {
    const fetchMock = jest.fn().mockReturnValue(okJson({ ok: true }));
    const api = createApi({ root: 'https://x/api', getToken: async () => 't', fetchImpl: fetchMock });
    const form = new FormData();
    form.append('k', 'v');
    await api.postForm('/upload', form);
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect(init.body).toBe(form);
  });

  it('throws ApiError with status on non-2xx', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false, status: 403, json: () => Promise.resolve({ error: 'nope' }),
    } as Response);
    const api = createApi({ root: 'https://x/api', getToken: async () => 't', fetchImpl: fetchMock });
    await expect(api.get('/x')).rejects.toMatchObject({ status: 403, message: 'nope' });
  });
});
