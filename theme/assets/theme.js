/* ===========================================
   MOLLY & SOPHIE - Shopify Theme JS
   =========================================== */

(function() {
  'use strict';

  // ---------- Helpers ----------
  function formatMoney(cents, format) {
    var fmt = format || (window.theme && window.theme.moneyFormat) || '${{amount}}';
    var value = (cents / 100).toFixed(2);
    return fmt.replace(/\{\{\s*amount\s*\}\}/g, value).replace(/\{\{\s*amount_no_decimals\s*\}\}/g, Math.floor(cents / 100));
  }

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  // ---------- Site-wide toast ----------
  // Shows a top-right notification using [data-app-toast] from layout/theme.liquid.
  // Used by cart-add ("Added X to cart"), email-support copy, etc.
  // For wishlist-drawer messages we still use Wishlist.toast() and the
  // wishlist-page-scoped [data-wishlist-toast] element.
  var _toastTimer;
  function showToast(msg, opts) {
    var el = $('[data-app-toast]');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('is-muted', !!(opts && opts.muted));
    el.classList.add('is-visible');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function() { el.classList.remove('is-visible'); }, (opts && opts.duration) || 2400);
  }
  // Expose so inline Liquid handlers can call it (e.g. mailto button onclick).
  window.theme = window.theme || {};
  window.theme.toast = showToast;

  // v20 a11y (2026-05-27): shared focus management helpers used by every modal/drawer.
  // Each modal stores the previously-focused element, moves focus into the modal,
  // traps Tab/Shift+Tab while open, and restores focus when closed. Handles WCAG
  // 2.1.2 (No Keyboard Trap) + 2.4.3 (Focus Order) for the cart drawer, promo popup,
  // bundle-upsell popup, and image lightbox.
  function getFocusables(root) {
    if (!root) return [];
    var sel = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [contenteditable="true"]';
    return Array.from(root.querySelectorAll(sel)).filter(function(el) {
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
    });
  }
  function openModal(root, opts) {
    if (!root) return null;
    opts = opts || {};
    var previousActive = document.activeElement;
    var focusables = getFocusables(root);
    var firstTarget = opts.focusFirst || focusables[0] || root;
    if (firstTarget && firstTarget.focus) {
      setTimeout(function() { try { firstTarget.focus(); } catch (e) {} }, 50);
    }
    function onKeyDown(e) {
      if (e.key === 'Escape' && opts.onEscape) { opts.onEscape(); return; }
      if (e.key !== 'Tab') return;
      var nodes = getFocusables(root);
      if (nodes.length === 0) { e.preventDefault(); return; }
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    root.addEventListener('keydown', onKeyDown);
    return {
      release: function() {
        root.removeEventListener('keydown', onKeyDown);
        if (previousActive && previousActive.focus) {
          try { previousActive.focus(); } catch (e) {}
        }
      }
    };
  }


  // Delegated handler for any anchor with [data-app-mailto="…"]. We keep the
  // mailto: href so users WITH a default mail client still get the standard
  // prompt, but we ALSO copy the address to the clipboard and surface a
  // toast — so users without a mail client get visible feedback instead of
  // a button that looks dead.
  document.addEventListener('click', function(e) {
    var trigger = e.target.closest && e.target.closest('[data-app-mailto]');
    if (!trigger) return;
    var addr = trigger.getAttribute('data-app-mailto');
    if (!addr) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(addr).catch(function() {});
      }
    } catch (_) { /* clipboard blocked — fine */ }
    showToast('📧 ' + addr + ' (copied)');
    // Don't preventDefault — let the browser still try the mailto: handler.
  });

  // ---------- Cart Store ----------
  var Cart = {
    state: { item_count: 0, total_price: 0, items: [], note: '' },
    listeners: [],
    
    subscribe: function(fn) { this.listeners.push(fn); },
    notify: function() {
      var self = this;
      this.listeners.forEach(function(fn) { fn(self.state); });
    },
    
    fetch: function() {
      var self = this;
      return fetch('/cart.js', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          self.state = data;
          self.notify();
          return data;
        })
        .catch(function() {
          // Demo fallback when not on Shopify
          self.notify();
          return self.state;
        });
    },
    
    add: function(variantId, quantity) {
      var self = this;
      return fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: variantId, quantity: quantity || 1 })
      })
        .then(function(r) { return r.json(); })
        .then(function() { return self.fetch(); });
    },
    
    change: function(line, quantity) {
      var self = this;
      return fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ line: line, quantity: quantity })
      })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          self.state = data;
          self.notify();
          return data;
        });
    }
  };

  // ---------- Cart Drawer ----------
  function initCartDrawer() {
    var drawer = $('[data-cart-drawer]');
    var overlay = $('[data-cart-overlay]');
    if (!drawer) return;

    var cartTrap = null;
    function open() {
      drawer.classList.add('is-open');
      overlay.classList.add('is-open');
      document.body.classList.add('no-scroll');
      Cart.fetch();
      cartTrap = openModal(drawer, { onEscape: close, focusFirst: drawer.querySelector('[data-cart-close]') });
    }
    function close() {
      drawer.classList.remove('is-open');
      overlay.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
      if (cartTrap) { cartTrap.release(); cartTrap = null; }
    }

    $$('[data-cart-toggle]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        open();
      });
    });
    $$('[data-cart-close]').forEach(function(btn) {
      btn.addEventListener('click', close);
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') close();
    });

    // Listen for add-to-cart events.
    // Old behavior: auto-open the cart drawer the moment something was added.
    // New behavior: keep the drawer closed and surface a top-right toast so
    // the customer can keep shopping. They open the cart themselves via the
    // cart icon (which always shows the live item count).
    document.addEventListener('cart:added', function(e) {
      // Refresh the cart state (powers the count badge + drawer if opened later).
      Cart.fetch();
      var name = (e && e.detail && e.detail.product_title) || (e && e.detail && e.detail.title) || 'Item';
      showToast('Added ' + name + ' to cart 🛒');
    });
  }

  // ---------- Cart Renderer ----------
  function initCartRender() {
    Cart.subscribe(function(state) {
      // Update cart count
      $$('[data-cart-count]').forEach(function(el) {
        el.textContent = state.item_count || 0;
        el.setAttribute('data-count', state.item_count || 0);
      });

      // Update drawer body
      var body = $('[data-cart-body]');
      var footer = $('[data-cart-footer]');
      if (!body) return;

      if (!state.items || state.items.length === 0) {
        body.innerHTML = ''
          + '<div class="cart-drawer-empty">'
          + '<div class="icon">🐾</div>'
          + '<h3>Your pack is empty</h3>'
          + '<p>Add some goodies to spoil your furry friend.</p>'
          + '<a href="/collections/all" class="btn btn-primary mt-2">Start Shopping</a>'
          + '</div>';
        if (footer) footer.style.display = 'none';
        return;
      }

      if (footer) footer.style.display = 'block';

      var html = '';
      state.items.forEach(function(item, idx) {
        html += ''
          + '<div class="cart-item" data-line="' + (idx + 1) + '">'
          + '  <div class="cart-item-image"><img src="' + (item.image || '') + '" alt="' + item.title + '"></div>'
          + '  <div>'
          + '    <h4 class="cart-item-title">' + item.product_title + '</h4>'
          + (item.variant_title ? '    <div class="cart-item-variant">' + item.variant_title + '</div>' : '')
          + '    <div class="cart-item-controls">'
          + '      <button data-qty-change="-1" aria-label="Decrease">−</button>'
          + '      <span class="qty">' + item.quantity + '</span>'
          + '      <button data-qty-change="1" aria-label="Increase">+</button>'
          + '    </div>'
          + '  </div>'
          + '  <div>'
          + '    <div class="cart-item-price">' + formatMoney(item.final_line_price) + '</div>'
          + '    <button class="cart-item-remove" data-remove>Remove</button>'
          + '  </div>'
          + '</div>';
      });
      body.innerHTML = html;

      // Bind controls
      $$('.cart-item', body).forEach(function(itemEl) {
        var line = parseInt(itemEl.getAttribute('data-line'), 10);
        var item = state.items[line - 1];
        $$('[data-qty-change]', itemEl).forEach(function(btn) {
          btn.addEventListener('click', function() {
            var delta = parseInt(btn.getAttribute('data-qty-change'), 10);
            Cart.change(line, Math.max(0, item.quantity + delta));
          });
        });
        var rm = $('[data-remove]', itemEl);
        if (rm) rm.addEventListener('click', function() { Cart.change(line, 0); });
      });

      // Update subtotal
      var subtotal = $('[data-cart-subtotal]');
      if (subtotal) subtotal.textContent = formatMoney(state.total_price);

      // Update free shipping bar
      updateShippingBar(state.total_price);
    });
  }

  // ---------- Free Shipping Bar ----------
  function updateShippingBar(totalCents) {
    var threshold = (window.theme && window.theme.freeShippingThreshold) || 50;
    var thresholdCents = threshold * 100;
    var bar = $('[data-shipping-bar]');
    var fill = $('[data-shipping-fill]');
    var text = $('[data-shipping-text]');
    if (!bar) return;

    var pct = Math.min(100, (totalCents / thresholdCents) * 100);
    if (fill) fill.style.width = pct + '%';

    if (totalCents >= thresholdCents) {
      if (fill) fill.classList.add('is-complete');
      if (text) text.innerHTML = '🎉 You\'ve unlocked <strong>FREE SHIPPING!</strong>';
    } else {
      if (fill) fill.classList.remove('is-complete');
      var remaining = (thresholdCents - totalCents) / 100;
      if (text) text.innerHTML = 'Spend <strong>$' + remaining.toFixed(2) + '</strong> more for FREE shipping';
    }
  }

  // ---------- Promo Code (in cart drawer) ----------
  function initPromoCode() {
    // v19 (2026-05-26): the cart-drawer promo form used to validate against a hardcoded
    //   { WELCOME10, PETS15, FREESHIP, RESCUE20 } list and show "✓ Code accepted!" even
    //   though zero matching discount codes exist in Shopify admin (verified via
    //   codeDiscountNodes). That was a bait-and-switch: enter code → fake confirmation →
    //   no discount at checkout. We now show the truthful message that codes are entered
    //   at the Shopify checkout page itself. When the owner creates real Shopify discount
    //   codes, they will work natively at checkout without any client-side validation here.
    var form = $('[data-promo-form]');
    if (!form) return;
    var input = $('[data-promo-input]', form);
    var msg = $('[data-promo-message]');
    var applied = $('[data-promo-applied]');

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var code = (input.value || '').trim();
      if (!code) return;
      if (msg) {
        msg.className = 'promo-message';
        msg.textContent = 'Codes are entered at checkout. Copy your code and apply it on the next page.';
      }
      input.value = '';
    });

    if (applied) applied.style.display = 'none';
    // Clean up stale saved-code state from the old fake-validation flow.
    try { localStorage.removeItem('msPromoCode'); } catch (e) {}
  }

  // ---------- Promo Popup ----------
  function initPromoPopup() {
    var popup = $('[data-promo-popup]');
    if (!popup) return;
    if (!window.theme || !window.theme.promoEnabled) return;

    var dismissed = false;
    try { dismissed = localStorage.getItem('msPromoDismissed') === '1'; } catch(e) {}
    if (dismissed) return;

    var promoTrap = null;
    setTimeout(function() {
      popup.classList.add('is-open');
      document.body.classList.add('no-scroll');
      promoTrap = openModal(popup, { onEscape: close });
    }, 1500);

    function close() {
      popup.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
      if (promoTrap) { promoTrap.release(); promoTrap = null; }
      try { localStorage.setItem('msPromoDismissed', '1'); } catch(e) {}
    }

    $$('[data-promo-popup-close]').forEach(function(btn) {
      btn.addEventListener('click', close);
    });

    var copyBtn = $('[data-promo-copy]');
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        var code = window.theme.promoCode;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code);
        }
        copyBtn.textContent = 'Copied!';
        setTimeout(function() { copyBtn.textContent = 'Copy Code'; }, 2000);
      });
    }
  }

  // ---------- Wishlist ----------
  var Wishlist = {
    KEY: 'msWishlistV1',
    items: [],

    load: function() {
      try {
        var raw = localStorage.getItem(this.KEY);
        this.items = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(this.items)) this.items = [];
      } catch (e) { this.items = []; }
      return this.items;
    },
    save: function() {
      try { localStorage.setItem(this.KEY, JSON.stringify(this.items)); } catch (e) {}
      this.updateUI();
    },
    has: function(handle) {
      return this.items.some(function(it) { return it.handle === handle; });
    },
    add: function(item) {
      if (!item || !item.handle || this.has(item.handle)) return false;
      this.items.unshift(item);
      this.save();
      return true;
    },
    remove: function(handle) {
      var before = this.items.length;
      this.items = this.items.filter(function(it) { return it.handle !== handle; });
      if (this.items.length !== before) this.save();
    },
    clear: function() {
      this.items = [];
      this.save();
    },
    toggle: function(button) {
      var d = button.dataset;
      var handle = d.productHandle;
      if (!handle) return;
      if (this.has(handle)) {
        this.remove(handle);
      } else {
        this.add({
          handle: handle,
          title: d.productTitle || handle,
          vendor: d.productVendor || '',
          price: d.productPrice || '',
          priceCents: parseInt(d.productPriceCents, 10) || 0,
          url: d.productUrl || ('/products/' + handle),
          image: d.productImage || '',
          variantId: d.productVariantId || ''
        });
      }
    },

    // ---- DOM ----
    updateUI: function() {
      // 1) Header badge
      var counters = $$('[data-wishlist-count]');
      var n = this.items.length;
      counters.forEach(function(el) {
        el.textContent = n;
        el.setAttribute('data-count', n);
        if (n > 0) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
      });
      // 2) Heart visual state on every product card on the page
      var self = this;
      $$('[data-wishlist-toggle]').forEach(function(btn) {
        var handle = btn.dataset.productHandle;
        var active = self.has(handle);
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.setAttribute('aria-label', active ? 'Remove from wishlist' : 'Save to wishlist');
      });
      // 3) Wishlist page (only if mounted)
      this.renderPage();
    },

    renderPage: function() {
      var grid = $('[data-wishlist-grid]');
      if (!grid) return;
      var empty = $('[data-wishlist-empty]');
      var subtitle = $('[data-wishlist-subtitle]');
      var clearBtn = $('[data-wishlist-clear]');
      var addAllBtn = $('[data-wishlist-add-all]');

      grid.innerHTML = '';

      if (this.items.length === 0) {
        if (grid) grid.setAttribute('hidden', '');
        if (empty) empty.removeAttribute('hidden');
        if (clearBtn) clearBtn.setAttribute('hidden', '');
        if (addAllBtn) addAllBtn.setAttribute('hidden', '');
        if (subtitle) subtitle.textContent = 'Your wishlist is empty. Start tapping hearts!';
        return;
      }

      if (empty) empty.setAttribute('hidden', '');
      grid.removeAttribute('hidden');
      if (clearBtn) clearBtn.removeAttribute('hidden');
      if (addAllBtn) addAllBtn.removeAttribute('hidden');
      if (subtitle) subtitle.textContent = this.items.length + ' item' + (this.items.length === 1 ? '' : 's') + ' saved · ready to spoil your pup';

      var frag = document.createDocumentFragment();
      this.items.forEach(function(item) {
        var li = document.createElement('li');
        li.className = 'wishlist-card';
        li.setAttribute('data-wishlist-card', '');
        li.setAttribute('data-handle', item.handle);
        var hasImg = item.image && item.image.length > 0;
        li.innerHTML =
          '<a href="' + item.url + '" class="wishlist-card-media" data-testid="wishlist-card-media-' + item.handle + '">' +
            (hasImg
              ? '<img src="' + item.image + '" alt="' + item.title + '" loading="lazy">'
              : '<div class="wishlist-card-placeholder">🐾</div>') +
            '<button type="button" class="wishlist-card-remove" data-wishlist-remove="' + item.handle + '" aria-label="Remove from wishlist" data-testid="wishlist-remove-' + item.handle + '">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button>' +
          '</a>' +
          '<div class="wishlist-card-info">' +
            (item.vendor ? '<div class="wishlist-card-vendor">' + item.vendor + '</div>' : '') +
            '<a href="' + item.url + '" class="wishlist-card-title">' + item.title + '</a>' +
            '<div class="wishlist-card-price">' + (item.price || '') + '</div>' +
            '<button type="button" class="btn btn-primary btn-block wishlist-card-add" data-wishlist-add data-variant-id="' + item.variantId + '" data-handle="' + item.handle + '" data-testid="wishlist-add-' + item.handle + '">🛒 Add to cart</button>' +
          '</div>';
        frag.appendChild(li);
      });
      grid.appendChild(frag);
    },

    toast: function(msg) {
      var el = $('[data-wishlist-toast]');
      if (!el) return;
      el.textContent = msg;
      el.classList.add('is-visible');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(function() { el.classList.remove('is-visible'); }, 2000);
    }
  };

  function initWishlist() {
    Wishlist.load();
    Wishlist.updateUI();

    // Heart toggle (event delegation, works for cards re-rendered later too)
    document.addEventListener('click', function(e) {
      var heart = e.target.closest && e.target.closest('[data-wishlist-toggle]');
      if (heart) {
        e.preventDefault();
        e.stopPropagation();
        var was = Wishlist.has(heart.dataset.productHandle);
        Wishlist.toggle(heart);
        Wishlist.toast(was ? 'Removed from wishlist' : 'Saved to wishlist ❤');
        return;
      }
      var removeBtn = e.target.closest && e.target.closest('[data-wishlist-remove]');
      if (removeBtn) {
        e.preventDefault();
        Wishlist.remove(removeBtn.getAttribute('data-wishlist-remove'));
        Wishlist.toast('Removed from wishlist');
        return;
      }
      var addBtn = e.target.closest && e.target.closest('[data-wishlist-add]');
      if (addBtn) {
        e.preventDefault();
        var variantId = addBtn.getAttribute('data-variant-id');
        var handle = addBtn.getAttribute('data-handle');
        if (!variantId) {
          Wishlist.toast('Could not add. No variant on file');
          return;
        }
        addBtn.disabled = true;
        var original = addBtn.innerHTML;
        addBtn.innerHTML = 'Adding…';
        Cart.add(variantId, 1).then(function() {
          addBtn.innerHTML = '✓ Added';
          Wishlist.toast('Added to cart');
          // open cart drawer if available
          var drawer = $('[data-cart-drawer]');
          if (drawer) drawer.classList.add('is-open');
          var overlay = $('[data-cart-overlay]');
          if (overlay) overlay.classList.add('is-open');
          document.body.classList.add('no-scroll');
          setTimeout(function() { addBtn.innerHTML = original; addBtn.disabled = false; }, 1500);
        }).catch(function() {
          addBtn.innerHTML = original;
          addBtn.disabled = false;
          Wishlist.toast('Could not add to cart');
        });
        return;
      }
    });

    // Clear wishlist
    var clearBtn = $('[data-wishlist-clear]');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        if (Wishlist.items.length === 0) return;
        if (!confirm('Clear all ' + Wishlist.items.length + ' item' + (Wishlist.items.length === 1 ? '' : 's') + ' from your wishlist?')) return;
        Wishlist.clear();
        Wishlist.toast('Wishlist cleared');
      });
    }

    // Add all to cart
    var addAllBtn = $('[data-wishlist-add-all]');
    if (addAllBtn) {
      addAllBtn.addEventListener('click', function() {
        if (Wishlist.items.length === 0) return;
        addAllBtn.disabled = true;
        var original = addAllBtn.innerHTML;
        addAllBtn.innerHTML = 'Adding…';
        var queue = Wishlist.items.slice().filter(function(it) { return it.variantId; });
        function next() {
          if (queue.length === 0) {
            addAllBtn.innerHTML = '✓ All added';
            Wishlist.toast('Everything added to cart');
            var drawer = $('[data-cart-drawer]');
            if (drawer) drawer.classList.add('is-open');
            var overlay = $('[data-cart-overlay]');
            if (overlay) overlay.classList.add('is-open');
            document.body.classList.add('no-scroll');
            setTimeout(function() { addAllBtn.innerHTML = original; addAllBtn.disabled = false; }, 1500);
            return;
          }
          var item = queue.shift();
          Cart.add(item.variantId, 1).then(next).catch(next);
        }
        next();
      });
    }
  }

  // Expose for debugging / inline handlers in templates
  window.MollyWishlist = Wishlist;

  // ---------- Bundle Upsell Popup (intercepts cart-drawer checkout) ----------
  function initBundleUpsell() {
    var popup = $('[data-bundle-upsell-popup]');
    if (!popup) return;
    if (!window.theme || !window.theme.bundleUpsellEnabled) return;

    var bypass = false;
    var checkoutForm = null;

    var upsellTrap = null;
    function open() {
      popup.classList.add('is-open');
      popup.setAttribute('aria-hidden', 'false');
      document.body.classList.add('no-scroll');
      upsellTrap = openModal(popup, { onEscape: close });
    }
    function close() {
      popup.classList.remove('is-open');
      popup.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll');
      if (upsellTrap) { upsellTrap.release(); upsellTrap = null; }
    }
    function proceedToCheckout() {
      bypass = true;
      close();
      // give the close transition a moment, then submit the original form
      setTimeout(function() {
        if (checkoutForm) {
          checkoutForm.submit();
        } else {
          window.location.href = '/checkout';
        }
      }, 200);
    }

    // Intercept any checkout button submission inside the cart drawer
    document.addEventListener('submit', function(e) {
      var form = e.target;
      if (!form || !form.matches) return;
      if (!form.querySelector('[name="checkout"]')) return;
      if (bypass) return;
      // skip popup if already shown this session
      var skipped = false;
      try { skipped = sessionStorage.getItem('msBundleUpsellSeen') === '1'; } catch(err) {}
      if (skipped) return;
      // skip popup on empty cart
      var countEl = $('[data-cart-count]');
      if (countEl && parseInt(countEl.textContent, 10) === 0) return;

      e.preventDefault();
      checkoutForm = form;
      try { sessionStorage.setItem('msBundleUpsellSeen', '1'); } catch(err) {}
      open();
    }, true);

    $$('[data-bundle-upsell-close]').forEach(function(btn) {
      btn.addEventListener('click', close);
    });
    $$('[data-bundle-upsell-skip]').forEach(function(btn) {
      btn.addEventListener('click', proceedToCheckout);
    });

    // Add the upsell items to cart, then proceed
    var addBtn = $('[data-bundle-upsell-add]');
    if (addBtn) {
      addBtn.addEventListener('click', function() {
        addBtn.disabled = true;
        addBtn.textContent = 'Adding…';
        // Ideal: POST to /cart/add.js with the configured variant ids.
        // Here we just proceed — merchant wires up specific products via metafields.
        setTimeout(proceedToCheckout, 400);
      });
    }

    // Close on outer-overlay click
    popup.addEventListener('click', function(e) {
      if (e.target === popup) close();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && popup.classList.contains('is-open')) close();
    });
  }

  // ---------- Mobile Nav ----------
  function initMobileNav() {
    var nav = $('[data-mobile-nav]');
    var overlay = $('[data-mobile-nav-overlay]');
    if (!nav) return;

    function open() {
      nav.classList.add('is-open');
      if (overlay) overlay.classList.add('is-open');
      document.body.classList.add('no-scroll');
    }
    function close() {
      nav.classList.remove('is-open');
      if (overlay) overlay.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
    }

    $$('[data-mobile-nav-toggle]').forEach(function(btn) { btn.addEventListener('click', open); });
    $$('[data-mobile-nav-close]').forEach(function(btn) { btn.addEventListener('click', close); });
    if (overlay) overlay.addEventListener('click', close);
  }

  // ---------- Add to Cart Form ----------
  function initAddToCartForms() {
    $$('form[action="/cart/add"]').forEach(function(form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        var formData = new FormData(form);
        var btn = form.querySelector('[type="submit"]');
        var originalText = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Adding...'; }

        fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          credentials: 'same-origin',
          body: formData
        })
          .then(function(r) { return r.json(); })
          .then(function(added) {
            // Pass the product info through to the cart:added listener so
            // the toast can name the item ("Added Salmon Soft Treats to cart").
            return Cart.fetch().then(function() { return added; });
          })
          .then(function(added) {
            if (btn) { btn.disabled = false; btn.textContent = '✓ Added!'; }
            setTimeout(function() { if (btn) btn.textContent = originalText; }, 1500);
            document.dispatchEvent(new CustomEvent('cart:added', { detail: added || {} }));
          })
          .catch(function() {
            if (btn) { btn.disabled = false; btn.textContent = originalText; }
          });
      });
    });
  }

  // ---------- Product Page Gallery ----------
  function initProductGallery() {
    var thumbs = $$('[data-product-thumb]');
    var main = $('[data-product-main-img]');
    if (!main || thumbs.length === 0) return;

    thumbs.forEach(function(thumb) {
      thumb.addEventListener('click', function() {
        thumbs.forEach(function(t) { t.classList.remove('is-active'); });
        thumb.classList.add('is-active');
        var src = thumb.getAttribute('data-img');
        if (src) main.src = src;
      });
    });
  }

  // ---------- Product Variants ----------
  function initProductOptions() {
    $$('[data-option-value]').forEach(function(el) {
      el.addEventListener('click', function() {
        var group = el.getAttribute('data-option-group');
        $$('[data-option-group="' + group + '"]').forEach(function(o) { o.classList.remove('is-active'); });
        el.classList.add('is-active');
      });
    });
  }

  // ---------- Scroll reveal ----------
  function initScrollReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || els.length === 0) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  // ---------- Image lightbox ----------
  function initLightbox() {
    var triggers = $$('[data-lightbox]');
    if (triggers.length === 0) return;
    var box = document.createElement('div');
    box.className = 'image-lightbox';
    box.setAttribute('data-image-lightbox', '');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Product image preview');
    box.innerHTML = '<button class="image-lightbox-close" aria-label="Close image preview">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '<img alt="" />';
    document.body.appendChild(box);
    var img = box.querySelector('img');

    var lightboxTrap = null;
    function open(src, srcAlt) {
      img.src = src;
      img.alt = srcAlt || '';
      box.classList.add('is-open');
      document.body.classList.add('no-scroll');
      lightboxTrap = openModal(box, { onEscape: close });
    }
    function close() {
      box.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
      if (lightboxTrap) { lightboxTrap.release(); lightboxTrap = null; }
    }
    triggers.forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        var src = t.getAttribute('data-lightbox') || (t.querySelector('img') && t.querySelector('img').src);
        var triggerImg = t.querySelector('img');
        var alt = triggerImg ? (triggerImg.alt || triggerImg.getAttribute('alt') || '') : '';
        if (src) open(src, alt);
      });
    });
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.closest('.image-lightbox-close')) close();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', function() {
    initCartDrawer();
    initCartRender();
    initPromoCode();
    initPromoPopup();
    initBundleUpsell();
    initWishlist();
    initMobileNav();
    initAddToCartForms();
    initProductGallery();
    initProductOptions();
    initScrollReveal();
    initLightbox();
    Cart.fetch();
  });

  // Expose for debugging
  window.MollyAndSophie = { Cart: Cart };
})();
