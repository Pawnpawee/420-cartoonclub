// Reusable Footer Component using FontAwesome icons
function renderFooter(targetId) {
    const footerHTML = `
        <footer class="footer">
            <div class="footer-content">
                <div class="footer-logo-section">
                    <div class="footer-logo">
                        <img src="img/Logo Cartoon Club.png" alt="Cartoon Club Logo">
                    </div>
                    <p class="footer-address">
                        32 ซอย สุภาพงษ์ 1 แยก 6 แขวงหนองบอน เขตประเวศ กรุงเทพฯ 10250<br>
                        Office : 02-320-4005-7
                    </p>
                </div>
                <div class="footer-about">
                    <h3>เกี่ยวกับเรา</h3>
                    <a href="https://www.facebook.com/CartoonClubChannel/?locale=th_TH" target="_blank" rel="noopener" class="social-link"><span class="social-icon"><i class="fab fa-facebook-f"></i></span><span>Facebook</span></a>
                    <a href="https://www.instagram.com/cartoonclub.channel/" target="_blank" rel="noopener" class="social-link"><span class="social-icon"><i class="fab fa-instagram"></i></span><span>Instagram</span></a>
                    <a href="https://x.com/CARTOONCLUBCH" target="_blank" rel="noopener" class="social-link"><span class="social-icon"><i class="fab fa-x-twitter"></i></span><span>X</span></a>
                </div>
                <div class="footer-links">
                    <h3>ข้อกำหนดและเงื่อนไข</h3>
                    <a href="#">ข้อตกลงความเป็นส่วนตัว</a>
                    <a href="#">นโยบายคุกกี้</a>
                </div>
            </div>
            <div class="footer-divider"></div>
            <p class="footer-copyright">Copyright © 2025 Cartoon Club. นี่เป็นเว็บไซต์สำหรับใช้ในวิชา CMM 420 เท่านั้น ไม่ใช่เว็บไซต์จริง
            
            
            
            
            
            
            </p>
        </footer>
    `;
    document.getElementById(targetId).innerHTML = footerHTML;
}

// Auto-render if #footer exists
if (document.getElementById('footer')) {
    renderFooter('footer');
}

/* Global modal helpers: showAlertModal(message, title?) and showConfirmModal(message, title?)
     These create a figma-style modal consistent with the project's Modal look-and-feel.
*/
(function(){
    function createModalEl({id, title, message, buttons}){
        const wrapper = document.createElement('div');
        wrapper.id = id || ('modal-' + Math.random().toString(36).slice(2,8));
        wrapper.className = 'modal';
        const hasTwo = Array.isArray(buttons) && buttons.length === 2;
        const footerHtml = (buttons || []).map((b, i) => {
            const cls = b.class || (i===0 ? 'btn-figma-secondary' : 'btn-figma-primary');
            return `<button type="button" class="${cls}" data-action="modal-btn" data-idx="${i}">${b.label}</button>`;
        }).join('');

        const footerContainer = hasTwo ? `<div class="modal-footer modal-footer-figma">${footerHtml}</div>` : `<div class="modal-footer modal-footer-figma" style="justify-content:center">${footerHtml}</div>`;

        wrapper.innerHTML = `
            <div class="modal-content modal-figma" role="dialog" aria-modal="true">
                <div class="modal-figma-inner">
                    <div class="modal-figma-text">
                        <h1 class="modal-figma-title">${title || 'แจ้งเตือน'}</h1>
                        <p class="modal-figma-desc">${message || ''}</p>
                    </div>
                </div>
                ${footerContainer}
            </div>
        `;

        // click outside to close
        wrapper.addEventListener('click', (e)=>{
            if (e.target === wrapper) wrapper.remove();
        });

        return wrapper;
    }

    window.showAlertModal = function(message, title){
        const modalEl = createModalEl({ title: title || 'แจ้งเตือน', message: message, buttons: [{ label: 'ปิด', class: 'btn-figma-primary' }] });
        document.body.appendChild(modalEl);
        document.body.style.overflow = 'hidden';
        modalEl.classList.add('show');
        const btn = modalEl.querySelector('[data-action="modal-btn"]');
        btn && btn.addEventListener('click', ()=>{ modalEl.remove(); document.body.style.overflow = ''; });
    };

    window.showConfirmModal = function(message, title){
        return new Promise((resolve)=>{
            const modalEl = createModalEl({ title: title || 'ยืนยัน', message: message, buttons: [ { label: 'ยกเลิก', class: 'btn-figma-secondary' }, { label: 'ตกลง', class: 'btn-figma-primary' } ] });
            document.body.appendChild(modalEl);
            document.body.style.overflow = 'hidden';
            modalEl.classList.add('show');
            const buttons = modalEl.querySelectorAll('[data-action="modal-btn"]');
            buttons.forEach(btn=>{
                btn.addEventListener('click', (e)=>{
                    const idx = Number(btn.dataset.idx || 0);
                    document.body.style.overflow = '';
                    modalEl.remove();
                    resolve(idx === 1); // second button is confirm
                });
            });
        });
    };
})();
