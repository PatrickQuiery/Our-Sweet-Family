jest.mock('../../lib/prisma');

const prisma = require('../../lib/prisma');
const { sendPushToUsers, buildMessages } = require('../../lib/push');

describe('buildMessages', () => {
  it('keeps only Expo tokens and shapes the payload', () => {
    const msgs = buildMessages(['ExponentPushToken[abc]', 'not-a-token', null, undefined], {
      title: 'Hi',
      body: 'B',
      data: { memoryId: 'm1' },
    });
    expect(msgs).toEqual([
      { to: 'ExponentPushToken[abc]', title: 'Hi', body: 'B', data: { memoryId: 'm1' }, sound: 'default' },
    ]);
  });

  it('defaults data to an empty object', () => {
    const msgs = buildMessages(['ExponentPushToken[x]'], { title: 'T', body: 'B' });
    expect(msgs[0].data).toEqual({});
  });
});

describe('sendPushToUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('no-ops with no user ids (no DB call)', async () => {
    const res = await sendPushToUsers([], { title: 'x' });
    expect(res).toEqual({ sent: 0 });
    expect(prisma.deviceToken.findMany).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends to every Expo token of the given users', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([
      { token: 'ExponentPushToken[a]' },
      { token: 'ExponentPushToken[b]' },
    ]);
    global.fetch.mockResolvedValue({ ok: true });

    const res = await sendPushToUsers(['u1', 'u1', null], { title: 'New memory', body: 'x' });

    expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({
      where: { userId: { in: ['u1'] } },
      select: { token: true },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(res).toEqual({ sent: 2 });
  });

  it('returns sent:0 when a user has no registered devices', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([]);
    const res = await sendPushToUsers(['u1'], { title: 'x' });
    expect(res).toEqual({ sent: 0 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('never throws when the push request fails', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([{ token: 'ExponentPushToken[a]' }]);
    global.fetch.mockRejectedValue(new Error('network down'));
    const res = await sendPushToUsers(['u1'], { title: 'x' });
    expect(res).toEqual({ sent: 0 });
  });
});
