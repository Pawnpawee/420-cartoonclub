/**
 * Dashboard Component
 * Handles admin dashboard functionality and data
 */

import { auth, getUserDoc, db } from '../firebase-controller.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { 
  doc, 
  getDoc,
  collection,
  getDocs
} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';

class Dashboard {
  constructor() {
    this.data = {
      totalRevenue: 0,
      newMembers: 0,
      churnRate: 0,
      totalMembers: 0,
      revenueByPackage: {
        monthly: { value: 0, height: 0 },
        yearly: { value: 0, height: 0 }
      },
      packageDistribution: {
        free: 0,
        monthly: 0,
        yearly: 0
      },
      monthlyRevenue: [] // สำหรับกราฟแนวโน้มรายได้
    };
    
    this.init();
  }

  async init() {
    // show loader while loading dashboard data
    this._createLoader();
    await this.loadDashboardData();
    this._hideLoader();
    this.attachEventListeners();
    this.initCharts();
  }

  _createLoader(){
    if (document.getElementById('dashboard-calc-loader')) return;
    const overlay = document.createElement('div');
    overlay.id = 'dashboard-calc-loader';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.flexDirection = 'column';
    overlay.style.gap = '12px';
    overlay.style.background = 'rgba(255,245,223,0.95)';
    overlay.style.zIndex = '99998';
    overlay.innerHTML = `<div style="text-align:center;"><img src="img/logo_cartoonclub.png" style="width:120px;height:auto;margin-bottom:12px;"/><div style="font-weight:600;color:#333">กำลังโหลดข้อมูล Dashboard...</div></div>`;
    document.body.appendChild(overlay);
  }

  _hideLoader(){
    const el = document.getElementById('dashboard-calc-loader');
    if (!el) return;
    el.style.transition = 'opacity .3s ease';
    el.style.opacity = '0';
    setTimeout(()=>{ try{ el.remove(); }catch(e){} },350);
  }

  /**
   * โหลดข้อมูล Dashboard จาก Firestore และคำนวณค่า dynamic
   * - ดึง reports/daily_summary
   * - ดึง users เพื่อคำนวณสัดส่วนและรายชื่อสมาชิก
   * - ดึง packages เพื่อคำนวณรายได้แยกตามแพ็กเกจ (count_active * price)
   */
  async loadDashboardData() {
    try {
      // โหลด daily summary (ถ้ามี)
      const dailySummaryRef = doc(db, 'reports', 'daily_summary');
      const dailySummarySnap = await getDoc(dailySummaryRef);

      if (dailySummarySnap.exists()) {
        const data = dailySummarySnap.data();
        this.data.totalRevenue = data.totalRevenue || 0;
        this.data.newMembers = data.newMembers || 0;
        this.data.churnRate = data.churnRate || 0;
        this.data.totalMembers = data.totalMembers || 0;
      }

      // ดึง users ทั้งหมด (ยกเว้น admin)
      const usersSnap = await getDocs(collection(db, 'users'));
      const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // คำนวณจำนวนสมาชิก per package (active)
      const counts = { free: 0, monthly: 0, yearly: 0 };
      const memberListItems = [];

      users.forEach(u => {
        const role = (u.role || '').toString().toLowerCase();
        if (role === 'admin') return; // skip admins

        // collect for member list (display name)
        const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.uid || u.id;
        memberListItems.push({ id: u.id, name });

        const pkg = (u.subscription && u.subscription.packageId) ? u.subscription.packageId : 'free';
        const status = u.subscription && u.subscription.status ? u.subscription.status : 'inactive';
        if (status === 'active') {
          if (pkg === 'monthly') counts.monthly++;
          else if (pkg === 'yearly') counts.yearly++;
          else counts.free++;
        }
      });

      this.data.packageDistribution = counts;

      // Overwrite totalMembers with the fresh count of all non-admin users for consistency
      this.data.totalMembers = memberListItems.length;

      // Additional diagnostics: breakdown of user statuses
      try {
        const totalUsers = users.length;
        const nonAdminUsers = users.filter(u => ((u.role||'').toString().toLowerCase() !== 'admin')).length;
        const activeUsers = users.filter(u => (u.subscription && u.subscription.status === 'active')).length;
        const activePaid = users.filter(u => (u.subscription && u.subscription.status === 'active' && (u.subscription.packageId || 'free') !== 'free')).length;
        const activeFree = users.filter(u => (u.subscription && u.subscription.status === 'active' && (u.subscription.packageId || 'free') === 'free')).length;
        const inactive = users.filter(u => (u.subscription && (u.subscription.status === 'inactive'))).length;
        const expired = users.filter(u => (u.subscription && (u.subscription.status === 'expired'))).length;

        console.groupCollapsed('Dashboard User Breakdown');
        console.log('totalUsers (all docs):', totalUsers);
        console.log('nonAdminUsers:', nonAdminUsers);
        console.log('activeUsers (any package):', activeUsers);
        console.log('activePaidUsers (exclude free):', activePaid);
        console.log('activeFreeUsers:', activeFree);
        console.log('inactiveUsers:', inactive);
        console.log('expiredUsers:', expired);
        console.log('packageDistribution (active count per package):', counts);
        console.log('Note: `totalMembers` shown on dashboard = all non-admin users.');
        console.groupEnd();
      } catch (e) {
        console.warn('Error computing user breakdown', e);
      }

      // ดึงราคาจาก collection packages เพื่อคำนวณรายได้ = จำนวนคน active * price
      const packagesSnap = await getDocs(collection(db, 'packages'));
      const priceMap = {};
      packagesSnap.forEach(p => {
        const pid = p.id; // expected ids: free, monthly, yearly
        const pd = p.data();
        priceMap[pid] = pd.price || 0;
      });

      // Always calculate revenue from fresh data for accuracy
      const revenueRaw = {
        free: (priceMap.free || 0) * counts.free,
        monthly: (priceMap.monthly || 0) * counts.monthly,
        yearly: (priceMap.yearly || 0) * counts.yearly
      };
      this.data.totalRevenue = revenueRaw.monthly + revenueRaw.yearly + revenueRaw.free;

      // Defensive: ensure totalRevenue is numeric
      const numericTotal = Number(this.data.totalRevenue);
      if (!isFinite(numericTotal) || isNaN(numericTotal)) {
        console.warn('Dashboard debug: totalRevenue was invalid, resetting to 0', this.data.totalRevenue);
        this.data.totalRevenue = 0;
      } else {
        this.data.totalRevenue = numericTotal;
      }

      // Debug logging: output computed values to help diagnose NaN / unexpected rates
      try {
        console.groupCollapsed('Dashboard Debug');
        console.log('usersTotal', users.length);
        console.log('members (non-admin)', memberListItems.length);
        console.log('packageDistribution', counts);
        console.log('priceMap', priceMap);
        console.log('revenueRaw', revenueRaw);
        console.log('totalRevenue(final)', this.data.totalRevenue);
        console.log('dailySummary (fetched)', dailySummarySnap && dailySummarySnap.exists ? dailySummarySnap.data() : null);
        console.log('monthlyRevenue array (length)', this.data.monthlyRevenue ? this.data.monthlyRevenue.length : 0, this.data.monthlyRevenue);
        console.groupEnd();
      } catch (e) {
        console.log('Dashboard debug log error', e);
      }

      // Format revenueByPackage for bar chart display (uses monthly & yearly)
      this.data.revenueByPackage = this.formatRevenueByPackage({ monthly: revenueRaw.monthly, yearly: revenueRaw.yearly });

      // Store raw counts for other uses
      this.data._rawRevenue = revenueRaw;
      this.data._memberList = memberListItems;

      // Update UI: members list and stat cards
      this.updateStatCards();
      this.renderMemberList();

      console.log('✅ Dashboard data loaded', { counts, revenueRaw, members: memberListItems.length });
    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
      this.showError('ไม่สามารถโหลดข้อมูล Dashboard ได้');
    }
  }

  attachEventListeners() {
    // Menu items - only prevent default for items without href or with #
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const href = item.getAttribute('href');
        const action = item.getAttribute('data-action');
        
        // Allow navigation for dashboard.html and members.html
        if (href && href !== '#' && (href.endsWith('.html'))) {
          // Let the browser handle navigation
          return;
        }
        
        // Prevent default for # links
        e.preventDefault();
        this.handleMenuClick(item);
      });
    });

    // Year selector
    const yearSelector = document.querySelector('.year-selector');
    if (yearSelector) {
      yearSelector.addEventListener('click', () => this.handleYearChange());
    }

    // Logout
    // logout is handled by the shared sidebar component (Firebase signOut)
  }

  handleMenuClick(clickedItem) {
    // Remove active class from all items
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Add active class to clicked item
    clickedItem.classList.add('active');
    
    const action = clickedItem.getAttribute('data-action');
    const href = clickedItem.getAttribute('href');
    
    console.log('Menu clicked:', action);
    
    // If item has a valid href (not #), navigate to it
    if (href && href !== '#') {
      window.location.href = href;
      return;
    }
    
    // Handle different menu actions for # links
    switch(action) {
      case 'dashboard':
        this.showDashboard();
        break;
      case 'members':
        this.showMembers();
        break;
      case 'reports':
        this.showReports();
        break;
      case 'settings':
        this.showSettings();
        break;
    }
  }

  handleYearChange() {
    console.log('Year selector clicked');
    // Implement year selection dropdown
  showAlertModal('ฟีเจอร์การเลือกปีจะพัฒนาในอนาคต');
  }

  handleLogout() {
    (async () => {
      try {
        const ok = await window.showConfirmModal?.('คุณต้องการออกจากระบบใช่หรือไม่?') ?? confirm('คุณต้องการออกจากระบบใช่หรือไม่?');
        if (!ok) return;
        signOut(auth).then(() => {
          console.log('Logged out');
          window.location.href = 'login.html';
        }).catch(err => {
          console.error('SignOut error', err);
          showAlertModal?.('เกิดข้อผิดพลาดในการออกจากระบบ');
        });
      } catch (err) {
        console.error('Logout confirm failed', err);
      }
    })();
  }

  showDashboard() {
    console.log('Showing dashboard');
    // Dashboard is default view
  }

  showMembers() {
    console.log('Showing members');
  showAlertModal('หน้าจัดการสมาชิกจะพัฒนาในอนาคต');
  }

  showReports() {
    console.log('Showing reports');
  showAlertModal('หน้ารายงานสรุปผลจะพัฒนาในอนาคต');
  }

  showSettings() {
    console.log('Showing settings');
  showAlertModal('หน้าการตั้งค่าจะพัฒนาในอนาคต');
  }

  initCharts() {
    this.renderRevenueChart();
    this.renderPieChart();
    this.renderBarChart();
  }

  renderRevenueChart() {
    const chartContainer = document.getElementById('revenueChart');
    if (!chartContainer) return;

    // ใช้ข้อมูลรายได้รายเดือนจาก Firestore
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const data = this.data.monthlyRevenue.length > 0 ? this.data.monthlyRevenue : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    
    // หาค่าสูงสุดเพื่อ scale กราฟ
    const maxValue = Math.max(...data, 1);

    chartContainer.innerHTML = `
      <div style="position: relative; height: 266px; padding: 0 20px;">
        <svg width="100%" height="200" style="margin-bottom: 20px;">
          <polyline
            fill="none"
            stroke="#2ecc71"
            stroke-width="3"
            points="${data.map((val, idx) => `${(idx * 100 / 11)},${200 - (val / maxValue * 180)}`).join(' ')}"
            style="transform: translateX(20px);"
          />
          ${data.map((val, idx) => `
            <circle cx="${(idx * 100 / 11) + 20}" cy="${200 - (val / maxValue * 180)}" r="4" fill="#2ecc71" />
          `).join('')}
        </svg>
        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666;">
          ${months.map(month => `<span>${month}</span>`).join('')}
        </div>
      </div>
    `;
  }

  renderPieChart() {
    const chartContainer = document.getElementById('pieChart');
    if (!chartContainer) return;

    const { free, monthly, yearly } = this.data.packageDistribution;

    // Calculate percentages
    const total = free + monthly + yearly;
    let freePercent = 0, monthlyPercent = 0, yearlyPercent = 0;
    if (total > 0) {
      freePercent = Math.round((free / total) * 100);
      monthlyPercent = Math.round((monthly / total) * 100);
      yearlyPercent = Math.round((yearly / total) * 100);
    }

    // Calculate cumulative angles for pie chart (starting from top, going clockwise)
    let currentAngle = 0;
    const freeAngle = (free / total) * 360;
    const monthlyAngle = (monthly / total) * 360;
    const yearlyAngle = (yearly / total) * 360;

    // Calculate center angle for each segment for label positioning
    const freeCenterAngle = currentAngle + freeAngle / 2;
    const monthlyCenterAngle = currentAngle + freeAngle + monthlyAngle / 2;
    const yearlyCenterAngle = currentAngle + freeAngle + monthlyAngle + yearlyAngle / 2;

    // Calculate label positions at 60% radius from center
    const labelRadius = 68; // 60% of 114px radius
    const centerX = 120.5;
    const centerY = 119;

    const freeLabelPos = this.polarToCartesian(centerX, centerY, labelRadius, freeCenterAngle);
    const monthlyLabelPos = this.polarToCartesian(centerX, centerY, labelRadius, monthlyCenterAngle);
    const yearlyLabelPos = this.polarToCartesian(centerX, centerY, labelRadius, yearlyCenterAngle);

    // Helper function to calculate path for pie segment
    const createPieSlice = (startAngle, endAngle) => {
      const start = this.polarToCartesian(centerX, centerY, 114, endAngle);
      const end = this.polarToCartesian(centerX, centerY, 114, startAngle);
      const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
      return `M ${centerX} ${centerY} L ${start.x} ${start.y} A 114 114 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
    };

    chartContainer.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 235px; position: relative;">
        <svg width="241" height="238" viewBox="0 0 241 238">
          <!-- Free segment -->
          <path d="${createPieSlice(currentAngle, currentAngle + freeAngle)}" 
                fill="#0d748b" 
                stroke="white" 
                stroke-width="2" />
          
          <!-- Monthly segment -->
          <path d="${createPieSlice(currentAngle + freeAngle, currentAngle + freeAngle + monthlyAngle)}" 
                fill="#3d3387" 
                stroke="white" 
                stroke-width="2" />
          
          <!-- Yearly segment -->
          <path d="${createPieSlice(currentAngle + freeAngle + monthlyAngle, 360)}" 
                fill="#e1b504" 
                stroke="white" 
                stroke-width="2" />
        </svg>
        
        <!-- Percentage labels positioned at mathematical center of each segment -->
        <!-- Free -->
        <div style="position: absolute; left: ${freeLabelPos.x}px; top: ${freeLabelPos.y}px; transform: translate(-50%, -50%); color: white; font-size: 20px; font-weight: 700; font-family: 'IBM Plex Sans', sans-serif; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
          ${freePercent}%
        </div>
        
        <!-- Monthly -->
        <div style="position: absolute; left: ${monthlyLabelPos.x}px; top: ${monthlyLabelPos.y}px; transform: translate(-50%, -50%); color: white; font-size: 20px; font-weight: 700; font-family: 'IBM Plex Sans', sans-serif; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
          ${monthlyPercent}%
        </div>
        
        <!-- Yearly -->
        <div style="position: absolute; left: ${yearlyLabelPos.x}px; top: ${yearlyLabelPos.y}px; transform: translate(-50%, -50%); color: white; font-size: 20px; font-weight: 700; font-family: 'IBM Plex Sans', sans-serif; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
          ${yearlyPercent}%
        </div>
      </div>
    `;
  }
  
  // Helper function to convert polar coordinates to cartesian
  polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }

  renderBarChart() {
    const chartContainer = document.getElementById('barChart');
    if (!chartContainer) return;

    const { monthly, yearly } = this.data.revenueByPackage;
    
    chartContainer.innerHTML = `
      <div class="bar-chart-container">
        <!-- Y-axis labels -->
        <div class="bar-chart-y-axis">
          <span class="y-axis-label">10M</span>
          <span class="y-axis-label">8M</span>
          <span class="y-axis-label">6M</span>
          <span class="y-axis-label">4M</span>
          <span class="y-axis-label">2M</span>
        </div>
        
        <!-- Chart bars -->
        <div class="bar-chart-content">
          <div class="bar-wrapper">
            <div class="bar-value">${monthly.value}</div>
            <div class="bar monthly" style="height: ${monthly.height}px;"></div>
            <div class="bar-label">แพ็คเกจ<br>รายเดือน</div>
          </div>
          <div class="bar-wrapper">
            <div class="bar-value">${yearly.value}</div>
            <div class="bar yearly" style="height: ${yearly.height}px;"></div>
            <div class="bar-label yearly">แพ็คเกจ<br>รายปี</div>
          </div>
        </div>
      </div>
    `;
  }

  // Format revenue numbers into friendly strings and compute bar heights
  formatRevenueByPackage(revenueData) {
    const monthlyRevenue = revenueData.monthly || 0;
    const yearlyRevenue = revenueData.yearly || 0;

    const maxRevenue = Math.max(monthlyRevenue, yearlyRevenue, 1);
    const maxHeight = 351;

    return {
      monthly: {
        value: this.formatCurrency(monthlyRevenue),
        height: Math.round((monthlyRevenue / maxRevenue) * maxHeight)
      },
      yearly: {
        value: this.formatCurrency(yearlyRevenue),
        height: Math.round((yearlyRevenue / maxRevenue) * maxHeight)
      }
    };
  }

  formatCurrency(value) {
    if (!value || value === 0) return '0';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return `${value}`;
  }

  formatNumber(value) {
    try { return Number(value).toLocaleString('th-TH'); } catch (e) { return String(value); }
  }

  // Update the stat cards in the dashboard
  updateStatCards() {
    const revenueEl = document.querySelector('[data-stat="revenue"]');
    if (revenueEl) {
      revenueEl.textContent = `${this.formatNumber(this.data.totalRevenue)} ฿`;
    }

    const membersEl = document.querySelector('[data-stat="members"]');
    if (membersEl) {
      membersEl.textContent = `${this.formatNumber(this.data.newMembers)} คน`;
    }

    const churnEl = document.querySelector('[data-stat="churn"]');
    if (churnEl) {
      churnEl.textContent = `${this.data.churnRate}%`;
    }

    const totalMembersEl = document.querySelector('[data-stat="total-members"]');
    if (totalMembersEl) {
      totalMembersEl.textContent = `${this.formatNumber(this.data.totalMembers)} คน`;
    }
  }

  // Render a short list of recent members (first 5)
  renderMemberList() {
    const container = document.getElementById('memberList');
    if (!container) return;

    const members = (this.data._memberList || []).slice(0, 5);
    container.innerHTML = members.map(m => {
      const initials = m.name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
      return `
        <div class="member-item">
          <div class="member-avatar">${initials}</div>
          <div class="member-name">${m.name}</div>
        </div>
      `;
    }).join('');
  }

  // Method to update dashboard data
  updateData(newData) {
    this.data = { ...this.data, ...newData };
    this.refreshDashboard();
  }

  refreshDashboard() {
    // Update stat cards
    this.updateStatCards();
    
    // Refresh charts
    this.initCharts();
  }

  showError(message) {
    if (typeof showAlertModal === 'function') {
      showAlertModal(message);
    } else {
      alert(message);
    }
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // ตรวจสอบสิทธิ์ผู้ใช้ก่อน init dashboard
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // ถ้าไม่ได้ล็อกอิน ให้ไปหน้าเข้าสู่ระบบ
      window.location.href = 'login.html';
      return;
    }

    try {
      const userDoc = await getUserDoc(user.uid);
      const role = (userDoc && userDoc.exists()) ? (userDoc.data().role || 'user') : 'user';
      if (role !== 'admin') {
        // ถ้าไม่ใช่แอดมิน ให้ไปหน้า index
        window.location.href = 'index.html';
        return;
      }

      // เป็นแอดมิน -> เรียก Dashboard
      window.dashboard = new Dashboard();
    } catch (err) {
      console.error('Error validating admin role:', err);
      // ในกรณีผิดพลาด ให้กลับไปหน้า index เพื่อความปลอดภัย
      window.location.href = 'index.html';
    }
  });
});

export default Dashboard;
