/* ============================================================
   STRIDE — Theme JavaScript
   Vanilla JS, no dependencies, optimized for mobile
   ============================================================ */

'use strict';

/* ─── Utilities ─── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
const off = (el, ev, fn) => el && el.removeEventListener(ev, fn);
const emit = (el, name, detail = {}) => el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const formatMoney = (cents, symbol = '€') => {
  const amount = (cents / 100).toFixed(2).replace('.', ',');
  return `${symbol}\u00A0${amount}`;
};

/* ─── Header scroll behavior ─── */
function initHeader() {
  const header = $('.site-header');
  if (!header) return;
  let lastY = 0;
  const onScroll = debounce(() => {
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 20);
    lastY = y;
  }, 10);
  on(window, 'scroll', onScroll, { passive: true });
}

/* ─── Mobile Menu ─── */
function initMobileMenu() {
  const toggle = $('.mobile-menu-toggle');
  const menu = $('.mobile-menu');
  const close = $('.mobile-menu__close');
  if (!toggle || !menu) return;

  const open = () => {
    menu.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    menu.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
  };
  const closeMenu = () => {
    menu.classList.remove('is-open');
    document.body.style.overflow = '';
    menu.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
  };

  on(toggle, 'click', open);
  on(close, 'click', closeMenu);
  on(document, 'keydown', e => { if (e.key === 'Escape') closeMenu(); });

  // Expandable sub-links
  $$('.mobile-menu__link[data-has-children]').forEach(link => {
    on(link, 'click', e => {
      e.preventDefault();
      const sub = link.nextElementSibling;
      if (sub) sub.classList.toggle('is-open');
      link.classList.toggle('is-expanded');
    });
  });
}

/* ─── Cart Drawer ─── */
const Cart = {
  drawer: null,
  overlay: null,
  count: 0,

  init() {
    this.drawer = $('#cart-drawer');
    this.overlay = $('#cart-overlay');
    const openBtns = $$('[data-open-cart]');
    const closeBtn = $('.cart-drawer__close');

    openBtns.forEach(btn => on(btn, 'click', () => this.open()));
    on(closeBtn, 'click', () => this.close());
    on(this.overlay, 'click', () => this.close());
    on(document, 'keydown', e => { if (e.key === 'Escape') this.close(); });
    on(document, 'cart:open', () => this.open());
    on(document, 'cart:refresh', () => this.refresh());
  },

  open() {
    if (!this.drawer) return;
    this.drawer.classList.add('is-open');
    this.overlay.classList.add('is-visible');
    this.drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    this.refresh();
  },

  close() {
    if (!this.drawer) return;
    this.drawer.classList.remove('is-open');
    this.overlay.classList.remove('is-visible');
    this.drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  },

  async refresh() {
    try {
      const res = await fetch('/cart.js');
      const cart = await res.json();
      this.count = cart.item_count;
      this.updateCount();
      this.renderItems(cart);
    } catch (e) {
      console.warn('Cart refresh failed:', e);
    }
  },

  updateCount() {
    $$('.cart-count').forEach(el => {
      el.textContent = this.count;
      el.style.display = this.count > 0 ? 'flex' : 'none';
    });
  },

  async add(variantId, quantity = 1, properties = {}) {
    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity, properties })
      });
      if (!res.ok) throw new Error('Add to cart failed');
      const item = await res.json();
      this.open();
      Toast.show('Toegevoegd aan winkelwagen');
      return item;
    } catch (e) {
      Toast.show('Er is iets misgegaan', 'error');
      throw e;
    }
  },

  async update(key, quantity) {
    const res = await fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: key, quantity })
    });
    const cart = await res.json();
    this.count = cart.item_count;
    this.updateCount();
    this.renderItems(cart);
    return cart;
  },

  async remove(key) {
    return this.update(key, 0);
  },

  renderItems(cart) {
    const body = $('.cart-drawer__body');
    const footer = $('.cart-drawer__footer');
    if (!body) return;

    if (cart.item_count === 0) {
      body.innerHTML = `
        <div class="cart-drawer__empty">
          <div class="cart-drawer__empty-icon">🛒</div>
          <p style="font-weight:600;font-size:1rem;">Je winkelwagen is leeg</p>
          <p style="font-size:.875rem;color:var(--color-mid);">Voeg producten toe om te beginnen</p>
          <a href="/collections/all" class="btn btn-primary btn-sm" onclick="Cart.close()">Bekijk collectie</a>
        </div>`;
      if (footer) footer.style.display = 'none';
      return;
    }

    if (footer) footer.style.display = 'flex';

    body.innerHTML = cart.items.map(item => `
      <div class="cart-item" data-key="${item.key}">
        <img class="cart-item__img" src="${item.image}" alt="${item.product_title}" loading="lazy" width="80" height="80">
        <div class="cart-item__info">
          <div class="cart-item__title">${item.product_title}</div>
          <div class="cart-item__variant">${item.variant_title !== 'Default Title' ? item.variant_title : ''}</div>
          <div class="cart-item__bottom">
            <div class="cart-item__qty">
              <button class="cart-item__qty-btn" data-action="decrease" data-key="${item.key}" data-qty="${item.quantity}" aria-label="Minder">−</button>
              <span class="cart-item__qty-val">${item.quantity}</span>
              <button class="cart-item__qty-btn" data-action="increase" data-key="${item.key}" data-qty="${item.quantity}" aria-label="Meer">+</button>
            </div>
            <div class="cart-item__price">${formatMoney(item.final_line_price)}</div>
            <button class="cart-item__remove" data-action="remove" data-key="${item.key}" aria-label="Verwijderen">Verwijder</button>
          </div>
        </div>
      </div>`).join('');

    // Bind qty buttons
    $$('.cart-item__qty-btn', body).forEach(btn => {
      on(btn, 'click', async () => {
        const key = btn.dataset.key;
        const current = parseInt(btn.dataset.qty);
        const delta = btn.dataset.action === 'increase' ? 1 : -1;
        await Cart.update(key, Math.max(0, current + delta));
      });
    });

    $$('.cart-item__remove', body).forEach(btn => {
      on(btn, 'click', () => Cart.remove(btn.dataset.key));
    });

    // Update totals
    const totalEl = $('.cart-total-price');
    const subtotalEl = $('.cart-subtotal-price');
    if (totalEl) totalEl.textContent = formatMoney(cart.total_price);
    if (subtotalEl) subtotalEl.textContent = formatMoney(cart.total_price);
  }
};

/* ─── Toast Notifications ─── */
const Toast = {
  el: null,
  timer: null,

  init() {
    this.el = document.createElement('div');
    this.el.className = 'toast';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.el);
  },

  show(msg, type = 'success', duration = 2500) {
    if (!this.el) this.init();
    clearTimeout(this.timer);
    this.el.textContent = type === 'success' ? `✓  ${msg}` : `✕  ${msg}`;
    this.el.classList.add('visible');
    this.timer = setTimeout(() => this.el.classList.remove('visible'), duration);
  }
};

/* ─── Search Overlay ─── */
function initSearch() {
  const overlay = $('#search-overlay');
  const openBtns = $$('[data-open-search]');
  const closeBtn = $('.search-overlay__close');
  const input = $('.search-overlay__input');
  if (!overlay) return;

  const open = () => {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => input?.focus(), 100);
  };
  const close = () => {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  openBtns.forEach(btn => on(btn, 'click', open));
  on(closeBtn, 'click', close);
  on(document, 'keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); open(); }
  });
}

/* ─── Product Gallery ─── */
function initProductGallery() {
  const gallery = $('.product-gallery');
  if (!gallery) return;

  const main = $('.product-gallery__main', gallery);
  const mainImg = $('img', main);
  const thumbs = $$('.product-gallery__thumb', gallery);
  const prevBtn = $('.product-gallery__nav--prev', gallery);
  const nextBtn = $('.product-gallery__nav--next', gallery);
  let currentIdx = 0;

  const goTo = (idx) => {
    const total = thumbs.length;
    currentIdx = (idx + total) % total;
    thumbs.forEach((t, i) => t.classList.toggle('active', i === currentIdx));
    const thumbImg = thumbs[currentIdx]?.querySelector('img');
    if (thumbImg && mainImg) {
      mainImg.src = thumbImg.src.replace('_64x64', '_800x');
      mainImg.alt = thumbImg.alt;
    }
  };

  thumbs.forEach((thumb, i) => {
    on(thumb, 'click', () => goTo(i));
  });
  on(prevBtn, 'click', () => goTo(currentIdx - 1));
  on(nextBtn, 'click', () => goTo(currentIdx + 1));

  // Touch/swipe support
  let startX = 0;
  on(main, 'touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  on(main, 'touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goTo(currentIdx + (diff > 0 ? 1 : -1));
  });
}

/* ─── Variant Selector ─── */
function initVariantSelector() {
  const form = $('.product-form');
  if (!form) return;

  const sizeOptions = $$('.size-option', form);
  const addBtn = $('.add-to-cart-btn', form);
  const priceEl = $('.product-info__price', document);
  const comparePriceEl = $('.product-info__price--compare', document);

  sizeOptions.forEach(option => {
    on(option, 'click', () => {
      if (option.classList.contains('unavailable')) return;
      sizeOptions.forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');

      const variantId = option.dataset.variantId;
      const price = option.dataset.price;
      const comparePrice = option.dataset.comparePrice;

      // Update hidden input
      const variantInput = $('[name="id"]', form);
      if (variantInput) variantInput.value = variantId;

      // Update price display
      if (priceEl && price) priceEl.textContent = formatMoney(parseInt(price));
      if (comparePriceEl && comparePrice) {
        comparePriceEl.textContent = formatMoney(parseInt(comparePrice));
        comparePriceEl.style.display = comparePrice > price ? 'inline' : 'none';
      }

      // Update URL without reload
      const url = new URL(window.location);
      url.searchParams.set('variant', variantId);
      window.history.replaceState({}, '', url.toString());

      if (addBtn) addBtn.disabled = false;
    });
  });

  // Add to cart
  on(form, 'submit', async e => {
    e.preventDefault();
    const variantInput = $('[name="id"]', form);
    const qty = parseInt($('[name="quantity"]', form)?.value || 1);
    if (!variantInput?.value) {
      Toast.show('Selecteer een maat', 'error');
      return;
    }

    addBtn.classList.add('btn-loading');
    addBtn.disabled = true;
    addBtn.textContent = 'Toevoegen...';

    try {
      await Cart.add(variantInput.value, qty);
    } finally {
      addBtn.classList.remove('btn-loading');
      addBtn.disabled = false;
      addBtn.textContent = 'In winkelwagen';
    }
  });

  // Quantity selector
  const qtyInput = $('.quantity-input', form);
  const decBtn = $('.quantity-btn[data-action="decrease"]', form);
  const incBtn = $('.quantity-btn[data-action="increase"]', form);
  on(decBtn, 'click', () => { if (qtyInput) qtyInput.value = Math.max(1, parseInt(qtyInput.value) - 1); });
  on(incBtn, 'click', () => { if (qtyInput) qtyInput.value = parseInt(qtyInput.value) + 1; });
}

/* ─── Bundle Upsell ─── */
function initBundleUpsell() {
  const upsell = $('.bundle-upsell');
  if (!upsell) return;

  const items = $$('.bundle-upsell__item', upsell);
  const totalEl = $('.bundle-upsell__total-price', upsell);
  let basePrice = parseInt(upsell.dataset.basePrice || 0);

  const updateTotal = () => {
    let total = basePrice;
    items.forEach(item => {
      if (item.classList.contains('selected')) {
        total += parseInt(item.dataset.price || 0);
      }
    });
    if (totalEl) totalEl.textContent = formatMoney(total);
  };

  items.forEach(item => {
    on(item, 'click', () => {
      item.classList.toggle('selected');
      const check = item.querySelector('.bundle-upsell__item-check');
      if (check) check.innerHTML = item.classList.contains('selected') ? '✓' : '';
      updateTotal();
    });
  });
}

/* ─── Accordion ─── */
function initAccordions() {
  $$('.accordion-trigger').forEach(trigger => {
    on(trigger, 'click', () => {
      const item = trigger.closest('.accordion-item');
      const isOpen = item.classList.contains('open');

      // Close all
      $$('.accordion-item.open').forEach(el => el.classList.remove('open'));

      // Open this if was closed
      if (!isOpen) item.classList.add('open');
    });
  });

  // Open first by default
  const first = $('.accordion-item');
  if (first) first.classList.add('open');
}

/* ─── Size Guide Modal ─── */
function initSizeGuide() {
  const modal = $('.size-guide-modal');
  const openBtns = $$('[data-open-size-guide]');
  const closeBtn = modal ? $('.size-guide-modal__close', modal) : null;
  const overlay = modal ? $('.size-guide-modal__overlay', modal) : null;

  if (!modal) return;

  const open = () => {
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  openBtns.forEach(btn => on(btn, 'click', open));
  on(closeBtn, 'click', close);
  on(overlay, 'click', close);
  on(document, 'keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });
}

/* ─── Scroll To Top ─── */
function initScrollTop() {
  const btn = $('#scroll-to-top');
  if (!btn) return;
  const toggle = debounce(() => btn.classList.toggle('visible', window.scrollY > 400), 50);
  on(window, 'scroll', toggle, { passive: true });
  on(btn, 'click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ─── Scroll Animations ─── */
function initScrollAnimations() {
  const els = $$('.animate-fade-up, .animate-fade-in');
  if (!els.length || !window.IntersectionObserver) {
    els.forEach(el => el.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  els.forEach(el => observer.observe(el));
}

/* ─── Brands marquee pause on hover ─── */
function initBrandsTrack() {
  const track = $('.brands__track');
  if (!track) return;
  on(track, 'mouseenter', () => track.style.animationPlayState = 'paused');
  on(track, 'mouseleave', () => track.style.animationPlayState = 'running');
}

/* ─── Color Swatches ─── */
function initColorSwatches() {
  $$('.color-swatch').forEach(swatch => {
    on(swatch, 'click', function() {
      const card = this.closest('.product-card');
      if (!card) return;
      $$('.color-swatch', card).forEach(s => s.classList.remove('active'));
      this.classList.add('active');

      // Optionally update card image
      const imgUrl = this.dataset.image;
      if (imgUrl) {
        const img = $('.product-card__media img', card);
        if (img) img.src = imgUrl;
      }
    });
  });
}

/* ─── Walk Set Tabs (mobile) ─── */
function initWalkSet() {
  const section = $('.walk-set');
  if (!section) return;

  // Animate items on scroll
  const items = $$('.walk-set__item', section);
  items.forEach((item, i) => {
    item.style.transitionDelay = `${i * 80}ms`;
    item.classList.add('animate-fade-up');
  });
}

/* ─── Sticky Add To Cart (mobile) ─── */
function initStickyATC() {
  const productForm = $('.product-form');
  const addBtn = $('.add-to-cart-btn');
  if (!productForm || !addBtn || window.innerWidth >= 1024) return;

  // Show sticky CTA when original button is out of view
  const stickyBar = document.createElement('div');
  stickyBar.className = 'sticky-atc';
  stickyBar.innerHTML = `
    <div class="sticky-atc__inner container">
      <div class="sticky-atc__info"></div>
      <button class="btn btn-primary sticky-atc__btn">In winkelwagen</button>
    </div>`;

  const style = document.createElement('style');
  style.textContent = `
    .sticky-atc {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 300;
      background: rgba(248,246,243,0.97); backdrop-filter: blur(12px);
      border-top: 1px solid var(--color-border);
      padding: .75rem 0;
      transform: translateY(100%);
      transition: transform 300ms var(--ease-out);
    }
    .sticky-atc.visible { transform: translateY(0); }
    .sticky-atc__inner { display: flex; align-items: center; gap: 1rem; }
    .sticky-atc__info { flex: 1; font-size: .875rem; font-weight: 600; }
    .sticky-atc__btn { flex-shrink: 0; }
  `;
  document.head.appendChild(style);
  document.body.appendChild(stickyBar);

  const stickyBtn = stickyBar.querySelector('.sticky-atc__btn');
  on(stickyBtn, 'click', () => productForm.dispatchEvent(new Event('submit', { bubbles: true })));

  const observer = new IntersectionObserver(([entry]) => {
    stickyBar.classList.toggle('visible', !entry.isIntersecting);
  }, { threshold: 0.5 });
  observer.observe(addBtn);
}

/* ─── Announcement Bar Carousel ─── */
function initAnnouncementCarousel() {
  const items = $$('.announcement-bar__item');
  if (items.length <= 1) return;
  let idx = 0;
  items.forEach((item, i) => item.style.display = i === 0 ? 'flex' : 'none');
  setInterval(() => {
    items[idx].style.display = 'none';
    idx = (idx + 1) % items.length;
    items[idx].style.display = 'flex';
  }, 4000);
}

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded', () => {
  Toast.init();
  initHeader();
  initMobileMenu();
  Cart.init();
  initSearch();
  initProductGallery();
  initVariantSelector();
  initBundleUpsell();
  initAccordions();
  initSizeGuide();
  initScrollTop();
  initScrollAnimations();
  initBrandsTrack();
  initColorSwatches();
  initWalkSet();
  initStickyATC();
  initAnnouncementCarousel();

  // Cart count init
  Cart.refresh();
});
