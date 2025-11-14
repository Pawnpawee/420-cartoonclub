// Replace the old dynamic loader with direct imports of the two concrete
// sidebar renderers so pages load only what they need and we can remove
// `components/Sidebar.js`.

import { renderAdminSidebar } from '../components/AdminSidebar.js';
import { renderUserSidebar } from '../components/UserSidebar.js';

document.addEventListener('DOMContentLoaded', () => {
	// Render admin-sidebars
	document.querySelectorAll('.admin-sidebar').forEach(el => {
		try { renderAdminSidebar(el); } catch (e) { console.error('admin sidebar render failed', e); }
	});

	// Render user-style sidebars for known selectors, but skip any admin elements
	const userSelectors = ['.profile-sidebar', '.packages-sidebar', '.edit-profile-sidebar', '.sidebar'];
	userSelectors.forEach(sel => {
		document.querySelectorAll(sel).forEach(el => {
			if (el.classList && el.classList.contains('admin-sidebar')) return;
			try { renderUserSidebar(el); } catch (e) { console.error('user sidebar render failed', e); }
		});
	});
});

// export nothing; file exists to be referenced from pages as a module
