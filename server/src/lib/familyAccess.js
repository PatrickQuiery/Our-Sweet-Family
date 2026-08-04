// A "parent" has full control of a family — identical to the account creator.
// That's the family owner, OR an invited member granted Full Access ('all').
// Requires the family's `members` to be loaded on the passed object.
function isParent(family, userId) {
  if (!family || !userId) return false;
  if (family.ownerId === userId) return true;
  return (family.members || []).some((m) => m.userId === userId && m.permissions === 'all');
}

module.exports = { isParent };
