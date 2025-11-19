// Unified seeder: seeds packages, content, episodes, users, and payments
import { seedContentCollection } from './seed-databse.js';
import { seedPackagesCollection } from './seed-packages.js';
import { seedEpisodesCollection } from './seed-episodes.js';
import { seedReportsDaily } from './seed-reports.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
import {
  getFirestore,
  writeBatch,
  doc,
  setDoc,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';

// copy firebase config (same as other seed files)
const firebaseConfig = {
  apiKey: "AIzaSyBF9-h8iLcvwJZ4_d_YC7mnIyTAY5fY_6I",
  authDomain: "logincartoonclub.firebaseapp.com",
  projectId: "logincartoonclub",
  storageBucket: "logincartoonclub.firebasestorage.app",
  messagingSenderId: "916222025571",
  appId: "1:916222025571:web:d5e2dc68f36489ed93bd56",
  measurementId: "G-NL2226PG1V"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function randInt(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }
function randChoice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function isoDatePastDays(days){ return new Date(Date.now() - randInt(0, days) * 24*60*60*1000); }

function getWeekKey(d){
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
  return `${date.getUTCFullYear()}_W${String(weekNo).padStart(2,'0')}`;
}

async function seedContentWeekly(){
  // read content docs and add a weekly document for current week with random minutes
  const { collection, getDocs, setDoc } = await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js');
  const contentSnap = await getDocs(collection(db, 'content'));
  const weekKey = getWeekKey(new Date());
  let batch = writeBatch(db);
  let opCount = 0;
  for(const cdoc of contentSnap.docs){
    const cid = cdoc.id;
    const minutes = Math.floor(Math.random() * 20000); // 0..20k weekly minutes
    const docRef = doc(db, 'content', cid, 'weekly', weekKey);
    batch.set(docRef, { minutes, updatedAt: Timestamp.now() });
    opCount++;
    if(opCount >= 400){
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
    }
  }
  if(opCount>0) await batch.commit();
}

/**
 * Calculate a mock summary from seeded data and save it to `reports/main_summary`.
 * This is intended for local seeding/testing so the frontend can read one document.
 */
async function calculateMockSummary(){
  const { collection, collectionGroup, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js');
  console.log('Calculating mock summary from seeded data...');

  // load users and content
  const usersSnap = await getDocs(collection(db, 'users'));
  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const members = users.filter(u => (u.role || '').toLowerCase() !== 'admin');

  const contentSnap = await getDocs(collection(db, 'content'));
  const allContent = contentSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // load all succeeded payments via collectionGroup
  let payments = [];
  try{
    const paymentsSnap = await getDocs(query(collectionGroup(db, 'payments'), where('status','==','succeeded')));
    payments = paymentsSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  }catch(e){
    console.warn('collectionGroup payments failed, falling back to per-user scan', e);
    // fallback: collect payments by iterating users (best-effort)
    for(const u of users){
      try{
        const userPaymentsSnap = await getDocs(collection(db, 'users', u.id, 'payments'));
        userPaymentsSnap.forEach(p => { if((p.data().status||'')==='succeeded') payments.push({ id:p.id, ...p.data(), ref: p.ref }); });
      }catch(err){/* ignore per-user */}
    }
  }

  // total revenue
  const totalRevenue = payments.reduce((s,p) => s + Number(p.amount || 0), 0);

  // new members in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000);
  const newMembers = members.filter(u => {
    if(!u.createdAt) return false;
    const d = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
    return d >= thirtyDaysAgo;
  }).length;

  // package distribution (active users)
  const packageDistribution = { free:0, monthly:0, yearly:0 };
  members.forEach(u => {
    if(u.subscription && u.subscription.status === 'active'){
      const pid = u.subscription.packageId || 'free';
      if(packageDistribution.hasOwnProperty(pid)) packageDistribution[pid]++;
      else packageDistribution.free++;
    }
  });

  // revenue by package (from payments.packageId if present)
  const revenueByPackage = { free:0, monthly:0, yearly:0 };
  payments.forEach(p => {
    const pkg = p.packageId || 'free';
    if(revenueByPackage.hasOwnProperty(pkg)) revenueByPackage[pkg] += Number(p.amount || 0);
    else revenueByPackage.free += Number(p.amount || 0);
  });

  // top10 content by totalWatchMinutes
  const top10Content = allContent.sort((a,b)=> (b.totalWatchMinutes||0)-(a.totalWatchMinutes||0)).slice(0,10).map(c=>({ contentId: c.id, title: c.title||'Unknown', watchMinutes: c.totalWatchMinutes||0, followerCount: c.followerCount||0 }));

  // top10 weekly: approximate by using top10Content (mock)
  const top10Weekly = top10Content.map(c => ({ ...c, watchMinutes: Math.floor(c.watchMinutes * 0.5) }));

  // monthly trends (12 months): aggregate payments by month
  const now = new Date();
  const monthlyRevenue = [];
  for(let i=11;i>=0;i--){
    const monthStart = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth()+1, 1);
    const monthRevenue = payments.reduce((s,p)=>{
      const pd = p.date && p.date.toDate ? p.date.toDate() : (p.date ? new Date(p.date) : null);
      if(pd && pd >= monthStart && pd < monthEnd) return s + Number(p.amount||0);
      return s;
    },0);
    monthlyRevenue.push(monthRevenue);
  }

  const monthlyTrends = monthlyRevenue.map((rev, idx) => ({
    year: new Date(now.getFullYear(), now.getMonth()-11+idx,1).getFullYear(),
    month: new Date(now.getFullYear(), now.getMonth()-11+idx,1).getMonth()+1,
    revenue: rev
  }));

  const mainSummary = {
    totalRevenue,
    newMembers,
    churnRate: 0,
    renewalRate: 0,
    totalMembers: members.filter(u=>u.subscription && u.subscription.status==='active').length,
    packageDistribution,
    revenueByPackage,
    top10Content,
    top10Weekly,
    monthlyRevenue,
    monthlyTrends,
    lastUpdated: Timestamp.now()
  };

  try{
    await setDoc(doc(db, 'reports', 'main_summary'), mainSummary);
    console.log('Mock main_summary written to Firestore');
  }catch(e){
    console.error('Failed to write mock main_summary', e);
    throw e;
  }
}

export async function seedUsersAndPayments(options = {}){
  const totalUsers = Number(options.totalUsers ?? 120);
  const admins = Number(options.admins ?? 3);
  const maxPaymentsPerUser = Number(options.maxPaymentsPerUser ?? 8);
  const batchLimit = Number(options.batchLimit ?? 450);

  const firstNames = ['Somchai','Aroon','Narin','Pim','May','Nok','Kai','Lek','Tom','Anna'];
  const lastNames = ['Srisuk','Chaiyapan','Kittipong','Somboon','Wanida','Praew','Narin','Phan','Suda','Kong'];
  const phonePrefixes = ['081','082','083','084','085'];
  const packages = ['free','monthly','yearly'];

  let batch = writeBatch(db);
  let opCount = 0;
  let created = 0;

  try{
    for(let i=0;i<totalUsers;i++){
      const isAdmin = i < admins;
      const uid = isAdmin ? `admin-${i+1}` : `user-${i+1}`;
      const firstName = randChoice(firstNames);
      const lastName = randChoice(lastNames);
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i+1}@example.com`;
      const phone = `${randChoice(phonePrefixes)}${randInt(1000000,9999999)}`;
      const createdAt = Timestamp.fromDate(isoDatePastDays(365));

      // package probability: free 30%, monthly 45%, yearly 25%
      const packageRand = Math.random();
      let packageId;
      if (isAdmin) packageId = 'free';
      else if (packageRand < 0.30) packageId = 'free';
      else if (packageRand < 0.75) packageId = 'monthly';
      else packageId = 'yearly';

      // Decide if this user had a subscription end date within the last 30 days (due for renewal)
      const dueForRenewal = !isAdmin && Math.random() < 0.28; // ~28% of users due this month
      let endDateDate;
      if (dueForRenewal) {
        endDateDate = new Date(Date.now() - randInt(0,29) * 24*60*60*1000);
      } else {
        // either far past or in future
        endDateDate = isoDatePastDays(400);
      }

      // If due, decide renewed vs churned
      let status;
      let autoRenew = false;
      if (isAdmin) {
        status = 'active';
        autoRenew = false;
      } else if (dueForRenewal) {
        // 70% renewed, 30% churned
        if (Math.random() < 0.70) {
          status = 'active';
          autoRenew = true;
        } else {
          status = Math.random() > 0.5 ? 'expired' : 'inactive';
          autoRenew = false;
        }
      } else {
        // normal users: mostly active
        status = Math.random() < 0.78 ? 'active' : (Math.random() < 0.6 ? 'inactive' : 'expired');
        autoRenew = status === 'active' && packageId !== 'free' ? (Math.random() > 0.4) : false;
      }

      const subscription = {
        status,
        packageId,
        startDate: Timestamp.fromDate(isoDatePastDays(800)),
        endDate: Timestamp.fromDate(endDateDate),
        autoRenew,
        paymentMethodId: packageId !== 'free' ? `pm_${uid}` : null
      };

      const userDocRef = doc(db, 'users', uid);
      const userData = {
        uid,
        email,
        firstName,
        lastName,
        phone,
        profileImageURL: null,
        createdAt,
        role: isAdmin ? 'admin' : 'user',
        subscription
      };

      batch.set(userDocRef, userData);
      opCount++; created++;

      // add payments as separate writes in the same batch (subcollection docs)
      // Generate payments across the last 12 months. Ensure if user renewed we create a succeeded payment near endDate
      const paymentsCount = isAdmin ? 0 : randInt(0, maxPaymentsPerUser);
      for(let p=0;p<paymentsCount;p++){
        const payId = `pay_${Date.now()}_${i}_${p}_${Math.floor(Math.random()*1000)}`;
        // spread payments across 0..365 days
        const payDateObj = new Date(Date.now() - randInt(0, 365) * 24*60*60*1000);
        const payDate = Timestamp.fromDate(payDateObj);
        const amount = packageId === 'yearly' ? 1500 : (packageId === 'monthly' ? 159 : (Math.random() > 0.8 ? 59 : 0));
        const isSucceeded = Math.random() > 0.12;

        const paymentDocRef = doc(db, 'users', uid, 'payments', payId);
        const payData = {
          amount,
          date: payDate,
          status: isSucceeded ? 'succeeded' : 'failed',
          packageId,
          invoiceURL: null
        };
        batch.set(paymentDocRef, payData);
        opCount++;
      }

      // If user was dueForRenewal and marked as renewed, add a succeeded payment close to endDate
      if (dueForRenewal && status === 'active' && packageId !== 'free'){
        const payId = `pay_renew_${Date.now()}_${i}`;
        const payDate = Timestamp.fromDate(new Date(endDateDate.getTime() - randInt(0,2)*24*60*60*1000));
        const amount = packageId === 'yearly' ? 1500 : 159;
        const paymentDocRef = doc(db, 'users', uid, 'payments', payId);
        const payData = { amount, date: payDate, status: 'succeeded', packageId, invoiceURL: null };
        batch.set(paymentDocRef, payData);
        opCount++;
      }

      if(opCount >= batchLimit){
        console.log(`Committing batch of ${opCount} operations...`);
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }

    if(opCount>0){
      console.log(`Committing final batch of ${opCount} operations...`);
      await batch.commit();
    }

    return `✅ Seed Users & Payments: created ${created} users`;
  }catch(e){
    console.error('Error seeding users/payments:', e);
    throw e;
  }
}

export async function seedAll(){
  console.log('Starting full seed: packages, content, episodes, users, payments');
  try{
    const pk = await seedPackagesCollection();
    console.log(pk);
  }catch(e){ console.warn('seedPackagesCollection failed:', e); }

  try{
    const c = await seedContentCollection();
    console.log(c);
  }catch(e){ console.warn('seedContentCollection failed:', e); }

  try{
    const ep = await seedEpisodesCollection();
    console.log(ep);
  }catch(e){ console.warn('seedEpisodesCollection failed:', e); }

  try{
    const up = await seedUsersAndPayments();
    console.log(up);
  }catch(e){ console.warn('seedUsersAndPayments failed:', e); }

  // seed weekly summaries for content to support top10Weekly
  try{
    await seedContentWeekly();
    console.log('Seeded weekly content summaries');
  }catch(e){ console.warn('seedContentWeekly failed:', e); }

  // Calculate and write a mock main_summary so frontend can read a single document
  try{
    await calculateMockSummary();
    console.log('Calculated and wrote mock main_summary');
  }catch(e){ console.warn('calculateMockSummary failed:', e); }

  // Also write a daily_summary (used by reports page)
  try{
    await seedReportsDaily();
    console.log('Calculated and wrote daily_summary');
  }catch(e){ console.warn('seedReportsDaily failed:', e); }

  console.log('Full seeding finished');
  return 'done';
}

// auto-run in browser for convenience
if(typeof window !== 'undefined'){
  window.addEventListener('load', () => {
    seedAll().then(() => console.log('seedAll complete')).catch(err => console.error(err));
  });
}
