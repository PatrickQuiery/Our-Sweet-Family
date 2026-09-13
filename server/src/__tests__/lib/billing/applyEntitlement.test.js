const { applyEntitlement } = require('../../../lib/billing/applyEntitlement');
const mapped = {plan:'premium',subscriptionStatus:'active',subscriptionStore:'app_store',subscriptionProductId:'premium_yearly',subscriptionExpiresAt:new Date('2030-01-01'),subscriptionWillRenew:true,subscriptionSyncedAt:new Date('2026-09-12'),subscriptionManagementUrl:'https://apps.apple.com/account/subscriptions',subscriptionSnapshot:{version:1,entitlements:[],subscriptions:[]}};
it('conditionally persists only a newer trusted snapshot and leaves referral boosts untouched',async()=>{
 const db={user:{updateMany:jest.fn().mockResolvedValue({count:1})}};
 await applyEntitlement(db,{id:'u1'},mapped);
 expect(db.user.updateMany).toHaveBeenCalledWith({where:{id:'u1',OR:[{subscriptionSyncedAt:null},{subscriptionSyncedAt:{lt:new Date('2026-09-12')}}]},data:expect.objectContaining({plan:'premium',subscriptionSyncedAt:new Date('2026-09-12')})});
 expect(db.user.updateMany.mock.calls[0][0].data).not.toHaveProperty('planBoostUntil');
});
it('reports duplicate or older snapshots without claiming a new grant',async()=>{
 const db={user:{updateMany:jest.fn().mockResolvedValue({count:0})}};
 expect(await applyEntitlement(db,{id:'u1'},mapped)).toMatchObject({applied:false,reason:'stale_snapshot'});
});
