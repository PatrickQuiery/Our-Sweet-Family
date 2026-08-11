import { getMemories, buildUploadForm } from '../memories';
import { getFamilies } from '../family';
import type { Api } from '../api';

function fakeApi(overrides: Partial<Api>): Api {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    del: jest.fn(),
    postForm: jest.fn(),
    ...overrides,
  } as Api;
}

describe('memories data layer', () => {
  it('getFamilies unwraps the families array', async () => {
    const api = fakeApi({
      get: jest.fn().mockResolvedValue({ families: [{ id: 'f1', name: 'Fam', children: [] }] }),
    });
    await expect(getFamilies(api)).resolves.toEqual([{ id: 'f1', name: 'Fam', children: [] }]);
    expect(api.get).toHaveBeenCalledWith('/families');
  });

  it('getMemories builds the paginated query and unwraps memories', async () => {
    const get = jest.fn().mockResolvedValue({ memories: [{ id: 'm1' }] });
    const api = fakeApi({ get });
    const res = await getMemories(api, { familyId: 'f1', page: 2, limit: 20 });
    expect(get).toHaveBeenCalledWith('/memories?familyId=f1&page=2&limit=20');
    expect(res).toEqual([{ id: 'm1' }]);
  });

  it('getMemories appends the timeline from/to window', async () => {
    const get = jest.fn().mockResolvedValue({ memories: [] });
    const api = fakeApi({ get });
    await getMemories(api, { familyId: 'f1', from: '2023-01-01T00:00:00.000Z', to: '2023-12-31T23:59:59.000Z' });
    const url = get.mock.calls[0][0] as string;
    expect(url).toContain('from=2023-01-01T00%3A00%3A00.000Z');
    expect(url).toContain('to=2023-12-31T23%3A59%3A59.000Z');
  });

  it('buildUploadForm assembles multipart fields with the file part', () => {
    const form = buildUploadForm({
      familyId: 'f1',
      childIds: ['c1', 'c2'],
      caption: 'hi',
      asset: { uri: 'file:///x.jpg', name: 'x.jpg', mimeType: 'image/jpeg' },
    });
    expect(form).toBeInstanceOf(FormData);
    const parts = (form as unknown as { _parts?: [string, unknown][] })._parts;
    if (parts) {
      const keys = parts.map((p) => p[0]);
      expect(keys).toEqual(expect.arrayContaining(['file', 'familyId', 'childIds', 'caption']));
      expect(parts.find((p) => p[0] === 'childIds')?.[1]).toBe('["c1","c2"]');
    }
  });
});
