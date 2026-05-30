/* SnagNest — motion + interaction layer (vanilla, framework-free)
   Motion + components adapted from 21st.dev patterns (like-button burst,
   gallery lightbox). Progressive enhancement; respects reduced-motion. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function icon(href, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '"><use href="' + href + '"/></svg>'; }

  /* ---- focus + scroll-lock helpers (one source of truth) ---- */
  var lastFocus = null;
  function lockBody(on) { document.body.style.overflow = on ? 'hidden' : ''; }
  function remember() { lastFocus = document.activeElement; }
  function restoreFocus() { try { lastFocus && lastFocus.focus && lastFocus.focus(); } catch (e) {} lastFocus = null; }

  /* ---------- shared icon sprite ---------- */
  function injectSprite() {
    if (document.getElementById('nest-sprite')) return;
    fetch('assets/sprite.svg?v=21').then(function (r) { return r.text(); }).then(function (svg) {
      var holder = document.createElement('div');
      holder.id = 'nest-sprite';
      holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      holder.innerHTML = svg;
      document.body.insertBefore(holder, document.body.firstChild);
    }).catch(function () {});
  }

  /* ---------- shared chrome ---------- */
  function injectChrome() {
    var el = document.createElement('div');
    el.innerHTML =
      '<div class="toasts" id="toasts" aria-live="polite"></div>' +
      '<div class="cartdrawer" data-cart-drawer><div class="cd-panel" role="dialog" aria-label="Cart" aria-modal="true">' +
        '<div class="cd-head"><h3>Your nest</h3><button class="cd-close" data-cart-close aria-label="Close cart">' + icon('#ic-close') + '</button></div>' +
        '<div class="cd-items" data-cart-items></div>' +
        '<div class="cd-foot"><div class="cd-sub"><span>Subtotal</span><b data-cart-subtotal>$0</b></div>' +
        '<button class="btn btn-honey btn-block btn-lg" data-checkout>Checkout</button></div>' +
      '</div></div>' +
      '<div class="searchsheet" data-search-sheet role="dialog" aria-label="Search">' +
        '<div class="inner">' + icon('#ic-search') + '<input type="search" placeholder="Search the nest for clever finds..." aria-label="Search" data-search-input>' +
        '<button data-search-close aria-label="Close search">' + icon('#ic-close') + '</button></div>' +
        '<div class="search-results" data-search-results></div></div>';
    document.body.appendChild(el);
  }

  function toast(msg, ic) {
    var box = $('#toasts'); if (!box) return;
    var t = document.createElement('div');
    t.className = 'toast'; t.innerHTML = (ic ? icon(ic) : '') + '<span>' + msg + '</span>';
    box.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 320); }, 2200);
  }

  /* ---------- scroll reveal ---------- */
  function setupReveal() {
    var els = $$('[data-reveal]'); if (!els.length) return;
    $$('[data-reveal-group]').forEach(function (group) {
      $$(':scope > [data-reveal]', group).forEach(function (el, i) { el.style.setProperty('--i', i); });
    });
    if (reduce) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    var pending = els;
    function check() {
      var trigger = window.innerHeight * 0.9;
      pending = pending.filter(function (el) {
        if (el.getBoundingClientRect().top < trigger) { el.classList.add('in'); return false; }
        return true;
      });
      if (!pending.length) { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); }
    }
    var ticking = false;
    function onScroll() { if (ticking) return; ticking = true; requestAnimationFrame(function () { ticking = false; check(); }); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    requestAnimationFrame(function () { requestAnimationFrame(check); });
  }

  /* ---------- header shadow ---------- */
  function setupHeader() {
    var h = $('.site-header'); if (!h) return;
    var fn = function () { h.classList.toggle('scrolled', window.scrollY > 8); };
    fn(); window.addEventListener('scroll', fn, { passive: true });
  }

  /* ---------- seamless marquee ----------
     CSS animates the track by -50%; that only loops without a gap if each
     half is at least as wide as the viewport. So we widen one base group
     until it exceeds the ribbon, then duplicate it. Speed is held constant
     (px/sec) regardless of how wide the group ends up. */
  function setupMarquee() {
    var track = $('[data-marquee]'); if (!track || reduce) return;
    var ribbon = track.parentElement;
    var baseHTML = track.innerHTML;            // one logical set of items
    var rebuilding = false;
    function build() {
      track.style.animation = 'none';          // measure without transform
      track.innerHTML = baseHTML;
      var group = baseHTML;
      var guard = 0;
      while (track.scrollWidth < ribbon.offsetWidth && guard++ < 40) {
        track.insertAdjacentHTML('beforeend', baseHTML);
        group = track.innerHTML;
      }
      var groupW = track.scrollWidth;          // width of one group (>= viewport)
      track.innerHTML = group + group;         // two identical halves => seamless at -50%
      void track.offsetWidth;                  // reflow so the restart takes
      var dur = Math.max(18, groupW / 70);     // ~70px per second, steady speed
      track.style.animation = 'marquee ' + dur.toFixed(1) + 's linear infinite';
    }
    build();
    var t;
    window.addEventListener('resize', function () {
      if (rebuilding) return; rebuilding = true;
      clearTimeout(t);
      t = setTimeout(function () { rebuilding = false; build(); }, 200);
    });
  }

  /* ---------- mobile nav drawer ---------- */
  function setupDrawer() {
    var toggle = $('[data-drawer-toggle]'), drawer = $('[data-drawer]');
    if (!toggle || !drawer) return;
    function set(open) {
      drawer.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      lockBody(open); if (open) remember(); else restoreFocus();
    }
    toggle.addEventListener('click', function () { set(!drawer.classList.contains('open')); });
    drawer.addEventListener('click', function (e) {
      if (e.target === drawer || e.target.closest('[data-drawer-close], a')) set(false);
    });
  }

  /* ---------- wishlist (persisted in localStorage) ---------- */
  function picon(href, cls) { return '<svg class="pi' + (cls ? ' ' + cls : '') + '"><use href="' + href + '"/></svg>'; }
  var WL_KEY = 'snagnest_wishlist';
  function wlGet() { try { return JSON.parse(localStorage.getItem(WL_KEY)) || []; } catch (e) { return []; } }
  function wlSet(a) { try { localStorage.setItem(WL_KEY, JSON.stringify(a)); } catch (e) {} updateWlBadge(); }
  function wlHas(name) { return wlGet().some(function (i) { return i.name === name; }); }
  function wlToggle(item) {
    var a = wlGet(), idx = -1;
    a.forEach(function (x, k) { if (x.name === item.name) idx = k; });
    if (idx >= 0) { a.splice(idx, 1); wlSet(a); return false; }
    a.push(item); wlSet(a); return true;
  }
  function updateWlBadge() {
    var n = wlGet().length;
    $$('[data-wishlist-count]').forEach(function (el) { el.textContent = String(n); el.hidden = n === 0; });
  }
  function cardData(card) {
    if (!card) return null;
    var u = $('.prod .pi use', card) || $('.prod use', card);
    return {
      name: ($('.ttl', card) ? $('.ttl', card).textContent : 'Item').trim(),
      price: priceOf($('.price', card) ? $('.price', card).textContent : ''),
      icon: u ? u.getAttribute('href') : '#pr-tray',
      url: card.getAttribute('href') || 'product.html'
    };
  }
  var wlRender = null; // wishlist page registers its renderer here
  function setupHearts() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.heart'); if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      var card = btn.closest('.pcard');
      var item = cardData(card) || { name: 'Item', price: 0, icon: '#pr-tray', url: 'product.html' };
      var on = wlToggle(item);
      btn.classList.toggle('is-fav', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var use = $('use', btn); if (use) use.setAttribute('href', on ? '#ic-heart-fill' : '#ic-heart');
      if (!reduce) { btn.classList.remove('pop', 'burst'); void btn.offsetWidth; btn.classList.add('pop'); if (on) btn.classList.add('burst'); }
      toast(on ? 'Saved ' + item.name + ' to wishlist' : 'Removed from wishlist', on ? '#ic-heart-fill' : '#ic-heart');
      if (wlRender && card && card.closest('[data-wishlist-grid]')) setTimeout(wlRender, on ? 0 : 260);
    });
    syncHearts();
    updateWlBadge();
  }
  function syncHearts() {
    $$('.pcard .heart').forEach(function (btn) {
      var item = cardData(btn.closest('.pcard')); if (!item) return;
      var on = wlHas(item.name);
      btn.classList.toggle('is-fav', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var use = $('use', btn); if (use) use.setAttribute('href', on ? '#ic-heart-fill' : '#ic-heart');
    });
  }

  /* ---------- wishlist page ---------- */
  function setupWishlist() {
    var grid = $('[data-wishlist-grid]'); if (!grid) return;
    var empty = $('[data-wishlist-empty]'), count = $('[data-wishlist-meta]');
    function render() {
      var items = wlGet();
      if (!items.length) {
        grid.innerHTML = ''; grid.style.display = 'none';
        if (empty) empty.style.display = ''; if (count) count.style.display = 'none';
        return;
      }
      grid.style.display = ''; if (empty) empty.style.display = 'none';
      if (count) { count.style.display = ''; count.textContent = items.length + ' saved find' + (items.length > 1 ? 's' : ''); }
      grid.innerHTML = items.map(function (i) {
        return '<a class="pcard" href="' + (i.url || 'product.html') + '" data-reveal>' +
          '<div class="pimg"><button class="heart is-fav" aria-label="Remove from wishlist" aria-pressed="true">' + icon('#ic-heart-fill') + '</button>' +
          '<div class="prod">' + picon(i.icon) + '</div></div>' +
          '<div class="pb"><div class="ttl">' + i.name + '</div>' +
          '<div class="row2"><span class="price">$' + i.price + '</span>' +
          '<button class="add" data-add data-added-label="Added">Add</button></div></div></a>';
      }).join('');
      $$('[data-reveal]', grid).forEach(function (el) { el.classList.add('in'); });
    }
    wlRender = render;
    render();
  }

  /* ---------- cart ---------- */
  var cart = [];
  function money(n) { return '$' + n; }
  function priceOf(text) { var m = (text || '').match(/\$(\d+(\.\d+)?)/); return m ? parseFloat(m[1]) : 0; }
  function renderCart() {
    var box = $('[data-cart-items]'); if (!box) return;
    var qty = cart.reduce(function (s, i) { return s + i.qty; }, 0);
    var sub = cart.reduce(function (s, i) { return s + i.qty * i.price; }, 0);
    $$('[data-cart-count]').forEach(function (el) { el.textContent = String(qty); el.hidden = qty === 0; });
    var st = $('[data-cart-subtotal]'); if (st) st.textContent = money(sub);
    if (!cart.length) { box.innerHTML = '<div class="cd-empty">Your nest is empty. Go snag something clever.</div>'; return; }
    box.innerHTML = cart.map(function (i, idx) {
      return '<div class="cd-item"><div class="cd-thumb">' + icon(i.icon) + '</div>' +
        '<div class="cd-info"><b>' + i.name + '</b><span>Qty ' + i.qty + ' &middot; ' + money(i.price) + '</span></div>' +
        '<button class="cd-rm" data-cart-rm="' + idx + '" aria-label="Remove ' + i.name + '">' + icon('#ic-close') + '</button></div>';
    }).join('');
  }
  function addToCart(item) {
    var existing = cart.filter(function (i) { return i.name === item.name; })[0];
    if (existing) existing.qty += item.qty; else cart.push(item);
    renderCart();
    $$('[data-cart]').forEach(function (el) { if (!reduce) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } });
  }
  function openCart(open) {
    var d = $('[data-cart-drawer]'); if (!d) return;
    if (open) remember();
    d.classList.toggle('open', open); lockBody(open);
    if (open) { var c = $('[data-cart-close]', d); c && c.focus(); } else restoreFocus();
  }
  function setupCart() {
    document.addEventListener('click', function (e) {
      var add = e.target.closest && e.target.closest('[data-add]'); if (!add) return;
      e.preventDefault(); e.stopPropagation();
      var name = 'Item', price = 0, ic = '#pr-tray', qty = 1;
      var card = add.closest('.pcard');
      if (card) {
        if ($('.ttl', card)) name = $('.ttl', card).textContent;
        price = priceOf($('.price', card) ? $('.price', card).textContent : '');
        var u = $('.prod .pi use', card); if (u) ic = u.getAttribute('href');
      } else {
        var bb = $('.buybox');
        if (bb) {
          if ($('h1', bb)) name = $('h1', bb).textContent;
          price = priceOf($('.priceline .price', bb) ? $('.priceline .price', bb).textContent : '');
          var q = $('.qty input', bb); if (q) qty = Math.max(1, parseInt(q.value, 10) || 1);
        }
        var gu = $('[data-gallery-main] .pi use'); if (gu) ic = gu.getAttribute('href');
      }
      addToCart({ name: name.trim(), price: price, icon: ic, qty: qty });
      toast('Added ' + name.trim() + ' to cart', '#ic-check');
      var label = add.getAttribute('data-added-label');
      if (label != null) { var o = add.innerHTML; add.textContent = label; setTimeout(function () { add.innerHTML = o; }, 1300); }
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-cart]')) { e.preventDefault(); openCart(true); }
      else if (e.target.closest('[data-cart-close]') || e.target.matches('[data-cart-drawer]')) openCart(false);
      var rm = e.target.closest('[data-cart-rm]');
      if (rm) { cart.splice(+rm.getAttribute('data-cart-rm'), 1); renderCart(); }
      if (e.target.closest('[data-checkout]') && cart.length) toast('Checkout is a demo for now', '#ic-bag');
    });
    renderCart();
  }

  /* ---------- product catalog (for live search) ---------- */
  var PRODUCTS = [
    { n: 'Drawer Tamer Tray', d: 'Ends junk-drawer chaos', p: 16, i: '#pr-tray', c: 'Tidy & organize' },
    { n: 'Quiet Mini Heater', d: 'Desk-side warmth, no hum', p: 24, i: '#pr-heater', c: 'Cozy home' },
    { n: 'Magnetic Cord Keeper', d: 'Six cables, one tidy strip', p: 12, i: '#pr-cord', c: 'Little fixes' },
    { n: 'Sink Caddy Pro', d: 'Keeps the sink edge dry', p: 18, i: '#pr-sink', c: 'Tidy & organize' },
    { n: 'Cabinet Shelf Risers', d: 'Doubles any cupboard', p: 21, i: '#pr-riser', c: 'Tidy & organize' },
    { n: 'Compression Packing Cubes', d: 'Pack half the space', p: 29, i: '#pr-cubes', c: 'On the go' },
    { n: 'No-Slip Rug Grips', d: 'Corners that stay put', p: 14, i: '#pr-rug', c: 'Little fixes' },
    { n: 'Self-Warming Mug', d: 'Last sip as warm as the first', p: 34, i: '#pr-mug', c: 'Cozy home' },
    { n: 'Cable Clip Set', d: 'Desktop cords, corralled', p: 11, i: '#pr-clip', c: 'Little fixes' },
    { n: 'Fold-Flat Travel Kettle', d: 'Hot water anywhere', p: 39, i: '#pr-heater', c: 'On the go' },
    { n: 'Under-Shelf Basket', d: 'Found storage, instantly', p: 15, i: '#pr-riser', c: 'Tidy & organize' },
    { n: 'Cozy Knit Throw', d: 'The one you fight over', p: 42, i: '#pr-mug', c: 'Cozy home' }
  ];

  /* ---------- search sheet (live results) ---------- */
  function setupSearch() {
    var sheet = $('[data-search-sheet]'); if (!sheet) return;
    var inp = $('[data-search-input]', sheet);
    var box = $('[data-search-results]', sheet);
    var TAGS = ['Tidy & organize', 'Cozy home', 'On the go', 'Little fixes'];
    function srItem(p) {
      return '<a class="sr-item" href="' + (p.u || 'product.html') + '"><span class="sr-img">' + picon(p.i) + '</span>' +
        '<span class="sr-meta"><span class="sr-n">' + p.n + '</span><span class="sr-d">' + p.d + '</span></span>' +
        '<span class="sr-p">$' + p.p + '</span></a>';
    }
    function render(q) {
      if (!box) return;
      q = (q || '').trim().toLowerCase();
      if (!q) {
        box.innerHTML = '<div class="sr-tags">' + TAGS.map(function (t) { return '<a href="collection.html">' + t + '</a>'; }).join('') +
          '</div><div class="sr-head">Popular right now</div>' + PRODUCTS.slice(0, 4).map(srItem).join('');
      } else {
        var res = PRODUCTS.filter(function (p) { return (p.n + ' ' + p.d + ' ' + p.c).toLowerCase().indexOf(q) > -1; });
        var qe = q.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
        if (!res.length) box.innerHTML = '<div class="sr-empty">No finds match &ldquo;' + qe + '&rdquo; yet. Try &ldquo;tidy&rdquo;, &ldquo;cozy&rdquo;, or &ldquo;travel&rdquo;.</div>';
        else box.innerHTML = '<div class="sr-head">' + res.length + ' find' + (res.length > 1 ? 's' : '') + '</div>' + res.slice(0, 7).map(srItem).join('');
      }
      cur = -1;
    }
    var cur = -1;
    function items() { return $$('.sr-item', box); }
    function highlight(d) {
      var list = items(); if (!list.length) return;
      list.forEach(function (el) { el.classList.remove('cur'); });
      cur = (cur + d + list.length) % list.length;
      list[cur].classList.add('cur'); list[cur].scrollIntoView({ block: 'nearest' });
    }
    function open(o) {
      if (o) { remember(); render(''); }
      sheet.classList.toggle('open', o); lockBody(o);
      if (o) { inp && (inp.value = '', inp.focus()); } else restoreFocus();
    }
    document.addEventListener('click', function (e) {
      if (e.target.closest('.iconbtn.search')) { e.preventDefault(); open(true); return; }
      if (e.target.closest('[data-search-close]')) { open(false); return; }
      if (sheet.classList.contains('open') && !e.target.closest('[data-search-sheet]') && !e.target.closest('.iconbtn.search')) open(false);
    });
    inp && inp.addEventListener('input', function () { render(inp.value); });
    inp && inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); highlight(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(-1); }
      else if (e.key === 'Enter') {
        var list = items();
        if (cur >= 0 && list[cur]) window.location.href = list[cur].getAttribute('href');
        else if (list[0]) window.location.href = list[0].getAttribute('href');
      }
    });
  }

  /* ---------- PDP gallery + lightbox ---------- */
  function setupGallery() {
    var gal = $('[data-gallery]'); if (!gal) return;
    var thumbs = $$('.thumb', gal), main = $('[data-gallery-main] .pi use', gal), mainBox = $('[data-gallery-main]', gal);
    var imgs = thumbs.map(function (t) { return t.getAttribute('data-img'); });
    var cur = 0;
    function setMain(i, animate) {
      cur = (i + imgs.length) % imgs.length;
      thumbs.forEach(function (t, j) { t.classList.toggle('active', j === cur); });
      if (animate && !reduce) { mainBox.classList.add('swapping'); setTimeout(function () { main.setAttribute('href', imgs[cur]); mainBox.classList.remove('swapping'); }, 200); }
      else main.setAttribute('href', imgs[cur]);
    }
    thumbs.forEach(function (t, i) { t.addEventListener('click', function () { setMain(i, true); }); });

    var lb = document.createElement('div');
    lb.className = 'lightbox'; lb.setAttribute('data-lightbox', '');
    lb.innerHTML = '<button class="lb-close" data-lb-close aria-label="Close">' + icon('#ic-close') + '</button>' +
      '<button class="lb-nav lb-prev" data-lb-prev aria-label="Previous">' + icon('#ic-arrow') + '</button>' +
      '<div class="lb-stage"><svg class="pi"><use href="' + imgs[0] + '"/></svg></div>' +
      '<button class="lb-nav lb-next" data-lb-next aria-label="Next">' + icon('#ic-arrow') + '</button>' +
      '<div class="lb-counter"><span data-lb-i>1</span> / ' + imgs.length + '</div>';
    document.body.appendChild(lb);
    var lbUse = $('.lb-stage .pi use', lb), lbStage = $('.lb-stage', lb), lbI = $('[data-lb-i]', lb);
    function lbShow(i) {
      cur = (i + imgs.length) % imgs.length; lbI.textContent = String(cur + 1);
      thumbs.forEach(function (t, j) { t.classList.toggle('active', j === cur); });
      main.setAttribute('href', imgs[cur]);
      if (!reduce) { lbStage.classList.add('swapping'); setTimeout(function () { lbUse.setAttribute('href', imgs[cur]); lbStage.classList.remove('swapping'); }, 160); }
      else lbUse.setAttribute('href', imgs[cur]);
    }
    function lbOpen(o) {
      if (o) remember();
      lb.classList.toggle('open', o); lockBody(o);
      if (o) { var c = $('[data-lb-close]', lb); c && c.focus(); } else restoreFocus();
    }
    mainBox.addEventListener('click', function () { lbShow(cur); lbOpen(true); });
    mainBox.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); lbShow(cur); lbOpen(true); }
    });
    lb.addEventListener('click', function (e) {
      if (e.target.closest('[data-lb-close]') || e.target === lb) lbOpen(false);
      else if (e.target.closest('[data-lb-prev]')) lbShow(cur - 1);
      else if (e.target.closest('[data-lb-next]')) lbShow(cur + 1);
    });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'ArrowLeft') lbShow(cur - 1);
      else if (e.key === 'ArrowRight') lbShow(cur + 1);
    });
  }

  /* ---------- sticky PDP buy bar (shows when primary ATC scrolls away) ---------- */
  function setupStickyBuy() {
    var bar = $('.sticky-buy'), anchor = $('[data-atc-anchor]');
    if (!bar || !anchor || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { bar.classList.toggle('show', !e.isIntersecting && e.boundingClientRect.top < 0); });
    }, { threshold: 0 });
    io.observe(anchor);
  }

  /* ---------- FAQ accordion ---------- */
  function setupFaq() {
    $$('.qa-q').forEach(function (q) {
      q.addEventListener('click', function () {
        var item = q.closest('.qa'), isOpen = item.classList.contains('open');
        $$('.qa.open').forEach(function (o) { if (o !== item) { o.classList.remove('open'); var b = $('.qa-q', o); b && b.setAttribute('aria-expanded', 'false'); } });
        item.classList.toggle('open', !isOpen);
        q.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
      });
    });
  }

  /* ---------- PDP qty ---------- */
  function setupQty() {
    $$('.qty').forEach(function (qel) {
      var input = $('input', qel);
      qel.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b || !input) return;
        var v = parseInt(input.value, 10) || 1; v += (b.dataset.step === 'up' ? 1 : -1);
        input.value = Math.max(1, v);
      });
      if (input) {
        input.addEventListener('input', function () { input.value = input.value.replace(/[^0-9]/g, ''); });
        input.addEventListener('blur', function () { var v = parseInt(input.value, 10); input.value = (!v || v < 1) ? 1 : v; });
      }
    });
  }

  /* ---------- swatches ---------- */
  function setupSelectable() {
    $$('[data-select-group]').forEach(function (group) {
      group.addEventListener('click', function (e) {
        var opt = e.target.closest('.swatch'); if (!opt) return;
        $$('.swatch', group).forEach(function (o) { o.classList.remove('active'); });
        opt.classList.add('active');
      });
    });
  }

  /* ---------- collection: filter + sort + load more + mobile filter sheet ---------- */
  function setupCollection() {
    var grid = $('[data-grid]'); if (!grid) return;
    var allCards = $$('.pcard', grid);
    var pills = $$('[data-cat-pill]');
    var sortSel = $('[data-sort]');
    var countEl = $('[data-count]');
    var empty = $('.coll-empty', grid);
    var activeCat = 'all';

    function checked(name) { return $$('input[data-f="' + name + '"]:checked').map(function (c) { return c.value; }); }
    function apply() {
      var prices = checked('price'), solves = checked('solve'), ratings = checked('rating'), badges = checked('badge');
      var shown = 0;
      allCards.forEach(function (c) {
        if (c.classList.contains('is-hidden')) return;
        var cat = c.getAttribute('data-cat'), price = +c.getAttribute('data-price'),
            rating = +c.getAttribute('data-rating'), badge = c.getAttribute('data-badge') || '';
        var ok = true;
        if (activeCat !== 'all' && cat !== activeCat) ok = false;
        if (ok && solves.length && solves.indexOf(cat) < 0) ok = false;
        if (ok && prices.length) ok = prices.some(function (p) {
          if (p === 'u15') return price < 15; if (p === '15-30') return price >= 15 && price <= 30;
          if (p === '30-50') return price > 30 && price <= 50; if (p === 'o50') return price > 50; return true;
        });
        if (ok && ratings.length) ok = ratings.some(function (r) { return rating >= parseFloat(r); });
        if (ok && badges.length) ok = badges.indexOf(badge) >= 0;
        c.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      if (empty) empty.classList.toggle('show', shown === 0);
      if (countEl) countEl.textContent = 'Showing ' + shown + ' of ' + allCards.length + ' finds';
    }
    function sort(mode) {
      var visible = allCards.filter(function (c) { return !c.classList.contains('is-hidden'); });
      visible.sort(function (a, b) {
        var pa = +a.getAttribute('data-price'), pb = +b.getAttribute('data-price');
        var ra = +a.getAttribute('data-reviews'), rb = +b.getAttribute('data-reviews');
        if (mode === 'low') return pa - pb;
        if (mode === 'high') return pb - pa;
        if (mode === 'new') return (b.getAttribute('data-badge') === 'new') - (a.getAttribute('data-badge') === 'new');
        return rb - ra;
      });
      visible.forEach(function (c) { grid.appendChild(c); });
      if (empty && empty.parentNode === grid) grid.appendChild(empty);
    }

    pills.forEach(function (p) {
      p.addEventListener('click', function () {
        pills.forEach(function (o) { o.classList.remove('active'); });
        p.classList.add('active'); activeCat = p.getAttribute('data-cat-pill'); apply();
      });
    });
    $$('input[data-f]').forEach(function (c) { c.addEventListener('change', apply); });
    if (sortSel) sortSel.addEventListener('change', function () { sort(sortSel.value); apply(); });

    var more = $('[data-loadmore]');
    if (more) more.addEventListener('click', function () {
      allCards.filter(function (c) { return c.classList.contains('is-hidden'); }).slice(0, 4)
        .forEach(function (c) { c.classList.remove('is-hidden'); });
      if (!allCards.some(function (c) { return c.classList.contains('is-hidden'); })) more.style.display = 'none';
      if (sortSel) sort(sortSel.value);
      apply(); toast('Loaded more finds', '#ic-leaf');
    });

    // mobile filter sheet
    var filters = $('.filters'), ftoggle = $('[data-filters-toggle]');
    if (filters && ftoggle) {
      function setF(o) { filters.classList.toggle('open', o); lockBody(o); if (o) remember(); else restoreFocus(); }
      ftoggle.addEventListener('click', function () { setF(!filters.classList.contains('open')); });
      filters.addEventListener('click', function (e) { if (e.target.closest('[data-filters-close]') || e.target === filters) setF(false); });
    }
    apply();
  }

  /* ---------- one ESC handler: closes only the topmost open layer ---------- */
  function closeLayer(el) {
    if (!el || !el.classList.contains('open')) return false;
    el.classList.remove('open');
    if (el.matches('[data-drawer]')) { var t = $('[data-drawer-toggle]'); t && t.setAttribute('aria-expanded', 'false'); }
    lockBody(false); restoreFocus(); return true;
  }
  function setupEsc() {
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      closeLayer($('[data-lightbox]')) || closeLayer($('[data-search-sheet]')) ||
      closeLayer($('[data-cart-drawer]')) || closeLayer($('.filters.open')) || closeLayer($('[data-drawer]'));
    });
  }

  /* ---- focus trap: keep Tab inside the topmost open overlay ---- */
  function topOverlay() {
    var order = ['[data-lightbox]', '[data-search-sheet]', '[data-cart-drawer]', '.filters', '[data-drawer]'];
    for (var i = 0; i < order.length; i++) { var el = $(order[i]); if (el && el.classList.contains('open')) return el; }
    return null;
  }
  function focusables(el) {
    return $$('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', el)
      .filter(function (n) { return n.offsetWidth > 0 || n.offsetHeight > 0 || n === document.activeElement; });
  }
  function setupFocusTrap() {
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var ov = topOverlay(); if (!ov) return;
      var f = focusables(ov); if (!f.length) { e.preventDefault(); return; }
      var first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (e.shiftKey) { if (a === first || !ov.contains(a)) { e.preventDefault(); last.focus(); } }
      else { if (a === last || !ov.contains(a)) { e.preventDefault(); first.focus(); } }
    });
  }

  /* ---------- fake-submit forms (contact, newsletter, account, gift) ---------- */
  function setupForms() {
    $$('[data-fakeform]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = f.querySelector('.form-msg') || (f.parentNode && f.parentNode.querySelector('.form-msg'));
        if (msg) { msg.classList.add('show'); }
        var keep = f.getAttribute('data-keep');
        if (keep == null) f.reset();
        var t = f.getAttribute('data-toast');
        if (t) toast(t, '#ic-check');
      });
    });
  }

  /* ---------- track order: reveal a faux status timeline ---------- */
  function setupTrack() {
    var f = $('[data-track-form]'); if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var res = $('[data-track-result]'); if (!res) return;
      var ord = $('input[name="order"]', f);
      var no = $('[data-track-no]'); if (no) no.textContent = '#' + ((ord && ord.value.trim()) || 'SN-10428');
      res.classList.add('show');
      res.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
      var prog = $('.tprog', res);
      if (prog) requestAnimationFrame(function () { requestAnimationFrame(function () { prog.style.width = '62%'; }); });
    });
  }

  /* ---------- account sign-in / register tabs ---------- */
  function setupAccountTabs() {
    var tabs = $$('.acct-tabs button'); if (!tabs.length) return;
    function activate(id) {
      tabs.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === id); });
      $$('.acct-pane').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-pane') === id); });
    }
    tabs.forEach(function (b) { b.addEventListener('click', function () { activate(b.getAttribute('data-tab')); }); });
    $$('[data-acct-switch]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); activate(a.getAttribute('data-acct-switch')); });
    });
  }

  /* ---------- gift card denomination picker ---------- */
  function setupGiftCards() {
    var gifts = $$('.gift'); if (!gifts.length) return;
    gifts.forEach(function (g) {
      g.addEventListener('click', function () {
        gifts.forEach(function (x) { x.classList.remove('sel'); });
        g.classList.add('sel');
        var v = $('[data-gift-amt]'); if (v) v.textContent = '$' + g.getAttribute('data-amt');
      });
    });
  }

  /* ---------- animate bars/progress when scrolled into view ---------- */
  function setupBars() {
    var bars = $$('[data-pct]'); if (!bars.length) return;
    if (reduce || !('IntersectionObserver' in window)) { bars.forEach(function (b) { b.style.width = b.getAttribute('data-pct') + '%'; }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.style.width = en.target.getAttribute('data-pct') + '%'; io.unobserve(en.target); }
      });
    }, { threshold: .4 });
    bars.forEach(function (b) { io.observe(b); });
  }

  function init() {
    injectSprite(); injectChrome();
    setupReveal(); setupHeader(); setupMarquee(); setupDrawer(); setupHearts(); setupCart();
    setupSearch(); setupGallery(); setupStickyBuy(); setupFaq(); setupQty();
    setupSelectable(); setupCollection(); setupEsc(); setupFocusTrap();
    setupWishlist(); setupForms(); setupTrack(); setupAccountTabs(); setupGiftCards(); setupBars();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
