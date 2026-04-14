import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module so no real SQLite file is touched during tests
vi.mock('../../db.js', () => ({
  default: {
    prepare: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(null),
    }),
  },
}));

// Mock jsonwebtoken so we can control what verify returns
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

import jwt from 'jsonwebtoken';
import { authenticate, requireRole } from '../../server/middleware/auth.js';
import db from '../../db.js';

// --- Helpers -----------------------------------------------------------------

const mockReq = (overrides = {}) => ({ cookies: {}, ...overrides } as any);

const mockRes = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  return res;
};

// -----------------------------------------------------------------------------

describe('authenticate middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no cookie is present', () => {
    const req = mockReq(); // no token cookie
    const res = mockRes();
    const next = vi.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the JWT token is invalid', () => {
    const req = mockReq({ cookies: { token: 'bad-token' } });
    const res = mockRes();
    const next = vi.fn();

    (jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('invalid token');
    });

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.clearCookie).toHaveBeenCalledWith('token');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the user is not found in the database', () => {
    const req = mockReq({ cookies: { token: 'valid-token' } });
    const res = mockRes();
    const next = vi.fn();

    (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'user-123' });
    // db.prepare().get() already returns null by default from the top-level mock

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.clearCookie).toHaveBeenCalledWith('token');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and attaches user when token and user are valid', () => {
    const req = mockReq({ cookies: { token: 'valid-token' } });
    const res = mockRes();
    const next = vi.fn();

    const fakeUser = {
      id: 'user-123',
      username: 'alice',
      displayName: 'Alice',
      role: 'admin',
      mustChangePassword: 0,
    };

    (jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'user-123' });
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({
      get: vi.fn().mockReturnValue(fakeUser),
    });

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({
      id: 'user-123',
      username: 'alice',
      role: 'admin',
    });
  });
});

describe('requireRole middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when req.user is not set', () => {
    const req = mockReq(); // no user attached
    const res = mockRes();
    const next = vi.fn();

    requireRole(['admin'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden: Insufficient permissions',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the user does not have the required role', () => {
    const req = mockReq({ user: { id: '1', username: 'bob', role: 'user' } });
    const res = mockRes();
    const next = vi.fn();

    requireRole(['admin'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when the user has the required role', () => {
    const req = mockReq({ user: { id: '1', username: 'alice', role: 'admin' } });
    const res = mockRes();
    const next = vi.fn();

    requireRole(['admin'])(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() when the user has one of multiple allowed roles', () => {
    const req = mockReq({ user: { id: '2', username: 'carol', role: 'pipeline_editor' } });
    const res = mockRes();
    const next = vi.fn();

    requireRole(['admin', 'pipeline_editor'])(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
