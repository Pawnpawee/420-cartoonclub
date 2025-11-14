// Unified seeder: seeds packages, content, episodes, users, and payments
import { seedContentCollection } from './seed-databse.js';
import { seedPackagesCollection } from './seed-packages.js';
import { seedEpisodesCollection } from './seed-episodes.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
import {
  getFirestore,
  writeBatch,
  doc,
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

  console.log('Full seeding finished');
  return 'done';
}

// auto-run in browser for convenience
if(typeof window !== 'undefined'){
  window.addEventListener('load', () => {
    seedAll().then(() => console.log('seedAll complete')).catch(err => console.error(err));
  });
}
