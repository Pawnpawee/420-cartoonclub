// components/UserSidebar.js
// Renders user/profile-style sidebar into containers with classes like "profile-sidebar", "packages-sidebar", etc.

import { logout as firebaseLogout, auth as firebaseAuth } from '../firebase-controller.js';

function createMenuItem({cls = '', iconSrc, iconAlt = '', text, textClasses = ''}){
    const item = document.createElement('div');
    item.className = `menu-item ${cls}`.trim();

    const icon = document.createElement('div');
    icon.className = 'menu-icon' + (iconSrc && iconSrc.includes('-80') ? ' large' : '');
    if (iconSrc) {
        const img = document.createElement('img');
        img.src = iconSrc;
        img.alt = iconAlt;
        icon.appendChild(img);
    }

    const textEl = document.createElement('div');
    textEl.className = `menu-text ${textClasses}`.trim();
    textEl.textContent = text;

    item.appendChild(icon);
    item.appendChild(textEl);
    return {item, textEl, icon};
}

export function renderUserSidebar(container){
    if (!container || container.querySelector('.menu-item')) return;
    const active = container.dataset.active || '';

    // Back
    const back = createMenuItem({cls: 'back', iconSrc: 'icon/Back Arrow-2.png', iconAlt: 'Back Left', text: 'กลับสู่หน้าหลัก'});
    container.appendChild(back.item);

    // Overview
    const overview = createMenuItem({cls: 'overview', iconSrc: 'icon/Home.png', iconAlt: 'Home', text: 'ภาพรวม', textClasses: 'large'});
    if (active === 'overview') overview.textEl.classList.add('active'); else overview.textEl.classList.add('inactive');
    container.appendChild(overview.item);

    // Package
    const pkg = createMenuItem({cls: 'package', iconSrc: 'icon/Membership Card.png', iconAlt: 'Membership Card', text: 'แพ็คเกจ', textClasses: 'large'});
    if (active === 'package'){
        pkg.textEl.classList.add('active');
        pkg.icon.classList.add('large', 'active-icon');
    } else {
        pkg.textEl.classList.add('inactive');
    }
    container.appendChild(pkg.item);

    // Profile
    const prof = createMenuItem({cls: 'profile', iconSrc: 'icon/User.png', iconAlt: 'Profile', text: 'โปรไฟล์', textClasses: 'large'});
    if (active === 'profile') prof.textEl.classList.add('active'); else prof.textEl.classList.add('inactive');
    container.appendChild(prof.item);

    // If this is a profile sidebar, add logout button as in original markup
    if (container.classList.contains('profile-sidebar')){
        const logout = document.createElement('div');
        logout.className = 'menu-item';
        logout.id = 'logoutButton';

        const icon = document.createElement('div');
        icon.className = 'menu-icon large';
        icon.innerHTML = `<i class="fas fa-sign-out-alt" style="color:#c1272d; font-size: 32px;"></i>`;

        const textEl = document.createElement('div');
        textEl.className = 'menu-text large inactive';
        textEl.textContent = 'ออกจากระบบ';

        logout.appendChild(icon);
        logout.appendChild(textEl);
        container.appendChild(logout);
    }

    // Attach logout handler if present
    const logoutEl = container.querySelector('#logoutButton');
    if (logoutEl) {
        logoutEl.addEventListener('click', async () => {
            try {
                const ok = window.showConfirmModal ? await window.showConfirmModal('คุณต้องการออกจากระบบใช่หรือไม่?') : confirm('คุณต้องการออกจากระบบใช่หรือไม่?');
                if (!ok) return;

                // Prefer app-provided sign-out handler when available
                if (typeof window.appSignOut === 'function') {
                    try {
                        await window.appSignOut();
                    } catch (e) {
                        console.warn('window.appSignOut failed', e);
                    }
                } else if (typeof firebaseLogout === 'function') {
                    // Preferred: call logout exported from firebase-controller so it uses
                    // the initialized auth instance. This avoids relying on global SDKs.
                    try {
                        await firebaseLogout();
                    } catch (e) {
                        console.warn('firebase-controller.logout failed', e);
                    }
                } else {
                    // Try Firebase namespaced SDK: firebase.auth().signOut()
                    let signedOut = false;
                    try {
                        if (window.firebase && typeof window.firebase.auth === 'function') {
                            await window.firebase.auth().signOut();
                            signedOut = true;
                        } else if (window.firebase && window.firebase.auth && typeof window.firebase.auth.signOut === 'function') {
                            // some setups attach auth on firebase.auth
                            await window.firebase.auth.signOut();
                            signedOut = true;
                        }
                    } catch (e) {
                        console.warn('namespaced firebase signOut failed', e);
                    }

                    // Try modular SDK globals: signOut(getAuth()) if available
                    if (!signedOut) {
                        try {
                            if (typeof signOut === 'function' && typeof getAuth === 'function') {
                                await signOut(getAuth());
                                signedOut = true;
                            }
                        } catch (e) {
                            console.warn('modular firebase signOut failed', e);
                        }
                    }

                    // As a final fallback, call a window-level signOut helper if present
                    if (!signedOut && typeof window.appSignOut === 'function') {
                        try { await window.appSignOut(); signedOut = true; } catch (e) { console.warn('fallback appSignOut failed', e); }
                    }
                }

            
                setTimeout(() => { window.location.href = 'index.html'; }, 120);

            } catch (err) {
                console.error('Logout confirmation failed', err);
            }
        });
    }

    // Navigation wiring
    const backEl = container.querySelector('.menu-item.back');
    if (backEl) backEl.addEventListener('click', () => { window.location.href = 'index.html'; });

    if (typeof overview !== 'undefined' && overview && overview.item) overview.item.addEventListener('click', () => {
        setActive(container, overview.textEl);
        window.location.href = 'profile.html';
    });

    if (typeof pkg !== 'undefined' && pkg && pkg.item) pkg.item.addEventListener('click', () => {
        setActive(container, pkg.textEl);
        window.location.href = 'packages.html';
    });

    if (typeof prof !== 'undefined' && prof && prof.item) prof.item.addEventListener('click', () => {
        setActive(container, prof.textEl);
        window.location.href = 'edit-profile.html';
    });
}

function setActive(container, clickedTextEl){
    if (!container) return;
    container.querySelectorAll('.menu-text').forEach(mt => {
        mt.classList.remove('active');
        if (!mt.classList.contains('active')) mt.classList.add('inactive');
    });
    if (clickedTextEl){
        clickedTextEl.classList.remove('inactive');
        clickedTextEl.classList.add('active');
    }
}
