// js/content.js
// Admin UI for managing content collection and episodes subcollection

import { db } from '../firebase-controller.js';
import { collection, query, orderBy, getDocs, addDoc, doc, setDoc, deleteDoc, getDoc } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';
import Modal from '../components/Modal.js';

// lightweight dialog adapters (use project's modal system if available)
async function confirmDialog(message){
    if (typeof window.showConfirmModal === 'function') return await window.showConfirmModal(message);
    return confirm(message);
}
function alertDialog(message){
    if (typeof window.showAlertModal === 'function') return window.showAlertModal(message);
    return alert(message);
}

function createModal(title, html, opts = {}){
    const m = new Modal({ title, content: html, variant: opts.variant || 'figma', showFooter: opts.showFooter !== false });
    // attach primary action via onSubmit
    if (opts.onPrimary) m.onSubmit = async (modalInstance) => { await opts.onPrimary(modalInstance); };
    m.render();
    m.open();
    // update primary button text if provided
    if (opts.primaryText && m.element){
        const submitBtn = m.element.querySelector('[data-action="submit"]');
        if (submitBtn) submitBtn.textContent = opts.primaryText;
    }
    return m;
}

const pageSize = 10;
let contents = [];
let currentPage = 1;
let totalPages = 1;

const contentTableBody = document.getElementById('contentTableBody');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const paginationNumbers = document.getElementById('paginationNumbers');
const addContentBtn = document.getElementById('addContentBtn');

if (addContentBtn) addContentBtn.addEventListener('click', () => openCreateModal());
if (prevPageBtn) prevPageBtn.addEventListener('click', () => goToPage(currentPage - 1));
if (nextPageBtn) nextPageBtn.addEventListener('click', () => goToPage(currentPage + 1));

// delegate action button clicks inside table (edit / delete / episodes)
if (contentTableBody) {
    contentTableBody.addEventListener('click', (e) => {
        // Button actions (delete / episodes) take precedence
        const btn = e.target.closest('button');
        if (btn) {
            const id = btn.dataset.id;
            if (btn.classList.contains('delete')) {
                e.stopPropagation();
                confirmDelete(id);
                return;
            }
            if (btn.classList.contains('episodes')) {
                e.stopPropagation();
                openEpisodesManager(id);
                return;
            }
            return;
        }

        // If click wasn't on a button, allow row click to open edit modal (like members page)
        const row = e.target.closest('tr');
        // don't open edit modal when clicking interactive badges/controls inside the row
        if (row && row.dataset.id && !e.target.closest('.status-badge')) {
            openEditModal(row.dataset.id);
        }
    });
}

async function loadPage(){
    try {
        const cRef = collection(db, 'content');
        const snap = await getDocs(query(cRef, orderBy('title')));
        contents = snap.docs.map(d => ({ id: d.id, data: d.data() }));

        // pagination setup
        currentPage = 1;
        totalPages = Math.max(1, Math.ceil(contents.length / pageSize));

        renderTable();
        renderPagination();
    } catch (err) {
        console.error('loadPage error', err);
        alertDialog('เกิดข้อผิดพลาดขณะโหลดข้อมูล');
    }
}

function goToPage(page){
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    currentPage = page;
    renderTable();
    renderPagination();
}

// Render table for current page (members-style numbering)
function renderTable(){
    if (!contentTableBody) return;
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = contents.slice(start, end);

    if (pageItems.length === 0) {
        contentTableBody.innerHTML = '<tr><td colspan="8">No content found</td></tr>';
        return;
    }

    contentTableBody.innerHTML = pageItems.map((item, idx) => {
        const data = item.data || {};
        const seq = start + idx + 1;
        return `
            <tr data-id="${item.id}">
                <td>${seq}</td>
                <td>${escapeHtml(data.title || '')}</td>
                <td>${escapeHtml(data.type || '')}</td>
                <td style="text-align:center">${data.isRecommended ? '✓' : ''}</td>
                <td style="text-align:center">${data.isFeaturedHero ? '✓' : ''}</td>
                <td style="text-align:center">${data.requiresSubscription ? '✓' : ''}</td>
                <td style="text-align:center">${data.episodeCount || 0}</td>
                <td>
                    <div class="member-actions">
                        <!-- Edit via row click like members page (no edit button) -->
                        <button class="btn small btn-danger delete" data-id="${item.id}" title="ลบ"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // event delegation: handle edit/delete/episodes clicks
    contentTableBody.querySelectorAll('button').forEach(b => b.addEventListener('click', (e) => e.stopPropagation()));
}

// Render pagination buttons like members.js
function renderPagination(){
    if (!paginationNumbers) return;
    totalPages = Math.max(1, Math.ceil(contents.length / pageSize));
    let html = '';

    if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
    } else {
        html += `<button class="page-number ${currentPage === 1 ? 'active' : ''}" data-page="1">1</button>`;
        if (currentPage > 3) html += `<span class="page-ellipsis">...</span>`;
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) html += `<button class="page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        if (currentPage < totalPages - 2) html += `<span class="page-ellipsis">...</span>`;
        html += `<button class="page-number ${currentPage === totalPages ? 'active' : ''}" data-page="${totalPages}">${totalPages}</button>`;
    }

    paginationNumbers.innerHTML = html;
    // attach listeners
    paginationNumbers.querySelectorAll('.page-number').forEach(btn => btn.addEventListener('click', () => goToPage(parseInt(btn.dataset.page))));

    if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
}

function escapeHtml(s){
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[m]; });
}

// --- Modals: create/edit content ---
function openCreateModal(){
    const fields = [
        { id: 'title', name: 'title', label: 'Title', required: true },
        { id: 'type', name: 'type', label: 'Type', type: 'select', options: [ { value: 'series', label: 'series' }, { value: 'movie', label: 'movie' } ] },
        { id: 'thumbnailURL', name: 'thumbnailURL', label: 'Thumbnail URL' },
        { id: 'heroImageURL', name: 'heroImageURL', label: 'Hero Video ID' },
        { id: 'requiresSubscription', name: 'requiresSubscription', label: 'Requires Subscription', type: 'checkbox' },
        { id: 'isRecommended', name: 'isRecommended', label: 'Recommended', type: 'checkbox' },
        { id: 'isFeaturedHero', name: 'isFeaturedHero', label: 'Featured Hero', type: 'checkbox' },
        { id: 'tags', name: 'tags', label: 'Tags (comma separated)' },
        { id: 'episodeCount', name: 'episodeCount', label: 'Episode Count', type: 'number' }
    ];

    const modalId = 'content-create-' + Math.random().toString(36).slice(2,6);
    const modal = Modal.createFormModal({ id: modalId, title: 'เพิ่มคอนเทนต์', fields, formId: 'contentForm', variant: 'figma', showFooter: true });
    modal.onSubmit = async (modalInstance) => {
        try {
            const form = document.getElementById('contentForm');
            const obj = {
                title: form.querySelector('#title').value,
                type: form.querySelector('#type').value,
                thumbnailURL: form.querySelector('#thumbnailURL').value || '',
                heroImageURL: form.querySelector('#heroImageURL').value || '',
                requiresSubscription: !!form.querySelector('#requiresSubscription').checked,
                isRecommended: !!form.querySelector('#isRecommended').checked,
                isFeaturedHero: !!form.querySelector('#isFeaturedHero').checked,
                tags: form.querySelector('#tags').value ? form.querySelector('#tags').value.split(',').map(t=>t.trim()).filter(Boolean) : [],
                episodeCount: parseInt(form.querySelector('#episodeCount').value) || 0,
                totalWatchMinutes: 0,
                followerCount: 0
            };
            await addDoc(collection(db,'content'), obj);
            modalInstance.close();
            alertDialog('บันทึกสำเร็จ');
            await loadPage();
        } catch (err) {
            console.error('create content err', err);
            alertDialog('เกิดข้อผิดพลาดขณะบันทึก');
        }
    };
    modal.render();
    modal.open();
}

async function openEditModal(contentId){
    try {
        const dRef = doc(db,'content',contentId);
        const snap = await getDoc(dRef);
        if (!snap.exists()) { alertDialog('ไม่พบคอนเทนต์'); return; }
        const data = snap.data();

        const fields = [
            { id: 'title', name: 'title', label: 'Title', required: true },
            { id: 'type', name: 'type', label: 'Type', type: 'select', options: [ { value: 'series', label: 'series' }, { value: 'movie', label: 'movie' } ] },
            { id: 'thumbnailURL', name: 'thumbnailURL', label: 'Thumbnail URL' },
            { id: 'heroImageURL', name: 'heroImageURL', label: 'Hero Video ID' },
            { id: 'requiresSubscription', name: 'requiresSubscription', label: 'Requires Subscription', type: 'checkbox' },
            { id: 'isRecommended', name: 'isRecommended', label: 'Recommended', type: 'checkbox' },
            { id: 'isFeaturedHero', name: 'isFeaturedHero', label: 'Featured Hero', type: 'checkbox' },
            { id: 'tags', name: 'tags', label: 'Tags (comma separated)' },
            { id: 'episodeCount', name: 'episodeCount', label: 'Episode Count', type: 'number' }
        ];

        const modalId = 'content-edit-' + Math.random().toString(36).slice(2,6);
        const modal = Modal.createFormModal({ id: modalId, title: 'แก้ไขคอนเทนต์', fields, formId: 'contentForm', variant: 'figma', showFooter: true });
        modal.onSubmit = async (modalInstance) => {
            try {
                const form = document.getElementById('contentForm');
                const obj = {
                    title: form.querySelector('#title').value,
                    type: form.querySelector('#type').value,
                    thumbnailURL: form.querySelector('#thumbnailURL').value || '',
                    heroImageURL: form.querySelector('#heroImageURL').value || '',
                    requiresSubscription: !!form.querySelector('#requiresSubscription').checked,
                    isRecommended: !!form.querySelector('#isRecommended').checked,
                    isFeaturedHero: !!form.querySelector('#isFeaturedHero').checked,
                    tags: form.querySelector('#tags').value ? form.querySelector('#tags').value.split(',').map(t=>t.trim()).filter(Boolean) : [],
                    episodeCount: parseInt(form.querySelector('#episodeCount').value) || 0
                };
                await setDoc(dRef, {...data, ...obj});
                modalInstance.close();
                alertDialog('อัปเดตสำเร็จ');
                await loadPage();
            } catch (err) {
                console.error('update content err', err);
                alertDialog('เกิดข้อผิดพลาดขณะอัปเดต');
            }
        };
        modal.render();

        // prefill
        const formEl = () => document.getElementById('contentForm');
        // fill values once the form exists in DOM
        const fillOnce = () => {
            const form = formEl();
            if (!form) return false;
            form.querySelector('#title').value = data.title || '';
            form.querySelector('#type').value = data.type || 'series';
            form.querySelector('#thumbnailURL').value = data.thumbnailURL || '';
            form.querySelector('#heroImageURL').value = data.heroImageURL || '';
            if (form.querySelector('#requiresSubscription')) form.querySelector('#requiresSubscription').checked = !!data.requiresSubscription;
            if (form.querySelector('#isRecommended')) form.querySelector('#isRecommended').checked = !!data.isRecommended;
            if (form.querySelector('#isFeaturedHero')) form.querySelector('#isFeaturedHero').checked = !!data.isFeaturedHero;
            if (form.querySelector('#tags')) form.querySelector('#tags').value = (data.tags||[]).join(', ');
            if (form.querySelector('#episodeCount')) form.querySelector('#episodeCount').value = data.episodeCount || 0;
            return true;
        };

        // attempt immediate fill, otherwise poll briefly
        if (!fillOnce()) {
            const interval = setInterval(() => {
                if (fillOnce()) clearInterval(interval);
            }, 40);
            // stop polling after short timeout
            setTimeout(() => clearInterval(interval), 1200);
        }

        modal.open();
    } catch (err) {
        console.error('openEditModal err', err);
    }
}

async function confirmDelete(contentId){
    const ok = await confirmDialog('คุณต้องการลบคอนเทนต์นี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้');
    if (!ok) return;
    try {
    await deleteDoc(doc(db,'content',contentId));
    alertDialog('ลบสำเร็จ');
        loadPage();
    } catch (err) {
        console.error('delete err', err);
        alertDialog('เกิดข้อผิดพลาดขณะลบ');
    }
}

// Episodes manager (basic): lists episodes and allows add/delete for series
async function openEpisodesManager(contentId){
    try {
    const contentRef = doc(db,'content',contentId);
        const contentSnap = await getDoc(contentRef);
    if (!contentSnap.exists()) { alertDialog('ไม่พบคอนเทนต์'); return; }
    const contentData = contentSnap.data();
    if (contentData.type !== 'series') { alertDialog('เนื้อหานี้ไม่ใช่ซีรีส์'); return; }

        // Fetch episodes
    const epsCol = collection(db, 'content', contentId, 'episodes');
    const epsSnap = await getDocs(query(epsCol, orderBy('episodeNumber')));
        let html = `<div id="episodesList">`;
        epsSnap.forEach(es => {
            const d = es.data();
            html += `<div class="episode-row" data-id="${es.id}">#${d.episodeNumber} - ${escapeHtml(d.title)} <button class="btn small btn-danger ep-delete" data-id="${es.id}" title="ลบ"><i class="fas fa-trash"></i></button></div>`;
        });
        html += `</div><hr>`;
        html += `<form id="episodeForm"><label>Episode #<input name="episodeNumber" type="number" required></label><label>Title<input name="title"></label><label>Video ID<input name="video_id"></label><label>Duration (min)<input name="duration" type="number"></label></form>`;

        const modal = createModal(`จัดการตอน: ${contentData.title}`, html, {
            primaryText: 'เพิ่มตอน',
            onPrimary: async () => {
                const f = document.getElementById('episodeForm');
                const fd = new FormData(f);
                const obj = {
                    episodeNumber: parseInt(fd.get('episodeNumber')) || 0,
                    title: fd.get('title') || '',
                    video_id: fd.get('video_id') || '',
                    duration: parseInt(fd.get('duration')) || 0,
                    thumbnailURL: ''
                };
                try {
                    await addDoc(collection(db, 'content', contentId, 'episodes'), obj);
                        modal.close();
                        alertDialog('เพิ่มตอนสำเร็จ');
                        loadPage();
                } catch (err) {
                    console.error('add episode err', err);
                    alertDialog('เกิดข้อผิดพลาดขณะเพิ่มตอน');
                }
            }
        });

        // attach delete handlers inside modal after render (Modal implementation should expose modal DOM)
        setTimeout(() => {
            const modalEl = document.querySelector('.cc-modal');
            if (!modalEl) return;
            modalEl.querySelectorAll('.ep-delete').forEach(b => b.addEventListener('click', async (ev) => {
                const epId = ev.target.dataset.id;
                const ok = await confirmDialog('ลบตอนนี้?');
                if (!ok) return;
                try {
                    await deleteDoc(doc(db, 'content', contentId, 'episodes', epId));
                    alertDialog('ลบสำเร็จ');
                    modal.close();
                    loadPage();
                } catch (err) {
                    console.error('delete ep err', err);
                }
            }));
        }, 250);

    } catch (err) {
        console.error('openEpisodesManager err', err);
    }
}

// Initial load
loadPage();
