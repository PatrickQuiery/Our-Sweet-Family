// Keep these identifiers aligned with the RevenueCat offering. Never infer a paid
// tier from a substring in an arbitrary product name.
const PACKAGES = {
  plus_yearly: ['plus', 'annual'], premium_yearly: ['premium', 'annual'],
  osf_plus_yearly: ['plus', 'annual'], osf_premium_yearly: ['premium', 'annual'],
  plus_monthly: ['plus', 'monthly'], plus_annual: ['plus', 'annual'],
  premium_monthly: ['premium', 'monthly'], premium_annual: ['premium', 'annual'],
  osf_plus_monthly: ['plus', 'monthly'], osf_plus_annual: ['plus', 'annual'],
  osf_premium_monthly: ['premium', 'monthly'], osf_premium_annual: ['premium', 'annual'],
};
export function classifyPackage(pkg) {
  const product = pkg?.webBillingProduct;
  const productMapping = PACKAGES[product?.identifier];
  const packageMapping = PACKAGES[pkg?.identifier];
  if (productMapping && packageMapping && productMapping.join() !== packageMapping.join()) return null;
  const mapping = productMapping || packageMapping;
  if (!mapping || !product?.price?.formattedPrice) return null;
  const [tier, period] = mapping;
  if (product.normalPeriodDuration !== (period === 'annual' ? 'P1Y' : 'P1M')) return null;
  return { tier, period, price: product.price.formattedPrice, pkg };
}
export function checkoutAvailable(status) {
  return Boolean(status?.canManage && status.syncAvailable && !status.hasSubscription);
}
export function managementUrl(status) {
  if (!status?.canManage) return null;
  try {
    const url = new URL(status.managementURL);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* use originating store below */ }
  const store = status.subscriptionStore?.toUpperCase();
  if (store === 'APP_STORE' || store === 'MAC_APP_STORE') return 'https://apps.apple.com/account/subscriptions';
  if (store === 'PLAY_STORE') return 'https://play.google.com/store/account/subscriptions';
  return null;
}
export function validateWebKey(key, allowSandbox = false) {
  return typeof key === 'string' && (/^rcb_[A-Za-z0-9]+$/.test(key) || (allowSandbox && /^test_[A-Za-z0-9]+$/.test(key)));
}
export async function syncPurchase(sync, tier, delay = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  let status = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await delay(1200 * attempt);
    try {
      status = await sync();
      // Referral boosts alone are not evidence that a store purchase propagated.
      if (status.hasSubscription && (status.plan === tier || status.plan === 'premium')) return { confirmed: true, status };
    } catch { /* bounded retries; never imply that the purchase itself failed */ }
  }
  return { confirmed: false, status };
}
export function createIdentityAdapter(configure) {
  let desiredId = null;
  let revision = 0;
  let instance;
  let identifiedId;
  let queue = Promise.resolve();
  return {
    setIdentity(id) {
      if (desiredId !== id) { desiredId = id; revision++; }
    },
    run(id, operation) {
      const currentRevision = revision;
      const assertCurrent = () => {
        if (!id || id !== desiredId || currentRevision !== revision) throw Error('Your account changed. Please try again.');
      };
      const task = queue.then(async () => {
        assertCurrent();
        if (!instance) { instance = await configure(id); identifiedId = id; }
        else if (identifiedId !== id) { await instance.changeUser(id); identifiedId = id; }
        assertCurrent();
        const result = await operation(instance, assertCurrent);
        assertCurrent();
        return result;
      });
      queue = task.catch(() => {});
      return task;
    },
  };
}
