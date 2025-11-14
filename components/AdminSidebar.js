// components/AdminSidebar.js
// Renders admin-specific sidebar into a container element with class "admin-sidebar"

import { auth } from '../firebase-controller.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';

export function renderAdminSidebar(container){
    if (!container || container.querySelector('.menu-item')) return;
    const active = container.dataset.active || '';

    // Admin profile block
    const profile = document.createElement('div');
    profile.className = 'admin-profile';
    profile.innerHTML = `
        <div class="admin-avatar"><i class="fas fa-user"></i></div>
        <div class="admin-name">Admin</div>
    `;
    container.appendChild(profile);

    const nav = document.createElement('nav');
    nav.className = 'menu-list';

    const items = [
        {href: 'dashboard.html', cls: 'dashboard', icon: 'fas fa-chart-line', text: 'สรุปภาพรวม', key: 'dashboard'},
        {href: 'members.html', cls: 'members', icon: 'fas fa-users', text: 'จัดการสมาชิก', key: 'members'},
        {href: 'content.html', cls: 'content', icon: 'fas fa-clapperboard', text: 'จัดการคอนเทนต์', key: 'content'},
        {href: 'reports.html', cls: 'reports', icon: 'fas fa-file-alt', text: 'รายงานสรุปผล', key: 'reports'}
    ];

    items.forEach(it => {
        const a = document.createElement('a');
        a.href = it.href;
        a.className = 'menu-item' + (active === it.key ? ' active' : '');
        a.dataset.action = it.key;
        a.innerHTML = `<i class="${it.icon}"></i><span>${it.text}</span>`;
        nav.appendChild(a);
    });

    // Logout anchor
    const logoutA = document.createElement('a');
    logoutA.href = '#';
    logoutA.className = 'menu-item logout';
    logoutA.dataset.action = 'logout';
    logoutA.innerHTML = `<i class="fas fa-sign-out-alt"></i><span>ออกจากระบบ</span>`;
    nav.appendChild(logoutA);

    container.appendChild(nav);

    // Admin navigation wiring
    const adminDash = container.querySelector('.menu-item[data-action="dashboard"]');
    if (adminDash) adminDash.addEventListener('click', (ev) => { ev.preventDefault(); window.location.href = 'dashboard.html'; });
    const adminMembers = container.querySelector('.menu-item[data-action="members"]');
    if (adminMembers) adminMembers.addEventListener('click', (ev) => { ev.preventDefault(); window.location.href = 'members.html'; });
    const adminContent = container.querySelector('.menu-item[data-action="content"]');
    if (adminContent) adminContent.addEventListener('click', (ev) => { ev.preventDefault(); window.location.href = 'content.html'; });
    const adminReports = container.querySelector('.menu-item[data-action="reports"]');
    if (adminReports) adminReports.addEventListener('click', (ev) => { ev.preventDefault(); window.location.href = 'reports.html'; });

    const adminLogout = container.querySelector('.menu-item.logout');
    if (adminLogout) {
        adminLogout.addEventListener('click', async (ev) => {
            ev.preventDefault();
            try {
                const ok = window.showConfirmModal ? await window.showConfirmModal('คุณต้องการออกจากระบบใช่หรือไม่?') : confirm('คุณต้องการออกจากระบบใช่หรือไม่?');
                if (!ok) return;
                signOut(auth).then(() => {
                    window.location.href = 'login.html';
                }).catch((error) => {
                    console.error('Logout Error:', error);
                    if (window.showAlertModal) window.showAlertModal('เกิดข้อผิดพลาดในการออกจากระบบ'); else alert('เกิดข้อผิดพลาดในการออกจากระบบ');
                });
            } catch (err) {
                console.error('Logout confirmation failed', err);
            }
        });
    }
}
