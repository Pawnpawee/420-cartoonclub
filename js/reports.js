/**
 * Reports Page Component
 * แสดงรายงานสรุปผล - Renewal Rate, Churn Rate, และแนวโน้ม
 */

import { auth, db, getUserDoc } from "../firebase-controller.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

class Reports {
  constructor() {
    this.data = {
      renewalRate: 0,
      churnRate: 0,
      renewalChange: 0,
      churnChange: 0,
      monthlyTrends: [], // [{month: 'ม.ค.', renewal: 85, churn: 4.2}, ...]
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
      // Load all data from the single main_summary document
      const summaryRef = doc(db, "reports", "daily_summary");
      const summarySnap = await getDoc(summaryRef);

      if (summarySnap.exists()) {
        const data = summarySnap.data();
        this.data.renewalRate = data.renewalRate || 0;
        this.data.churnRate = data.churnRate || 0;
        this.data.top10Weekly = data.top10Weekly || data.top10Content || [];
        this.data.packageDistribution = data.packageDistribution || {};

        // Get monthly trends directly from the summary document
        this.data.monthlyTrends = data.monthlyTrends || [];

        console.log("✅ Loaded data from daily_summary:", data);
      } else {
        console.warn(
          "⚠️ `reports/daily_summary` not found, using default values"
        );
        this.showError("ไม่พบข้อมูลสรุป (daily_summary document)");
      }

      // Update UI with the loaded data
      this.updateRateCards();
      this.renderMiniGraphs();
      this.renderTop10Weekly();
      this.renderPackageProportions();
    } catch (error) {
      console.error("❌ Error loading reports data:", error);
      this.showError("ไม่สามารถโหลดข้อมูลรายงานได้");
    }
  }

  /**
   * (This function is no longer needed as data is loaded from main_summary)
   * โหลดแนวโน้มรายเดือน
   */
  async loadMonthlyTrends() {
    // This function is now obsolete. Monthly trends are part of main_summary.
    // The logic has been moved into loadReportsData.
    console.log("loadMonthlyTrends is deprecated.");
  }

  /**
   * อัปเดตการ์ดแสดงอัตรา
   */
  updateRateCards() {
    // อัปเดต Renewal Rate
    const renewalValueEl = document.querySelector(
      ".rate-card:nth-child(1) .rate-value"
    );
    if (renewalValueEl) {
      renewalValueEl.textContent = `${this.data.renewalRate}%`;
    }

    // อัปเดต Churn Rate
    const churnValueEl = document.querySelector(
      ".rate-card:nth-child(2) .rate-value"
    );
    if (churnValueEl) {
      churnValueEl.textContent = `${this.data.churnRate}%`;
    }

    // อัปเดต Rate Change (ถ้ามี)
    // คำนวณการเปลี่ยนแปลงจากเดือนก่อน
    if (this.data.monthlyTrends.length >= 2) {
      const currentMonth =
        this.data.monthlyTrends[this.data.monthlyTrends.length - 1];
      const lastMonth =
        this.data.monthlyTrends[this.data.monthlyTrends.length - 2];

      this.data.renewalChange = parseFloat(
        (currentMonth.renewal - lastMonth.renewal).toFixed(1)
      );
      this.data.churnChange = parseFloat(
        (currentMonth.churn - lastMonth.churn).toFixed(1)
      );

      // อัปเดต UI
      const renewalChangeEl = document.querySelector(
        ".rate-card:nth-child(1) .rate-change span"
      );
      if (renewalChangeEl) {
        renewalChangeEl.textContent = `${Math.abs(this.data.renewalChange)}%`;

        const changeDiv = renewalChangeEl.parentElement;
        if (this.data.renewalChange >= 0) {
          changeDiv.classList.remove("negative");
          changeDiv.classList.add("positive");
          changeDiv.querySelector("i").className = "fas fa-arrow-up";
        } else {
          changeDiv.classList.remove("positive");
          changeDiv.classList.add("negative");
          changeDiv.querySelector("i").className = "fas fa-arrow-down";
        }
      }

      const churnChangeEl = document.querySelector(
        ".rate-card:nth-child(2) .rate-change span"
      );
      if (churnChangeEl) {
        churnChangeEl.textContent = `${Math.abs(this.data.churnChange)}%`;

        const changeDiv = churnChangeEl.parentElement;
        if (this.data.churnChange >= 0) {
          changeDiv.classList.remove("positive");
          changeDiv.classList.add("negative");
          changeDiv.querySelector("i").className = "fas fa-arrow-up";
        } else {
          changeDiv.classList.remove("negative");
          changeDiv.classList.add("positive");
          changeDiv.querySelector("i").className = "fas fa-arrow-down";
        }
      }
    }
  }

  attachEventListeners() {
    // Year selector
    const yearSelector = document.querySelector(".year-selector");
    if (yearSelector) {
      yearSelector.addEventListener("click", () => this.handleYearChange());
    }
  }

  // small helper to escape HTML in inserted strings
  escapeHtml(s) {
    if (!s) return "";
    return String(s).replace(/[&<>"']/g, function (m) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[m];
    });
  }

  /**
   * Render small sparklines inside the two rate cards (renewal & churn)
   */
  renderMiniGraphs() {
    const trends = this.data.monthlyTrends || [];
    if (!trends || trends.length === 0) return;

    const makeSpark = (values, color) => {
      const w = 160,
        h = 56,
        pad = 6;
      const max = Math.max(...values, 1);
      const stepX = (w - pad * 2) / Math.max(1, values.length - 1);
      const points = values
        .map((v, i) => {
          const x = pad + i * stepX;
          const y = pad + (1 - v / max) * (h - pad * 2);
          return `${x},${y}`;
        })
        .join(" ");
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    };

    // renewal mini-graph (first rate-card)
    try {
      const renewalVals = trends.map((t) => Number(t.renewal) || 0);
      const el1 = document.querySelector(
        ".rate-card:nth-of-type(1) .rate-graph-placeholder"
      );
      if (el1) el1.innerHTML = makeSpark(renewalVals, "#6b9e3d");
    } catch (e) {
      console.warn("mini graph renewal failed", e);
    }

    // churn mini-graph (second rate-card)
    try {
      const churnVals = trends.map((t) => Number(t.churn) || 0);
      const el2 = document.querySelector(
        ".rate-card:nth-of-type(2) .rate-graph-placeholder"
      );
      if (el2) el2.innerHTML = makeSpark(churnVals, "#c1272d");
    } catch (e) {
      console.warn("mini graph churn failed", e);
    }
  }

  handleYearChange() {
    console.log("Year selector clicked");
    showAlertModal?.("ฟีเจอร์การเลือกปีจะพัฒนาในอนาคต");
  }

  renderCharts() {
    this.renderTrendChart();
  }

  renderTop10Weekly() {
    const container = document.getElementById("top10WeeklyList");
    if (!container) return;
    // Use already-loaded summary in this.data.top10Weekly if available
    (async () => {
      try {
        const list = this.data.top10Weekly || [];
        if (!list || list.length === 0) {
          container.innerHTML = '<p style="color:#999">ไม่มีข้อมูลอันดับ</p>';
          return;
        }

        const items = await Promise.all(
          list.map(async (it, idx) => {
            try {
              const cRef = doc(db, "content", it.contentId);
              const cSnap = await getDoc(cRef);
              const cdata = cSnap && cSnap.exists() ? cSnap.data() : {};
              return {
                rank: idx + 1,
                contentId: it.contentId,
                title: it.title || cdata.title || "Untitled",
                minutes: it.watchMinutes || 0,
                followerCount: it.followerCount || cdata.followerCount || 0,
                thumbnail: cdata.thumbnailURL || cdata.heroImageURL || "https://occ-0-8407-2219.1.nflxso.net/dnm/api/v6/E8vDc_W8CLv7-yMQu8KMEC7Rrr8/AAAABcEXJRHDMvWDoCn3shb0-LC7kPE6reaeSw7JtWOMu01hOhZ2mWC-QbWFfGKznZAQCKCrRw2akMYxixh1y4-ZdZ59Xkn8m04Gz2Rl.jpg?r=b6a",
                url: `view.html?content=${encodeURIComponent(it.contentId)}`,
              };
            } catch (err) {
              return {
                rank: idx + 1,
                contentId: it.contentId,
                title: it.title || "Untitled",
                minutes: it.watchMinutes || 0,
                followerCount: it.followerCount || 0,
                thumbnail: "",
                url: `view.html?content=${encodeURIComponent(it.contentId)}`,
              };
            }
          })
        );

        const defaultThumbnail = "https://occ-0-8407-2219.1.nflxso.net/dnm/api/v6/E8vDc_W8CLv7-yMQu8KMEC7Rrr8/AAAABcEXJRHDMvWDoCn3shb0-LC7kPE6reaeSw7JtWOMu01hOhZ2mWC-QbWFfGKznZAQCKCrRw2akMYxixh1y4-ZdZ59Xkn8m04Gz2Rl.jpg?r=b6a";
        
        container.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
            ${items
              .map(
                (it) => `
              <a href="${
                it.url
              }" class="top10-card" style="display:block;background:#fff;border-radius:8px;padding:10px;box-shadow:0 6px 18px rgba(15,23,42,0.06);text-decoration:none;color:inherit">
                <div style="display:flex;gap:10px;align-items:center">
                  <div style="width:72px;height:72px;flex:0 0 72px;border-radius:6px;overflow:hidden;background:#f3f4f6;display:flex;align-items:center;justify-content:center">
                    ${
                      it.thumbnail
                        ? `<img src="${it.thumbnail}" alt="${this.escapeHtml(
                            it.title
                          )}" onerror="this.src='${defaultThumbnail}'" style="width:100%;height:100%;object-fit:cover">`
                        : `<div style="font-weight:700;color:#999">${this.escapeHtml(
                            it.title.slice(0, 1)
                          )}</div>`
                    }
                  </div>
                  <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:8px;justify-content:space-between">
                      <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this.escapeHtml(
                        it.title
                      )}</div>
                      <div style="font-size:12px;color:#6b7280">#${
                        it.rank
                      }</div>
                    </div>
                    <div style="margin-top:6px;font-size:13px;color:#374151">${it.minutes.toLocaleString()} นาที</div>
                    <div style="margin-top:6px;font-size:12px;color:#6b7280">ผู้ติดตาม ${Number(
                      it.followerCount
                    ).toLocaleString()}</div>
                  </div>
                </div>
              </a>
            `
              )
              .join("")}
          </div>
        `;
      } catch (err) {
        console.error("renderTop10Weekly failed", err);
        container.innerHTML =
          '<p style="color:#999">เกิดข้อผิดพลาดขณะโหลดอันดับ</p>';
      }
    })();
  }

  /**
   * วาดกราฟแนวโน้มการต่ออายุเทียบกับการเลิกใช้
   */
  renderTrendChart() {
    const chartContainer = document.querySelector(".trend-chart-content");
    if (!chartContainer) return;

    // ข้อมูล 3 เส้น ตามดีไซน์ Figma
    const months = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    // ข้อมูลตัวอย่าง 3 เส้น (สีเขียว, สีส้ม, สีแดง)
    const line1Data = [20, 35, 50, 78, 70, 65, 60, 70, 75, 87, 95, 100]; // เส้นเขียว
    const line2Data = [25, 40, 50, 55, 50, 35, 30, 35, 50, 90, 78, 65];   // เส้นส้ม
    const line3Data = [30, 45, 55, 60, 65, 70, 75, 80, 90, 75, 70, 45];   // เส้นแดง

    const chartWidth = 900;
    const chartHeight = 320;
    const padding = { top: 30, right: 30, bottom: 50, left: 50 };
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;

    // คำนวณตำแหน่งจุดข้อมูล
    const xStep = plotWidth / (months.length - 1);

    // ฟังก์ชันสร้าง smooth curve path
    const createSmoothPath = (data) => {
      const points = data.map((value, i) => ({
        x: padding.left + i * xStep,
        y: padding.top + plotHeight - (value / 100) * plotHeight,
      }));

      if (points.length < 2) return '';

      let path = `M ${points[0].x} ${points[0].y}`;
      
      for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        const controlPointX = (current.x + next.x) / 2;
        
        path += ` Q ${controlPointX} ${current.y}, ${controlPointX} ${(current.y + next.y) / 2}`;
        path += ` Q ${controlPointX} ${next.y}, ${next.x} ${next.y}`;
      }

      return path;
    };

    const line1Path = createSmoothPath(line1Data);
    const line2Path = createSmoothPath(line2Data);
    const line3Path = createSmoothPath(line3Data);

    // Y-axis labels
    const yAxisLabels = [100, 80, 60, 40, 20];

    chartContainer.innerHTML = `
      <div style="display: flex; gap: 8px; align-items: flex-start; width: 100%;">
        <!-- Y-axis labels -->
        <div style="display: flex; flex-direction: column; justify-content: space-between; height: ${chartHeight - 50}px; padding-top: ${padding.top}px; padding-bottom: 25px; width: 40px; flex-shrink: 0;">
          ${yAxisLabels.map(label => `
            <div style="font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; color: #425466; text-align: right; line-height: 1;">
              ${label}
            </div>
          `).join('')}
        </div>

        <!-- Chart area -->
        <div style="flex: 1; min-width: 0;">
          <svg width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" style="width: 100%; height: auto; display: block;">
            <!-- Line 1 (Green) -->
            <path d="${line1Path}" fill="none" stroke="#2D8A5B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            
            <!-- Line 2 (Orange) -->
            <path d="${line2Path}" fill="none" stroke="#E67E22" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            
            <!-- Line 3 (Red) -->
            <path d="${line3Path}" fill="none" stroke="#E74C3C" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>

          <!-- X-axis labels -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; font-family: 'IBM Plex Sans', 'Noto Sans Thai', sans-serif; font-size: 14px; color: #8492A6; margin-top: 10px;">
            ${months.map(month => `
              <div style="flex-shrink: 0; white-space: nowrap; line-height: 1;">
                ${month}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
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
      const barRenew = document.querySelector(
        `.proportion-card .progress-bar.renewal[data-key="${key}"]`
      );
      const valRenew = document.querySelector(
        `.proportion-card .proportion-value[data-key="${key}"]`
      );
      if (barRenew) barRenew.style.width = percent + "%";
      if (valRenew) valRenew.textContent = text;

      const barChurn = document.querySelectorAll(
        `.proportion-card .progress-bar.churn[data-key="${key}"]`
      );
      const valChurn = document.querySelectorAll(
        `.proportion-card .proportion-value[data-key="${key}"]`
      );
      barChurn.forEach((b) => (b.style.width = percent + "%"));
      valChurn.forEach((v) => (v.textContent = text));
    };

    const freePct = Math.round((free / total) * 100);
    const monthlyPct = Math.round((monthly / total) * 100);
    const yearlyPct = Math.round((yearly / total) * 100);

    setFor("free", freePct, `${freePct}%`);
    setFor("monthly", monthlyPct, `${monthlyPct}%`);
    setFor("yearly", yearlyPct, `${yearlyPct}%`);
  }

  showError(message) {
    if (typeof showAlertModal === "function") {
      showAlertModal(message);
    } else {
      alert(message);
    }
  }
}

// Initialize reports when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    try {
      const userDoc = await getUserDoc(user.uid);
      const role =
        userDoc && userDoc.exists() ? userDoc.data().role || "user" : "user";

      if (role !== "admin") {
        window.location.href = "index.html";
        return;
      }

      // เป็นแอดมิน -> เรียก Reports
      window.reports = new Reports();
    } catch (err) {
      console.error("Error validating admin role:", err);
      window.location.href = "index.html";
    }
  });
});

export default Reports;
