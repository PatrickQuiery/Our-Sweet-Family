const { isMediaStreamPath } = require('../../lib/rateLimitPaths');

describe('isMediaStreamPath', () => {
  // Paths are relative to the /api mount (Express strips the mount prefix).
  it('exempts memory file streaming', () => {
    expect(isMediaStreamPath('/memories/abc-123/file')).toBe(true);
  });

  it('exempts memory thumbnail streaming', () => {
    expect(isMediaStreamPath('/memories/abc-123/thumb')).toBe(true);
  });

  it('does NOT exempt the memory detail endpoint', () => {
    expect(isMediaStreamPath('/memories/abc-123')).toBe(false);
  });

  it('does NOT exempt the memories list', () => {
    expect(isMediaStreamPath('/memories')).toBe(false);
  });

  it('does NOT exempt other resources', () => {
    expect(isMediaStreamPath('/families')).toBe(false);
    expect(isMediaStreamPath('/children')).toBe(false);
  });

  it('does NOT exempt the download endpoint (originals stay limited)', () => {
    expect(isMediaStreamPath('/memories/abc-123/download')).toBe(false);
  });

  it('does not match deeper or malformed paths', () => {
    expect(isMediaStreamPath('/memories/abc/file/extra')).toBe(false);
    expect(isMediaStreamPath('/memories//file')).toBe(false);
  });
});
