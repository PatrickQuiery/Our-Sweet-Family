import { getFamilies, getMemories, buildUploadForm } from '../memories';
import type { Api } from '../api';

function fakeApi(overrides: Partial<Api>): Api {
  return {
    get: jest.fn(),
    post: jest.fn(),
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
