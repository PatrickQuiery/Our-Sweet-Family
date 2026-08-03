// Manual mock for @clerk/express (auto-applied in tests). Tests set the
// authenticated Clerk user via the `x-clerk-user-id` request header; a missing
// header means "not signed in".
const clerkMiddleware = () => (req, res, next) => next();
const requireAuth = () => (req, res, next) => next();
const getAuth = (req) => ({
  userId: (req.headers && req.headers['x-clerk-user-id']) || null,
});
const clerkClient = {
  users: {
    getUser: jest.fn(),
  },
};

module.exports = { clerkMiddleware, requireAuth, getAuth, clerkClient };
