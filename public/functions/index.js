const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * A scheduled Cloud Function that runs once every 24 hours to calculate
 * all report metrics and save them to a single summary document.
 */
exports.calculateDailySummary = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .pubsub.schedule('every 24 hours')
  .onRun(async (context) => {
    console.log('🚀 Starting scheduled daily summary calculation.');
    try {
      await calculateAndSaveReports();
      console.log('✅ Successfully completed scheduled summary calculation.');
    } catch (error) {
      console.error('❌ Scheduled summary calculation failed:', error);
      // Optionally, you can add more error reporting here (e.g., to a monitoring service)
    }
    return null;
});

/**
 * An HTTP-callable function to allow manual triggering of the report calculation.
 * Useful for testing or on-demand updates.
 */
exports.calculateReportsManually = functions.https.onCall(async (data, context) => {
  // Optional: Add a check to ensure only authenticated admins can run this.
  // if (!context.auth || context.auth.token.role !== 'admin') {
  //   throw new functions.https.HttpsError('permission-denied', 'Only admins can trigger this function.');
  // }

  console.log('🚀 Starting manual summary calculation.');
  try {
    await calculateAndSaveReports();
    console.log('✅ Successfully completed manual summary calculation.');
    return { success: true, message: 'Reports calculated successfully.' };
  } catch (error) {
    console.error('❌ Manual summary calculation failed:', error);
    throw new functions.https.HttpsError('internal', 'An error occurred while calculating reports.', error.message);
  }
});


/**
 * Main logic to calculate all report metrics and save them to Firestore.
 */
async function calculateAndSaveReports() {
  console.log('📊 Calculating reports data...');
  
  // 1. Fetch all necessary data
  const usersSnapshot = await db.collection('users').get();
  const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const contentSnapshot = await db.collection('content').get();
  const allContent = contentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Filter out admin users for member-related calculations
  const members = users.filter(u => (u.role || '').toLowerCase() !== 'admin');

  // 2. Perform all calculations in parallel
  const [
    totalRevenue,
    newMembers,
    churnRate,
    renewalRate,
    packageDistribution,
    revenueByPackage,
    top10Content,
    top10Weekly,
    monthlyTrends
  ] = await Promise.all([
    calculateTotalRevenue(members),
    calculateNewMembers(members),
    calculateChurnRate(members),
    calculateRenewalRate(members),
    calculatePackageDistribution(members),
    calculateRevenueByPackage(members),
    calculateTop10Content(allContent),
    calculateTop10ContentWeekly(allContent),
    calculateMonthlyTrends(members)
  ]);

  const totalMembers = members.filter(user => user.subscription && user.subscription.status === 'active').length;

  // 3. Assemble the final summary document
  const mainSummary = {
    totalRevenue,
    newMembers,
    churnRate,
    renewalRate,
    totalMembers,
    packageDistribution,
    revenueByPackage,
    top10Content,
    top10Weekly,
    monthlyTrends, // Array of 12 months of data
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  };

  // 4. Save the single summary document
  await db.collection('reports').doc('main_summary').set(mainSummary);
  
  console.log('✅ main_summary document updated successfully.');
}


// --- Calculation Helper Functions ---

async function calculateTotalRevenue(users) {
  let total = 0;
  const allPayments = await db.collectionGroup('payments').where('status', '==', 'succeeded').get();
  
  // Create a set of member IDs for quick lookup
  const memberIds = new Set(users.map(u => u.id));

  allPayments.forEach(doc => {
    // Ensure the payment belongs to a non-admin user
    const userPath = doc.ref.parent.parent; // path is users/{userId}
    if (userPath && memberIds.has(userPath.id)) {
      const amount = Number(doc.data().amount || 0);
      if (!isNaN(amount)) {
        total += amount;
      }
    }
  });
  return total;
}

function calculateNewMembers(users) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return users.filter(user => {
    if (!user.createdAt) return false;
    const createdDate = user.createdAt.toDate();
    return createdDate >= thirtyDaysAgo;
  }).length;
}

function calculateChurnRate(users) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const activeAtStartOfMonth = users.filter(user => {
        if (!user.subscription || !user.createdAt) return false;
        const createdDate = user.createdAt.toDate();
        const subEndDate = user.subscription.endDate ? user.subscription.endDate.toDate() : null;
        
        // Was active if created before this month and subscription was active at the start of the month
        return createdDate < startOfMonth && (!subEndDate || subEndDate >= startOfMonth);
    }).length;

    const churnedThisMonth = users.filter(user => {
        if (!user.subscription || !user.subscription.endDate) return false;
        const subEndDate = user.subscription.endDate.toDate();
        return subEndDate >= startOfMonth && subEndDate <= now;
    }).length;

    if (activeAtStartOfMonth === 0) return 0;
    const rate = (churnedThisMonth / activeAtStartOfMonth) * 100;
    return parseFloat(rate.toFixed(1));
}

function calculateRenewalRate(users) {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const eligibleForRenewal = users.filter(user => {
        if (!user.subscription || !user.subscription.endDate) return false;
        const subEndDate = user.subscription.endDate.toDate();
        // Eligible if their subscription was supposed to end in the last 30 days
        return subEndDate >= thirtyDaysAgo && subEndDate <= now;
    });

    const renewed = eligibleForRenewal.filter(user => user.subscription.status === 'active');

    if (eligibleForRenewal.length === 0) return 0;
    const rate = (renewed.length / eligibleForRenewal.length) * 100;
    return parseFloat(rate.toFixed(1));
}

function calculatePackageDistribution(users) {
  const distribution = { free: 0, monthly: 0, yearly: 0 };
  users.forEach(user => {
    if (user.subscription && user.subscription.status === 'active') {
      const packageId = user.subscription.packageId || 'free';
      if (distribution.hasOwnProperty(packageId)) {
        distribution[packageId]++;
      }
    }
  });
  return distribution;
}

async function calculateRevenueByPackage(users) {
  const revenue = { free: 0, monthly: 0, yearly: 0 };
  const memberIds = new Set(users.map(u => u.id));
  const allPayments = await db.collectionGroup('payments').where('status', '==', 'succeeded').get();

  allPayments.forEach(doc => {
    const userPath = doc.ref.parent.parent;
    if (userPath && memberIds.has(userPath.id)) {
      const pdata = doc.data();
      const amount = Number(pdata.amount || 0);
      const packageId = pdata.packageId || 'free'; // Use packageId from payment if available
      if (!isNaN(amount) && revenue.hasOwnProperty(packageId)) {
        revenue[packageId] += amount;
      }
    }
  });
  return revenue;
}

function calculateTop10Content(allContent) {
  return allContent
    .sort((a, b) => (b.totalWatchMinutes || 0) - (a.totalWatchMinutes || 0))
    .slice(0, 10)
    .map(c => ({
      contentId: c.id,
      title: c.title || 'Unknown',
      watchMinutes: c.totalWatchMinutes || 0,
      followerCount: c.followerCount || 0
    }));
}

async function calculateTop10ContentWeekly(allContent) {
    const now = new Date();
    const weekKey = getWeekKey(now);
    const weeklyData = [];

    for (const content of allContent) {
        const weeklyDocRef = db.collection('content').doc(content.id).collection('weekly').doc(weekKey);
        const weeklySnap = await weeklyDocRef.get();
        
        let minutes = 0;
        if (weeklySnap.exists) {
            minutes = weeklySnap.data().minutes || 0;
        }
        weeklyData.push({
            contentId: content.id,
            title: content.title || 'Unknown',
            watchMinutes: minutes,
            followerCount: content.followerCount || 0
        });
    }

    return weeklyData
        .sort((a, b) => b.watchMinutes - a.watchMinutes)
        .slice(0, 10);
}

async function calculateMonthlyTrends(users) {
  const trends = [];
  const now = new Date();
  const memberIds = new Set(users.map(u => u.id));
  const allPayments = await db.collectionGroup('payments').where('status', '==', 'succeeded').get();

  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    
    let monthRevenue = 0;
    allPayments.forEach(doc => {
      const userPath = doc.ref.parent.parent;
      if (userPath && memberIds.has(userPath.id)) {
        const pdata = doc.data();
        if (pdata.date) {
          const paymentDate = pdata.date.toDate();
          if (paymentDate >= monthDate && paymentDate < nextMonthDate) {
            monthRevenue += Number(pdata.amount || 0);
          }
        }
      }
    });

    const monthNewMembers = users.filter(user => {
      if (!user.createdAt) return false;
      const createdDate = user.createdAt.toDate();
      return createdDate >= monthDate && createdDate < nextMonthDate;
    }).length;
    
    trends.push({
      year: monthDate.getFullYear(),
      month: monthDate.getMonth() + 1, // 1-12
      revenue: monthRevenue,
      newMembers: monthNewMembers
    });
  }
  return trends;
}

function getWeekKey(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}_W${String(weekNo).padStart(2, '0')}`;
}
