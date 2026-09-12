/** Run inside the identity session's exclusive action, immediately before checkout. */
export async function purchaseWithFreshStatus<T extends { activeSubscriptions: string[]; entitlements: { active: Record<string, unknown> } }, R>(deps: {
  invalidate: () => Promise<void>; read: () => Promise<T>; purchase: () => Promise<R>;
  accept: (info: T) => void; isCurrent: () => boolean;
}): Promise<R> {
  await deps.invalidate();
  const info = await deps.read();
  if (!deps.isCurrent()) throw new Error('Account changed. Please try again.');
  deps.accept(info);
  if (info.activeSubscriptions.length > 0 || Object.keys(info.entitlements.active).length > 0) {
    throw new Error('A subscription already exists. Manage your subscription instead.');
  }
  return deps.purchase();
}
