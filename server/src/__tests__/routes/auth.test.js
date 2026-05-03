jest.mock('../../lib/prisma');
jest.mock('bcryptjs');
jest.mock('google-auth-library');
jest.mock('apple-signin-auth');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../lib/prisma');
const { OAuth2Client } = require('google-auth-library');
const appleSignin = require('apple-signin-auth');

// Full DB row (includes passwordHash — used for login & authenticate lookups)
const dbUser = {
  id: 'user1',
  email: 'test@example.com',
  passwordHash: 'hashed_password',
  name: 'Test User',
  role: 'owner',
  plan: 'free',
  avatarUrl: null,
  createdAt: new Date().toISOString(),
};

// Signup uses a Prisma select clause that excludes passwordHash
const createdUser = {
  id: 'user1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'owner',
  plan: 'free',
  avatarUrl: null,
  createdAt: new Date().toISOString(),
};

describe('POST /api/auth/signup', () => {
  it('creates a user and returns token + safe user object', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed_password');
    prisma.user.create.mockResolvedValue(createdUser); // no passwordHash (Prisma select)

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'notanemail', password: 'password123', name: 'Test' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'short', name: 'Test' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing name', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'password123', name: '' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when email is already registered', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser);

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'password123', name: 'Test' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already in use/i);
  });
});

describe('POST /api/auth/login', () => {
  it('returns token and safe user for valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser);
    bcrypt.compare.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 401 for wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser);
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it('returns 401 for non-existent email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bademail', password: 'password123' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns authenticated user without passwordHash', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser);
    const token = jwt.sign({ userId: 'user1' }, process.env.JWT_SECRET);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user1');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer notavalidtoken');
    expect(res.status).toBe(401);
  });

  it('returns 401 when user no longer exists in DB', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const token = jwt.sign({ userId: 'deleted-user' }, process.env.JWT_SECRET);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────

describe('POST /api/auth/google', () => {
  const googlePayload = { sub: 'google-uid-123', email: 'guser@gmail.com', name: 'Google User', picture: 'https://pic.example.com/g.jpg' };
  const oauthUser = { ...dbUser, id: 'user-g1', email: 'guser@gmail.com', googleId: 'google-uid-123', avatarUrl: googlePayload.picture };

  function mockGoogleVerify(payload = googlePayload) {
    OAuth2Client.prototype.verifyIdToken = jest.fn().mockResolvedValue({
      getPayload: () => payload,
    });
  }

  it('creates a new user on first Google sign-in', async () => {
    mockGoogleVerify();
    bcrypt.hash.mockResolvedValue('tmp');
    // googleId lookup → null, email lookup → null → create
    prisma.user.findUnique
      .mockResolvedValueOnce(null)  // googleId
      .mockResolvedValueOnce(null); // email
    prisma.user.create.mockResolvedValue(oauthUser);

    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid-id-token' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('guser@gmail.com');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('signs in existing user by googleId', async () => {
    mockGoogleVerify();
    prisma.user.findUnique.mockResolvedValueOnce(oauthUser); // found by googleId

    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid-id-token' });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user-g1');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('links Google ID to an existing email account', async () => {
    mockGoogleVerify();
    const existingUser = { ...dbUser, googleId: null };
    const linkedUser = { ...existingUser, googleId: 'google-uid-123', avatarUrl: googlePayload.picture };
    prisma.user.findUnique
      .mockResolvedValueOnce(null)          // googleId → not found
      .mockResolvedValueOnce(existingUser); // email → found
    prisma.user.update.mockResolvedValue(linkedUser);

    const res = await request(app).post('/api/auth/google').send({ idToken: 'valid-id-token' });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ googleId: 'google-uid-123' }) })
    );
  });

  it('returns 400 when idToken is missing', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 when Google rejects the token', async () => {
    OAuth2Client.prototype.verifyIdToken = jest.fn().mockRejectedValue(new Error('Invalid token'));

    const res = await request(app).post('/api/auth/google').send({ idToken: 'bad-token' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid google token/i);
  });
});

// ─── Apple OAuth ─────────────────────────────────────────────────────────────

describe('POST /api/auth/apple', () => {
  const applePayload = { sub: 'apple-uid-456', email: 'auser@privaterelay.appleid.com' };
  const oauthUser = { ...dbUser, id: 'user-a1', email: applePayload.email, appleId: applePayload.sub };

  function mockAppleVerify(payload = applePayload) {
    appleSignin.verifyIdToken = jest.fn().mockResolvedValue(payload);
  }

  it('creates a new user on first Apple sign-in', async () => {
    mockAppleVerify();
    bcrypt.hash.mockResolvedValue('tmp');
    prisma.user.findUnique
      .mockResolvedValueOnce(null)  // appleId
      .mockResolvedValueOnce(null); // email
    prisma.user.create.mockResolvedValue(oauthUser);

    const res = await request(app)
      .post('/api/auth/apple')
      .send({ idToken: 'valid-apple-token', name: 'Apple User' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('signs in existing user by appleId', async () => {
    mockAppleVerify();
    prisma.user.findUnique.mockResolvedValueOnce(oauthUser); // found by appleId

    const res = await request(app).post('/api/auth/apple').send({ idToken: 'valid-apple-token' });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user-a1');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('links Apple ID to an existing email account', async () => {
    mockAppleVerify();
    const existingUser = { ...dbUser, appleId: null };
    const linkedUser = { ...existingUser, appleId: applePayload.sub };
    prisma.user.findUnique
      .mockResolvedValueOnce(null)          // appleId → not found
      .mockResolvedValueOnce(existingUser); // email → found
    prisma.user.update.mockResolvedValue(linkedUser);

    const res = await request(app).post('/api/auth/apple').send({ idToken: 'valid-apple-token' });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ appleId: applePayload.sub }) })
    );
  });

  it('returns 400 when Apple omits email and user is new', async () => {
    mockAppleVerify({ sub: 'apple-uid-new', email: undefined });
    prisma.user.findUnique.mockResolvedValueOnce(null); // appleId → not found

    const res = await request(app).post('/api/auth/apple').send({ idToken: 'valid-apple-token' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when idToken is missing', async () => {
    const res = await request(app).post('/api/auth/apple').send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 when Apple rejects the token', async () => {
    appleSignin.verifyIdToken = jest.fn().mockRejectedValue(new Error('Invalid token'));

    const res = await request(app).post('/api/auth/apple').send({ idToken: 'bad-token' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid apple token/i);
  });
});
