/* ===================================================
   SHRI GHANSHYAM TYRE HOUSE - CLIENT APPLICATION
   Clean, Fit-on-Screen, Modern Accessibility
   =================================================== */

// Global State
let shopSettings = {};
let allProducts = [];
let cart = [];
let currentCategory = 'All'; // 'All' | 'Bike' | 'Scooter' | 'Car' | 'Auto & Rickshaw'
let currentProductType = 'All'; // 'All' | 'Tyre' | 'Tube'
let currentBrand = 'All';
let currentUser = null; // { role: 'customer', name, phone, ... }
let currentWAPaymentChoice = 'no'; // 'no' | 'yes'

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  loadStoredSession();
  loadStoredCart();
  await fetchSettings();
  await fetchProducts();
  setupEventListeners();
  if (window.lucide) lucide.createIcons();
});

// Load Stored Session
function loadStoredSession() {
  try {
    const user = localStorage.getItem('gth_user');
    if (user) {
      currentUser = JSON.parse(user);
      updateAuthUI();
      if (currentUser && currentUser.role === 'admin') {
        setTimeout(() => switchView('admin'), 50);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

// User-Specific Cart Helpers
function getCartStorageKey() {
  if (currentUser && currentUser.phone) {
    return `gth_cart_${currentUser.phone}`;
  }
  return 'gth_cart_guest';
}

// Load Stored Cart (Associated with logged-in user)
function loadStoredCart() {
  try {
    const key = getCartStorageKey();
    const savedCart = localStorage.getItem(key);
    if (savedCart) {
      const parsed = JSON.parse(savedCart);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cart = parsed;
      }
    } else if (cart && cart.length > 0) {
      // Keep items currently selected in session
      localStorage.setItem(key, JSON.stringify(cart));
    } else {
      const guestCart = localStorage.getItem('gth_cart_guest');
      if (guestCart) {
        cart = JSON.parse(guestCart);
        localStorage.setItem(key, JSON.stringify(cart));
      }
    }
    updateCartBadge();
  } catch (e) {
    console.error(e);
  }
}

function saveCart() {
  const key = getCartStorageKey();
  localStorage.setItem(key, JSON.stringify(cart));
  updateCartBadge();
}

// ----------------- SETTINGS API -----------------
async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    shopSettings = await res.json();
    applySettingsToUI();
  } catch (err) {
    console.error('Failed to load settings', err);
  }
}

function applySettingsToUI() {
  if (shopSettings.shopName) {
    const titleEl = document.getElementById('displayShopName');
    if (titleEl) titleEl.innerText = shopSettings.shopName;
  }
  if (shopSettings.tagline) {
    const tagEl = document.getElementById('displayShopTagline');
    if (tagEl) tagEl.innerText = `${shopSettings.tagline} • Gorakhpur`;
  }
  if (shopSettings.address) {
    const addrEl = document.getElementById('displayShopAddress');
    if (addrEl) addrEl.innerText = shopSettings.address;
  }
  if (shopSettings.shopUPI) {
    const upiEl = document.getElementById('upiIdLabel');
    if (upiEl) upiEl.innerText = shopSettings.shopUPI;
  }
}

// ----------------- PRODUCTS API -----------------
async function fetchProducts() {
  try {
    const res = await fetch('/api/products');
    allProducts = await res.json();
    renderProducts();
  } catch (err) {
    console.error('Failed to load products', err);
  }
}

// ----------------- WEBSITE SEARCH HISTORY (LOCAL TO STORE ONLY) -----------------
function getSearchHistory() {
  try {
    return JSON.parse(localStorage.getItem('gth_search_history') || '[]');
  } catch (e) {
    return [];
  }
}

function saveSearchHistory(term) {
  if (!term || !term.trim()) return;
  const trimmed = term.trim();
  let history = getSearchHistory();
  history = history.filter(h => h.toLowerCase() !== trimmed.toLowerCase());
  history.unshift(trimmed);
  if (history.length > 8) history = history.slice(0, 8);
  localStorage.setItem('gth_search_history', JSON.stringify(history));
}

function showSearchHistory() {
  const dropdown = document.getElementById('searchHistoryDropdown');
  if (!dropdown) return;

  const input = document.getElementById('searchInput');
  const query = (input ? input.value : '').trim().toLowerCase();

  // If user already typed letters, show LIVE RECOMMENDATIONS instead of empty history
  if (query.length > 0) {
    showSearchRecommendations(query);
    return;
  }

  const history = getSearchHistory();
  if (history.length === 0) {
    dropdown.innerHTML = `
      <div class="search-history-empty">
        <small>No previous searches yet. Type tyre size or brand for recommendations!</small>
      </div>
    `;
    dropdown.classList.remove('d-none');
    return;
  }

  dropdown.innerHTML = `
    <div class="search-history-header">
      <span><i data-lucide="history"></i> Previous Searches</span>
      <button type="button" class="btn-clear-history" onmousedown="clearAllSearchHistory(event)">Clear All</button>
    </div>
    <div class="search-history-items">
      ${history.map(item => `
        <div class="search-history-row" onmousedown="selectHistorySearch('${encodeURIComponent(item)}')">
          <div class="history-label">
            <i data-lucide="search" class="history-item-icon"></i>
            <span>${escapeHtml(item)}</span>
          </div>
          <button type="button" class="btn-delete-history-item" onmousedown="deleteHistorySearch(event, '${encodeURIComponent(item)}')" title="Remove">✕</button>
        </div>
      `).join('')}
    </div>
  `;
  dropdown.classList.remove('d-none');
  if (window.lucide) lucide.createIcons();
}

// Live Matching Item Recommendations While Searching
function showSearchRecommendations(query) {
  const dropdown = document.getElementById('searchHistoryDropdown');
  if (!dropdown) return;

  const q = query.toLowerCase().trim();
  const matches = allProducts.filter(p => {
    const isTube = (p.itemType === 'Tube' || p.category === 'Tubes & Flaps' || (p.id && p.id.startsWith('TUBE-')));
    const kind = isTube ? 'Tube' : 'Tyre';
    const searchable = `${p.name} ${kind} ${p.brand} ${p.size} ${p.category}`.toLowerCase();
    return searchable.includes(q);
  }).slice(0, 6);

  if (matches.length === 0) {
    dropdown.innerHTML = `
      <div class="search-history-empty">
        <small>No matching tyres or tubes found for "<strong>${escapeHtml(query)}</strong>"</small>
      </div>
    `;
    dropdown.classList.remove('d-none');
    return;
  }

  dropdown.innerHTML = `
    <div class="search-history-header">
      <span><i data-lucide="sparkles"></i> Recommended Matching Items (${matches.length})</span>
      <span style="font-size:11px; color:#64748b;">Click to view item</span>
    </div>
    <div class="search-recommendations-list">
      ${matches.map(prod => {
        const isTube = (prod.itemType === 'Tube' || prod.category === 'Tubes & Flaps' || (prod.id && prod.id.startsWith('TUBE-')));
        const itemKind = isTube ? 'Tube' : 'Tyre';
        const displayName = `${prod.name} - ${itemKind}`;
        return `
          <div class="search-recommendation-row" onmousedown="selectProductRecommendation('${prod.id}', '${encodeURIComponent(displayName)}')">
            <img src="${prod.image || 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=100&auto=format&fit=crop&q=60'}" class="rec-thumb" alt="${prod.name}">
            <div class="rec-info">
              <span class="rec-title">${highlightSearchMatch(displayName, q)}</span>
              <span class="rec-meta">${prod.brand} • Size: <strong>${prod.size}</strong> • ${prod.category}</span>
            </div>
            <div class="rec-price">
              <span>₹${prod.wholesalePrice.toLocaleString('en-IN')}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  dropdown.classList.remove('d-none');
  if (window.lucide) lucide.createIcons();
}

function selectProductRecommendation(productId, encodedName) {
  const name = decodeURIComponent(encodedName);
  const input = document.getElementById('searchInput');
  if (input) input.value = name;
  document.getElementById('searchHistoryDropdown')?.classList.add('d-none');
  saveSearchHistory(name);
  renderProducts();

  // Highlight matched product on the screen
  setTimeout(() => {
    const el = document.getElementById(`product_${productId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('card-focus-highlight');
      setTimeout(() => el.classList.remove('card-focus-highlight'), 2200);
    }
  }, 100);
}

function highlightSearchMatch(text, query) {
  if (!query) return escapeHtml(text);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return escapeHtml(text).replace(regex, '<mark>$1</mark>');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

function selectHistorySearch(encodedTerm) {
  const term = decodeURIComponent(encodedTerm);
  const input = document.getElementById('searchInput');
  if (input) input.value = term;
  document.getElementById('searchHistoryDropdown')?.classList.add('d-none');
  saveSearchHistory(term);
  renderProducts();
}

function deleteHistorySearch(e, encodedTerm) {
  e.stopPropagation();
  const term = decodeURIComponent(encodedTerm);
  let history = getSearchHistory().filter(h => h.toLowerCase() !== term.toLowerCase());
  localStorage.setItem('gth_search_history', JSON.stringify(history));
  showSearchHistory();
}

function clearAllSearchHistory(e) {
  if (e) e.stopPropagation();
  localStorage.removeItem('gth_search_history');
  document.getElementById('searchHistoryDropdown')?.classList.add('d-none');
}

function handleSearchKeyDown(e) {
  if (e.key === 'Enter') {
    executeSearchSubmit();
  }
}

function executeSearchSubmit() {
  const val = document.getElementById('searchInput')?.value.trim();
  if (val) {
    saveSearchHistory(val);
  }
  document.getElementById('searchHistoryDropdown')?.classList.add('d-none');
  renderProducts();
}

// Close search history dropdown on outside click
document.addEventListener('click', (e) => {
  const searchContainer = document.querySelector('.amazon-search-bar-container');
  if (searchContainer && !searchContainer.contains(e.target)) {
    document.getElementById('searchHistoryDropdown')?.classList.add('d-none');
  }
});

// ----------------- TOAST POPUP NOTIFICATION (ITEM ADDED TO BAG) -----------------
function showBagToast(productName, quantity) {
  const toast = document.getElementById('bagToast');
  if (!toast) return;

  const descEl = document.getElementById('toastDesc');
  if (descEl) descEl.innerText = `${quantity} × ${productName} added to your bag`;

  toast.classList.remove('d-none');
  toast.classList.add('show');

  clearTimeout(window.bagToastTimer);
  window.bagToastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('d-none'), 300);
  }, 2500);
}

// ----------------- PRODUCTS RENDERING -----------------
function renderProducts() {
  const container = document.getElementById('productsGrid');
  if (!container) return;

  const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

  const filtered = allProducts.filter(p => {
    // 1. Primary Tyre vs Tube filter
    const isTube = (p.itemType === 'Tube' || p.category === 'Tubes & Flaps' || (p.id && p.id.startsWith('TUBE-')) || (p.type && p.type.toLowerCase().includes('tube') && !p.type.toLowerCase().includes('tyre')));
    if (currentProductType === 'Tyre' && isTube) return false;
    if (currentProductType === 'Tube' && !isTube) return false;

    // 2. Sub Category filter (Bike, Scooter, Car, Auto & Rickshaw)
    const matchCat = (currentCategory === 'All' || p.category === currentCategory);

    // 3. Brand filter
    const matchBrand = (currentBrand === 'All' || p.brand.toLowerCase() === currentBrand.toLowerCase());

    // 4. Search input filter
    const matchSearch = !searchVal || (
      p.name.toLowerCase().includes(searchVal) ||
      p.size.toLowerCase().includes(searchVal) ||
      p.brand.toLowerCase().includes(searchVal) ||
      (p.type && p.type.toLowerCase().includes(searchVal))
    );

    return matchCat && matchBrand && matchSearch;
  });

  const countEl = document.getElementById('resultsCount');
  if (countEl) {
    countEl.innerText = `Showing ${filtered.length} items`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-results-box">
        <i data-lucide="package-search" class="empty-icon"></i>
        <h3>No items found matching your search</h3>
        <p>Try searching with tyre size (e.g. 90/90-12, 145/80 R12, 2.75-18), vehicle, or brand name.</p>
        <button class="btn btn-primary mt-3" onclick="clearSearch()">Clear Search</button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Render 2-in-a-Row Amazon Grid (Photo on top, Name, Description, Price, Add to Bag below)
  container.innerHTML = filtered.map(prod => {
    const isOutOfStock = prod.stock <= 0;
    const isTube = (prod.itemType === 'Tube' || prod.category === 'Tubes & Flaps' || (prod.id && prod.id.startsWith('TUBE-')));
    const itemKind = isTube ? 'Tube' : 'Tyre';
    
    const savingPercent = prod.retailPrice && prod.wholesalePrice 
      ? Math.round(((prod.retailPrice - prod.wholesalePrice) / prod.retailPrice) * 100)
      : null;

    return `
      <div class="amazon-grid-card ${isOutOfStock ? 'is-out-of-stock' : ''}" id="product_${prod.id}">
        
        <!-- 1. Product Image with Brand Tag -->
        <div class="grid-card-img-wrapper">
          <img src="${prod.image || 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=500&auto=format&fit=crop&q=60'}" alt="${prod.name}" loading="lazy">
          <span class="grid-brand-pill">${prod.brand}</span>
        </div>

        <!-- 2. Product Information (Below Image) -->
        <div class="grid-card-body">
          <div class="grid-type-indicator-row">
            <span class="simple-kind-text ${isTube ? 'kind-tube' : 'kind-tyre'}">
              ${isTube ? 'Tube' : 'Tyre'}
            </span>
          </div>

          <h3 class="grid-card-title" title="${prod.name}">
            ${prod.name}
          </h3>

          <div class="grid-card-desc">
            <span class="grid-spec-size">${prod.size}</span>
            <span class="grid-spec-divider">•</span>
            <span class="grid-spec-cat">${prod.category}</span>
          </div>

          <div class="grid-card-warranty ${isTube ? 'no-warranty' : ''}">
            <i data-lucide="${isTube ? 'shield-alert' : 'shield-check'}"></i>
            <span>${isTube ? 'Genuine Tube' : '3 Yr Warranty'}</span>
          </div>

          <div class="grid-card-pricing">
            <span class="grid-current-price">₹${prod.wholesalePrice.toLocaleString('en-IN')}</span>
            ${prod.retailPrice ? `
              <span class="grid-mrp-price">₹${prod.retailPrice.toLocaleString('en-IN')}</span>
              <span class="grid-savings-pill">${savingPercent}% off</span>
            ` : ''}
          </div>

          <div class="grid-card-actions">
            <button class="btn-grid-add-to-bag" ${isOutOfStock ? 'disabled' : ''} onclick="handleAddToCartClick('${prod.id}')">
              <i data-lucide="shopping-bag"></i> ${isOutOfStock ? 'Sold Out' : 'Add to Bag'}
            </button>
          </div>
        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Step quantity with + and - buttons
function stepCustomQty(productId, delta, maxStock) {
  const input = document.getElementById(`qty_${productId}`);
  if (!input) return;
  let current = parseInt(input.value, 10) || 1;
  let next = current + delta;
  if (next < 1) next = 1;
  if (next > maxStock) {
    next = maxStock;
    alert(`Quantity cannot exceed available stock (${maxStock} units).`);
  }
  input.value = next;
}

// Validate manual input in custom quantity field
function validateCustomQty(productId, maxStock) {
  const input = document.getElementById(`qty_${productId}`);
  if (!input) return;
  let val = parseInt(input.value, 10);
  if (isNaN(val) || val < 1) {
    return;
  }
  if (val > maxStock) {
    input.value = maxStock;
    alert(`Quantity cannot exceed available stock (${maxStock} units).`);
  }
}

// ----------------- FILTERING CONTROLS -----------------
function setProductTypeFilter(type) {
  currentProductType = type;
  
  const btnTyres = document.getElementById('btnFilterTyres');
  const btnTubes = document.getElementById('btnFilterTubes');
  const btnAll = document.getElementById('btnFilterAll');
  const selectDropdown = document.getElementById('searchTypeSelect');

  if (btnTyres) btnTyres.classList.toggle('active', type === 'Tyre');
  if (btnTubes) btnTubes.classList.toggle('active', type === 'Tube');
  if (btnAll) btnAll.classList.toggle('active', type === 'All');
  if (selectDropdown) selectDropdown.value = type;

  renderProducts();
}

function handleTypeSelectChange(newType) {
  setProductTypeFilter(newType);
}

function filterCategory(cat) {
  currentCategory = cat;
  document.querySelectorAll('.category-pills .pill').forEach(btn => {
    btn.classList.toggle('active', btn.innerText.includes(cat) || (cat === 'All' && btn.innerText.includes('All')));
  });
  renderProducts();
}

function filterBrand(brand) {
  currentBrand = brand;
  document.querySelectorAll('.brand-chips .brand-chip').forEach(btn => {
    btn.classList.toggle('active', btn.innerText === brand || (brand === 'All' && btn.innerText === 'All Brands'));
  });
  renderProducts();
}

function handleSearch() {
  const val = document.getElementById('searchInput')?.value || '';
  const clearBtn = document.getElementById('searchClearBtn');
  if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';

  if (val.trim().length > 0) {
    showSearchRecommendations(val.trim());
  } else {
    document.getElementById('searchHistoryDropdown')?.classList.add('d-none');
  }

  renderProducts();
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  if (input) input.value = '';
  const clearBtn = document.getElementById('searchClearBtn');
  if (clearBtn) clearBtn.style.display = 'none';
  document.getElementById('searchHistoryDropdown')?.classList.add('d-none');
  renderProducts();
}

function clearFilters() {
  clearSearch();
  currentProductType = 'All';
  currentCategory = 'All';
  currentBrand = 'All';
  renderProducts();
}

// ----------------- CART / BAG OPERATIONS -----------------
function handleAddToCartClick(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const qtyInput = document.getElementById(`qty_${productId}`);
  let customQty = qtyInput ? parseInt(qtyInput.value, 10) : 1;
  if (isNaN(customQty) || customQty < 1) customQty = 1;
  if (customQty > product.stock) customQty = product.stock;

  addToCartWithQuantity(productId, customQty);
}

function addToCartWithQuantity(productId, quantity) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const isTube = (product.itemType === 'Tube' || product.category === 'Tubes & Flaps' || (product.id && product.id.startsWith('TUBE-')));
  const itemKind = isTube ? 'Tube' : 'Tyre';
  const displayName = `${product.name} - ${itemKind}`;

  const existing = cart.find(item => item.id === productId);

  if (existing) {
    let newQty = existing.quantity + quantity;
    if (newQty > product.stock) {
      newQty = product.stock;
      alert(`Updated to maximum available stock (${product.stock} units).`);
    }
    existing.quantity = newQty;
  } else {
    cart.push({
      id: product.id,
      name: displayName,
      size: product.size,
      brand: product.brand,
      wholesalePrice: product.wholesalePrice,
      quantity: quantity,
      stock: product.stock,
      image: product.image
    });
  }

  saveCart();
  renderBagSection();
  renderCartDrawer();

  // Show small toast popup without navigating away
  showBagToast(displayName, quantity);
}

function updateCartQty(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.id !== productId);
  } else if (item.stock && item.quantity > item.stock) {
    item.quantity = item.stock;
    alert(`Cannot exceed available stock (${item.stock} units).`);
  }
  saveCart();
  renderBagSection();
  renderCartDrawer();
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  saveCart();
  renderBagSection();
  renderCartDrawer();
}

function clearCart() {
  if (confirm('Are you sure you want to empty your shopping bag?')) {
    cart = [];
    saveCart();
    renderBagSection();
    renderCartDrawer();
  }
}

function updateCartBadge() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById('cartCount');
  if (badge) badge.innerText = count;
}

// ----------------- FULL SCREEN SHOPPING BAG SECTION -----------------
function renderBagSection() {
  const container = document.getElementById('bagPageItemsList');
  const countBadge = document.getElementById('bagPageCountBadge');
  const emptyState = document.getElementById('bagPageEmptyState');
  const contentGrid = document.getElementById('bagPageContent');
  const totalUnitsEl = document.getElementById('bagPageTotalUnits');
  const subtotalEl = document.getElementById('bagPageSubtotal');
  const grandTotalEl = document.getElementById('bagPageGrandTotal');

  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.wholesalePrice * item.quantity), 0);

  if (countBadge) {
    countBadge.innerText = `${totalQty} item${totalQty === 1 ? '' : 's'}`;
  }

  if (cart.length === 0) {
    if (emptyState) emptyState.classList.remove('d-none');
    if (contentGrid) contentGrid.classList.add('d-none');
    if (window.lucide) lucide.createIcons();
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');
  if (contentGrid) contentGrid.classList.remove('d-none');

  if (totalUnitsEl) totalUnitsEl.innerText = `${totalQty} units`;
  if (subtotalEl) subtotalEl.innerText = `₹${totalPrice.toLocaleString('en-IN')}`;
  if (grandTotalEl) grandTotalEl.innerText = `₹${totalPrice.toLocaleString('en-IN')}`;

  if (container) {
    const defaultImg = 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=400&auto=format&fit=crop&q=70';
    container.innerHTML = cart.map(item => {
      const itemTotal = item.wholesalePrice * item.quantity;
      const imgSrc = item.image || defaultImg;
      const isTube = (item.name && item.name.toLowerCase().includes('tube'));

      return `
        <div class="bag-item-card-row" id="bag_item_${item.id}">
          <div class="bag-item-img-frame">
            <img src="${imgSrc}" alt="${item.name}" loading="lazy">
          </div>
          <div class="bag-item-main-details">
            <div class="bag-item-title-bar">
              <h4 class="bag-item-heading">${item.name}</h4>
              <button class="bag-item-delete-btn" onclick="removeFromCart('${item.id}')" title="Remove item">
                <i data-lucide="trash-2"></i> Remove
              </button>
            </div>
            
            <div class="bag-item-tags-row">
              <span class="bag-tag size">Size: <strong>${item.size}</strong></span>
              <span class="bag-tag brand">${item.brand}</span>
              <span class="bag-tag warranty ${isTube ? 'is-tube' : 'is-tyre'}">
                <i data-lucide="${isTube ? 'shield-alert' : 'shield-check'}"></i> ${isTube ? 'Standard Warranty' : '3 Years Warranty'}
              </span>
            </div>

            <div class="bag-item-price-stepper-row">
              <div class="bag-unit-price">
                <span class="unit-label">Wholesale Rate:</span>
                <span class="unit-val">₹${item.wholesalePrice.toLocaleString('en-IN')} / unit</span>
              </div>
              
              <div class="bag-stepper-box">
                <button type="button" class="btn-bag-step" onclick="updateCartQty('${item.id}', -1)">−</button>
                <span class="bag-step-val">${item.quantity}</span>
                <button type="button" class="btn-bag-step" onclick="updateCartQty('${item.id}', 1)">+</button>
              </div>

              <div class="bag-item-total-block">
                <span class="bag-total-lbl">Subtotal:</span>
                <span class="bag-total-val">₹${itemTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  if (window.lucide) lucide.createIcons();
}

function renderCartDrawer() {
  const listEl = document.getElementById('cartItemsList');
  const itemsTotalEl = document.getElementById('cartSummaryItems');
  const grandTotalEl = document.getElementById('cartGrandTotal');
  const headerBadge = document.getElementById('cartHeaderBadge');
  const footerEl = document.getElementById('cartDrawerFooter');
  const proceedBtn = document.getElementById('btnProceedCheckout');

  if (!listEl) return;

  if (cart.length === 0) {
    if (headerBadge) headerBadge.innerText = '0 items';
    if (footerEl) footerEl.style.display = 'none';
    listEl.innerHTML = `
      <div class="cart-empty">
        <i data-lucide="shopping-bag"></i>
        <h3>Your Shopping Bag is Empty</h3>
        <p>No tyres or tubes in your bag yet. Browse genuine tyres & tubes with 3 years warranty to add items.</p>
        <button class="btn btn-primary mt-3" onclick="showCustomerSection('catalog');">
          <i data-lucide="layers"></i> Browse All Tyres & Tubes
        </button>
      </div>
    `;
    if (itemsTotalEl) itemsTotalEl.innerText = '0 units';
    if (grandTotalEl) grandTotalEl.innerText = '₹0';
    if (window.lucide) lucide.createIcons();
    return;
  }

  if (footerEl) footerEl.style.display = 'block';

  let totalQty = 0;
  let totalPrice = 0;

  listEl.innerHTML = cart.map(item => {
    const itemTotal = item.wholesalePrice * item.quantity;
    totalQty += item.quantity;
    totalPrice += itemTotal;

    const defaultImg = 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=300&auto=format&fit=crop&q=60';
    const imgSrc = item.image || defaultImg;

    return `
      <div class="cart-item-card">
        <div class="cart-item-img-col">
          <img src="${imgSrc}" alt="${item.name}" class="cart-item-thumb" loading="lazy">
        </div>
        <div class="cart-item-info-col">
          <div class="cart-item-top">
            <div class="cart-item-name">${item.name}</div>
            <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" title="Remove item">✕</button>
          </div>
          <div class="cart-item-sub">
            <span class="cart-item-size-badge">Size: <strong>${item.size}</strong></span>
            <span class="cart-item-brand-badge">${item.brand}</span>
          </div>
          <div class="cart-item-rate">Rate: ₹${item.wholesalePrice.toLocaleString('en-IN')} / unit</div>
          <div class="cart-item-bottom">
            <div class="qty-control">
              <button class="qty-btn" onclick="updateCartQty('${item.id}', -1)">−</button>
              <span class="qty-display">${item.quantity}</span>
              <button class="qty-btn" onclick="updateCartQty('${item.id}', 1)">+</button>
            </div>
            <div class="cart-item-total">₹${itemTotal.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (headerBadge) headerBadge.innerText = `${totalQty} unit${totalQty > 1 ? 's' : ''}`;
  if (itemsTotalEl) itemsTotalEl.innerText = `${totalQty} units`;
  if (grandTotalEl) grandTotalEl.innerText = `₹${totalPrice.toLocaleString('en-IN')}`;
  if (proceedBtn) {
    proceedBtn.innerHTML = `Proceed to Order & Payment (₹${totalPrice.toLocaleString('en-IN')}) <i data-lucide="arrow-right"></i>`;
  }
  if (window.lucide) lucide.createIcons();
}

function toggleCartDrawer() {
  // Always opens full screen shopping bag as requested by user
  showCustomerSection('bag');
}

function openCartDrawer() {
  // Always opens full screen shopping bag as requested by user
  showCustomerSection('bag');
}

// ----------------- WHATSAPP QUICK CHATTER (LOGIN CHECK + BAG ITEMS + PAYMENT STATUS MENTION) -----------------
function handleWhatsAppChatterClick(e, specificProductId) {
  if (e) e.preventDefault();

  // 1. Restriction: Without login, no one can message on WhatsApp (they can call anytime)
  if (!currentUser || currentUser.role !== 'customer') {
    alert('Please log in to your customer account to send orders via WhatsApp. (Direct phone call is available anytime without login).');
    openLoginModal('customer');
    return;
  }

  // 2. If a specific product was clicked, ensure it's in bag
  if (specificProductId) {
    const existing = cart.find(i => i.id === specificProductId);
    if (!existing) {
      const qtyInput = document.getElementById(`qty_${specificProductId}`);
      const q = qtyInput ? parseInt(qtyInput.value, 10) : 1;
      addToCartWithQuantity(specificProductId, q);
    }
  }

  // 3. Restriction: If nothing is in bag, alert customer to add items first
  if (cart.length === 0) {
    alert('Your shopping bag is empty! Please add tyres or tubes to your bag first before sending via WhatsApp.');
    return;
  }

  // 4. Open WhatsApp Order Payment Status Modal
  openWhatsAppPaymentModal();
}

function openWhatsAppPaymentModal() {
  const totalAmount = cart.reduce((sum, item) => sum + (item.wholesalePrice * item.quantity), 0);
  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);

  const itemsCountEl = document.getElementById('waModalItemsCount');
  const grandTotalEl = document.getElementById('waModalGrandTotal');
  const payableAmountEl = document.getElementById('waPayableAmount');
  const upiIdLabel = document.getElementById('waUpiIdLabel');
  const qrImg = document.getElementById('waModalUPIQr');

  if (itemsCountEl) itemsCountEl.innerText = `${cart.length} item(s) (${totalUnits} units)`;
  if (grandTotalEl) grandTotalEl.innerText = `₹${totalAmount.toLocaleString('en-IN')}`;
  if (payableAmountEl) payableAmountEl.innerText = `₹${totalAmount.toLocaleString('en-IN')}`;
  if (upiIdLabel) upiIdLabel.innerText = shopSettings.shopUPI || 'bhaveshk1157@okicici';
  if (qrImg) qrImg.src = shopSettings.paymentQrImage || '/images/payment-qr.jpg';

  selectWAPaymentStatus('no');
  const utrInput = document.getElementById('waUtrInput');
  if (utrInput) utrInput.value = '';

  document.getElementById('whatsappPaymentModal')?.classList.remove('d-none');
  if (window.lucide) lucide.createIcons();
}

function closeWhatsAppPaymentModal() {
  document.getElementById('whatsappPaymentModal')?.classList.add('d-none');
}

function selectWAPaymentStatus(choice) {
  currentWAPaymentChoice = choice;
  const optNo = document.getElementById('waPayOptionNo');
  const optYes = document.getElementById('waPayOptionYes');
  const detailsBox = document.getElementById('waPaymentDetailsBox');

  if (choice === 'yes') {
    optYes?.classList.add('active');
    optNo?.classList.remove('active');
    if (detailsBox) detailsBox.classList.remove('d-none');
    const radio = optYes?.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  } else {
    optNo?.classList.add('active');
    optYes?.classList.remove('active');
    if (detailsBox) detailsBox.classList.add('d-none');
    const radio = optNo?.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  }
  if (window.lucide) lucide.createIcons();
}

function copyWAUPI() {
  const upi = shopSettings.shopUPI || 'bhaveshk1157@okicici';
  navigator.clipboard.writeText(upi).then(() => {
    alert(`Shop UPI ID copied: ${upi}`);
  }).catch(() => {
    alert(`Shop UPI ID: ${upi}`);
  });
}

function sendWhatsAppOrderWithPaymentStatus() {
  const ownerWhatsApp = (shopSettings.ownerWhatsApp || '919838451157').replace(/\D/g, '');
  let totalAmount = 0;
  const utrNumber = document.getElementById('waUtrInput')?.value.trim();

  let msg = `*NEW ORDER INQUIRY*\n`;
  msg += `*Store:* Shri Ghanshyam Tyre House\n`;
  msg += `------------------------------------\n`;
  msg += `*Customer Name:* ${currentUser.name}\n`;
  if (currentUser.shopName) {
    msg += `*Shop / Business:* ${currentUser.shopName}\n`;
  }
  msg += `*Phone:* ${currentUser.phone}\n`;
  msg += `*Address / Location:* ${currentUser.city || ''} ${currentUser.address || ''}\n`;
  msg += `------------------------------------\n`;
  msg += `*ITEMS IN MY BAG:*\n`;

  cart.forEach((item, idx) => {
    const itemTotal = item.wholesalePrice * item.quantity;
    totalAmount += itemTotal;
    msg += `${idx + 1}. ${item.name} [Size: ${item.size}] - Qty: ${item.quantity} pcs @ ₹${item.wholesalePrice} = ₹${itemTotal}\n`;
  });

  msg += `------------------------------------\n`;
  msg += `*TOTAL AMOUNT: ₹${totalAmount.toLocaleString('en-IN')}*\n`;

  // Explicitly mention whether payment is done or not
  if (currentWAPaymentChoice === 'yes') {
    msg += `*Payment Status:* ✅ PAYMENT DONE (UPI / Bank Transfer)\n`;
    if (utrNumber) {
      msg += `*Transaction UTR / Ref:* ${utrNumber}\n`;
    }
  } else {
    msg += `*Payment Status:* ⏳ PAYMENT NOT DONE (Pay on Delivery / Transport Khata)\n`;
  }

  if (totalAmount > 20000) {
    msg += `*Order Category:* Commercial Order (Above ₹20,000)\n`;
  }

  msg += `\nPlease confirm availability and dispatch details.`;

  closeWhatsAppPaymentModal();
  const waUrl = `https://api.whatsapp.com/send?phone=${ownerWhatsApp}&text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
}

// ----------------- CHECKOUT & CONDITIONAL GST (ABOVE 20K) -----------------
function openCheckoutModal() {
  if (!currentUser) {
    alert('Please sign in to your registered customer account to complete order and payment.');
    openLoginModal('customer');
    return;
  }

  if (!cart || cart.length === 0) {
    alert('Your shopping bag is empty. Please select tyres or tubes first.');
    return;
  }

  // Pre-fill hidden inputs and verified account card
  const buyerName = currentUser.name || 'Customer Account';
  const buyerPhone = currentUser.phone || '';
  const buyerShop = currentUser.shopName || '';
  const buyerCity = currentUser.city || 'Gorakhpur';
  const buyerAddress = currentUser.address || '';

  if (document.getElementById('custOrderName')) document.getElementById('custOrderName').value = buyerName;
  if (document.getElementById('custOrderPhone')) document.getElementById('custOrderPhone').value = buyerPhone;
  if (document.getElementById('custOrderShop')) document.getElementById('custOrderShop').value = buyerShop;
  if (document.getElementById('custOrderCity')) document.getElementById('custOrderCity').value = buyerCity;
  if (document.getElementById('custOrderAddress')) document.getElementById('custOrderAddress').value = buyerAddress;

  const cardNameEl = document.getElementById('chkBuyerName');
  const cardPhoneEl = document.getElementById('chkBuyerPhone');
  const cardAddressEl = document.getElementById('chkBuyerAddress');

  if (cardNameEl) cardNameEl.innerText = buyerName;
  if (cardPhoneEl) cardPhoneEl.innerText = buyerPhone ? `+91 ${buyerPhone}` : '';
  if (cardAddressEl) {
    const locParts = [buyerShop, buyerAddress, buyerCity].filter(Boolean);
    cardAddressEl.innerText = locParts.length > 0 ? locParts.join(' • ') : 'Gorakhpur, Uttar Pradesh';
  }

  // Close cart drawer
  document.getElementById('cartDrawer')?.classList.remove('open');
  document.getElementById('cartBackdrop')?.classList.add('d-none');

  renderCheckoutSummary();
  updateUPIQRCode();

  // Handle Online Payment toggle (Turned OFF: Cash on Delivery only)
  const upiOpt = document.getElementById('payOptionUPI');
  const upiBox = document.getElementById('upiPaymentBox');
  if (shopSettings.enableOnlinePayment === false) {
    if (upiOpt) upiOpt.style.display = 'none';
    if (upiBox) upiBox.style.display = 'none';
    selectPaymentMethod('COD');
  } else {
    if (upiOpt) upiOpt.style.display = 'flex';
  }

  document.getElementById('checkoutModal')?.classList.remove('d-none');
  if (window.lucide) lucide.createIcons();
}

function closeCheckoutModal() {
  document.getElementById('checkoutModal')?.classList.add('d-none');
}

function renderCheckoutSummary() {
  const itemsContainer = document.getElementById('checkoutItemsList');
  const subtotalEl = document.getElementById('checkoutSubtotal');
  const grandTotalEl = document.getElementById('checkoutGrandTotal');
  const upiAmtEl = document.getElementById('upiAmountLabel');
  const submitBtn = document.getElementById('submitOrderBtn');
  const totalUnitsEl = document.getElementById('checkoutTotalUnits');
  const gstContainer = document.getElementById('gstNumberContainer');
  const gstInput = document.getElementById('custOrderGST');

  let total = 0;
  let totalUnits = 0;
  const defaultImg = 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=300&auto=format&fit=crop&q=60';

  if (!itemsContainer) return;

  if (!cart || cart.length === 0) {
    itemsContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b; font-size:14px;">Your bag is currently empty.</div>';
  } else {
    itemsContainer.innerHTML = cart.map(item => {
      const rate = Number(item.wholesalePrice || item.price || 0);
      const qty = Number(item.quantity || item.qty || 1);
      const itemTotal = rate * qty;
      total += itemTotal;
      totalUnits += qty;
      const imgSrc = item.image || defaultImg;
      const itemSize = item.size || 'Standard';
      const itemBrand = item.brand || 'Tyre';

      return `
        <div class="summary-item-row" style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #e2e8f0;">
          <img src="${imgSrc}" alt="${item.name}" style="width:48px; height:48px; object-fit:cover; border-radius:6px; border:1px solid #cbd5e1; flex-shrink:0;">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:13px; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</div>
            <div style="display:flex; gap:6px; margin:2px 0;">
              <span style="font-size:11px; font-weight:700; background:#e2e8f0; color:#334155; padding:1px 6px; border-radius:4px;">${itemSize}</span>
              <span style="font-size:11px; font-weight:700; background:#dbeafe; color:#1e40af; padding:1px 6px; border-radius:4px;">${itemBrand}</span>
            </div>
            <small style="color:#64748b; font-size:12px;">${qty} pcs × ₹${rate.toLocaleString('en-IN')}</small>
          </div>
          <div style="font-weight:800; font-size:14px; color:#0f172a; text-align:right; white-space:nowrap;">
            ₹${itemTotal.toLocaleString('en-IN')}
          </div>
        </div>
      `;
    }).join('');
  }

  if (totalUnitsEl) totalUnitsEl.innerText = `${totalUnits} unit${totalUnits !== 1 ? 's' : ''}`;
  if (subtotalEl) subtotalEl.innerText = `₹${total.toLocaleString('en-IN')}`;
  if (grandTotalEl) grandTotalEl.innerText = `₹${total.toLocaleString('en-IN')}`;
  if (upiAmtEl) upiAmtEl.innerText = `₹${total.toLocaleString('en-IN')}`;
  if (submitBtn) {
    submitBtn.innerHTML = `<i data-lucide="check-circle"></i> Confirm & Place Order (₹${total.toLocaleString('en-IN')})`;
  }

  // REQUIREMENT: When customer is ordering items above 20k, ask GST number
  if (total > 20000) {
    if (gstContainer) gstContainer.classList.remove('d-none');
    if (gstInput) gstInput.setAttribute('required', 'required');
  } else {
    if (gstContainer) gstContainer.classList.add('d-none');
    if (gstInput) {
      gstInput.removeAttribute('required');
      gstInput.value = '';
    }
  }

  if (window.lucide) lucide.createIcons();
}

function selectPaymentMethod(type) {
  const upiBox = document.getElementById('upiPaymentBox');
  const upiCard = document.getElementById('payOptionUPI');
  const codCard = document.getElementById('payOptionCOD');

  if (type === 'UPI') {
    if (upiCard) {
      upiCard.classList.add('active');
      const radio = upiCard.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    }
    if (codCard) codCard.classList.remove('active');
    if (upiBox) upiBox.style.display = 'block';
  } else if (type === 'COD') {
    if (codCard) {
      codCard.classList.add('active');
      const radio = codCard.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    }
    if (upiCard) upiCard.classList.remove('active');
    if (upiBox) upiBox.style.display = 'none';
  }
}

function updateUPIQRCode() {
  const qrImage = shopSettings.paymentQrImage || '/images/payment-qr.jpg';
  const imgEl = document.getElementById('dynamicUPIQr');
  const waImgEl = document.getElementById('waModalUPIQr');
  const upiIdLabel = document.getElementById('upiIdLabel');
  const waUpiIdLabel = document.getElementById('waUpiIdLabel');
  const upiId = shopSettings.shopUPI || 'bhaveshk1157@okicici';

  if (imgEl) imgEl.src = qrImage;
  if (waImgEl) waImgEl.src = qrImage;
  if (upiIdLabel) upiIdLabel.innerText = upiId;
  if (waUpiIdLabel) waUpiIdLabel.innerText = upiId;
}

function launchUPIApp(appKey, modalType = 'checkout') {
  const amount = cart.reduce((sum, item) => sum + (item.wholesalePrice * item.quantity), 0);
  const upiId = shopSettings.shopUPI || 'bhaveshk1157@okicici';
  const shopName = encodeURIComponent(shopSettings.shopName || 'Shri Ghanshyam Tyre House');
  const baseParams = `pa=${upiId}&pn=${shopName}&am=${amount}&cu=INR&tn=OrderPayment`;

  let deepLink = `upi://pay?${baseParams}`;

  if (appKey === 'gpay') {
    deepLink = `tez://upi/pay?${baseParams}`;
  } else if (appKey === 'phonepe') {
    deepLink = `phonepe://pay?${baseParams}`;
  } else if (appKey === 'paytm') {
    deepLink = `paytmmp://pay?${baseParams}`;
  }

  // Attempt direct app intent
  window.location.href = deepLink;

  // Fallback to generic upi:// intent if app doesn't open within 800ms
  const now = Date.now();
  setTimeout(() => {
    if (Date.now() - now < 1500) {
      window.location.href = `upi://pay?${baseParams}`;
    }
  }, 750);
}

function togglePaymentQR(modalType = 'checkout') {
  const containerId = modalType === 'wa' ? 'waQRContainer' : 'checkoutQRContainer';
  const tagId = modalType === 'wa' ? 'waQrToggleTag' : 'checkoutQrToggleTag';
  const container = document.getElementById(containerId);
  const tag = document.getElementById(tagId);

  if (container) {
    const isHidden = container.classList.contains('d-none');
    if (isHidden) {
      container.classList.remove('d-none');
      if (tag) tag.innerText = 'Hide QR ↑';
    } else {
      container.classList.add('d-none');
      if (tag) tag.innerText = 'Show QR ↓';
    }
  }
}

function copyUPI() {
  const upi = shopSettings.shopUPI || 'bhaveshk1157@okicici';
  navigator.clipboard.writeText(upi).then(() => {
    alert(`Copied Shop UPI ID: ${upi}`);
  }).catch(() => {
    alert(`Shop UPI ID: ${upi}`);
  });
}

// ----------------- SUBMIT ORDER (UPDATES IN MY ORDERS ONLY - NO WHATSAPP MESSAGE SENT) -----------------
async function handlePlaceOrder(e) {
  e.preventDefault();

  if (!currentUser) {
    alert('Please sign in or register to place your order.');
    openLoginModal('customer');
    return;
  }

  if (!cart || cart.length === 0) {
    alert('Your shopping bag is empty.');
    return;
  }

  const total = cart.reduce((sum, item) => sum + ((Number(item.wholesalePrice) || Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);
  const gstInput = document.getElementById('custOrderGST');
  const gstErrorMsg = document.getElementById('gstErrorMsg');
  let gstNumber = gstInput ? gstInput.value.trim().toUpperCase() : '';

  // Validation of GST number for orders > 20k
  if (total > 20000) {
    if (!gstNumber || gstNumber.length < 15) {
      if (gstErrorMsg) gstErrorMsg.style.display = 'block';
      gstInput?.focus();
      return;
    }
  }
  if (gstErrorMsg) gstErrorMsg.style.display = 'none';

  const customer = {
    name: currentUser.name || document.getElementById('custOrderName')?.value?.trim() || 'Customer Account',
    phone: currentUser.phone || document.getElementById('custOrderPhone')?.value?.trim() || '',
    shopName: currentUser.shopName || document.getElementById('custOrderShop')?.value?.trim() || '',
    city: currentUser.city || document.getElementById('custOrderCity')?.value?.trim() || 'Gorakhpur',
    address: currentUser.address || document.getElementById('custOrderAddress')?.value?.trim() || '',
    gstNumber: gstNumber
  };

  const paymentMethodInput = document.querySelector('input[name="paymentMethod"]:checked');
  const paymentMethod = paymentMethodInput ? paymentMethodInput.value : 'UPI (QR Code)';
  const transactionId = document.getElementById('upiRefNumber')?.value.trim() || '';
  const notes = document.getElementById('custOrderNotes')?.value.trim() || '';

  const orderPayload = {
    customer,
    items: cart,
    paymentMethod,
    transactionId,
    notes
  };

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    const data = await res.json();
    if (data.success) {
      // Clear cart
      cart = [];
      saveCart();
      renderBagSection();
      renderCartDrawer();

      closeCheckoutModal();

      // Show Success Modal with direct owner notification link & payment status
      document.getElementById('successOrderId').innerText = `Order #${data.order.orderId}`;
      const statusBadge = document.getElementById('successPaymentStatusBadge');
      if (statusBadge) {
        statusBadge.innerText = data.paymentStatusText || data.order.paymentStatus || (data.isPaymentDone ? '✅ Payment Done' : '❌ Payment Not Done');
        statusBadge.style.color = data.isPaymentDone ? '#16a34a' : '#dc2626';
      }
      const ownerBtn = document.getElementById('successOwnerWhatsAppBtn');
      if (ownerBtn && data.whatsappUrl) {
        ownerBtn.href = data.whatsappUrl;
        ownerBtn.style.display = 'flex';
      }

      document.getElementById('orderSuccessModal')?.classList.remove('d-none');
      if (window.lucide) lucide.createIcons();

      // Refresh My Orders data in background
      fetchCustomerOrders();
    } else {
      alert(data.error || 'Failed to place order.');
    }
  } catch (err) {
    console.error('Order error', err);
    alert('Network error placing order. Please try again.');
  }
}

function closeSuccessModalAndShowOrders() {
  document.getElementById('orderSuccessModal')?.classList.add('d-none');
  showCustomerSection('my-orders');
}

// ----------------- CUSTOMER ORDERS VIEW & 2 OPTIONS (PENDING & DELIVERED) -----------------
let currentCustOrderFilter = 'pending'; // 'pending' | 'delivered'
let allCustomerOrders = [];

// Accurate Payment Status badge (Payment Not Done instead of pending)
function formatPaymentBadge(order) {
  const isDone = order.paymentDone === true || 
    (order.paymentStatus && (order.paymentStatus.toLowerCase().includes('done') || order.paymentStatus.toLowerCase().includes('paid')) && !order.paymentStatus.toLowerCase().includes('not done'));

  if (isDone) {
    return '<strong style="color:#16a34a; font-weight:800;">✅ Payment Done</strong>';
  }
  return '<strong style="color:#dc2626; font-weight:800;">❌ Payment Not Done</strong>';
}

function filterCustOrdersTab(filterType) {
  currentCustOrderFilter = filterType;
  const btnPending = document.getElementById('btnCustFilterPending');
  const btnDelivered = document.getElementById('btnCustFilterDelivered');

  if (filterType === 'pending') {
    btnPending?.classList.add('active');
    btnDelivered?.classList.remove('active');
  } else {
    btnDelivered?.classList.add('active');
    btnPending?.classList.remove('active');
  }
  renderCustomerOrdersList();
}

async function fetchCustomerOrders() {
  const container = document.getElementById('customerOrdersList');
  if (!container) return;

  const phone = currentUser?.phone || document.getElementById('custOrderPhone')?.value || '';
  const url = phone ? `/api/orders?phone=${encodeURIComponent(phone)}` : '/api/orders';

  try {
    const res = await fetch(url);
    allCustomerOrders = await res.json();
    if (!Array.isArray(allCustomerOrders)) allCustomerOrders = [];

    const pendingOrders = allCustomerOrders.filter(o => (o.status || o.orderStatus) !== 'Delivered');
    const deliveredOrders = allCustomerOrders.filter(o => (o.status || o.orderStatus) === 'Delivered');

    const pendingCountEl = document.getElementById('custPendingCount');
    const deliveredCountEl = document.getElementById('custDeliveredCount');
    if (pendingCountEl) pendingCountEl.innerText = pendingOrders.length;
    if (deliveredCountEl) deliveredCountEl.innerText = deliveredOrders.length;

    renderCustomerOrdersList();
  } catch (err) {
    console.error('Fetch customer orders error', err);
  }
}

function renderCustomerOrdersList() {
  const container = document.getElementById('customerOrdersList');
  if (!container) return;

  const filtered = allCustomerOrders.filter(o => {
    const isDelivered = (o.status || o.orderStatus) === 'Delivered';
    return currentCustOrderFilter === 'delivered' ? isDelivered : !isDelivered;
  });

  if (filtered.length === 0) {
    const emptyMsg = currentCustOrderFilter === 'delivered'
      ? 'No delivered orders yet. Completed orders will appear here once delivered.'
      : 'No pending orders! All your orders have been completed and delivered.';
    container.innerHTML = `
      <div style="text-align:center; padding: 40px; background:white; border-radius:12px; border:1px solid #e2e8f0;">
        <h3 style="color:#0f172a; margin-bottom:6px;">${currentCustOrderFilter === 'delivered' ? 'No Delivered Orders Yet' : 'No Pending Orders'}</h3>
        <p style="color:#64748b; margin:0;">${emptyMsg}</p>
        <button class="btn btn-primary mt-4" onclick="showCustomerSection('catalog')">Browse Tyres & Tubes</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(order => {
    const orderId = order.orderId || order.id;
    const isDispatched = (order.orderStatus === 'Dispatched' || order.status === 'Dispatched' || order.orderStatus === 'Delivered' || order.status === 'Delivered');
    const isDelivered = (order.orderStatus === 'Delivered' || order.status === 'Delivered');

    return `
      <div class="order-history-card">
        <div class="order-card-header">
          <div>
            <strong style="font-size:18px; color:var(--primary);">${orderId}</strong>
            <span style="color:#64748b; font-size:13px; margin-left:10px;">${new Date(order.timestamp || order.createdAt || Date.now()).toLocaleString()}</span>
          </div>
          <div>
            <span class="status-badge ${isDelivered ? 'status-delivered' : 'status-placed'}">${order.orderStatus || order.status || 'Order Placed'}</span>
          </div>
        </div>

        <div class="order-ack-box">
          <div class="ack-indicator received">
            <i data-lucide="check-circle-2" class="ack-icon"></i>
            <div>
              <strong>Order Status:</strong>
              <span class="ack-text">${order.orderStatus || order.status || 'Order Placed'} (Shri Ghanshyam Tyre House)</span>
            </div>
          </div>
          <div class="order-timeline-mini">
            <span class="step-badge done">1. Order Placed ✓</span>
            <span class="step-arrow">→</span>
            <span class="step-badge done">2. Received by Shop ✓</span>
            <span class="step-arrow">→</span>
            <span class="step-badge ${isDispatched ? 'done' : 'pending'}">3. Dispatched ${isDispatched ? '✓' : ''}</span>
            <span class="step-arrow">→</span>
            <span class="step-badge ${isDelivered ? 'done' : 'pending'}">4. Delivered ${isDelivered ? '✓' : ''}</span>
          </div>
        </div>

        <div style="margin:14px 0 10px;">
          <strong style="color:#1e293b;">Items in Order:</strong>
          <ul style="padding-left:20px; margin-top:6px; color:#334155;">
            ${(order.items || []).map(i => {
              const qty = i.quantity || i.qty || 1;
              const rate = i.wholesalePrice || i.price || 0;
              return `<li>${i.name} [Size: ${i.size || 'Standard'}] × ${qty} pcs @ ₹${rate} = <strong>₹${rate * qty}</strong></li>`;
            }).join('')}
          </ul>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed #cbd5e1; padding-top:10px; flex-wrap:wrap; gap:10px;">
          <div>
            <span>Payment Mode: <strong>${order.paymentMethod || 'UPI / Cash'}</strong></span>
            <br><span>Payment Status: ${formatPaymentBadge(order)}</span>
            ${order.transactionId ? `<br><small style="color:#64748b;">Ref / UTR: ${order.transactionId}</small>` : ''}
            ${order.gstNumber ? `<br><small style="color:#0369a1; font-weight:700;">GSTIN: ${order.gstNumber}</small>` : ''}
          </div>
          <div style="font-size:20px; font-weight:800; color:var(--primary);">
            Total: ₹${(order.grandTotal || order.total || 0).toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// ----------------- NAVIGATION -----------------
function showCustomerSection(sec) {
  // Always scroll smoothly to top of the website
  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  document.querySelectorAll('#customerView .page-section').forEach(p => p.classList.add('d-none'));
  document.querySelectorAll('#headerNavCustomer .nav-btn').forEach(b => b.classList.remove('active'));

  const navBtns = document.querySelectorAll('#headerNavCustomer .nav-btn');

  if (sec === 'catalog') {
    document.getElementById('sectionCatalog')?.classList.remove('d-none');
    if (navBtns[0]) navBtns[0].classList.add('active');
  } else if (sec === 'bag') {
    document.getElementById('sectionBag')?.classList.remove('d-none');
    renderBagSection();
  } else if (sec === 'my-orders') {
    document.getElementById('sectionMyOrders')?.classList.remove('d-none');
    if (navBtns[1]) navBtns[1].classList.add('active');
    fetchCustomerOrders();
  } else if (sec === 'profile') {
    document.getElementById('sectionProfile')?.classList.remove('d-none');
    updateAuthUI();
  } else if (sec === 'about') {
    document.getElementById('sectionAbout')?.classList.remove('d-none');
    if (navBtns[2]) navBtns[2].classList.add('active');
  }
  if (window.lucide) lucide.createIcons();
}

function navigateTo(dest) {
  showCustomerSection('catalog');
}

// Top Right Circular Profile Button Click Handler
function handleProfileCircleClick() {
  if (currentUser) {
    if (currentUser.role === 'admin') {
      switchView('admin');
    } else {
      showCustomerSection('profile');
    }
  } else {
    openLoginModal('customer');
  }
}

// ----------------- AUTH MODAL & LOGIC (UNIFIED CUSTOMER & ADMIN LOGIN) -----------------
function openLoginModal(role = 'customer') {
  closeSignupModal(); // Guarantees registration modal closes immediately
  document.getElementById('loginErrorMessage')?.classList.add('d-none');
  document.getElementById('loginModal')?.classList.remove('d-none');
  if (window.lucide) lucide.createIcons();
}

function closeLoginModal() {
  document.getElementById('loginModal')?.classList.add('d-none');
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const phone = document.getElementById('loginPhone').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errBox = document.getElementById('loginErrorMessage');
  if (errBox) errBox.classList.add('d-none');

  try {
    const res = await fetch('/api/auth/unified-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const data = await res.json();

    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('gth_user', JSON.stringify(currentUser));
      updateAuthUI();
      closeLoginModal();

      if (currentUser.role === 'admin') {
        switchView('admin');
        alert(`Logged in as Administrator (${currentUser.name || 'Owner'}). Welcome to Store Management Portal!`);
      } else {
        switchView('customer');
        // Restore this user's personal bag / cart
        loadStoredCart();
        renderBagSection();
        renderCartDrawer();
        alert(`Welcome back, ${currentUser.name}! You are now signed in.`);
        if (cart && cart.length > 0) {
          setTimeout(() => openCheckoutModal(), 200);
        }
      }
    } else {
      if (errBox) {
        errBox.innerText = data.error || 'Login failed. Please check your credentials.';
        errBox.classList.remove('d-none');
      }
    }
  } catch (err) {
    if (errBox) {
      errBox.innerText = 'Network error during login.';
      errBox.classList.remove('d-none');
    }
  }
}

function openSignupModal() {
  closeLoginModal(); // Guarantees login modal closes immediately
  document.getElementById('signupErrorMessage')?.classList.add('d-none');
  document.getElementById('signupModal')?.classList.remove('d-none');
  if (window.lucide) lucide.createIcons();
}

function closeSignupModal() {
  document.getElementById('signupModal')?.classList.add('d-none');
}

async function handleSignupSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const phone = document.getElementById('signupPhone').value.trim();
  const password = document.getElementById('signupPassword').value;
  const shopName = document.getElementById('signupShop').value.trim();
  const city = document.getElementById('signupCity').value.trim();
  const address = document.getElementById('signupAddress').value.trim();

  const errBox = document.getElementById('signupErrorMessage');
  errBox.classList.add('d-none');

  try {
    const res = await fetch('/api/auth/customer-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, password, shopName, city, address })
    });
    const data = await res.json();

    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('gth_user', JSON.stringify(currentUser));
      updateAuthUI();
      closeSignupModal();
      
      // Initialize user's bag
      loadStoredCart();
      renderCartDrawer();

      alert(`Account created successfully! Welcome, ${currentUser.name}.`);
    } else {
      errBox.innerText = data.error || 'Sign up failed.';
      errBox.classList.remove('d-none');
    }
  } catch (err) {
    errBox.innerText = 'Network error during registration.';
    errBox.classList.remove('d-none');
  }
}

function updateAuthUI() {
  // Single Top-Right Circular Profile Button Elements
  const headerProfileBtn = document.getElementById('headerProfileBtn');
  const profileIconGuest = document.getElementById('profileIconGuest');
  const circleAvatarChar = document.getElementById('circleAvatarChar');
  const onlinePulseDot = document.getElementById('onlinePulseDot');

  // Dedicated Profile Page fields
  const profileFullName = document.getElementById('profileFullName');
  const profileBigAvatar = document.getElementById('profileBigAvatar');
  const profileFieldFullName = document.getElementById('profileFieldFullName');
  const profileFieldPhone = document.getElementById('profileFieldPhone');
  const profileFieldShop = document.getElementById('profileFieldShop');
  const profileFieldCity = document.getElementById('profileFieldCity');
  const profileFieldAddress = document.getElementById('profileFieldAddress');
  const profileLoggedOutNotice = document.getElementById('profileLoggedOutNotice');
  const profileLoggedInContent = document.getElementById('profileLoggedInContent');

  if (currentUser) {
    const initial = (currentUser.name || 'C').charAt(0).toUpperCase();

    // Show single circle avatar with user initial & green online dot
    if (profileIconGuest) profileIconGuest.classList.add('d-none');
    if (circleAvatarChar) {
      circleAvatarChar.classList.remove('d-none');
      circleAvatarChar.innerText = initial;
    }
    if (onlinePulseDot) onlinePulseDot.classList.remove('d-none');
    if (headerProfileBtn) headerProfileBtn.title = `My Profile (${currentUser.name})`;

    // Populate dedicated Profile section
    if (profileFullName) profileFullName.innerText = currentUser.name || 'Customer Account';
    if (profileBigAvatar) profileBigAvatar.innerText = initial;
    if (profileFieldFullName) profileFieldFullName.innerText = currentUser.name || '—';
    if (profileFieldPhone) profileFieldPhone.innerText = currentUser.phone ? `+91 ${currentUser.phone}` : '—';
    if (profileFieldShop) profileFieldShop.innerText = currentUser.shopName || 'Retail Buyer / Vehicle Owner';
    if (profileFieldCity) profileFieldCity.innerText = currentUser.city || 'Gorakhpur, Uttar Pradesh';
    if (profileFieldAddress) profileFieldAddress.innerText = currentUser.address || 'Gorakhpur, Uttar Pradesh';

    if (profileLoggedOutNotice) profileLoggedOutNotice.classList.add('d-none');
    if (profileLoggedInContent) profileLoggedInContent.classList.remove('d-none');
  } else {
    // Show single circle with guest icon
    if (profileIconGuest) profileIconGuest.classList.remove('d-none');
    if (circleAvatarChar) circleAvatarChar.classList.add('d-none');
    if (onlinePulseDot) onlinePulseDot.classList.add('d-none');
    if (headerProfileBtn) headerProfileBtn.title = 'Customer Login';

    if (profileLoggedOutNotice) profileLoggedOutNotice.classList.remove('d-none');
    if (profileLoggedInContent) profileLoggedInContent.classList.add('d-none');
  }
  if (window.lucide) lucide.createIcons();
}

// ----------------- EDIT PROFILE DETAILS -----------------
function openEditProfileModal() {
  if (!currentUser) {
    openLoginModal('customer');
    return;
  }

  const nameInput = document.getElementById('editProfileName');
  const phoneInput = document.getElementById('editProfilePhone');
  const shopInput = document.getElementById('editProfileShop');
  const cityInput = document.getElementById('editProfileCity');
  const addressInput = document.getElementById('editProfileAddress');
  const pwInput = document.getElementById('editProfileNewPassword');

  if (nameInput) nameInput.value = currentUser.name || '';
  if (phoneInput) phoneInput.value = currentUser.phone || '';
  if (shopInput) shopInput.value = currentUser.shopName || '';
  if (cityInput) cityInput.value = currentUser.city || '';
  if (addressInput) addressInput.value = currentUser.address || '';
  if (pwInput) pwInput.value = '';

  const errBox = document.getElementById('editProfileErrorMessage');
  const succBox = document.getElementById('editProfileSuccessMessage');
  if (errBox) errBox.classList.add('d-none');
  if (succBox) succBox.classList.add('d-none');

  const modal = document.getElementById('editProfileModal');
  if (modal) modal.classList.remove('d-none');
  if (window.lucide) lucide.createIcons();
}

function closeEditProfileModal() {
  const modal = document.getElementById('editProfileModal');
  if (modal) modal.classList.add('d-none');
}

async function handleEditProfileSubmit(e) {
  e.preventDefault();
  if (!currentUser) return;

  const name = document.getElementById('editProfileName')?.value.trim() || '';
  const phone = document.getElementById('editProfilePhone')?.value.trim() || '';
  const shopName = document.getElementById('editProfileShop')?.value.trim() || '';
  const city = document.getElementById('editProfileCity')?.value.trim() || '';
  const address = document.getElementById('editProfileAddress')?.value.trim() || '';
  const newPassword = document.getElementById('editProfileNewPassword')?.value || '';

  const errBox = document.getElementById('editProfileErrorMessage');
  const succBox = document.getElementById('editProfileSuccessMessage');
  const submitBtn = document.getElementById('editProfileSubmitBtn');

  if (errBox) errBox.classList.add('d-none');
  if (succBox) succBox.classList.add('d-none');

  if (!name || !phone) {
    if (errBox) {
      errBox.innerText = 'Name and phone number are required.';
      errBox.classList.remove('d-none');
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Saving...';
  }

  try {
    const res = await fetch('/api/auth/customer-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentUser.id,
        name,
        phone,
        shopName,
        city,
        address,
        newPassword: newPassword || undefined
      })
    });

    const data = await res.json();

    if (data.success && data.user) {
      currentUser = { ...currentUser, ...data.user };
      localStorage.setItem('gth_user', JSON.stringify(currentUser));
      updateAuthUI();

      if (succBox) {
        succBox.innerText = 'Profile details updated successfully!';
        succBox.classList.remove('d-none');
      }

      setTimeout(() => {
        closeEditProfileModal();
      }, 700);
    } else {
      if (errBox) {
        errBox.innerText = data.error || 'Failed to update profile.';
        errBox.classList.remove('d-none');
      }
    }
  } catch (err) {
    if (errBox) {
      errBox.innerText = 'Network error while updating profile.';
      errBox.classList.remove('d-none');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="check"></i> Save Changes';
      if (window.lucide) lucide.createIcons();
    }
  }
}

function logout() {
  // Save cart to user's phone key
  if (currentUser && currentUser.phone) {
    localStorage.setItem(`gth_cart_${currentUser.phone}`, JSON.stringify(cart));
  }

  // Clear session
  currentUser = null;
  localStorage.removeItem('gth_user');
  localStorage.removeItem('gth_cart');
  localStorage.removeItem('gth_cart_guest');

  // Empty active cart for the screen
  cart = [];
  updateCartBadge();
  renderCartDrawer();

  // Reset checkout form fields
  if (document.getElementById('custOrderName')) document.getElementById('custOrderName').value = '';
  if (document.getElementById('custOrderPhone')) document.getElementById('custOrderPhone').value = '';
  if (document.getElementById('custOrderShop')) document.getElementById('custOrderShop').value = '';
  if (document.getElementById('custOrderCity')) document.getElementById('custOrderCity').value = '';
  if (document.getElementById('custOrderAddress')) document.getElementById('custOrderAddress').value = '';
  if (document.getElementById('custOrderNotes')) document.getElementById('custOrderNotes').value = '';
  if (document.getElementById('custOrderGST')) document.getElementById('custOrderGST').value = '';

  // Close modals
  document.getElementById('cartDrawer')?.classList.remove('open');
  document.getElementById('cartBackdrop')?.classList.add('d-none');
  document.getElementById('checkoutModal')?.classList.add('d-none');
  document.getElementById('whatsappPaymentModal')?.classList.add('d-none');

  updateAuthUI();
  switchView('customer');
}

function setupEventListeners() {
  // Additional event listeners
}

// =========================================================================
// OWNER & ADMIN DASHBOARD PORTAL LOGIC
// =========================================================================

// Toggle Between Customer Store & Admin View
function switchView(viewName) {
  const customerView = document.getElementById('customerView');
  const adminView = document.getElementById('adminView');
  const headerNav = document.getElementById('headerNavCustomer');

  if (viewName === 'admin') {
    if (!currentUser || currentUser.role !== 'admin') {
      openLoginModal('admin');
      return;
    }
    if (customerView) customerView.classList.add('d-none');
    if (adminView) adminView.classList.remove('d-none');
    if (headerNav) headerNav.classList.add('d-none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadAdminDashboard();
  } else {
    if (adminView) adminView.classList.add('d-none');
    if (customerView) customerView.classList.remove('d-none');
    if (headerNav) headerNav.classList.remove('d-none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showCustomerSection('catalog');
  }
  if (window.lucide) lucide.createIcons();
}

// Switch Admin Internal Tabs
function showAdminTab(tabName) {
  const tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach(tab => tab.classList.remove('active'));

  const panes = document.querySelectorAll('.admin-tab-pane');
  panes.forEach(pane => pane.classList.add('d-none'));

  if (tabName === 'inventory') {
    document.getElementById('adminTabInventory')?.classList.remove('d-none');
    if (tabs[0]) tabs[0].classList.add('active');
    renderAdminInventory();
  } else if (tabName === 'orders') {
    document.getElementById('adminTabOrders')?.classList.remove('d-none');
    if (tabs[1]) tabs[1].classList.add('active');
    fetchAdminOrders();
  } else if (tabName === 'settings') {
    document.getElementById('adminTabSettings')?.classList.remove('d-none');
    if (tabs[2]) tabs[2].classList.add('active');
    loadSettingsIntoAdminForm();
  } else if (tabName === 'admins') {
    document.getElementById('adminTabAdmins')?.classList.remove('d-none');
    if (tabs[3]) tabs[3].classList.add('active');
    renderAdminWhitelist();
  }
  if (window.lucide) lucide.createIcons();
}

// Load All Admin Dashboard Components
async function loadAdminDashboard() {
  if (currentUser) {
    const adminPill = document.getElementById('adminUserPill');
    if (adminPill) {
      adminPill.innerText = `Logged in as Administrator (${currentUser.name || currentUser.phone})`;
    }
  }
  renderAdminInventory();
  fetchAdminOrders();
  loadSettingsIntoAdminForm();
  renderAdminWhitelist();
  if (window.lucide) lucide.createIcons();
}

// ----------------- ADMIN INVENTORY & PRODUCT MANAGEMENT -----------------
function filterAdminInventory() {
  const query = document.getElementById('adminInventorySearch')?.value.trim().toLowerCase() || '';
  renderAdminInventory(query);
}

function renderAdminInventory(filterText = '') {
  const tbody = document.getElementById('adminProductsTbody');
  if (!tbody) return;

  let list = allProducts;
  if (filterText) {
    list = list.filter(p => 
      (p.name && p.name.toLowerCase().includes(filterText)) ||
      (p.brand && p.brand.toLowerCase().includes(filterText)) ||
      (p.size && p.size.toLowerCase().includes(filterText)) ||
      (p.itemType && p.itemType.toLowerCase().includes(filterText))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px; color:#64748b;">No products found matching "${filterText}".</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => {
    const typeLabel = p.itemType === 'Tube' ? '⭕ Tube' : '🚗 Tyre';
    const stockBadge = (p.stock || 0) > 10 
      ? `<span class="badge" style="background:#dcfce7; color:#15803d; font-weight:700;">${p.stock} In Stock</span>`
      : (p.stock || 0) > 0 
      ? `<span class="badge" style="background:#fef9c3; color:#a16207; font-weight:700;">${p.stock} Low Stock</span>`
      : `<span class="badge" style="background:#fee2e2; color:#b91c1c; font-weight:700;">Out of Stock</span>`;

    return `
      <tr>
        <td>
          <img src="${p.image || 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=120&auto=format&fit=crop&q=80'}" 
               alt="${p.name}" class="admin-thumb" onerror="this.src='https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=120&auto=format&fit=crop&q=80'">
        </td>
        <td>
          <strong style="color:#0f172a; display:block;">${p.name}</strong>
          <small style="color:#64748b;">${p.brand || ''} • ${p.category || ''}</small>
        </td>
        <td>
          <span style="font-weight:700; color:#0369a1; background:#e0f2fe; padding:2px 8px; border-radius:6px; font-size:12px;">${typeLabel}</span>
          <div style="font-size:12px; color:#334155; margin-top:2px; font-weight:600;">${p.size || 'Standard'}</div>
        </td>
        <td>
          <strong style="color:#059669; font-size:15px;">₹${p.wholesalePrice || p.price}</strong>
          ${p.retailPrice ? `<div style="text-decoration:line-through; font-size:12px; color:#94a3b8;">₹${p.retailPrice}</div>` : ''}
        </td>
        <td>${stockBadge}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="openProductModal('${p.id}')" title="Edit Item & Image">
              <i data-lucide="edit-2"></i> Edit
            </button>
            <button type="button" class="btn btn-danger-soft btn-sm" onclick="handleDeleteProduct('${p.id}')" title="Delete Item">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function updateImagePreview(url) {
  const container = document.getElementById('imagePreviewContainer');
  const img = document.getElementById('imagePreviewImg');
  if (!img) return;

  const cleanUrl = url ? url.trim() : '';
  if (cleanUrl && (cleanUrl.startsWith('http') || cleanUrl.startsWith('/uploads/') || cleanUrl.startsWith('data:image'))) {
    img.src = cleanUrl;
    img.classList.remove('d-none');
    if (container) container.classList.remove('d-none');
  } else {
    img.src = '';
    img.classList.add('d-none');
    if (container) container.classList.add('d-none');
  }
}

function clearProductImage() {
  const imgInput = document.getElementById('prodImage');
  const fileInput = document.getElementById('prodImageFile');
  if (imgInput) imgInput.value = '';
  if (fileInput) fileInput.value = '';
  updateImagePreview('');
  const statusEl = document.getElementById('imageUploadStatus');
  if (statusEl) statusEl.classList.add('d-none');
}

async function handleImageFileUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (file.size > 20 * 1024 * 1024) {
    alert('Please choose an image under 20MB.');
    return;
  }

  const statusEl = document.getElementById('imageUploadStatus');
  if (statusEl) {
    statusEl.innerText = 'Uploading photo from device...';
    statusEl.classList.remove('d-none');
  }

  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;
    updateImagePreview(dataUrl);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, filename: file.name })
      });
      const data = await res.json();
      if (data.success && data.url) {
        document.getElementById('prodImage').value = data.url;
        updateImagePreview(data.url);
        if (statusEl) {
          statusEl.innerText = 'Photo uploaded successfully!';
          setTimeout(() => statusEl.classList.add('d-none'), 3000);
        }
      } else {
        document.getElementById('prodImage').value = dataUrl;
        if (statusEl) statusEl.innerText = 'Photo attached.';
      }
    } catch (err) {
      document.getElementById('prodImage').value = dataUrl;
      if (statusEl) statusEl.innerText = 'Photo attached.';
    }
  };
  reader.readAsDataURL(file);
}

function openProductModal(productId = null) {
  const modal = document.getElementById('productModal');
  const title = document.getElementById('productModalTitle');
  const errBox = document.getElementById('productErrorMessage');
  const editIdInput = document.getElementById('editProductId');
  if (errBox) errBox.classList.add('d-none');

  if (productId) {
    const prod = allProducts.find(p => String(p.id) === String(productId));
    if (prod) {
      if (title) title.innerHTML = '<i data-lucide="edit-3"></i> Edit Product & Image';
      if (editIdInput) editIdInput.value = prod.id;
      document.getElementById('prodName').value = prod.name || '';
      document.getElementById('prodItemType').value = prod.itemType || 'Tyre';
      document.getElementById('prodBrand').value = prod.brand || '';
      document.getElementById('prodSize').value = prod.size || '';
      document.getElementById('prodCategory').value = prod.category || 'Bike';
      document.getElementById('prodWholesalePrice').value = prod.wholesalePrice || prod.price || '';
      document.getElementById('prodRetailPrice').value = prod.retailPrice || '';
      document.getElementById('prodStock').value = prod.stock !== undefined ? prod.stock : 50;
      document.getElementById('prodImage').value = prod.image || '';
      updateImagePreview(prod.image || '');
    }
  } else {
    if (title) title.innerHTML = '<i data-lucide="package-plus"></i> Add New Product';
    if (editIdInput) editIdInput.value = '';
    document.getElementById('productForm')?.reset();
    updateImagePreview('');
  }

  if (modal) modal.classList.remove('d-none');
  if (window.lucide) lucide.createIcons();
}

function closeProductModal() {
  document.getElementById('productModal')?.classList.add('d-none');
}

async function handleProductSubmit(e) {
  e.preventDefault();
  const editId = document.getElementById('editProductId')?.value;
  const name = document.getElementById('prodName')?.value.trim();
  const itemType = document.getElementById('prodItemType')?.value || 'Tyre';
  const brand = document.getElementById('prodBrand')?.value.trim();
  const size = document.getElementById('prodSize')?.value.trim();
  const category = document.getElementById('prodCategory')?.value || 'Bike';
  const wholesalePrice = parseFloat(document.getElementById('prodWholesalePrice')?.value) || 0;
  const retailPrice = parseFloat(document.getElementById('prodRetailPrice')?.value) || 0;
  const stock = parseInt(document.getElementById('prodStock')?.value, 10) || 0;
  const image = document.getElementById('prodImage')?.value.trim() || 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=400&auto=format&fit=crop&q=80';

  const errBox = document.getElementById('productErrorMessage');
  const submitBtn = document.getElementById('productSubmitBtn');

  if (!name || !brand || !size || !wholesalePrice) {
    if (errBox) {
      errBox.innerText = 'Please fill out all required fields marked with *.';
      errBox.classList.remove('d-none');
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Saving...';
  }

  try {
    const payload = {
      name,
      itemType,
      brand,
      size,
      category,
      wholesalePrice,
      price: wholesalePrice,
      retailPrice,
      stock,
      image,
      featured: true
    };

    let res;
    if (editId) {
      res = await fetch(`/api/products/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (data.success) {
      await fetchProducts(); // Reloads allProducts and re-renders customer catalog
      renderAdminInventory(); // Updates admin inventory table
      closeProductModal();
      alert(editId ? 'Product and image updated successfully!' : 'New product added successfully!');
    } else {
      if (errBox) {
        errBox.innerText = data.error || 'Failed to save product.';
        errBox.classList.remove('d-none');
      }
    }
  } catch (err) {
    if (errBox) {
      errBox.innerText = 'Network error while saving product.';
      errBox.classList.remove('d-none');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="check"></i> Save Product';
      if (window.lucide) lucide.createIcons();
    }
  }
}

async function handleDeleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  try {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      await fetchProducts();
      renderAdminInventory();
      alert('Product deleted successfully.');
    } else {
      alert(data.error || 'Failed to delete product.');
    }
  } catch (err) {
    alert('Error deleting product.');
  }
}

// ----------------- CUSTOMER ORDERS MANAGEMENT & 2 OPTIONS (PENDING & DELIVERED) -----------------
let currentAdminOrderFilter = 'pending'; // 'pending' | 'delivered'
let allAdminOrders = [];

function filterAdminOrdersTab(filterType) {
  currentAdminOrderFilter = filterType;
  const btnPending = document.getElementById('btnAdminFilterPending');
  const btnDelivered = document.getElementById('btnAdminFilterDelivered');

  if (filterType === 'pending') {
    btnPending?.classList.add('active');
    btnDelivered?.classList.remove('active');
  } else {
    btnDelivered?.classList.add('active');
    btnPending?.classList.remove('active');
  }
  renderAdminOrdersList();
}

async function fetchAdminOrders() {
  const container = document.getElementById('adminOrdersList');
  const countBadge = document.getElementById('adminOrdersCount');
  if (!container) return;

  try {
    const res = await fetch('/api/orders');
    allAdminOrders = await res.json();
    if (!Array.isArray(allAdminOrders)) allAdminOrders = [];

    const pendingOrders = allAdminOrders.filter(o => (o.status || o.orderStatus) !== 'Delivered');
    const deliveredOrders = allAdminOrders.filter(o => (o.status || o.orderStatus) === 'Delivered');

    if (countBadge) countBadge.innerText = allAdminOrders.length;
    const adminPendingCountEl = document.getElementById('adminPendingCount');
    const adminDeliveredCountEl = document.getElementById('adminDeliveredCount');
    if (adminPendingCountEl) adminPendingCountEl.innerText = pendingOrders.length;
    if (adminDeliveredCountEl) adminDeliveredCountEl.innerText = deliveredOrders.length;

    renderAdminOrdersList();
  } catch (err) {
    console.error('Failed to load orders', err);
  }
}

function renderAdminOrdersList() {
  const container = document.getElementById('adminOrdersList');
  if (!container) return;

  const filtered = allAdminOrders.filter(o => {
    const isDelivered = (o.status || o.orderStatus) === 'Delivered';
    return currentAdminOrderFilter === 'delivered' ? isDelivered : !isDelivered;
  });

  if (filtered.length === 0) {
    const msg = currentAdminOrderFilter === 'delivered'
      ? 'No delivered orders yet. Orders marked as Delivered will appear here.'
      : 'All caught up! No pending orders waiting for dispatch.';
    container.innerHTML = `<div class="admin-card-box" style="text-align:center; color:#64748b; padding:40px;">${msg}</div>`;
    return;
  }

  container.innerHTML = filtered.map(order => {
    const orderId = order.orderId || order.id;
    const orderDate = new Date(order.timestamp || order.createdAt || Date.now()).toLocaleString();
    const currentStatus = order.orderStatus || order.status || 'Order Placed';
    const statusOptions = ['Order Placed', 'Confirmed', 'Dispatched', 'Delivered'];
    const statusSelect = `
      <select onchange="handleUpdateOrderStatus('${orderId}', this.value)" style="padding:6px 12px; border-radius:6px; border:1.5px solid #cbd5e1; font-weight:700; background:#f8fafc; color:#0f172a; font-size:13px;">
        ${statusOptions.map(st => `<option value="${st}" ${currentStatus === st ? 'selected' : ''}>${st}</option>`).join('')}
      </select>
    `;

    const itemsSummary = (order.items || []).map(it => {
      const qty = it.qty || it.quantity || 1;
      const rate = it.wholesalePrice || it.price || 0;
      return `
        <div style="display:flex; justify-content:space-between; font-size:13px; padding:5px 0; border-bottom:1px dashed #f1f5f9;">
          <span><strong>${qty}x</strong> ${it.name} (${it.size || ''} ${it.itemType || 'Tyre'})</span>
          <span style="font-weight:700;">₹${rate * qty}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="admin-order-card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">
          <div>
            <strong style="font-size:16px; color:#0f172a;">Order #${orderId}</strong>
            <span style="font-size:12px; color:#64748b; margin-left:8px;">${orderDate}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:13px; font-weight:600; color:#475569;">Order Status:</span>
            ${statusSelect}
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:14px;">
          <div>
            <div style="font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Customer Details</div>
            <div style="font-weight:700; color:#0f172a; margin-top:4px;">${order.customer?.name || 'Customer'}</div>
            <div style="font-size:13px; color:#475569;">📞 ${order.customer?.phone || ''}</div>
            ${order.customer?.shopName ? `<div style="font-size:13px; color:#0369a1; font-weight:600;">🏪 ${order.customer.shopName}</div>` : ''}
            <div style="font-size:13px; color:#64748b; margin-top:2px;">📍 ${order.customer?.address || ''}, ${order.customer?.city || ''}</div>
          </div>

          <div>
            <div style="font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Payment Info</div>
            <div style="font-weight:700; color:#059669; font-size:16px; margin-top:4px;">₹${order.total || order.grandTotal || 0}</div>
            <div style="font-size:13px; color:#475569;">Method: ${order.paymentMethod || 'Pay on Delivery / Wholesale Credit'}</div>
            <div style="font-size:13px; color:#64748b;">Payment Status: ${formatPaymentBadge(order)}</div>
            ${order.transactionId ? `<div style="font-size:12px; color:#64748b; margin-top:2px;">Ref/UTR: ${order.transactionId}</div>` : ''}
          </div>
        </div>

        <div style="background:#f8fafc; border-radius:8px; padding:12px; margin-top:8px;">
          <div style="font-size:12px; font-weight:700; color:#64748b; margin-bottom:6px;">ORDERED ITEMS</div>
          ${itemsSummary}
        </div>
      </div>
    `;
  }).join('');
}

async function handleUpdateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, orderStatus: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Order #${orderId} status updated to: ${newStatus}`);
      fetchAdminOrders();
    } else {
      alert(data.error || 'Failed to update order status.');
    }
  } catch (err) {
    alert('Error updating order status.');
  }
}

// ----------------- WEBSITE INTERFACE & SETTINGS CUSTOMIZATION -----------------
function loadSettingsIntoAdminForm() {
  if (!shopSettings) return;
  const setShopName = document.getElementById('setShopName');
  const setTagline = document.getElementById('setTagline');
  const setOwnerWA = document.getElementById('setOwnerWhatsApp');
  const setContact = document.getElementById('setContactPhone');
  const setAddress = document.getElementById('setAddress');
  const setLandmark = document.getElementById('setLandmark');
  const setCity = document.getElementById('setCity');
  const setUPI = document.getElementById('setShopUPI');
  const setOnlinePay = document.getElementById('setEnableOnlinePayment');

  if (setShopName) setShopName.value = shopSettings.shopName || '';
  if (setTagline) setTagline.value = shopSettings.tagline || '';
  if (setOwnerWA) setOwnerWA.value = shopSettings.ownerWhatsApp || '';
  if (setContact) setContact.value = shopSettings.contactPhone || '';
  if (setAddress) setAddress.value = shopSettings.address || '';
  if (setLandmark) setLandmark.value = shopSettings.landmark || '';
  if (setCity) setCity.value = shopSettings.city || '';
  if (setUPI) setUPI.value = shopSettings.shopUPI || '';
  if (setOnlinePay) setOnlinePay.checked = shopSettings.enableOnlinePayment === true;
}

async function handleSaveSettings(e) {
  e.preventDefault();
  const alertEl = document.getElementById('settingsAlertMessage');
  if (alertEl) alertEl.classList.add('d-none');

  const updatedSettings = {
    shopName: document.getElementById('setShopName')?.value.trim() || '',
    tagline: document.getElementById('setTagline')?.value.trim() || '',
    ownerWhatsApp: document.getElementById('setOwnerWhatsApp')?.value.trim() || '',
    contactPhone: document.getElementById('setContactPhone')?.value.trim() || '',
    address: document.getElementById('setAddress')?.value.trim() || '',
    landmark: document.getElementById('setLandmark')?.value.trim() || '',
    city: document.getElementById('setCity')?.value.trim() || '',
    shopUPI: document.getElementById('setShopUPI')?.value.trim() || '',
    enableOnlinePayment: document.getElementById('setEnableOnlinePayment')?.checked || false
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings)
    });
    const data = await res.json();
    if (data.success) {
      shopSettings = { ...shopSettings, ...updatedSettings };
      applySettingsToUI();
      if (alertEl) {
        alertEl.innerText = 'Website interface and store information saved and updated live!';
        alertEl.classList.remove('d-none');
      }
      alert('All website customizations saved successfully!');
    } else {
      alert(data.error || 'Failed to save settings.');
    }
  } catch (err) {
    alert('Error saving website settings.');
  }
}

// ----------------- ADMIN WHITELIST & CREDENTIALS MANAGEMENT -----------------
async function renderAdminWhitelist() {
  const container = document.getElementById('adminWhitelistContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/whitelist');
    const list = await res.json();

    if (!list || list.length === 0) {
      container.innerHTML = `<p style="color:#64748b; font-size:13px;">No admin accounts configured yet.</p>`;
      return;
    }

    container.innerHTML = list.map(item => {
      const isPrimaryOwner = item.phone === '9838451157';
      const deleteBtn = isPrimaryOwner ? '' : `
        <button type="button" class="btn btn-danger-soft btn-sm" onclick="handleDeleteAdminUser('${item.phone}')" title="Remove admin access">
          <i data-lucide="trash-2"></i>
        </button>
      `;

      return `
        <div class="admin-whitelist-card">
          <div>
            <strong style="color:#0f172a; font-size:14px;">${item.name || 'Admin User'} ${isPrimaryOwner ? '<span style="color:#0284c7; font-size:11px;">(Primary Owner)</span>' : ''}</strong>
            <div style="font-size:13px; color:#475569;">Login ID / Mobile: <strong>${item.phone}</strong></div>
            <span style="font-size:11px; background:#e0e7ff; color:#3730a3; padding:2px 6px; border-radius:4px; font-weight:700;">Role: ${item.role || 'admin'}</span>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <button type="button" class="btn btn-outline btn-sm" onclick="quickFillAdminEdit('${item.phone}', '${encodeURIComponent(item.name || '')}')">
              <i data-lucide="key"></i> Update Password
            </button>
            ${deleteBtn}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Failed to load admin whitelist', err);
  }
}

function quickFillAdminEdit(phone, encName) {
  const name = decodeURIComponent(encName);
  document.getElementById('newAdminPhone').value = phone;
  document.getElementById('newAdminName').value = name;
  const pwField = document.getElementById('newAdminPassword');
  pwField.value = '';
  pwField.focus();
}

async function handleDeleteAdminUser(phone) {
  if (phone === '9838451157') {
    alert('Primary owner account (9838451157) cannot be deleted.');
    return;
  }
  if (!confirm(`Are you sure you want to remove admin access for ${phone}?`)) return;

  try {
    const res = await fetch(`/api/admin/whitelist/${phone}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert('Admin account removed successfully.');
      renderAdminWhitelist();
    } else {
      alert(data.error || 'Failed to remove admin account.');
    }
  } catch (err) {
    alert('Error removing admin account.');
  }
}

async function handleSaveAdminUser(e) {
  e.preventDefault();
  const alertEl = document.getElementById('adminCredAlert');
  if (alertEl) alertEl.classList.add('d-none');

  const name = document.getElementById('newAdminName')?.value.trim();
  const phone = document.getElementById('newAdminPhone')?.value.trim();
  const password = document.getElementById('newAdminPassword')?.value;

  if (!name || !phone || !password) {
    alert('Please provide name, phone/ID, and password.');
    return;
  }

  try {
    const res = await fetch('/api/admin/whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, password })
    });
    const data = await res.json();
    if (data.success) {
      if (alertEl) {
        alertEl.innerText = `Admin account for ${name} (${phone}) saved successfully!`;
        alertEl.classList.remove('d-none');
      }
      document.getElementById('adminCredentialsForm')?.reset();
      renderAdminWhitelist();
      alert(`Admin credentials for ${name} saved successfully!`);
    } else {
      alert(data.error || 'Failed to save admin user.');
    }
  } catch (err) {
    alert('Error saving admin credentials.');
  }
}

// ----------------- ADMIN INVENTORY SEARCH & RECOMMENDATIONS -----------------
function handleAdminSearchInput() {
  const input = document.getElementById('adminInventorySearch');
  const clearBtn = document.getElementById('adminSearchClearBtn');
  const dropdown = document.getElementById('adminSearchDropdown');
  if (!input) return;

  const query = input.value.trim().toLowerCase();

  if (clearBtn) {
    if (query) clearBtn.classList.remove('d-none');
    else clearBtn.classList.add('d-none');
  }

  // Filter inventory table directly
  renderAdminInventory(query);

  if (!query) {
    if (dropdown) dropdown.classList.add('d-none');
    return;
  }

  // Find matching products for recommendations
  const matches = allProducts.filter(p => {
    const searchable = `${p.name} ${p.brand || ''} ${p.size || ''} ${p.category || ''} ${p.itemType || ''}`.toLowerCase();
    return searchable.includes(query);
  }).slice(0, 6);

  if (matches.length === 0) {
    if (dropdown) {
      dropdown.innerHTML = `<div style="padding: 14px; text-align: center; color: #64748b; font-size: 13px;">No matching items found for "<strong>${escapeHtml(query)}</strong>"</div>`;
      dropdown.classList.remove('d-none');
    }
    return;
  }

  if (dropdown) {
    dropdown.innerHTML = `
      <div style="padding: 8px 14px; font-size: 11px; font-weight: 700; color: #64748b; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between;">
        <span><i data-lucide="sparkles"></i> Matching Inventory Items (${matches.length})</span>
        <span style="color: #0284c7;">Click to select</span>
      </div>
      ${matches.map(prod => {
        const itemType = prod.itemType === 'Tube' ? '⭕ Tube' : '🚗 Tyre';
        return `
          <div class="admin-rec-item" onmousedown="selectAdminRecommendation('${prod.id}', '${encodeURIComponent(prod.name)}')">
            <img src="${prod.image || 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=80&auto=format&fit=crop&q=80'}" class="admin-rec-thumb" alt="${prod.name}">
            <div class="admin-rec-info">
              <span class="admin-rec-name">${highlightSearchMatch(prod.name, query)}</span>
              <div class="admin-rec-meta">
                <span>${prod.brand || ''}</span>
                <span>•</span>
                <span>${itemType} (${prod.size || 'Std'})</span>
              </div>
            </div>
            <div class="admin-rec-price">
              ₹${prod.wholesalePrice || prod.price}
            </div>
          </div>
        `;
      }).join('')}
    `;
    dropdown.classList.remove('d-none');
    if (window.lucide) lucide.createIcons();
  }
}

function selectAdminRecommendation(productId, encodedName) {
  const name = decodeURIComponent(encodedName);
  const input = document.getElementById('adminInventorySearch');
  if (input) input.value = name;
  document.getElementById('adminSearchDropdown')?.classList.add('d-none');
  const clearBtn = document.getElementById('adminSearchClearBtn');
  if (clearBtn) clearBtn.classList.remove('d-none');
  renderAdminInventory(name.toLowerCase());
}

function clearAdminSearch() {
  const input = document.getElementById('adminInventorySearch');
  if (input) input.value = '';
  document.getElementById('adminSearchClearBtn')?.classList.add('d-none');
  document.getElementById('adminSearchDropdown')?.classList.add('d-none');
  renderAdminInventory('');
}

// Close admin search dropdown when clicking outside
document.addEventListener('click', (e) => {
  const container = document.querySelector('.admin-inventory-search-container');
  if (container && !container.contains(e.target)) {
    document.getElementById('adminSearchDropdown')?.classList.add('d-none');
  }
});
