/**
 * Backend Function สำหรับคำนวณข้อมูลสรุป (Reports)
 * ทำงานทุก 3 นาที (180,000 ms) เพื่ออัปเดตข้อมูล reports collection
 */

import { db } from '../firebase-controller.js';
import {
  collection,
  collectionGroup,
  getDocs,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';

class ReportsCalculator {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this._unsubscribeFns = []; // store real-time listener unsubscribe functions
    this._calculatePending = false; // avoid overlapping calculate calls
    this.isCalculating = false;
    this.lastCalculatedAt = null;
  }

  /**
   * เริ่มการทำงานอัตโนมัติ (ทุก 3 นาที)
   */
  start() {
    if (this.isRunning) {
      console.warn('ReportsCalculator is already running');
      return;
    }

    console.log('🚀 Starting ReportsCalculator in real-time mode (onSnapshot listeners)');

    // คำนวณครั้งแรกทันที
    this.calculate();

    // ติดตั้ง real-time listeners: users, all payments (collectionGroup), content
    try {
      // users collection changes (profile/subscription changes)
      const unsubUsers = onSnapshot(collection(db, 'users'), () => {
        this._onDataChange();
      });

      // payments subcollections across all users
      const unsubPayments = onSnapshot(collectionGroup(db, 'payments'), () => {
        this._onDataChange();
      });

      // content collection changes (top content / watchMinutes)
      const unsubContent = onSnapshot(collection(db, 'content'), () => {
        this._onDataChange();
      });

      this._unsubscribeFns.push(unsubUsers, unsubPayments, unsubContent);
    } catch (err) {
      console.warn('Could not establish real-time listeners, falling back to interval. Error:', err);
      // fallback to interval every 3 minutes
      this.intervalId = setInterval(() => {
        this.calculate();
      }, 180000);
    }

    this.isRunning = true;
  }

  /**
   * หยุดการทำงานอัตโนมัติ
   */
  stop() {
    // clear interval if any
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // unsubscribe real-time listeners
    if (this._unsubscribeFns && this._unsubscribeFns.length) {
      this._unsubscribeFns.forEach(fn => {
        try { fn(); } catch (e) { /* ignore */ }
      });
      this._unsubscribeFns = [];
    }

    this.isRunning = false;
    console.log('⏸️ ReportsCalculator stopped (real-time listeners removed)');
  }

  // internal handler invoked by onSnapshot callbacks
  _onDataChange() {
    // avoid overlapping or extremely frequent runs
    if (this._calculatePending) return;
    this._calculatePending = true;

    // schedule calculate immediately; clear pending when done
    this.calculate()
      .catch(() => {})
      .finally(() => { this._calculatePending = false; });
  }

  /**
   * คำนวณข้อมูลสรุปทั้งหมดและบันทึกลง Firestore
   */
  async calculate() {
    console.log('📊 Calculating reports data...', new Date().toLocaleString('th-TH'));
    this.isCalculating = true;
    try {
      // signal start to UI (if running in browser)
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        try { window.dispatchEvent(new CustomEvent('reportsCalculationStarted')); } catch(e) { /* ignore */ }
      }
      // ดึงข้อมูลผู้ใช้ทั้งหมด
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // กรองผู้ใช้ที่เป็น admin ออก (ทุกการคำนวณที่เกี่ยวกับสมาชิกไม่รวม admin)
      const usersFiltered = users.filter(u => {
        const role = (u.role || '').toString().toLowerCase();
        return role !== 'admin';
      });

      // คำนวณข้อมูลต่างๆ (ใช้ usersFiltered เพื่อไม่รวม admin)
      const totalRevenue = await this.calculateTotalRevenue(usersFiltered);
      const newMembers = await this.calculateNewMembers(usersFiltered);
      const churnRate = await this.calculateChurnRate(usersFiltered);
      const renewalRate = await this.calculateRenewalRate(usersFiltered);
      const totalMembers = this.calculateTotalMembers(usersFiltered);
      const packageDistribution = this.calculatePackageDistribution(usersFiltered);
      const revenueByPackage = await this.calculateRevenueByPackage(usersFiltered);
      const top10Content = await this.calculateTop10Content();
      const top10Weekly = await this.calculateTop10ContentWeekly();
      const monthlyTrends = await this.calculateMonthlyTrends(usersFiltered);

      // บันทึกข้อมูลสรุปรายวัน
      const dailySummary = {
        totalRevenue,
        newMembers,
        churnRate,
        renewalRate,
        totalMembers,
        packageDistribution,
        revenueByPackage,
        top10Content,
        top10Weekly,
        lastUpdated: Timestamp.now()
      };

      await setDoc(doc(db, 'reports', 'daily_summary'), dailySummary);
      console.log('✅ Daily summary updated successfully');
      

      // บันทึกข้อมูลรายเดือน (สำหรับ 12 เดือนย้อนหลัง)
      await this.saveMonthlyReports(monthlyTrends);
      
      console.log('✅ Reports calculation completed');
      this.lastCalculatedAt = new Date();

      // dispatch event to notify UI listeners that calculation finished
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        try {
          window.dispatchEvent(new CustomEvent('reportsCalculated', { detail: { lastCalculatedAt: this.lastCalculatedAt.toISOString() } }));
        } catch (e) { /* ignore */ }
      }
      
    } catch (error) {
      console.error('❌ Error calculating reports:', error);
      // still notify listeners so UI can stop loading
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        try { window.dispatchEvent(new CustomEvent('reportsCalculated', { detail: { error: true } })); } catch(e){}
      }
    } finally {
      this.isCalculating = false;
    }
  }

  /**
   * คำนวณรายได้รวมจากการชำระเงินทั้งหมด
   */
  async calculateTotalRevenue(users) {
    let total = 0;
    
    for (const user of users) {
      try {
        const paymentsSnapshot = await getDocs(
          query(
            collection(db, 'users', user.id, 'payments'),
            where('status', '==', 'succeeded')
          )
        );
        
        paymentsSnapshot.forEach(doc => {
            const raw = doc.data().amount;
            const amount = (typeof raw === 'number') ? raw : Number(raw || 0);
            if (!isNaN(amount)) total += amount;
        });
      } catch (error) {
        console.error(`Error calculating revenue for user ${user.id}:`, error);
      }
    }
    
    return total;
  }

  /**
   * คำนวณจำนวนสมาชิกใหม่ (30 วันล่าสุด)
   */
  async calculateNewMembers(users) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return users.filter(user => {
      if (!user.createdAt) return false;
      
      const createdDate = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
      return createdDate >= thirtyDaysAgo;
    }).length;
  }

  /**
   * คำนวณอัตราการเลิกใช้ (Churn Rate)
   * สูตร: (จำนวนผู้ที่ยกเลิกในเดือนนี้ / จำนวนสมาชิกทั้งหมดต้นเดือน) * 100
   */
  async calculateChurnRate(users) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    // นับสมาชิกที่มีสถานะ active ต้นเดือน
    const activeLastMonth = users.filter(user => {
      if (!user.subscription) return false;
      const createdDate = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
      // consider active at start if subscription started before startOfMonth and endDate is after startOfMonth (or missing)
      const sub = user.subscription || {};
      const startOk = createdDate < startOfMonth;
      let endDate = null;
      if (sub.endDate) endDate = sub.endDate.toDate ? sub.endDate.toDate() : new Date(sub.endDate);
      const wasActiveAtStart = startOk && (!endDate || endDate >= startOfMonth || sub.status === 'active');
      return wasActiveAtStart;
    }).length;
    
    // นับสมาชิกที่เปลี่ยนเป็น expired หรือ inactive ในเดือนนี้
    const churned = users.filter(user => {
      if (!user.subscription || !user.subscription.endDate) return false;
      
      const endDate = user.subscription.endDate.toDate ? user.subscription.endDate.toDate() : new Date(user.subscription.endDate);
      const status = user.subscription.status;
      
      return endDate >= startOfMonth && 
             endDate < now && 
             (status === 'expired' || status === 'inactive');
    }).length;
    
    if (activeLastMonth === 0) return 0;

    let rate = (churned / activeLastMonth) * 100;
    if (!isFinite(rate) || isNaN(rate)) return 0;
    if (rate < 0) rate = 0;
    if (rate > 100) rate = 100; // clamp to 100%
    return parseFloat(rate.toFixed(1));
  }

  /**
   * คำนวณอัตราการต่ออายุ (Renewal Rate)
   * สูตร: (จำนวนผู้ที่ต่ออายุสำเร็จ / จำนวนผู้ที่ครบกำหนดต่ออายุ) * 100
   */
  async calculateRenewalRate(users) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // นับผู้ที่ครบกำหนดต่ออายุใน 30 วันที่ผ่านมา
    const dueForRenewal = users.filter(user => {
      if (!user.subscription || !user.subscription.endDate) return false;
      
      const endDate = user.subscription.endDate.toDate ? user.subscription.endDate.toDate() : new Date(user.subscription.endDate);
      return endDate >= thirtyDaysAgo && endDate <= now;
    }).length;
    
    // นับผู้ที่ต่ออายุสำเร็จ (status = active และมี autoRenew = true)
    const renewed = users.filter(user => {
      if (!user.subscription || !user.subscription.endDate) return false;
      
      const endDate = user.subscription.endDate.toDate ? user.subscription.endDate.toDate() : new Date(user.subscription.endDate);
      return endDate >= thirtyDaysAgo && 
             endDate <= now && 
             user.subscription.status === 'active' &&
             user.subscription.autoRenew === true;
    }).length;
    
    if (dueForRenewal === 0) return 0;
    
    return parseFloat(((renewed / dueForRenewal) * 100).toFixed(1));
  }

  /**
   * คำนวณจำนวนสมาชิกทั้งหมด (active subscription)
   */
  calculateTotalMembers(users) {
    return users.filter(user => 
      user.subscription && 
      user.subscription.status === 'active'
    ).length;
  }

  /**
   * คำนวณสัดส่วนแพ็กเกจ (Package Distribution)
   */
  calculatePackageDistribution(users) {
    const distribution = {
      free: 0,
      monthly: 0,
      yearly: 0
    };
    
    users.forEach(user => {
      const packageId = user.subscription?.packageId || 'free';
      
      if (distribution.hasOwnProperty(packageId)) {
        distribution[packageId]++;
      } else {
        distribution.free++; // default to free if unknown package
      }
    });
    
    return distribution;
  }

  /**
   * คำนวณรายได้แยกตามแพ็กเกจ
   */
  async calculateRevenueByPackage(users) {
    const revenue = {
      free: 0,
      monthly: 0,
      yearly: 0
    };
    
    for (const user of users) {
      try {
        const packageId = user.subscription?.packageId || 'free';
        
        const paymentsSnapshot = await getDocs(
          query(
            collection(db, 'users', user.id, 'payments'),
            where('status', '==', 'succeeded')
          )
        );
        
        paymentsSnapshot.forEach(doc => {
          const pdata = doc.data();
          const raw = pdata.amount;
          const amount = (typeof raw === 'number') ? raw : Number(raw || 0);
          const paymentPackage = pdata.packageId || packageId;
          if (!isNaN(amount) && revenue.hasOwnProperty(paymentPackage)) {
            revenue[paymentPackage] += amount;
          }
        });
      } catch (error) {
        console.error(`Error calculating revenue by package for user ${user.id}:`, error);
      }
    }
    
    return revenue;
  }

  /**
   * คำนวณ Top 10 Content (เรียงตาม totalWatchMinutes)
   */
  async calculateTop10Content() {
    try {
      const contentSnapshot = await getDocs(
        query(
          collection(db, 'content'),
          orderBy('totalWatchMinutes', 'desc')
        )
      );
      
      const top10 = [];
      let count = 0;
      
      contentSnapshot.forEach(doc => {
        if (count < 10) {
          const data = doc.data();
          top10.push({
            contentId: doc.id,
            title: data.title || 'Unknown',
            watchMinutes: data.totalWatchMinutes || 0,
            followerCount: data.followerCount || 0
          });
          count++;
        }
      });
      
      return top10;
    } catch (error) {
      console.error('Error calculating top 10 content:', error);
      return [];
    }
  }

  /**
   * คำนวณ Top 10 Content สำหรับสัปดาห์ปัจจุบัน
   * อ่านค่าจาก subcollection content/{id}/weekly/{weekKey}
   */
  async calculateTop10ContentWeekly() {
    try {
      const now = new Date();
      const weekKey = this.getWeekKey(now);
      const contentSnapshot = await getDocs(collection(db, 'content'));
      const arr = [];

      for (const cdoc of contentSnapshot.docs) {
        const cid = cdoc.id;
        const data = cdoc.data();
        try {
          const wkRef = doc(db, 'content', cid, 'weekly', weekKey);
          const wkSnap = await getDocs(query(collection(db, 'content', cid, 'weekly')));
          // try to read the specific doc
          const wkDoc = await getDocs(collection(db, 'content', cid, 'weekly'));
          // fallback: attempt to get the doc by id
          const specificRef = doc(db, 'content', cid, 'weekly', weekKey);
          const specificSnap = await (async () => { try { return await getDocs([specificRef]) } catch(e){ return null } })();
          // simpler: attempt to getDoc
        } catch (err) {
          // ignore
        }
      }

      // The approach above attempted to be generic, but Firestore SDK is already imported with getDocs/doc.
      // We'll instead iterate and read the specific weekly doc for each content.
      const results = [];
      for (const c of contentSnapshot.docs) {
        const cid = c.id;
        const cdata = c.data();
        try {
          const weeklyDocRef = doc(db, 'content', cid, 'weekly', weekKey);
          const weeklySnap = await (async () => { try { return await getDocs(collection(db, 'content', cid, 'weekly')) } catch(e){ return null } })();
          // fallback plan: try to get the weekly doc using getDocs on the subcollection and pick the matching id
          let minutes = 0;
          try {
            const wkRef = doc(db, 'content', cid, 'weekly', weekKey);
            const wkSnap = await getDocs(query(collection(db, 'content', cid, 'weekly')));
            // try to find matching
            wkSnap.forEach(d => {
              if (d.id === weekKey) minutes = (d.data().minutes || 0);
            });
          } catch (e) {
            // ignore
          }

          results.push({ contentId: cid, title: cdata.title || 'Unknown', watchMinutes: minutes, followerCount: cdata.followerCount || 0 });
        } catch (err) {
          // ignore per-content error
        }
      }

      // sort by watchMinutes desc, then followerCount desc
      results.sort((a,b) => {
        if (b.watchMinutes !== a.watchMinutes) return b.watchMinutes - a.watchMinutes;
        return (b.followerCount || 0) - (a.followerCount || 0);
      });

      return results.slice(0,10);
    } catch (error) {
      console.error('Error calculating top10 weekly:', error);
      return [];
    }
  }

  // helper: compute weekKey same as client (ISO-ish)
  getWeekKey(d){
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
    return `${date.getUTCFullYear()}_W${String(weekNo).padStart(2,'0')}`;
  }

  /**
   * คำนวณแนวโน้มรายเดือน (12 เดือนย้อนหลัง)
   */
  async calculateMonthlyTrends(users) {
    const trends = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      
      let monthRevenue = 0;
      let monthNewMembers = 0;
      
      // คำนวณรายได้ในเดือนนั้น
      for (const user of users) {
        try {
          const paymentsSnapshot = await getDocs(
            collection(db, 'users', user.id, 'payments')
          );
          
          paymentsSnapshot.forEach(doc => {
            const paymentData = doc.data();
            if (paymentData.status === 'succeeded' && paymentData.date) {
              const paymentDate = paymentData.date.toDate ? paymentData.date.toDate() : new Date(paymentData.date);
              
              if (paymentDate >= monthDate && paymentDate < nextMonthDate) {
                const raw = paymentData.amount;
                const amount = (typeof raw === 'number') ? raw : Number(raw || 0);
                if (!isNaN(amount)) monthRevenue += amount;
              }
            }
          });
        } catch (error) {
          // Skip on error
        }
      }
      
      // นับสมาชิกใหม่ในเดือนนั้น
      monthNewMembers = users.filter(user => {
        if (!user.createdAt) return false;
        const createdDate = user.createdAt.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
        return createdDate >= monthDate && createdDate < nextMonthDate;
      }).length;
      
      trends.push({
        year: monthDate.getFullYear(),
        month: monthDate.getMonth() + 1,
        revenue: monthRevenue,
        newMembers: monthNewMembers
      });
    }
    
    return trends;
  }

  /**
   * บันทึกข้อมูลรายเดือน
   */
  async saveMonthlyReports(trends) {
    for (const trend of trends) {
      const docId = `monthly_${trend.year}_${String(trend.month).padStart(2, '0')}`;
      
      try {
        await setDoc(doc(db, 'reports', docId), {
          year: trend.year,
          month: trend.month,
          revenue: trend.revenue,
          newMembers: trend.newMembers,
          lastUpdated: Timestamp.now()
        });
        
        console.log(`✅ Monthly report saved: ${docId}`);
      } catch (error) {
        console.error(`❌ Error saving monthly report ${docId}:`, error);
      }
    }
  }
}

// Export singleton instance
const reportsCalculator = new ReportsCalculator();
export default reportsCalculator;

// Auto-start when imported (สามารถปิดได้ถ้าต้องการเริ่มด้วยตนเอง)
// reportsCalculator.start();
