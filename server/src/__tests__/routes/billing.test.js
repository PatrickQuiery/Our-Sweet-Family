jest.mock('../../lib/prisma');
jest.mock('../../lib/billing/revenuecat',()=>({fetchCustomer:jest.fn()}));
const request=require('supertest');
const app=require('../../app');
const prisma=require('../../lib/prisma');
const {fetchCustomer}=require('../../lib/billing/revenuecat');
const NOW=Date.now();
const FUTURE=new Date(NOW+86400000).toISOString();
const snapshot=(entitlements={premium:{product_identifier:'premium_yearly',expires_date:FUTURE,grace_period_expires_date:null}})=>({request_date_ms:NOW,subscriber:{entitlements,subscriptions:{premium_yearly:{store:'app_store',is_sandbox:false,expires_date:FUTURE}},management_url:'https://apps.apple.com/account/subscriptions'}});
let owner;
beforeEach(()=>{
 jest.clearAllMocks(); process.env.REVENUECAT_WEBHOOK_SECRET='test-secret'; process.env.REVENUECAT_API_KEY='server-test-key'; delete process.env.REVENUECAT_ALLOW_SANDBOX;
 owner={id:'u1',clerkUserId:'clerk-1',plan:'free',role:'owner'};
 prisma.user.findUnique.mockImplementation(async({where})=>where.id==='u1'||where.clerkUserId==='clerk-1'?owner:null);
 prisma.user.updateMany=jest.fn().mockImplementation(async({data})=>{owner={...owner,...data};return {count:1};});
 prisma.family.findUnique.mockResolvedValue({id:'f1',ownerId:'u1',owner,members:[{userId:'member'}]});
 fetchCustomer.mockResolvedValue(snapshot());
});
const post=(event,auth='test-secret')=>request(app).post('/api/billing/revenuecat').set('Authorization',auth).send({event});
const event={id:'event-1',type:'INITIAL_PURCHASE',app_user_id:'clerk-1',environment:'PRODUCTION'};
it('requires webhook authorization before querying RevenueCat',async()=>{
 expect((await post(event,'wrong')).status).toBe(401);expect(fetchCustomer).not.toHaveBeenCalled();
});
it('authenticates TEST pings but needs no API key',async()=>{
 delete process.env.REVENUECAT_API_KEY;
 expect((await post({type:'TEST'})).status).toBe(200);expect(fetchCustomer).not.toHaveBeenCalled();
});
it('rejects malformed event envelopes without changing access',async()=>{
 expect((await post({type:'INITIAL_PURCHASE'})).status).toBe(400);expect(fetchCustomer).not.toHaveBeenCalled();
});
it('reads current customer after an expiration event instead of erasing another paid subscription',async()=>{
 const res=await post({...event,type:'EXPIRATION'});
 expect(res.status).toBe(200);expect(owner.plan).toBe('premium');
 expect(fetchCustomer).toHaveBeenCalledWith('clerk-1');
});
it('does not fetch unknown anonymous customers and returns a harmless no-op',async()=>{
 const res=await post({...event,app_user_id:'unknown'});expect(res.status).toBe(200);expect(fetchCustomer).not.toHaveBeenCalled();
});
it('reconciles all known transfer identities even when the event has no product or entitlement IDs',async()=>{
 const recipient={id:'u2',clerkUserId:'clerk-2'};
 prisma.user.findUnique.mockImplementation(async({where})=>where.id==='u1'||where.clerkUserId==='clerk-1'?owner:where.id==='u2'||where.clerkUserId==='clerk-2'?recipient:null);
 fetchCustomer.mockImplementation(async(id)=>id==='clerk-1'?{request_date_ms:NOW,subscriber:{entitlements:{},subscriptions:{}}}:snapshot());
 const res=await post({id:'transfer-1',type:'TRANSFER',transferred_from:['anonymous-old','clerk-1'],transferred_to:['anonymous-new','clerk-2']});
 expect(res.status).toBe(200);
 expect(fetchCustomer.mock.calls.map(([id])=>id)).toEqual(['clerk-1','clerk-2']);
 expect(prisma.user.updateMany.mock.calls.map(([arg])=>[arg.where.id,arg.data.plan])).toEqual([['u1','free'],['u2','premium']]);
});
it('fails retryably on RevenueCat errors instead of trusting event claims',async()=>{
 fetchCustomer.mockRejectedValue(new Error('unavailable'));
 expect((await post(event)).status).toBe(503);expect(owner.plan).toBe('free');
});
it('does not apply sandbox webhook events without explicit opt-in',async()=>{
 const res=await post({...event,environment:'SANDBOX'});expect(res.status).toBe(200);expect(fetchCustomer).not.toHaveBeenCalled();
});
it('keeps previous plan when RevenueCat returns malformed data',async()=>{
 owner.plan='plus'; fetchCustomer.mockResolvedValue({subscriber:{}});
 expect((await post(event)).status).toBe(503);expect(owner.plan).toBe('plus');
});
it('rejects client-supplied billing identity or plan',async()=>{
 const res=await request(app).post('/api/billing/sync').set('x-clerk-user-id','clerk-1').send({appUserId:'other',plan:'premium'});
 expect(res.status).toBe(400);expect(fetchCustomer).not.toHaveBeenCalled();
});
it('syncs only the authenticated account and returns trusted status',async()=>{
 const res=await request(app).post('/api/billing/sync').set('x-clerk-user-id','clerk-1').send({});
 expect(res.status).toBe(200);expect(res.body).toMatchObject({plan:'premium',effectivePlan:'premium',hasSubscription:true,canManage:true,managementURL:'https://apps.apple.com/account/subscriptions'});
 expect(fetchCustomer).toHaveBeenCalledWith('clerk-1');
});
it('redacts owner payment details for a family member while showing shared access',async()=>{
 owner.plan='premium';owner.subscriptionManagementUrl='https://billing.example.com/private-token';owner.subscriptionProductId='premium_yearly';
 prisma.user.findUnique.mockResolvedValue({id:'member',plan:'free'});
 const res=await request(app).get('/api/billing/status?familyId=f1').set('x-clerk-user-id','clerk-member');
 expect(res.status).toBe(200);expect(res.body).toMatchObject({effectivePlan:'premium',canManage:false,managementURL:null,subscriptionProductId:null});
});
it('does not allow a member, including a co-parent, to sync the owner subscription',async()=>{
 prisma.user.findUnique.mockResolvedValue({id:'member',plan:'free'});
 const res=await request(app).post('/api/billing/sync?familyId=f1').set('x-clerk-user-id','clerk-member').send({});
 expect(res.status).toBe(403);expect(fetchCustomer).not.toHaveBeenCalled();
});
it('hides billing status from nonmembers',async()=>{
 prisma.user.findUnique.mockResolvedValue({id:'stranger',plan:'free'});
 expect((await request(app).get('/api/billing/status?familyId=f1').set('x-clerk-user-id','clerk-stranger')).status).toBe(404);
});
it('requires authentication for status and sync',async()=>{
 expect((await request(app).get('/api/billing/status')).status).toBe(401);
 expect((await request(app).post('/api/billing/sync')).status).toBe(401);
});
