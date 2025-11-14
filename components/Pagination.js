/**
 * Pagination Component
 * Reusable pagination component for tables and lists
 * Based on Figma Design (Node ID: 38-743)
 */

class Pagination {
  constructor(options = {}) {
    this.currentPage = options.currentPage || 1;
    this.totalPages = options.totalPages || 1;
    this.maxVisible = options.maxVisible || 5;
    this.onChange = options.onChange || null;
    this.container = null;
  }

  /**
   * Calculate visible page numbers
   */
  getVisiblePages() {
    const pages = [];
    
    if (this.totalPages <= this.maxVisible) {
      // Show all pages
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Add ellipsis if needed
      if (this.currentPage > 3) {
        pages.push('...');
      }
      
      // Show current page and neighbors
      const start = Math.max(2, this.currentPage - 1);
      const end = Math.min(this.totalPages - 1, this.currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }
      
      // Add ellipsis if needed
      if (this.currentPage < this.totalPages - 2) {
        pages.push('...');
      }
      
      // Always show last page
      if (!pages.includes(this.totalPages)) {
        pages.push(this.totalPages);
      }
    }
    
    return pages;
  }

  /**
   * Render pagination HTML
   */
  render() {
    const visiblePages = this.getVisiblePages();
    
    const html = `
      <div class="pagination">
        <button 
          class="pagination-btn" 
          data-action="prev" 
          ${this.currentPage === 1 ? 'disabled' : ''}
        >
          <i class="fas fa-chevron-left"></i>
        </button>
        
        <div class="pagination-numbers">
          ${visiblePages.map(page => {
            if (page === '...') {
              return '<span class="page-ellipsis">...</span>';
            }
            return `
              <button 
                class="page-number ${page === this.currentPage ? 'active' : ''}" 
                data-page="${page}"
              >
                ${page}
              </button>
            `;
          }).join('')}
        </div>
        
        <button 
          class="pagination-btn" 
          data-action="next"
          ${this.currentPage === this.totalPages ? 'disabled' : ''}
        >
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    `;
    
    return html;
  }

  /**
   * Render pagination to container
   */
  renderTo(container) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    
    if (!container) {
      console.error('Pagination container not found');
      return;
    }
    
    this.container = container;
    container.innerHTML = this.render();
    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    if (!this.container) return;

    // Previous button
    const prevBtn = this.container.querySelector('[data-action="prev"]');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.goToPage(this.currentPage - 1);
      });
    }

    // Next button
    const nextBtn = this.container.querySelector('[data-action="next"]');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.goToPage(this.currentPage + 1);
      });
    }

    // Page numbers
    const pageButtons = this.container.querySelectorAll('.page-number');
    pageButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page);
        this.goToPage(page);
      });
    });
  }

  /**
   * Navigate to specific page
   */
  goToPage(page) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
    
    if (this.onChange) {
      this.onChange(page);
    }

    if (this.container) {
      this.renderTo(this.container);
    }
  }

  /**
   * Update total pages
   */
  setTotalPages(total) {
    this.totalPages = total;
    
    // Adjust current page if needed
    if (this.currentPage > total) {
      this.currentPage = total;
    }
    
    if (this.container) {
      this.renderTo(this.container);
    }
  }

  /**
   * Get current page
   */
  getCurrentPage() {
    return this.currentPage;
  }

  /**
   * Get total pages
   */
  getTotalPages() {
    return this.totalPages;
  }

  /**
   * Static method to calculate total pages
   */
  static calculateTotalPages(totalItems, itemsPerPage) {
    return Math.ceil(totalItems / itemsPerPage);
  }

  /**
   * Static method to get page slice
   */
  static getPageSlice(items, page, itemsPerPage) {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return items.slice(start, end);
  }
}

// Export for use in other modules
export default Pagination;
