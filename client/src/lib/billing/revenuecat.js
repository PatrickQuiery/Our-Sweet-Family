import api from '../api';
import { createIdentityAdapter, classifyPackage, validateWebKey } from './billing';
const apiKey = import.meta.env.VITE_REVENUECAT_WEB_KEY;
const allowSandbox = import.meta.env.VITE_REVENUECAT_ALLOW_SANDBOX === 'true';
const adapter = createIdentityAdapter(async appUserId => {
  if (!validateWebKey(apiKey, allowSandbox)) throw Error('Web subscriptions are not available yet.');
  const { Purchases } = await import('@revenuecat/purchases-js');
  return Purchases.configure({ apiKey, appUserId });
});
const params = familyId => familyId ? { familyId } : {};
export const billingClient = {
  configured: validateWebKey(apiKey, allowSandbox),
  setIdentity: adapter.setIdentity,
  async status(familyId) { return (await api.get('/billing/status', { params: params(familyId) })).data; },
  async sync(familyId) { return (await api.post('/billing/sync', {}, { params: params(familyId) })).data; },
  offerings(userId) {
    return adapter.run(userId, async sdk => {
      const offerings = await sdk.getOfferings();
      return (offerings.current?.availablePackages || []).map(classifyPackage).filter(Boolean);
    });
  },
  purchase(userId, pkg) {
    return adapter.run(userId, async (sdk, assertCurrent) => {
      // RevenueCat may already know about a store purchase that the API has not
      // received yet. Block checkout in that case too.
      const info = await sdk.getCustomerInfo();
      assertCurrent();
      if (info.activeSubscriptions.size > 0 || Object.keys(info.entitlements.active).length > 0) {
        const error = Error('You already have a subscription. Refresh your plan to manage it.');
        error.existingSubscription = true;
        throw error;
      }
      return sdk.purchase({ rcPackage: pkg });
    });
  },
  isCancellation: error => error?.errorCode === 1,
};
