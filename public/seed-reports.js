// Seed script: write a mock `reports/daily_summary` document for local testing
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
import {
  getFirestore,
  doc,
  setDoc,
  Timestamp,
  getDocs,
  collection,
  query,
  where,
  orderBy
} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';

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

export async function seedReportsDaily(options = {}){
  console.log('Seeding reports/daily_summary...');

  // Try to compute top10Content from the `content` collection
  let top10Weekly = [];
  try{
    const contentSnap = await getDocs(collection(db, 'content'));
    const contents = contentSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    // sort by totalWatchMinutes desc (fallback to followerCount)
    const sorted = contents.sort((a,b) => (b.totalWatchMinutes||0) - (a.totalWatchMinutes||0));
    top10Weekly = sorted.slice(0,10).map((c, idx) => ({
      contentId: c.id,
      title: c.title || 'Untitled',
      watchMinutes: c.totalWatchMinutes || 0,
      followerCount: c.followerCount || 0
    }));
  }catch(err){
    console.warn('seedReportsDaily: failed to load content collection, falling back to sample', err);
    const sampleContent = [
      'movie-spirited-away','movie-your-name','series-one-piece','series-adventure-time',
      'series-demon-slayer','series-naruto-shippuden','series-jujutsu-kaisen','movie-akira'
    ];
    top10Weekly = sampleContent.slice(0,8).map((id, idx) => ({
      contentId: id,
      title: id.replace(/[-]/g,' ').replace(/\b\w/g, c => c.toUpperCase()),
      watchMinutes: randInt(2000, 40000),
      followerCount: randInt(200, 120000)
    }));
  }

  // Compute packageDistribution from users collection (active subscriptions)
  let packageDistribution = { free:0, monthly:0, yearly:0 };
  try{
    const usersSnap = await getDocs(collection(db, 'users'));
    usersSnap.docs.forEach(d => {
      const u = d.data() || {};
      const sub = u.subscription || {};
      if(sub.status === 'active'){
        const pid = sub.packageId || 'free';
        if(packageDistribution.hasOwnProperty(pid)) packageDistribution[pid]++;
        else packageDistribution.free++;
      } else {
        // treat non-active as free for distribution counts
        packageDistribution.free++;
      }
    });
  }catch(err){
    console.warn('seedReportsDaily: failed to compute packageDistribution, using defaults', err);
    packageDistribution = { free: 320, monthly: 780, yearly: 150 };
  }

  // monthly trends for last 12 months with renewal & churn percentages
  const monthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const monthlyTrends = [];
  for(let i=0;i<12;i++){
    // generate a smooth-ish renewal ~60-95, churn ~2-12
    const baseRenewal = 65 + Math.round(Math.sin(i/2) * 12) + randInt(-4,6);
    const baseChurn = 4 + Math.round(Math.cos(i/3) * 3) + randInt(-2,3);
    monthlyTrends.push({ month: monthNames[i], renewal: Math.max(0, Math.min(100, baseRenewal)), churn: Math.max(0, Math.min(100, baseChurn)) });
  }

  const last = monthlyTrends[monthlyTrends.length - 1] || { renewal: 70, churn: 5 };

  const dailySummary = {
    renewalRate: last.renewal,
    churnRate: last.churn,
    renewalChange: 0,
    churnChange: 0,
    top10Weekly,
    top10Content: top10Weekly,
    packageDistribution,
    monthlyTrends,
    lastUpdated: Timestamp.now()
  };

  try{
    await setDoc(doc(db, 'reports', 'daily_summary'), dailySummary);
    console.log('✅ reports/daily_summary written');
    return 'reports/daily_summary seeded';
  }catch(e){
    console.error('Failed to write reports/daily_summary', e);
    throw e;
  }
}

// Auto-run in browser for convenience
if(typeof window !== 'undefined'){
  window.addEventListener('load', () => {
    seedReportsDaily().then(msg => console.log(msg)).catch(err => console.error(err));
  });
}
