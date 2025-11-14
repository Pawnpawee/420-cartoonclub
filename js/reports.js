/**
 * Reports Page Component
 * แสดงรายงานสรุปผล - Renewal Rate, Churn Rate, และแนวโน้ม
 */

import { auth, db, getUserDoc } from '../firebase-controller.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';
import { 
  doc, 
  getDoc,
  collection,
  getDocs,
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';

class Reports {
  constructor() {
    this.data = {
      renewalRate: 0,
      churnRate: 0,
      renewalChange: 0,
      churnChange: 0,
      monthlyTrends: [] // [{month: 'ม.ค.', renewal: 85, churn: 4.2}, ...]
    };
    
    this.init();
  }

  async init() {
    await this.loadReportsData();
    this.attachEventListeners();
    this.renderCharts();
  }

  /**
   * โหลดข้อมูลรายงานจาก Firestore
   */
  async loadReportsData() {
    try {
      // โหลดข้อมูลสรุปรายวัน
      const dailySummaryRef = doc(db, 'reports', 'daily_summary');
      const dailySummarySnap = await getDoc(dailySummaryRef);
      
      if (dailySummarySnap.exists()) {
        const data = dailySummarySnap.data();
        this.data.renewalRate = data.renewalRate || 0;
        this.data.churnRate = data.churnRate || 0;
        this.data.top10Weekly = data.top10Weekly || data.top10Content || [];
        
        console.log('✅ Loaded daily summary:', data);
      } else {
        console.warn('⚠️ Daily summary not found, using default values');
      }
      
      // โหลดข้อมูลรายเดือน (12 เดือนล่าสุด)
      await this.loadMonthlyTrends();
      
      // อัปเดต UI
      this.updateRateCards();
      // render mini sparklines and top10 weekly cards
      this.renderMiniGraphs();
      this.renderTop10Weekly();
      this.renderPackageProportions();
      
    } catch (error) {
      console.error('❌ Error loading reports data:', error);
      this.showError('ไม่สามารถโหลดข้อมูลรายงานได้');
    }
  }

  /**
   * โหลดแนวโน้มรายเดือน
   */
  async loadMonthlyTrends() {
    try {
      const now = new Date();
      const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const trends = [];
      
      // ดึงข้อมูล 12 เดือนย้อนหลัง
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth() + 1;
        const docId = `monthly_${year}_${String(month).padStart(2, '0')}`;
        
        try {
          const monthlyRef = doc(db, 'reports', docId);
          const monthlySnap = await getDoc(monthlyRef);
          
          if (monthlySnap.exists()) {
            const data = monthlySnap.data();
            trends.push({
              month: monthNames[month - 1],
              renewal: data.renewalRate || this.data.renewalRate || 85,
              churn: data.churnRate || this.data.churnRate || 4.2,
              revenue: data.revenue || 0,
              newMembers: data.newMembers || 0
            });
          } else {
            // ถ้าไม่มีข้อมูล ใช้ค่าเริ่มต้น
            trends.push({
              month: monthNames[month - 1],
              renewal: this.data.renewalRate || 85,
              churn: this.data.churnRate || 4.2,
              revenue: 0,
              newMembers: 0
            });
          }
        } catch (error) {
          console.warn(`⚠️ Could not load ${docId}:`, error);
          trends.push({
            month: monthNames[month - 1],
            renewal: 85,
            churn: 4.2,
            revenue: 0,
            newMembers: 0
          });
        }
      }
      
      this.data.monthlyTrends = trends;
      console.log('✅ Loaded monthly trends:', trends);
      
    } catch (error) {
      console.error('❌ Error loading monthly trends:', error);
    }
  }

  /**
   * อัปเดตการ์ดแสดงอัตรา
   */
  updateRateCards() {
    // อัปเดต Renewal Rate
    const renewalValueEl = document.querySelector('.rate-card:nth-child(1) .rate-value');
    if (renewalValueEl) {
      renewalValueEl.textContent = `${this.data.renewalRate}%`;
    }
    
    // อัปเดต Churn Rate
    const churnValueEl = document.querySelector('.rate-card:nth-child(2) .rate-value');
    if (churnValueEl) {
      churnValueEl.textContent = `${this.data.churnRate}%`;
    }
    
    // อัปเดต Rate Change (ถ้ามี)
    // คำนวณการเปลี่ยนแปลงจากเดือนก่อน
    if (this.data.monthlyTrends.length >= 2) {
      const currentMonth = this.data.monthlyTrends[this.data.monthlyTrends.length - 1];
      const lastMonth = this.data.monthlyTrends[this.data.monthlyTrends.length - 2];
      
      this.data.renewalChange = parseFloat((currentMonth.renewal - lastMonth.renewal).toFixed(1));
      this.data.churnChange = parseFloat((currentMonth.churn - lastMonth.churn).toFixed(1));
      
      // อัปเดต UI
      const renewalChangeEl = document.querySelector('.rate-card:nth-child(1) .rate-change span');
      if (renewalChangeEl) {
        renewalChangeEl.textContent = `${Math.abs(this.data.renewalChange)}%`;
        
        const changeDiv = renewalChangeEl.parentElement;
        if (this.data.renewalChange >= 0) {
          changeDiv.classList.remove('negative');
          changeDiv.classList.add('positive');
          changeDiv.querySelector('i').className = 'fas fa-arrow-up';
        } else {
          changeDiv.classList.remove('positive');
          changeDiv.classList.add('negative');
          changeDiv.querySelector('i').className = 'fas fa-arrow-down';
        }
      }
      
      const churnChangeEl = document.querySelector('.rate-card:nth-child(2) .rate-change span');
      if (churnChangeEl) {
        churnChangeEl.textContent = `${Math.abs(this.data.churnChange)}%`;
        
        const changeDiv = churnChangeEl.parentElement;
        if (this.data.churnChange >= 0) {
          changeDiv.classList.remove('positive');
          changeDiv.classList.add('negative');
          changeDiv.querySelector('i').className = 'fas fa-arrow-up';
        } else {
          changeDiv.classList.remove('negative');
          changeDiv.classList.add('positive');
          changeDiv.querySelector('i').className = 'fas fa-arrow-down';
        }
      }
    }
  }

  attachEventListeners() {
    // Year selector
    const yearSelector = document.querySelector('.year-selector');
    if (yearSelector) {
      yearSelector.addEventListener('click', () => this.handleYearChange());
    }
  }

  // small helper to escape HTML in inserted strings
  escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[m]; });
  }

  /**
   * Render small sparklines inside the two rate cards (renewal & churn)
   */
  renderMiniGraphs() {
    const trends = this.data.monthlyTrends || [];
    if (!trends || trends.length === 0) return;

    const makeSpark = (values, color) => {
      const w = 160, h = 56, pad = 6;
      const max = Math.max(...values, 1);
      const stepX = (w - pad*2) / Math.max(1, values.length - 1);
      const points = values.map((v,i) => {
        const x = pad + i * stepX;
        const y = pad + (1 - (v / max)) * (h - pad*2);
        return `${x},${y}`;
      }).join(' ');
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    };

    // renewal mini-graph (first rate-card)
    try {
      const renewalVals = trends.map(t => Number(t.renewal) || 0);
      const el1 = document.querySelector('.rate-card:nth-of-type(1) .rate-graph-placeholder');
      if (el1) el1.innerHTML = makeSpark(renewalVals, '#6b9e3d');
    } catch(e){ console.warn('mini graph renewal failed', e); }

    // churn mini-graph (second rate-card)
    try {
      const churnVals = trends.map(t => Number(t.churn) || 0);
      const el2 = document.querySelector('.rate-card:nth-of-type(2) .rate-graph-placeholder');
      if (el2) el2.innerHTML = makeSpark(churnVals, '#c1272d');
    } catch(e){ console.warn('mini graph churn failed', e); }
  }

  handleYearChange() {
    console.log('Year selector clicked');
    showAlertModal?.('ฟีเจอร์การเลือกปีจะพัฒนาในอนาคต');
  }

  renderCharts() {
    this.renderTrendChart();
  }

  renderTop10Weekly() {
    const container = document.getElementById('top10WeeklyList');
    if (!container) return;
    // Use already-loaded summary in this.data.top10Weekly if available
    (async () => {
      try {
        const list = this.data.top10Weekly || [];
        if (!list || list.length === 0) {
          container.innerHTML = '<p style="color:#999">ไม่มีข้อมูลอันดับ</p>';
          return;
        }

        const items = await Promise.all(list.map(async (it, idx) => {
          try {
            const cRef = doc(db, 'content', it.contentId);
            const cSnap = await getDoc(cRef);
            const cdata = cSnap && cSnap.exists() ? cSnap.data() : {};
            return {
              rank: idx + 1,
              contentId: it.contentId,
              title: it.title || cdata.title || 'Untitled',
              minutes: it.watchMinutes || 0,
              followerCount: it.followerCount || cdata.followerCount || 0,
              thumbnail: cdata.thumbnailURL || cdata.heroImageURL || '',
              url: `view.html?content=${encodeURIComponent(it.contentId)}`
            };
          } catch (err) {
            return {
              rank: idx + 1,
              contentId: it.contentId,
              title: it.title || 'Untitled',
              minutes: it.watchMinutes || 0,
              followerCount: it.followerCount || 0,
              thumbnail: '',
              url: `view.html?content=${encodeURIComponent(it.contentId)}`
            };
          }
        }));

        container.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
            ${items.map(it => `
              <a href="${it.url}" class="top10-card" style="display:block;background:#fff;border-radius:8px;padding:10px;box-shadow:0 6px 18px rgba(15,23,42,0.06);text-decoration:none;color:inherit">
                <div style="display:flex;gap:10px;align-items:center">
                  <div style="width:72px;height:72px;flex:0 0 72px;border-radius:6px;overflow:hidden;background:#f3f4f6;display:flex;align-items:center;justify-content:center">
                    ${it.thumbnail ? `<img src="${it.thumbnail}" alt="${this.escapeHtml(it.title)}" style="width:100%;height:100%;object-fit:cover">` : `<div style="font-weight:700;color:#999">${this.escapeHtml(it.title.slice(0,1))}</div>`}
                  </div>
                  <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
                      <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this.escapeHtml(it.title)}</div>
                      <div style="font-size:12px;color:#6b7280">#${it.rank}</div>
                    </div>
                    <div style="margin-top:6px;font-size:13px;color:#374151">${(it.minutes).toLocaleString()} นาที</div>
                    <div style="margin-top:6px;font-size:12px;color:#6b7280">ผู้ติดตาม ${Number(it.followerCount).toLocaleString()}</div>
                  </div>
                </div>
              </a>
            `).join('')}
          </div>
        `;
      } catch (err) {
        console.error('renderTop10Weekly failed', err);
        container.innerHTML = '<p style="color:#999">เกิดข้อผิดพลาดขณะโหลดอันดับ</p>';
      }
    })();
  }

  /**
   * วาดกราฟแนวโน้มการต่ออายุเทียบกับการเลิกใช้
   */
  renderTrendChart() {
    const chartContainer = document.querySelector('.trend-chart-content');
    if (!chartContainer) return;

    const trends = this.data.monthlyTrends;
    if (trends.length === 0) {
      chartContainer.innerHTML = '<p style="text-align: center; color: #999;">ไม่มีข้อมูล</p>';
      return;
    }

    // คำนวณค่าสูงสุดเพื่อ scale กราฟ
    const maxRenewal = Math.max(...trends.map(t => t.renewal));
    const maxChurn = Math.max(...trends.map(t => t.churn));
    const maxValue = Math.max(maxRenewal, maxChurn, 100); // อย่างน้อย 100%

    const chartWidth = 800;
    const chartHeight = 300;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;

    // คำนวณตำแหน่งจุดข้อมูล
    const xStep = plotWidth / (trends.length - 1);
    
    const renewalPoints = trends.map((t, i) => ({
      x: padding.left + i * xStep,
      y: padding.top + plotHeight - (t.renewal / maxValue * plotHeight)
    }));
    
    const churnPoints = trends.map((t, i) => ({
      x: padding.left + i * xStep,
      y: padding.top + plotHeight - (t.churn / maxValue * plotHeight)
    }));

    // สร้าง path string สำหรับ polyline
    const renewalPath = renewalPoints.map(p => `${p.x},${p.y}`).join(' ');
    const churnPath = churnPoints.map(p => `${p.x},${p.y}`).join(' ');

    chartContainer.innerHTML = `
      <svg width="${chartWidth}" height="${chartHeight}" style="width: 100%; height: auto;">
        <!-- Grid lines -->
        <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + plotHeight}" 
              stroke="#e0e0e0" stroke-width="2" />
        <line x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${padding.left + plotWidth}" y2="${padding.top + plotHeight}" 
              stroke="#e0e0e0" stroke-width="2" />
        
        <!-- Renewal Rate Line -->
        <polyline points="${renewalPath}" fill="none" stroke="#6b9e3d" stroke-width="3" />
        
        <!-- Churn Rate Line -->
        <polyline points="${churnPath}" fill="none" stroke="#c1272d" stroke-width="3" />
        
        <!-- Data points - Renewal -->
        ${renewalPoints.map((p, i) => `
          <circle cx="${p.x}" cy="${p.y}" r="4" fill="#6b9e3d" />
          <text x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-size="11" fill="#6b9e3d" font-weight="600">
            ${trends[i].renewal}%
          </text>
        `).join('')}
        
        <!-- Data points - Churn -->
        ${churnPoints.map((p, i) => `
          <circle cx="${p.x}" cy="${p.y}" r="4" fill="#c1272d" />
          <text x="${p.x}" y="${p.y + 20}" text-anchor="middle" font-size="11" fill="#c1272d" font-weight="600">
            ${trends[i].churn}%
          </text>
        `).join('')}
        
        <!-- X-axis labels -->
        ${trends.map((t, i) => `
          <text x="${padding.left + i * xStep}" y="${padding.top + plotHeight + 25}" 
                text-anchor="middle" font-size="12px" fill="#666">
            ${t.month}
          </text>
        `).join('')}
      </svg>
    `;
  }

  renderPackageProportions() {
    // use packageDistribution from daily summary if available
    const dist = this.data.packageDistribution || {};
    const free = dist.free || 0;
    const monthly = dist.monthly || 0;
    const yearly = dist.yearly || 0;
    const total = free + monthly + yearly || 1;

    const setFor = (key, percent, text) => {
      // update both renewal and churn rows (we have duplicate keys)
      const barRenew = document.querySelector(`.proportion-card .progress-bar.renewal[data-key="${key}"]`);
      const valRenew = document.querySelector(`.proportion-card .proportion-value[data-key="${key}"]`);
      if (barRenew) barRenew.style.width = percent + '%';
      if (valRenew) valRenew.textContent = text;

      const barChurn = document.querySelectorAll(`.proportion-card .progress-bar.churn[data-key="${key}"]`);
      const valChurn = document.querySelectorAll(`.proportion-card .proportion-value[data-key="${key}"]`);
      barChurn.forEach(b => b.style.width = percent + '%');
      valChurn.forEach(v => v.textContent = text);
    };

    const freePct = Math.round((free / total) * 100);
    const monthlyPct = Math.round((monthly / total) * 100);
    const yearlyPct = Math.round((yearly / total) * 100);

    setFor('free', freePct, `${freePct}%`);
    setFor('monthly', monthlyPct, `${monthlyPct}%`);
    setFor('yearly', yearlyPct, `${yearlyPct}%`);
  }

  showError(message) {
    if (typeof showAlertModal === 'function') {
      showAlertModal(message);
    } else {
      alert(message);
    }
  }
}

// Initialize reports when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    try {
      const userDoc = await getUserDoc(user.uid);
      const role = (userDoc && userDoc.exists()) ? (userDoc.data().role || 'user') : 'user';
      
      if (role !== 'admin') {
        window.location.href = 'index.html';
        return;
      }

      // เป็นแอดมิน -> เรียก Reports
      window.reports = new Reports();
    } catch (err) {
      console.error('Error validating admin role:', err);
      window.location.href = 'index.html';
    }
  });
});

export default Reports;
