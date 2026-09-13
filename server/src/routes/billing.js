const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { mapSubscriber } = require('../lib/billing/entitlements');
const { applyEntitlement, findUser } = require('../lib/billing/applyEntitlement');
const { fetchCustomer } = require('../lib/billing/revenuecat');
const { billingStatus } = require('../lib/billing/status');
const router = express.Router();

function secretsMatch(provided, secret) {
  if (typeof provided !== 'string' || !secret) return false;
  const a = Buffer.from(provided), b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a,b);
}
const allowSandbox = () => process.env.REVENUECAT_ALLOW_SANDBOX === 'true';
async function syncUser(user) {
  if (!user.clerkUserId) throw new Error('Billing identity unavailable');
  const snapshot = await fetchCustomer(user.clerkUserId);
  const mapped = mapSubscriber(snapshot, { allowSandbox: allowSandbox() });
  return applyEntitlement(prisma, user, mapped);
}

router.post('/revenuecat', async (req,res) => {
  if (!process.env.REVENUECAT_WEBHOOK_SECRET) return res.status(503).json({error:'Webhook not configured'});
  if (!secretsMatch(req.headers.authorization,process.env.REVENUECAT_WEBHOOK_SECRET)) return res.status(401).json({error:'Invalid authorization'});
  const e=req.body?.event;
  if (!e || typeof e.type !== 'string') return res.status(400).json({error:'Invalid webhook event'});
  if (e.type === 'TEST') return res.json({ok:true,applied:false,reason:'test'});
  if (e.environment === 'SANDBOX' && !allowSandbox()) return res.json({ok:true,applied:false,reason:'sandbox_disabled'});
  const ids=e.type==='TRANSFER' ? [...(Array.isArray(e.transferred_from)?e.transferred_from:[]),...(Array.isArray(e.transferred_to)?e.transferred_to:[])]
    : [e.app_user_id,...(Array.isArray(e.aliases)?e.aliases:[])];
  if (typeof e.id !== 'string' || !e.id || !ids.length || ids.some(id=>typeof id!=='string'||!id||id.length>512) || ids.length>100) {
    return res.status(400).json({error:'Invalid webhook event'});
  }
  try {
    const handled=new Set(); let applied=0;
    for (const id of new Set(ids)) {
      const user=await findUser(prisma,id);
      if (!user || handled.has(user.id)) continue;
      handled.add(user.id);
      const result=await syncUser(user);
      if(result.applied) applied++;
    }
    return res.json({ok:true,applied:applied>0,processed:handled.size});
  } catch {
    // RevenueCat retries failures. Never acknowledge a failed reconciliation or
    // substitute a product-name guess for trusted access.
    return res.status(503).json({error:'Subscription sync temporarily unavailable'});
  }
});

async function ownerContext(req,res,next) {
  res.set('Cache-Control','no-store');
  const familyId=req.query.familyId;
  if (familyId===undefined) { req.billingOwner=req.user;req.canManageBilling=true;return next(); }
  if (typeof familyId!=='string' || !familyId || familyId.length>128) return res.status(400).json({error:'Invalid family'});
  try {
    const family=await prisma.family.findUnique({where:{id:familyId},include:{owner:true,members:{select:{userId:true}}}});
    if (!family || (family.ownerId!==req.user.id && !family.members.some(m=>m.userId===req.user.id))) return res.status(404).json({error:'Family not found'});
    req.billingOwner=family.owner;
    req.canManageBilling=family.ownerId===req.user.id;
    return next();
  } catch { return res.status(503).json({error:'Subscription status temporarily unavailable'}); }
}
router.get('/status',authenticate,ownerContext,(req,res)=>res.json(billingStatus(req.billingOwner,req.canManageBilling)));
const syncLimit=rateLimit({windowMs:60000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,keyGenerator:req=>req.user.id,
  message:{error:'Please wait a moment before refreshing your subscription again.'}});
router.post('/sync',authenticate,ownerContext,syncLimit,async(req,res)=>{
  if(!req.canManageBilling) return res.status(403).json({error:'Only the family owner can manage the subscription'});
  if(req.body && Object.keys(req.body).length) return res.status(400).json({error:'Subscription identity is determined by your signed-in account'});
  if(!process.env.REVENUECAT_API_KEY) return res.status(503).json({error:'Subscription sync is not configured'});
  try {
    await syncUser(req.billingOwner);
    const current=await prisma.user.findUnique({where:{id:req.billingOwner.id}});
    return res.json(billingStatus(current,true));
  } catch { return res.status(503).json({error:'Your subscription is still syncing. Please try again shortly.'}); }
});
module.exports=router;
