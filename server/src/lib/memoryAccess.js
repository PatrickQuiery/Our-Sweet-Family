const prisma = require('./prisma');
const { isParent } = require('./familyAccess');

/**
 * Safely parse a value that may be a JSON array string or already an array.
 * Never throws — returns [] on malformed input.
 */
function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Load a memory only if `user` is allowed to view it, enforcing the SAME gate
 * used by GET /api/memories/:id:
 *   - the user must be the family owner or a member of the family
 *   - non-owners cannot view classified memories
 *   - a restricted loved one (accessPerChild !== 'all') may only view memories
 *     tagged with at least one child they are allowed to see (untagged memories
 *     are visible to all members)
 *
 * Returns { memory, isOwner, membership } on success, or { status, error } on
 * denial. Centralizing this prevents the access rules from drifting between the
 * feed, the detail view, reels, reactions and comments.
 */
async function loadAccessibleMemory(memoryId, user) {
  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    include: { family: { include: { members: true } } },
  });
  if (!memory) return { status: 404, error: 'Memory not found' };

  // A parent (owner or Full Access member) has full control — sees everything.
  const parent = isParent(memory.family, user.id);
  const membership = memory.family.members.find((m) => m.userId === user.id);

  if (!parent && !membership) return { status: 403, error: 'Access denied' };
  if (!parent && memory.isClassified) return { status: 403, error: 'Access denied' };

  if (!parent && membership && membership.accessPerChild !== 'all') {
    const allowed = toArray(membership.accessPerChild);
    const childIds = toArray(memory.childIds);
    const hasAccess =
      childIds.length === 0 || childIds.some((cid) => allowed.includes(cid));
    if (!hasAccess) return { status: 403, error: 'Access denied' };
  }

  return { memory, isOwner: parent, membership };
}

module.exports = { loadAccessibleMemory, toArray };
