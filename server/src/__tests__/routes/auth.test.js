jest.mock('../../lib/prisma');
jest.mock('bcryptjs');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../lib/prisma');

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
