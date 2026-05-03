window.HIDDEN_GEMS_CATALOG = {"new-releases":{"title":"New Releases","subtitle":"Fresh premium drops added to the Hidden Gems vault. Unlock fast-moving releases before they rotate into the archive.","count":"0 videos","videos":[]},"most-popular":{"title":"Most Popular","subtitle":"Top-performing videos across the platform, based on viewer demand and replay value.","count":"0 videos","videos":[]},"behind-the-scenes":{"title":"Behind the Scenes","subtitle":"Process footage, setup moments, studio energy, and the making-of content that viewers usually never get to see.","count":"0 videos","videos":[]},"live-sessions":{"title":"Live Sessions","subtitle":"Performance-driven content with live energy, room texture, and premium session-style presentation.","count":"0 videos","videos":[]},"short-films":{"title":"Short Films","subtitle":"Story-driven premium visuals with cinematic structure, sharper pacing, and high replay value.","count":"0 videos","videos":[]},"creator-picks":{"title":"Creator Picks","subtitle":"Hand-selected standouts that represent the strongest direction, quality, and replay value in the vault.","count":"0 videos","videos":[]},"vip-exclusives":{"title":"VIP Exclusives","subtitle":"Members-only premium vault content. These titles stay locked unless VIP access is active on the account.","count":"Members only","vip":true,"videos":[]}};


window.HiddenGemsApp = (() => {
  const APP_CONFIG = window.GEMS_HIDDEN_CONFIG || {};
  const AUTH_CONFIG = APP_CONFIG.auth || {};
  const SUPPORT_EMAIL = APP_CONFIG.supportEmail || 'HGemsLLC@proton.me';
  const BRAND_NAME = APP_CONFIG.brandName || 'Hidden Gems';
  const BRAND_SHORT = APP_CONFIG.brandShort || 'HG';
  const SUPABASE_URL = AUTH_CONFIG.supabaseUrl || '';
  const SUPABASE_PUBLISHABLE_KEY = AUTH_CONFIG.supabaseAnonKey || '';
  const ADMIN_EMAILS = (APP_CONFIG.adminEmails || []).map((email) => String(email).trim().toLowerCase()).filter(Boolean);
  const ADMIN_USER_IDS = (APP_CONFIG.adminUserIds || []).map((id) => String(id).trim().toLowerCase()).filter(Boolean);
  const FALLBACK_PAYMENT_URL = (APP_CONFIG.stripeLinks && (APP_CONFIG.stripeLinks.vipSubscription || APP_CONFIG.stripeLinks.defaultVideo || APP_CONFIG.stripeLinks.default)) || '';
  const SITE_URL = APP_CONFIG.siteUrl || window.location.origin;
  const PAYMENT_CONFIG = APP_CONFIG.payment || {};
  const STRIPE_VIDEO_PAYMENT_LINK = (PAYMENT_CONFIG.stripeVideoLink || (APP_CONFIG.stripeLinks && (APP_CONFIG.stripeLinks.defaultVideo || APP_CONFIG.stripeLinks.video)) || '').trim();
  const STRIPE_VIP_SUBSCRIPTION_LINK = (PAYMENT_CONFIG.stripeVipSubscriptionLink || (APP_CONFIG.stripeLinks && (APP_CONFIG.stripeLinks.vipSubscription || APP_CONFIG.stripeLinks.vip)) || '').trim();
  const PAYMENT_FUNCTION_URL = String(PAYMENT_CONFIG.edgeFunctionUrl || '').trim();

  const THEME_LOGO_PATHS = {
    dark: './assets/hidden-gems-logo.png',
    light: './assets/hidden-gems-logo.png',
    midnight: './assets/hg-blue.png',
    gold: './assets/hg-gold.png'
  };
  let themeLogoObserverStarted = false;
  let themeLogoRaf = null;

  const KEYS = {
    unlocked: 'hg_unlocked',
    transactions: 'hg_transactions',
    customVideos: 'hg_custom_videos',
    hiddenVideos: 'hg_hidden_videos',
    roleOverrides: 'hg_role_overrides',
    profileCache: 'hg_profile_cache',
    linkOverrides: 'hg_link_overrides',
    videoOverrides: 'hg_video_overrides',
    categoryNames: 'hg_category_names',
    categoryMeta: 'hg_category_meta',
    deletedCategories: 'hg_deleted_categories',
    siteSettings: 'hg_site_settings',
    thumbnailLibrary: 'hg_thumbnail_library',
    userPreferences: 'hg_user_preferences',
    vipDealDeadline: 'hg_vip_deal_deadline'
  };

  const LEGACY_VIDEO_RESET_KEY = 'hg_legacy_video_reset_stripe_reupload_v1';

  function resetLegacyLocalVideoDataOnce() {
    try {
      if (localStorage.getItem(LEGACY_VIDEO_RESET_KEY) === 'done') return;
      [KEYS.customVideos, KEYS.hiddenVideos, KEYS.videoOverrides, KEYS.linkOverrides, KEYS.thumbnailLibrary, KEYS.unlocked].forEach((key) => {
        try { localStorage.removeItem(key); } catch (_) {}
      });
      try { indexedDB.deleteDatabase(MEDIA_DB_NAME); } catch (_) {}
      localStorage.setItem(LEGACY_VIDEO_RESET_KEY, 'done');
    } catch (_) {}
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  const MEDIA_DB_NAME = 'hidden_gems_media';
  const MEDIA_STORE_NAME = 'video_files';

  resetLegacyLocalVideoDataOnce();

  function openMediaDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB is not available.'));
      const request = window.indexedDB.open(MEDIA_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) db.createObjectStore(MEDIA_STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Unable to open media storage.'));
    });
  }

  async function saveVideoBlob(ref, file) {
    if (!ref || !file) return '';
    const db = await openMediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
      tx.objectStore(MEDIA_STORE_NAME).put(file, ref);
      tx.oncomplete = () => resolve(ref);
      tx.onerror = () => reject(tx.error || new Error('Unable to save uploaded video file.'));
    });
  }

  async function getVideoBlob(ref) {
    if (!ref) return null;
    const db = await openMediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
      const request = tx.objectStore(MEDIA_STORE_NAME).get(ref);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Unable to load uploaded video file.'));
    });
  }

  async function removeVideoBlob(ref) {
    if (!ref) return;
    const db = await openMediaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
      tx.objectStore(MEDIA_STORE_NAME).delete(ref);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Unable to remove uploaded video file.'));
    });
  }

  const storage = {
    getUnlocked() { return readJson(KEYS.unlocked, []); },
    unlock(id) { const items = this.getUnlocked(); if (!items.includes(id)) { items.push(id); writeJson(KEYS.unlocked, items); } },
    isUnlocked(id) { return this.getUnlocked().includes(id); },
    getUserUnlocked(email) {
      const map = readJson(KEYS.unlocked + '_by_user', {});
      return Array.isArray(map[String(email || '').trim().toLowerCase()]) ? map[String(email || '').trim().toLowerCase()] : [];
    },
    unlockForUser(email, id) {
      const key = String(email || '').trim().toLowerCase();
      if (!key || !id) return;
      const map = readJson(KEYS.unlocked + '_by_user', {});
      const items = Array.isArray(map[key]) ? map[key] : [];
      if (!items.includes(id)) items.push(id);
      map[key] = items;
      writeJson(KEYS.unlocked + '_by_user', map);
      this.unlock(id);
    },
    isUnlockedForUser(email, id) {
      const key = String(email || '').trim().toLowerCase();
      if (!key) return this.isUnlocked(id);
      return this.getUserUnlocked(key).includes(id) || this.isUnlocked(id);
    },
    getTransactions() { return readJson(KEYS.transactions, []); },
    addTransaction(item) { const tx = this.getTransactions(); tx.unshift({ ...item, at: new Date().toISOString() }); writeJson(KEYS.transactions, tx.slice(0, 100)); },
    getCustomVideos() { return readJson(KEYS.customVideos, []); },
    setCustomVideos(items) { writeJson(KEYS.customVideos, items); },
    getHiddenVideos() { return readJson(KEYS.hiddenVideos, []); },
    setHiddenVideos(items) { writeJson(KEYS.hiddenVideos, items); },
    getRoleOverrides() { return readJson(KEYS.roleOverrides, {}); },
    setRoleOverride(email, role) {
      const map = this.getRoleOverrides();
      const key = String(email || '').trim().toLowerCase();
      if (!key) return;
      if (role) map[key] = role; else delete map[key];
      writeJson(KEYS.roleOverrides, map);
    },
    getRoleOverride(email) { return this.getRoleOverrides()[String(email || '').trim().toLowerCase()] || null; },
    getLinkOverrides() { return readJson(KEYS.linkOverrides, {}); },
    setVideoLink(id, url) { const map = this.getLinkOverrides(); map[id] = String(url || '').trim(); writeJson(KEYS.linkOverrides, map); },
    getVideoOverrides() { return readJson(KEYS.videoOverrides, {}); },
    setVideoOverride(id, data) { const map = this.getVideoOverrides(); map[id] = { ...(map[id] || {}), ...data }; writeJson(KEYS.videoOverrides, map); },
    removeVideoOverride(id) { const map = this.getVideoOverrides(); delete map[id]; writeJson(KEYS.videoOverrides, map); },
    cacheProfile(email, data) { if (!email) return; const map = readJson(KEYS.profileCache, {}); map[String(email).toLowerCase()] = data; writeJson(KEYS.profileCache, map); },
    getCachedProfile(email) { const map = readJson(KEYS.profileCache, {}); return map[String(email || '').toLowerCase()] || null; },
    getSiteSettings() { return readJson(KEYS.siteSettings, {}); },
    setSiteSetting(key, value) { const map = this.getSiteSettings(); map[String(key || '').trim()] = value; writeJson(KEYS.siteSettings, map); },
    getSiteSetting(key, fallback = '') { const map = this.getSiteSettings(); const value = map[String(key || '').trim()]; return typeof value === 'undefined' ? fallback : value; },
    getUserPreferences() { return readJson(KEYS.userPreferences, { theme: 'dark', cardDensity: 'comfortable', autoplayPreviews: true, reducedMotion: false }); },
    setUserPreferences(prefs) { writeJson(KEYS.userPreferences, { ...this.getUserPreferences(), ...(prefs || {}) }); },
    getVipDealDeadline() {
      let deadline = localStorage.getItem(KEYS.vipDealDeadline);
      if (!deadline || Number.isNaN(Date.parse(deadline)) || Date.parse(deadline) <= Date.now()) {
        deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        localStorage.setItem(KEYS.vipDealDeadline, deadline);
      }
      return deadline;
    },
    getThumbnailLibrary() { return readJson(KEYS.thumbnailLibrary, []); },
    setThumbnailLibrary(items) { writeJson(KEYS.thumbnailLibrary, uniqueThumbnailItems(items)); },
    addThumbnail(item = {}) {
      const library = this.getThumbnailLibrary();
      const url = String(item.url || item.imageUrl || item.image_url || '').trim();
      if (!url) return library;
      const next = uniqueThumbnailItems([{ id: item.id || `thumb-${Date.now()}`, url, title: item.title || item.fileName || item.file_name || 'Saved thumbnail', fileName: item.fileName || item.file_name || '', linkedVideoId: item.linkedVideoId || item.linked_video_id || '', createdAt: item.createdAt || item.created_at || new Date().toISOString() }, ...library]);
      this.setThumbnailLibrary(next);
      return next;
    },
    getCategoryNameOverrides() { return readJson(KEYS.categoryNames, {}); },
    getCategoryMeta() { return readJson(KEYS.categoryMeta, {}); },
    setCategoryMeta(slug, data = {}) {
      const key = String(slug || '').trim().toLowerCase();
      if (!key) return;
      const map = this.getCategoryMeta();
      map[key] = { ...(map[key] || {}), ...data, slug: key };
      writeJson(KEYS.categoryMeta, map);
    },
    removeCategoryMeta(slug) { const map = this.getCategoryMeta(); delete map[String(slug || '').trim().toLowerCase()]; writeJson(KEYS.categoryMeta, map); },
    getDeletedCategories() { return readJson(KEYS.deletedCategories, []); },
    markCategoryDeleted(slug) {
      const key = String(slug || '').trim().toLowerCase();
      if (!key || CATEGORY_ORDER.includes(key)) return;
      const items = this.getDeletedCategories();
      if (!items.includes(key)) items.push(key);
      writeJson(KEYS.deletedCategories, items);
    },
    restoreCategory(slug) {
      const key = String(slug || '').trim().toLowerCase();
      writeJson(KEYS.deletedCategories, this.getDeletedCategories().filter((item) => item !== key));
    },
    setCategoryNameOverride(slug, title) {
      const map = this.getCategoryNameOverrides();
      const key = String(slug || '').trim().toLowerCase();
      if (!key) return;
      const value = String(title || '').trim();
      if (value) map[key] = value; else delete map[key];
      writeJson(KEYS.categoryNames, map);
      this.setCategoryMeta(key, { title: value || titleFromSlug(key) });
    }
  };

  function initialsFromEmail(email) {
    const source = String(email || '').split('@')[0] || BRAND_SHORT;
    const parts = source.split(/[._-]+/).filter(Boolean);
    if (!parts.length) return BRAND_SHORT.slice(0, 2).toUpperCase();
    return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
  }

  function normalizePriceCents(value) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
  }
  function moneyFromCents(cents) { return '$' + (normalizePriceCents(cents) / 100).toFixed(2).replace('.00', ''); }
  function moneyLabelFromVideo(video) {
    const cents = normalizePriceCents(video?.priceCents);
    return cents > 0 ? moneyFromCents(cents) : 'Price coming soon';
  }
  function configuredStripeVideoPriceLinks() {
    const maps = [
      PAYMENT_CONFIG.stripeVideoLinksByPrice,
      PAYMENT_CONFIG.stripePriceLinks,
      APP_CONFIG.stripeVideoLinksByPrice,
      APP_CONFIG.stripeLinks && APP_CONFIG.stripeLinks.videoPrices,
      APP_CONFIG.stripeLinks && APP_CONFIG.stripeLinks.byPrice
    ].filter((map) => map && typeof map === 'object');
    return maps;
  }
  function configuredNamedPaymentLinks() {
    const links = Array.isArray(PAYMENT_CONFIG.namedPaymentLinks) ? PAYMENT_CONFIG.namedPaymentLinks : [];
    return links.map((item) => ({
      name: String(item?.name || '').trim(),
      url: String(item?.url || '').trim(),
      amountCents: normalizePriceCents(item?.amountCents || 0),
      kind: String(item?.kind || 'video').trim().toLowerCase() || 'video'
    })).filter((item) => item.name && item.url && !item.url.includes('REPLACE_WITH'));
  }
  function paymentLinkOptionsMarkup(selectedUrl = '') {
    const selected = String(selectedUrl || '').trim();
    const options = configuredNamedPaymentLinks();
    const rows = options.map((item) => {
      const value = escapeHtml(item.url);
      const label = `${item.name}${item.kind === 'vip' ? ' · VIP' : item.amountCents ? ' · ' + moneyFromCents(item.amountCents) : ''}`;
      return `<option value="${value}" data-price-cents="${item.amountCents}" data-kind="${escapeHtml(item.kind)}" ${selected && selected === item.url ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
    return `<option value="">Use matching shared price link / custom pasted link</option>${rows}<option value="__custom__" ${selected && !options.some((item) => item.url === selected) ? 'selected' : ''}>Custom link pasted below</option>`;
  }
  function parseDollarsToCents(value) {
    const raw = String(value ?? '').trim().replace(/[$,]/g, '');
    if (!raw) return 0;
    const amount = Number(raw);
    return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
  }
  function checkoutPriceCentsFromVideo(video = {}) {
    if (video.priceCents !== undefined && video.priceCents !== null && String(video.priceCents).trim() !== '') {
      return normalizePriceCents(video.priceCents);
    }
    if (video.amountCents !== undefined && video.amountCents !== null && String(video.amountCents).trim() !== '') {
      return normalizePriceCents(video.amountCents);
    }
    if (video.price !== undefined && video.price !== null && String(video.price).trim() !== '') {
      return parseDollarsToCents(video.price);
    }
    if (video.amount !== undefined && video.amount !== null && String(video.amount).trim() !== '') {
      return parseDollarsToCents(video.amount);
    }
    return 0;
  }
  function stripeVideoLinkForPrice(video = {}) {
    const perVideo = String(video?.paypalUrl || video?.paymentUrl || '').trim();
    if (perVideo && !perVideo.includes('REPLACE_WITH')) return perVideo;

    const cents = checkoutPriceCentsFromVideo(video);
    const dollars = cents > 0 ? String(cents / 100).replace(/\.0+$/, '') : '';
    const keys = [
      String(cents),
      cents > 0 ? `cents_${cents}` : '',
      cents > 0 ? `price_${cents}` : '',
      dollars,
      dollars ? `$${dollars}` : '',
      dollars ? `usd_${dollars}` : ''
    ].filter(Boolean);
    for (const map of configuredStripeVideoPriceLinks()) {
      for (const key of keys) {
        const value = String(map[key] || '').trim();
        if (value && !value.includes('REPLACE_WITH')) return value;
      }
    }

    const shared = String(STRIPE_VIDEO_PAYMENT_LINK || '').trim();
    // The global shared link is the $3/default link in this build. Only use it for
    // $3 videos or videos with no configured price so $5/$7 videos never undercharge.
    if (shared && !shared.includes('REPLACE_WITH') && (!cents || cents === 300)) return shared;
    return '';
  }
  function priceInputValueFromCents(cents) {
    const normalized = normalizePriceCents(cents);
    return normalized > 0 ? (normalized / 100).toFixed(2) : '';
  }
  function priceCentsFromFormValue(value) {
    const raw = String(value ?? '').trim().replace(/[$,]/g, '');
    if (!raw) return 0;
    const amount = Number(raw);
    return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
  }
  function qs(name) { return new URLSearchParams(window.location.search).get(name); }
  function currentPageKey() { const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase(); return !page || page === 'index.html' ? 'home' : page.replace(/\.html$/, ''); }
  function categoryPageHref(slug) {
    const safeSlug = String(slug || '').trim().toLowerCase();
    return CATEGORY_ORDER.includes(safeSlug) ? `${safeSlug}.html` : `all-videos.html?category=${encodeURIComponent(safeSlug)}`;
  }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
  function trustedExternalHostNotice(extraClass = '') {
    return `<div class="${escapeHtml(extraClass)} rounded-[1.25rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-300"><span class="font-semibold text-white">Trusted download partners:</span> Hidden Gems uses approved external hosts like <span class="font-semibold text-pink-300">PikPak</span> and <span class="font-semibold text-pink-300">Mega</span> for downloadable video files. If a file link opens through PikPak or Mega, it is an official Hidden Gems download source.</div>`;
  }
  const CATEGORY_ORDER = ['new-releases', 'most-popular', 'behind-the-scenes', 'live-sessions', 'short-films', 'creator-picks', 'vip-exclusives'];
  const TEMP_CATEGORY_LABELS = {
    'new-releases': 'Category 1',
    'most-popular': 'Category 2',
    'behind-the-scenes': 'Category 3',
    'live-sessions': 'Category 4',
    'short-films': 'Category 5',
    'creator-picks': 'Category 6',
    'vip-exclusives': 'Category 7'
  };

  function titleFromSlug(slug) {
    const clean = String(slug || '').trim();
    return clean ? clean.replace(/-/g, ' ').replace(/\w/g, (m) => m.toUpperCase()) : 'Uncategorized';
  }

  function categoryDisplayName(slug, fallback = '') {
    const key = String(slug || '').trim().toLowerCase();
    const meta = storage.getCategoryMeta ? storage.getCategoryMeta() : {};
    const overrides = storage.getCategoryNameOverrides ? storage.getCategoryNameOverrides() : {};
    return String(meta[key]?.title || overrides[key] || '').trim() || TEMP_CATEGORY_LABELS[key] || String(fallback || '').trim() || titleFromSlug(slug);
  }

  function categoryDescription(slug, fallback = '') {
    const key = String(slug || '').trim().toLowerCase();
    const meta = storage.getCategoryMeta ? storage.getCategoryMeta() : {};
    return String(meta[key]?.description || '').trim() || String(fallback || '').trim() || 'Premium titles ready to unlock.';
  }

  function makeCategorySlug(title) {
    const base = String(title || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return base || `category-${Date.now()}`;
  }

  function categorySortIndex(slug) {
    const index = CATEGORY_ORDER.indexOf(String(slug || '').trim());
    return index >= 0 ? index : 999;
  }

  function normalizeRole(role) {
    const value = String(role || 'guest').trim().toLowerCase();
    return ['guest', 'vip', 'admin'].includes(value) ? value : 'guest';
  }

  function uniqueVideos(videos) {
    const seen = new Map();
    for (const video of videos || []) {
      if (!video?.id) continue;
      seen.set(String(video.id), video);
    }
    return [...seen.values()];
  }

  function uniqueThumbnailItems(items = []) {
    const seen = new Map();
    for (const item of items || []) {
      const url = String(item?.url || item?.imageUrl || item?.image_url || '').trim();
      if (!url) continue;
      const key = url;
      seen.set(key, {
        id: String(item.id || `thumb-${Math.abs(hashString(url))}`).trim(),
        url,
        title: String(item.title || item.fileName || item.file_name || 'Saved thumbnail').trim(),
        fileName: String(item.fileName || item.file_name || '').trim(),
        linkedVideoId: String(item.linkedVideoId || item.linked_video_id || '').trim(),
        createdAt: String(item.createdAt || item.created_at || '').trim()
      });
    }
    return [...seen.values()];
  }

  function hashString(value) {
    let hash = 0;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash) + text.charCodeAt(i), hash |= 0;
    return hash;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read file.'));
      reader.readAsDataURL(file);
    });
  }

  function normalizeVideoItem(item = {}, fallback = {}) {
    const sourceItem = Array.isArray(item)
      ? {
          id: item[0],
          title: item[1],
          description: item[2],
          priceCents: item[3],
          image: item[4],
          videoUrl: item[5] || '',
          access: item[6],
          categorySlug: item[7],
          categoryTitle: item[8],
          videoFile: item[9] || '',
          videoFileName: item[10] || '',
          videoMimeType: item[11] || '',
          videoFileRef: item[12] || '',
          paypalUrl: item[13] || item[14] || ''
        }
      : item;
    const base = { ...fallback, ...sourceItem };
    return {
      id: String(base.id || fallback.id || ('custom-' + Date.now())).trim(),
      title: String(base.title || '').trim(),
      description: String(base.description || '').trim(),
      image: String(base.image || '').trim(),
      videoUrl: String(base.videoUrl || '').trim(),
      videoFile: String(base.videoFile || '').trim(),
      videoFileName: String(base.videoFileName || '').trim(),
      videoMimeType: String(base.videoMimeType || '').trim(),
      videoFileRef: String(base.videoFileRef || '').trim(),
      videoStoragePath: String(base.videoStoragePath || '').trim(),
      sourceType: String(base.sourceType || (base.videoFile || base.videoFileRef || base.videoStoragePath ? 'file' : 'link')).trim() === 'file' ? 'file' : 'link',
      categorySlug: String(base.categorySlug || 'creator-picks').trim(),
      categoryTitle: String(base.categoryTitle || '').trim(),
      category: String(base.category || base.categoryTitle || '').trim(),
      access: String(base.access || 'guest').trim().toLowerCase() === 'vip' ? 'vip' : 'guest',
      priceCents: normalizePriceCents(base.priceCents),
      previewImageEnabled: base.previewImageEnabled !== false,
      previewVideoEnabled: !!base.previewVideoEnabled,
      previewImage: String(base.previewImage || '').trim(),
      previewImageUrl: String(base.previewImageUrl || '').trim(),
      previewVideo: String(base.previewVideo || '').trim(),
      previewVideoUrl: String(base.previewVideoUrl || '').trim(),
      previewVideoMimeType: String(base.previewVideoMimeType || '').trim(),
      previewVideoFileName: String(base.previewVideoFileName || '').trim(),
      externalFileUrl: String(base.externalFileUrl || '').trim(),
      paypalUrl: String(base.paypalUrl || base.paymentUrl || base.paypal_url || '').trim(),
      paymentUrl: String(base.paymentUrl || base.paypalUrl || base.paypal_url || '').trim(),
      isCustom: !!base.isCustom
    };
  }

  function getVideoSource(video) {
    if (video?.videoFile) return { type: 'file', value: video.videoFile, mimeType: video.videoMimeType || '', fileName: video.videoFileName || '', ref: video.videoFileRef || '', storagePath: video.videoStoragePath || '' };
    if (video?.videoFileRef || video?.videoStoragePath) return { type: 'file', value: '', mimeType: video.videoMimeType || '', fileName: video.videoFileName || '', ref: video.videoFileRef || '', storagePath: video.videoStoragePath || '' };
    if (video?.videoUrl) return { type: 'link', value: video.videoUrl };
    return { type: 'none', value: '' };
  }

  function isPlayableVideoFile(video) {
    return getVideoSource(video).type === 'file';
  }

  function getVideoPreviewConfig(video) {
    const override = storage.getVideoOverrides ? (storage.getVideoOverrides()[String(video?.id || '')] || {}) : {};
    return {
      imageEnabled: (override.previewImageEnabled ?? video?.previewImageEnabled) !== false,
      videoEnabled: !!(override.previewVideoEnabled ?? video?.previewVideoEnabled),
      imageUrl: String(override.previewImage || override.previewImageUrl || video?.previewImage || video?.previewImageUrl || '').trim(),
      videoUrl: String(override.previewVideo || override.previewVideoUrl || video?.previewVideo || video?.previewVideoUrl || '').trim(),
      generatedFrame: String(override.generatedPreviewFrame || '').trim()
    };
  }

  function captureVideoFrame(url, seekRatio = 0.35) {
    return new Promise((resolve, reject) => {
      if (!url) return reject(new Error('Missing video URL for preview capture.'));
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      const cleanup = () => {
        video.pause();
        video.removeAttribute('src');
        try { video.load(); } catch (error) {}
      };
      video.onloadedmetadata = () => {
        const duration = Number(video.duration || 0);
        const safeRatio = Math.min(0.8, Math.max(0.1, Number(seekRatio) || 0.35));
        const target = duration > 0 ? Math.max(0.1, duration * safeRatio) : 0.1;
        try { video.currentTime = target; } catch (error) { video.currentTime = 0.1; }
      };
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 1280;
          canvas.height = video.videoHeight || 720;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          cleanup();
          resolve(dataUrl);
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      video.onerror = () => {
        cleanup();
        reject(new Error('Unable to create a video frame preview.'));
      };
      video.src = url;
    });
  }

  async function resolveStillPreviewImage(video) {
    const preview = getVideoPreviewConfig(video);
    if (preview.imageUrl) return preview.imageUrl;
    if (preview.generatedFrame) return preview.generatedFrame;
    const source = getVideoSource(video);
    try {
      let playableSrc = '';
      if (source.type === 'file' && source.storagePath) playableSrc = await createSignedVideoUrl(source.storagePath);
      else if (source.type === 'file' && source.ref) {
        const blob = await getVideoBlob(source.ref);
        if (blob) playableSrc = URL.createObjectURL(blob);
      } else if (source.type === 'link') {
        playableSrc = source.value;
      }
      if (playableSrc) {
        const frame = await captureVideoFrame(playableSrc, 0.37);
        if (frame && storage.setVideoOverride) storage.setVideoOverride(video.id, { generatedPreviewFrame: frame });
        if (source.type === 'file' && source.ref && playableSrc.startsWith('blob:')) {
          try { URL.revokeObjectURL(playableSrc); } catch (error) {}
        }
        if (frame) return frame;
      }
    } catch (error) {
      console.error(error);
    }
    return video.image || './assets/hidden-gems-logo.png';
  }

  function renderStillPreviewShell(image, title, caption = '') {
    return `<div class="space-y-4"><div class="relative overflow-hidden rounded-2xl border border-white/10 bg-black"><img src="${escapeHtml(image || './assets/hidden-gems-logo.png')}" alt="${escapeHtml(title || 'Preview image')}" loading="lazy" decoding="async" class="h-[420px] w-full object-cover" /><div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div><div class="pointer-events-none absolute inset-0 flex items-center justify-center"><img src="./assets/hidden-gems-logo.png" alt="Hidden Gems watermark" class="max-h-32 w-auto opacity-20 select-none" /></div><div class="absolute bottom-4 left-4 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.2em] text-pink-200">Still Preview</div></div>${caption ? `<p class="text-sm text-neutral-400">${caption}</p>` : ''}</div>`;
  }

  async function renderPublicPreviewShell(video, caption = '') {
    const preview = getVideoPreviewConfig(video);
    const previewVideo = preview.videoEnabled && preview.videoUrl ? preview.videoUrl : '';
    const safeCaption = caption || 'Preview is available before purchase so guests can see what they are about to unlock. Full playback, downloads, and external file links stay locked until purchase or VIP access.';
    if (previewVideo) {
      const mimeType = previewVideo.startsWith('data:video/webm') ? 'video/webm' : (previewVideo.startsWith('data:video/quicktime') || /\.mov(\?.*)?$/i.test(previewVideo) ? 'video/quicktime' : 'video/mp4');
      return `<div class="space-y-4"><div class="relative overflow-hidden rounded-2xl border border-white/10 bg-black"><video controls playsinline preload="metadata" poster="${escapeHtml(preview.imageUrl || video.image || './assets/hidden-gems-logo.png')}" class="w-full rounded-2xl bg-black"><source src="${escapeHtml(previewVideo)}" type="${escapeHtml(mimeType)}" />Your browser does not support preview playback.</video><div class="pointer-events-none absolute right-4 top-4 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.2em] text-pink-200">Preview</div></div><p class="text-sm text-neutral-400">${escapeHtml(safeCaption)}</p></div>`;
    }
    const previewImage = await resolveStillPreviewImage(video);
    return renderStillPreviewShell(previewImage || video.image, video.title, safeCaption);
  }

  function redirectToPaymentLink(url = FALLBACK_PAYMENT_URL) {
    const target = String(url || '').trim();
    if (!target || target.includes('REPLACE_WITH')) {
      toast('Add your live Stripe payment link in config.js before using checkout.', 'error');
      return false;
    }
    window.open(target, '_blank', 'noopener,noreferrer');
    return true;
  }


  async function getPurchasedVideoIds(state = null) {
    const currentState = state || await getState();
    const email = String(currentState?.email || '').trim().toLowerCase();
    const ids = new Set(email ? storage.getUserUnlocked(email) : storage.getUnlocked());
    const supabase = getSupabaseClient();
    const user = currentState?.user || await getSessionUser();

    if (supabase && user?.id) {
      try {
        const result = await supabase
          .from('hg_video_purchases')
          .select('video_id,status')
          .eq('user_id', user.id);
        if (result?.error) throw result.error;
        (result?.data || []).forEach((row) => {
          const status = String(row.status || 'completed').toLowerCase();
          if (!row.video_id || ['failed', 'canceled', 'cancelled', 'refunded'].includes(status)) return;
          ids.add(String(row.video_id));
        });
      } catch (error) {
        if (isInvalidJwtError(error)) await resetSupabaseSession(extractErrorMessage(error, 'Invalid JWT'));
        else console.error('Failed to load Supabase purchases', error);
      }
    }

    const list = Array.from(ids);
    if (email) list.forEach((id) => storage.unlockForUser(email, id));
    return list;
  }

  async function unlockVideoForState(state, video, paymentMeta = {}) {
    if (!video) return false;
    const currentState = state || await getState();
    const email = String(currentState?.email || '').trim().toLowerCase();
    if (email) storage.unlockForUser(email, video.id); else storage.unlock(video.id);
    const supabase = getSupabaseClient();
    const user = currentState?.user || await getSessionUser();
    if (supabase && user) {
      try {
        const payload = {
          user_id: user.id,
          video_id: String(video.id),
          role_at_purchase: currentState?.role || 'guest',
          title_snapshot: video.title || '',
          amount_paid_cents: normalizePriceCents(video.priceCents),
          payment_provider: paymentMeta.provider || PAYMENT_CONFIG.provider || 'stripe-link',
          payment_id: paymentMeta.paymentId || paymentMeta.sessionId || paymentMeta.token || null,
          status: paymentMeta.status || 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const result = await supabase.from('hg_video_purchases').upsert(payload, { onConflict: 'user_id,video_id' });
        if (result?.error) throw result.error;
      } catch (error) {
        if (isInvalidJwtError(error)) {
          await resetSupabaseSession(extractErrorMessage(error, 'Invalid JWT'));
        } else {
          console.error('Failed to sync purchase', error);
        }
      }
    }
    return true;
  }

  function toast(message, type = 'info') {
    const colors = {
      info: 'border-white/15 bg-white/10 text-white',
      success: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100',
      error: 'border-rose-400/30 bg-rose-500/15 text-rose-100'
    };
    const holder = document.getElementById('hg-toast-holder') || (() => {
      const div = document.createElement('div');
      div.id = 'hg-toast-holder';
      div.className = 'fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-3';
      document.body.appendChild(div);
      return div;
    })();
    const item = document.createElement('div');
    item.className = `rounded-2xl border px-4 py-3 text-sm shadow-2xl shadow-black/40 backdrop-blur ${colors[type] || colors.info}`;
    item.textContent = message;
    holder.appendChild(item);
    setTimeout(() => item.remove(), 3000);
  }

  function injectThemeStyles() {
    if (document.getElementById('hg-global-theme-styles')) return;
    const style = document.createElement('style');
    style.id = 'hg-global-theme-styles';
    style.textContent = `
      :root[data-hg-theme="dark"] { color-scheme: dark; --hg-page-bg: radial-gradient(circle at top right, rgba(236,72,153,0.22), transparent 30%), radial-gradient(circle at left, rgba(217,70,239,0.14), transparent 24%), #000; --hg-text:#fff; --hg-muted:#d4d4d8; --hg-card:rgba(255,255,255,.05); --hg-card-strong:rgba(0,0,0,.42); --hg-border:rgba(255,255,255,.10); --hg-accent:#ec4899; --hg-accent-contrast:#ffffff; --hg-accent-hover:#f472b6; --hg-accent-soft:rgba(236,72,153,.12); --hg-accent-border:rgba(244,114,182,.30); --hg-gradient-from:rgba(236,72,153,.14); --hg-gradient-via:rgba(217,70,239,.10); --hg-shadow:rgba(236,72,153,.22); }
      :root[data-hg-theme="midnight"] { color-scheme: dark; --hg-page-bg: radial-gradient(circle at top right, rgba(59,130,246,0.24), transparent 30%), radial-gradient(circle at left, rgba(96,165,250,0.16), transparent 24%), #020617; --hg-text:#fff; --hg-muted:#dbeafe; --hg-card:rgba(37,99,235,.10); --hg-card-strong:rgba(2,6,23,.62); --hg-border:rgba(147,197,253,.18); --hg-accent:#60a5fa; --hg-accent-contrast:#06111f; --hg-accent-hover:#93c5fd; --hg-accent-soft:rgba(37,99,235,.16); --hg-accent-border:rgba(96,165,250,.34); --hg-gradient-from:rgba(37,99,235,.16); --hg-gradient-via:rgba(96,165,250,.12); --hg-shadow:rgba(96,165,250,.24); }
      :root[data-hg-theme="light"] { color-scheme: light; --hg-page-bg: radial-gradient(circle at top right, rgba(236,72,153,0.12), transparent 30%), radial-gradient(circle at left, rgba(217,70,239,0.08), transparent 24%), #f8fafc; --hg-text:#0f172a; --hg-muted:#475569; --hg-card:rgba(255,255,255,.82); --hg-card-strong:rgba(255,255,255,.94); --hg-border:rgba(15,23,42,.12); --hg-accent:#db2777; --hg-accent-contrast:#ffffff; --hg-accent-hover:#be185d; --hg-accent-soft:rgba(236,72,153,.08); --hg-accent-border:rgba(219,39,119,.25); --hg-gradient-from:rgba(236,72,153,.08); --hg-gradient-via:rgba(217,70,239,.06); --hg-shadow:rgba(219,39,119,.16); }
      :root[data-hg-theme="gold"] { color-scheme: dark; --hg-page-bg: radial-gradient(circle at top right, rgba(245,158,11,0.24), transparent 30%), radial-gradient(circle at left, rgba(217,119,6,0.16), transparent 24%), #050505; --hg-text:#fff7ed; --hg-muted:#d6d3d1; --hg-card:rgba(245,158,11,.08); --hg-card-strong:rgba(8,8,8,.72); --hg-border:rgba(251,191,36,.22); --hg-accent:#f59e0b; --hg-accent-contrast:#111827; --hg-accent-hover:#fbbf24; --hg-accent-soft:rgba(245,158,11,.14); --hg-accent-border:rgba(251,191,36,.34); --hg-gradient-from:rgba(245,158,11,.16); --hg-gradient-via:rgba(217,119,6,.12); --hg-shadow:rgba(245,158,11,.28); }
      html[data-hg-theme] body { background: var(--hg-page-bg) !important; color: var(--hg-text) !important; }
      html[data-hg-theme] header, html[data-hg-theme] footer { border-color: var(--hg-border) !important; color: var(--hg-text) !important; }
      html[data-hg-theme="light"] header, html[data-hg-theme="light"] footer { background: rgba(255,255,255,.86) !important; }
      html[data-hg-theme="gold"] header, html[data-hg-theme="gold"] footer { background: rgba(5,5,5,.82) !important; box-shadow: 0 0 45px rgba(245,158,11,.08) !important; }
      html[data-hg-theme="midnight"] header, html[data-hg-theme="midnight"] footer { background: rgba(2,6,23,.86) !important; box-shadow: 0 0 45px rgba(96,165,250,.08) !important; }
      html[data-hg-theme] [class*="bg-white/5"], html[data-hg-theme] [class*="bg-white/10"], html[data-hg-theme] [class*="bg-white/["], html[data-hg-theme] [class*="bg-black/30"], html[data-hg-theme] [class*="bg-black/40"] { background-color: var(--hg-card) !important; }
      html[data-hg-theme="light"] [class*="bg-black"], html[data-hg-theme="light"] [class*="bg-neutral-950"], html[data-hg-theme="light"] [class*="bg-neutral-900"] { background-color: var(--hg-card-strong) !important; }
      html[data-hg-theme="gold"] [class*="bg-black"], html[data-hg-theme="gold"] [class*="bg-neutral-950"], html[data-hg-theme="gold"] [class*="bg-neutral-900"] { background-color: var(--hg-card-strong) !important; }
      html[data-hg-theme] [class*="border-white/"], html[data-hg-theme] [class*="border-neutral-"], html[data-hg-theme] [class*="border-pink-"], html[data-hg-theme] [class*="border-fuchsia-"] { border-color: var(--hg-border) !important; }
      html[data-hg-theme] .bg-pink-500, html[data-hg-theme] button.bg-pink-500, html[data-hg-theme] a.bg-pink-500, html[data-hg-theme] [class*="bg-pink-500"], html[data-hg-theme] [class*="bg-fuchsia-500"] { background-color: var(--hg-accent) !important; color: var(--hg-accent-contrast) !important; }
      html[data-hg-theme] [class*="bg-pink-500/"], html[data-hg-theme] [class*="bg-pink-400/"], html[data-hg-theme] [class*="bg-fuchsia-500/"], html[data-hg-theme] [class*="bg-fuchsia-400/"], html[data-hg-theme] [class*="bg-amber-500/"], html[data-hg-theme] [class*="bg-amber-400/"] { background-color: var(--hg-accent-soft) !important; color: var(--hg-text) !important; }
      html[data-hg-theme] [class*="hover:bg-pink-400"]:hover, html[data-hg-theme] [class*="hover:bg-pink-500"]:hover, html[data-hg-theme] [class*="hover:bg-fuchsia-500"]:hover { background-color: var(--hg-accent-hover) !important; color: var(--hg-accent-contrast) !important; }
      html[data-hg-theme] [class*="hover:bg-pink-500/"]:hover, html[data-hg-theme] [class*="hover:bg-white/10"]:hover, html[data-hg-theme] [class*="hover:bg-white/5"]:hover { background-color: var(--hg-accent-soft) !important; color: var(--hg-text) !important; }
      html[data-hg-theme] [class*="text-pink-"], html[data-hg-theme] [class*="text-fuchsia-"], html[data-hg-theme] [class*="text-amber-100"], html[data-hg-theme] [class*="text-amber-200"], html[data-hg-theme] [class*="hover:text-pink-"]:hover, html[data-hg-theme] [class*="hover:text-fuchsia-"]:hover { color: var(--hg-accent-hover) !important; }
      html[data-hg-theme] [class*="border-pink-"], html[data-hg-theme] [class*="border-fuchsia-"], html[data-hg-theme] [class*="border-amber-400/"] { border-color: var(--hg-accent-border) !important; }
      html[data-hg-theme] [class*="ring-pink-"], html[data-hg-theme] [class*="ring-fuchsia-"] { --tw-ring-color: var(--hg-accent-border) !important; }
      html[data-hg-theme] [class*="shadow-pink-"], html[data-hg-theme] [class*="shadow-fuchsia-"] { --tw-shadow-color: var(--hg-shadow) !important; --tw-shadow: var(--tw-shadow-colored) !important; }
      html[data-hg-theme] [class*="from-pink-"], html[data-hg-theme] [class*="from-fuchsia-"], html[data-hg-theme] [class*="from-amber-"] { --tw-gradient-from: var(--hg-gradient-from) var(--tw-gradient-from-position) !important; --tw-gradient-to: rgba(0,0,0,0) var(--tw-gradient-to-position) !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important; }
      html[data-hg-theme] [class*="via-pink-"], html[data-hg-theme] [class*="via-fuchsia-"], html[data-hg-theme] [class*="via-amber-"] { --tw-gradient-via: var(--hg-gradient-via) var(--tw-gradient-via-position) !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-via), var(--tw-gradient-to) !important; }
      html[data-hg-theme] [class*="to-pink-"], html[data-hg-theme] [class*="to-fuchsia-"], html[data-hg-theme] [class*="to-amber-"] { --tw-gradient-to: transparent var(--tw-gradient-to-position) !important; }
      html[data-hg-theme] input, html[data-hg-theme] select, html[data-hg-theme] textarea { border-color: var(--hg-border) !important; }
      html[data-hg-theme="light"] input, html[data-hg-theme="light"] select, html[data-hg-theme="light"] textarea { background: rgba(255,255,255,.92) !important; color: #0f172a !important; }
      html[data-hg-theme="gold"] input, html[data-hg-theme="gold"] select, html[data-hg-theme="gold"] textarea, html[data-hg-theme="midnight"] input, html[data-hg-theme="midnight"] select, html[data-hg-theme="midnight"] textarea { background: rgba(0,0,0,.55) !important; color: var(--hg-text) !important; }
      html[data-hg-theme] input[type="checkbox"], html[data-hg-theme] input[type="radio"] { accent-color: var(--hg-accent) !important; }
      html[data-hg-theme] .file\:bg-pink-500::file-selector-button, html[data-hg-theme] input[type="file"]::file-selector-button { background-color: var(--hg-accent) !important; color: var(--hg-accent-contrast) !important; border-color: var(--hg-accent-border) !important; }
      html[data-hg-theme="light"] [class*="text-white"], html[data-hg-theme="light"] h1, html[data-hg-theme="light"] h2, html[data-hg-theme="light"] h3, html[data-hg-theme="light"] h4 { color: var(--hg-text) !important; }
      html[data-hg-theme="light"] [class*="text-neutral-"] { color: var(--hg-muted) !important; }
      html[data-hg-theme="light"] .shadow-black\/40, html[data-hg-theme="light"] .shadow-black\/50, html[data-hg-theme="light"] .shadow-black\/60 { --tw-shadow-color: rgba(15,23,42,.16) !important; --tw-shadow: var(--tw-shadow-colored) !important; }
      html[data-hg-density="compact"] .rounded-\[2rem\] { border-radius: 1.25rem !important; }
      html.hg-reduced-motion *, html.hg-reduced-motion *::before, html.hg-reduced-motion *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
    `;
    document.head.appendChild(style);
  }

  function getThemeLogoPath(theme) {
    return THEME_LOGO_PATHS[theme] || THEME_LOGO_PATHS.dark;
  }

  function isHiddenGemsLogoPath(value = '') {
    return /hidden-gems-logo\.png|hg-blue\.png|hg-gold\.png/i.test(String(value));
  }

  function applyThemeLogos() {
    const theme = document.documentElement.dataset.hgTheme || (storage.getUserPreferences ? storage.getUserPreferences().theme : 'dark') || 'dark';
    const logoPath = getThemeLogoPath(theme);
    document.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (!img.dataset.hgThemeLogo && !isHiddenGemsLogoPath(src)) return;
      img.dataset.hgThemeLogo = 'true';
      if (src !== logoPath) img.setAttribute('src', logoPath);
      img.classList.toggle('shadow-pink-500/20', theme === 'dark' || theme === 'light');
      img.classList.toggle('shadow-blue-500/20', theme === 'midnight');
      img.classList.toggle('shadow-amber-500/20', theme === 'gold');
    });
    document.querySelectorAll('link[rel~="icon"]').forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (!isHiddenGemsLogoPath(href)) return;
      if (href !== logoPath) link.setAttribute('href', logoPath);
    });
  }

  function scheduleThemeLogoSync() {
    if (themeLogoRaf) return;
    themeLogoRaf = window.requestAnimationFrame(() => {
      themeLogoRaf = null;
      applyThemeLogos();
    });
  }

  function startThemeLogoObserver() {
    if (themeLogoObserverStarted || !document.body || !window.MutationObserver) return;
    themeLogoObserverStarted = true;
    const observer = new MutationObserver(scheduleThemeLogoSync);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function applyUserPreferences() {
    injectThemeStyles();
    const prefs = storage.getUserPreferences ? storage.getUserPreferences() : {};
    document.documentElement.dataset.hgTheme = prefs.theme || 'dark';
    document.documentElement.dataset.hgDensity = prefs.cardDensity || 'comfortable';
    scheduleThemeLogoSync();
    startThemeLogoObserver();
    if (prefs.reducedMotion) document.documentElement.classList.add('hg-reduced-motion');
    else document.documentElement.classList.remove('hg-reduced-motion');
  }

  function applyBg() {
    applyUserPreferences();
    const prefs = storage.getUserPreferences ? storage.getUserPreferences() : {};
    const theme = prefs.theme || 'dark';
    document.body.classList.add('min-h-screen');
    document.body.classList.toggle('bg-slate-50', theme === 'light');
    document.body.classList.toggle('text-slate-950', theme === 'light');
    document.body.classList.toggle('bg-black', theme !== 'light');
    document.body.classList.toggle('text-white', theme !== 'light');
    document.body.style.background = theme === 'light'
      ? 'radial-gradient(circle at top right, rgba(236,72,153,0.12), transparent 30%),radial-gradient(circle at left, rgba(217,70,239,0.08), transparent 24%),#f8fafc'
      : theme === 'midnight'
        ? 'radial-gradient(circle at top right, rgba(59,130,246,0.22), transparent 30%),radial-gradient(circle at left, rgba(168,85,247,0.14), transparent 24%),#020617'
        : theme === 'gold'
          ? 'radial-gradient(circle at top right, rgba(245,158,11,0.24), transparent 30%),radial-gradient(circle at left, rgba(217,119,6,0.16), transparent 24%),#050505'
          : 'radial-gradient(circle at top right, rgba(236,72,153,0.22), transparent 30%),radial-gradient(circle at left, rgba(217,70,239,0.14), transparent 24%),#000';
  }

  let supabaseClient = null;

  function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    if (!window.supabase || typeof window.supabase.createClient !== 'function' || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
    return supabaseClient;
  }

  async function resetSupabaseSession(reason = '') {
    const supabase = getSupabaseClient();
    if (!supabase?.auth) return null;
    try { await supabase.auth.signOut({ scope: 'local' }); } catch (error) {}
    try {
      Object.keys(window.localStorage || {}).filter((key) => /supabase|sb-|auth-token/i.test(key)).forEach((key) => {
        try { window.localStorage.removeItem(key); } catch (error) {}
      });
    } catch (error) {}
    try {
      Object.keys(window.sessionStorage || {}).filter((key) => /supabase|sb-|auth-token/i.test(key)).forEach((key) => {
        try { window.sessionStorage.removeItem(key); } catch (error) {}
      });
    } catch (error) {}
    if (reason) console.warn('Supabase session reset:', reason);
    return null;
  }

  function isInvalidJwtError(error) {
    const message = extractErrorMessage(error, '').toLowerCase();
    return /invalid jwt|jwt expired|missing sub|bad jwt|auth session missing/i.test(message);
  }

  async function getSessionUser() {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    try {
      const result = await supabase.auth.getSession();
      const session = result?.data?.session || null;
      if (session?.user && session?.access_token) return session.user;
      const userResult = await supabase.auth.getUser();
      return userResult?.data?.user || null;
    } catch (error) {
      if (isInvalidJwtError(error)) await resetSupabaseSession(extractErrorMessage(error, 'Invalid JWT'));
      return null;
    }
  }

  async function getProfile() {
    const user = await getSessionUser();
    if (!user) return { id: '', email: '', is_vip: false, role: 'guest' };
    const email = user.email || '';
    const cached = storage.getCachedProfile(email) || {};
    const profile = { id: user.id, email, is_vip: false, role: 'guest', ...cached };
    const supabase = getSupabaseClient();
    if (!supabase) return profile;
    try {
      const result = await supabase.from('profiles').select('id, email, is_vip, role').eq('id', user.id).maybeSingle();
      if (result?.data) {
        const merged = { ...profile, ...result.data, email: result.data.email || email };
        storage.cacheProfile(email, merged);
        return merged;
      }
    } catch (error) {}
    return profile;
  }

  let supabaseVideosCache = [];
  let supabaseVideosLoaded = false;
  let adminSupabaseVideosCache = [];
  let adminSupabaseVideosLoaded = false;
  let lastAdminVideoLoadError = '';
  let supabaseCategoriesCache = [];
  let supabaseCategoriesLoaded = false;
  let supabaseThumbnailsCache = [];
  let supabaseThumbnailsLoaded = false;
  const SESSION_CACHE_TTL_MS = 60 * 1000;

  function readSessionCache(key, ttl = SESSION_CACHE_TTL_MS) {
    try {
      const raw = window.sessionStorage ? sessionStorage.getItem(key) : '';
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.data === null || (!Array.isArray(parsed.data) && typeof parsed.data !== 'object')) return null;
      if (Date.now() - Number(parsed.savedAt || 0) > ttl) return null;
      return parsed.data;
    } catch (_) { return null; }
  }

  function writeSessionCache(key, data) {
    try {
      if (window.sessionStorage) sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
    } catch (_) {}
  }

  function clearSessionCache(key) {
    try { if (window.sessionStorage) sessionStorage.removeItem(key); } catch (_) {}
  }

  function hasSharedVideoCatalog() {
    return supabaseVideosCache.length > 0;
  }

  function shouldUseTemplateCatalog() {
    return false;
  }

  function extractErrorMessage(error, fallback = 'Unknown error.') {
    if (!error) return fallback;
    if (typeof error === 'string') return error;
    if (typeof error.message === 'string' && error.message.trim()) return error.message.trim();
    if (typeof error.error_description === 'string' && error.error_description.trim()) return error.error_description.trim();
    if (typeof error.details === 'string' && error.details.trim()) return error.details.trim();
    if (typeof error.hint === 'string' && error.hint.trim()) return error.hint.trim();
    return fallback;
  }

  function mapDbVideo(row = {}) {
    const slug = String(row.category_slug || row.category || 'creator-picks').trim() || 'creator-picks';
    const categoryTitle = categoryDisplayName(slug, row.category_title || row.categoryTitle || '');
    const published = row.is_published !== false && !row.deleted_at;
    return normalizeVideoItem({
      id: row.id,
      title: row.title,
      description: row.description,
      image: row.image || row.thumbnail_url || '',
      videoUrl: row.video_url || '',
      videoFile: row.video_file || '',
      sourceType: row.source_type || (row.video_storage_path ? 'file' : 'link'),
      categorySlug: slug,
      categoryTitle,
      category: categoryTitle,
      access: String(row.access_type || row.access || 'guest').toLowerCase() === 'vip' ? 'vip' : 'guest',
      priceCents: normalizePriceCents(row.price_cents),
      isPublished: published,
      isCustom: true,
      videoStoragePath: row.video_storage_path || '',
      videoFileName: row.video_file_name || '',
      videoMimeType: row.video_mime_type || '',
      previewImageEnabled: row.preview_image_enabled !== false,
      previewVideoEnabled: !!row.preview_video_enabled,
      previewImage: row.preview_image_url || '',
      previewImageUrl: row.preview_image_url || '',
      previewVideo: row.preview_video_url || '',
      previewVideoUrl: row.preview_video_url || '',
      externalFileUrl: row.external_file_url || '',
      paypalUrl: row.paypal_url || row.payment_url || '',
      paymentUrl: row.paypal_url || row.payment_url || '',
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || ''
    });
  }

  async function refreshSupabaseVideos(force = false) {
    const supabase = getSupabaseClient();
    if (!supabase) return supabaseVideosCache;
    if (supabaseVideosLoaded && !force) return supabaseVideosCache;
    if (!force) {
      const cached = readSessionCache('hg_public_videos_cache_v1');
      if (Array.isArray(cached)) {
        supabaseVideosCache = cached.map(normalizeVideoItem).filter((video) => video.isPublished !== false);
        supabaseVideosLoaded = true;
        return supabaseVideosCache;
      }
    } else {
      clearSessionCache('hg_public_videos_cache_v1');
    }
    try {
      const result = await supabase
        .from('hg_videos')
        .select('*')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
      const rows = Array.isArray(result?.data) ? result.data : [];
      supabaseVideosCache = rows.map(mapDbVideo).filter((video) => video.isPublished !== false);
      writeSessionCache('hg_public_videos_cache_v1', supabaseVideosCache);
      supabaseVideosLoaded = true;
    } catch (error) {
      console.error('Failed to refresh Supabase videos', error);
    }
    return supabaseVideosCache;
  }

  async function refreshAdminSupabaseVideos(force = false) {
    const supabase = getSupabaseClient();
    if (!supabase) return adminSupabaseVideosCache;
    if (adminSupabaseVideosLoaded && !force) return adminSupabaseVideosCache;
    lastAdminVideoLoadError = '';
    try {
      const result = await supabase
        .from('hg_videos')
        .select('*')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
      if (result?.error) throw result.error;
      const rows = Array.isArray(result?.data) ? result.data : [];
      adminSupabaseVideosCache = rows.map(mapDbVideo);
      adminSupabaseVideosLoaded = true;
    } catch (error) {
      lastAdminVideoLoadError = extractErrorMessage(error, 'Admin video list failed to load.');
      adminSupabaseVideosLoaded = true;
      console.error('Failed to refresh admin Supabase videos', error);
    }
    return adminSupabaseVideosCache;
  }

  function mapDbCategory(row = {}) {
    const slug = String(row.slug || '').trim().toLowerCase();
    return { slug, title: String(row.title || categoryDisplayName(slug)).trim(), description: String(row.description || '').trim(), isCore: !!row.is_core, deletedAt: row.deleted_at || null, updatedAt: row.updated_at || '' };
  }

  async function refreshSupabaseCategories(force = false) {
    const supabase = getSupabaseClient();
    if (!supabase) return supabaseCategoriesCache;
    if (supabaseCategoriesLoaded && !force) return supabaseCategoriesCache;
    if (!force) {
      const cached = readSessionCache('hg_categories_cache_v1');
      if (Array.isArray(cached)) {
        supabaseCategoriesCache = cached.map((item) => ({ ...item, slug: String(item.slug || '').trim().toLowerCase() })).filter((category) => category.slug);
        supabaseCategoriesLoaded = true;
        return supabaseCategoriesCache;
      }
    } else {
      clearSessionCache('hg_categories_cache_v1');
    }
    try {
      const result = await supabase.from('hg_categories').select('*').is('deleted_at', null).order('sort_order', { ascending: true }).order('title', { ascending: true });
      if (result?.error) throw result.error;
      const rows = Array.isArray(result?.data) ? result.data : [];
      supabaseCategoriesCache = rows.map(mapDbCategory).filter((category) => category.slug);
      const local = storage.getCategoryMeta();
      supabaseCategoriesCache.forEach((category) => { local[category.slug] = { ...(local[category.slug] || {}), title: category.title, description: category.description, slug: category.slug }; });
      writeJson(KEYS.categoryMeta, local);
      writeSessionCache('hg_categories_cache_v1', supabaseCategoriesCache);
      supabaseCategoriesLoaded = true;
    } catch (error) {
      console.error('Failed to refresh Supabase categories', error);
    }
    return supabaseCategoriesCache;
  }

  function mapDbThumbnail(row = {}) {
    return {
      id: String(row.id || '').trim(),
      url: String(row.image_url || row.url || '').trim(),
      title: String(row.title || row.file_name || 'Saved thumbnail').trim(),
      fileName: String(row.file_name || '').trim(),
      linkedVideoId: String(row.linked_video_id || '').trim(),
      createdAt: String(row.created_at || '').trim()
    };
  }

  async function refreshSupabaseThumbnails(force = false) {
    const supabase = getSupabaseClient();
    if (!supabase) return supabaseThumbnailsCache;
    if (supabaseThumbnailsLoaded && !force) return supabaseThumbnailsCache;
    try {
      const result = await supabase.from('hg_thumbnails').select('*').is('deleted_at', null).order('created_at', { ascending: false });
      if (result?.error) throw result.error;
      supabaseThumbnailsCache = uniqueThumbnailItems((result.data || []).map(mapDbThumbnail));
      supabaseThumbnailsCache.forEach((thumb) => storage.addThumbnail(thumb));
      supabaseThumbnailsLoaded = true;
    } catch (error) {
      console.error('Failed to refresh thumbnail library', error);
    }
    return supabaseThumbnailsCache;
  }

  function buildThumbnailLibrary() {
    const baseCatalog = window.HIDDEN_GEMS_CATALOG || {};
    const fromVideos = uniqueVideos([...Object.values(baseCatalog).flatMap((category) => category.videos || []), ...storage.getCustomVideos(), ...supabaseVideosCache, ...adminSupabaseVideosCache]).map((video) => ({ id: `video-${video.id}`, url: video.image, title: video.title || 'Video thumbnail', linkedVideoId: video.id })).filter((item) => item.url);
    return uniqueThumbnailItems([...supabaseThumbnailsCache, ...storage.getThumbnailLibrary(), ...fromVideos]);
  }

  async function saveThumbnailToSupabase(item = {}) {
    const url = String(item.url || item.imageUrl || '').trim();
    if (!url) return false;
    storage.addThumbnail(item);
    const supabase = getSupabaseClient();
    const user = await getSessionUser();
    if (!supabase || !user) return false;
    const payload = {
      id: String(item.id || `thumb-${Date.now()}`).trim(),
      image_url: url,
      title: String(item.title || item.fileName || 'Saved thumbnail').trim(),
      file_name: String(item.fileName || '').trim(),
      linked_video_id: String(item.linkedVideoId || '').trim() || null,
      created_by: user.id,
      updated_at: new Date().toISOString(),
      deleted_at: null
    };
    const result = await supabase.from('hg_thumbnails').upsert(payload, { onConflict: 'id' });
    if (result?.error) throw result.error;
    supabaseThumbnailsLoaded = false;
    return true;
  }

  let siteSettingsCache = {};
  let siteSettingsLoaded = false;

  async function refreshSiteSettings(force = false) {
    const supabase = getSupabaseClient();
    if (siteSettingsLoaded && !force) return siteSettingsCache;
    const local = storage.getSiteSettings ? storage.getSiteSettings() : {};
    siteSettingsCache = { ...local };
    if (!supabase) { siteSettingsLoaded = true; return siteSettingsCache; }
    if (!force) {
      const cached = readSessionCache('hg_site_settings_cache_v1');
      if (cached && typeof cached === 'object' && !Array.isArray(cached)) {
        siteSettingsCache = { ...siteSettingsCache, ...cached };
        siteSettingsLoaded = true;
        return siteSettingsCache;
      }
    } else {
      clearSessionCache('hg_site_settings_cache_v1');
    }
    try {
      const result = await supabase.from('hg_site_settings').select('key,value');
      if (result?.error) throw result.error;
      (result.data || []).forEach((row) => {
        const key = String(row.key || '').trim();
        if (!key) return;
        const value = row.value && typeof row.value === 'object' && 'value' in row.value ? row.value.value : row.value;
        siteSettingsCache[key] = value;
        if (storage.setSiteSetting) storage.setSiteSetting(key, value);
      });
      writeSessionCache('hg_site_settings_cache_v1', siteSettingsCache);
      siteSettingsLoaded = true;
    } catch (error) {
      console.error('Failed to refresh site settings', error);
      siteSettingsLoaded = true;
    }
    return siteSettingsCache;
  }

  function getSiteSetting(key, fallback = '') {
    const local = storage.getSiteSetting ? storage.getSiteSetting(key, fallback) : fallback;
    return typeof siteSettingsCache[key] === 'undefined' ? local : siteSettingsCache[key];
  }

  async function saveSiteSettingToSupabase(key, value) {
    const safeKey = String(key || '').trim();
    if (!safeKey) return false;
    if (storage.setSiteSetting) storage.setSiteSetting(safeKey, value);
    siteSettingsCache[safeKey] = value;
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const result = await supabase.from('hg_site_settings').upsert({ key: safeKey, value: { value }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (result?.error) throw result.error;
    siteSettingsLoaded = false;
    clearSessionCache('hg_site_settings_cache_v1');
    return true;
  }

  function applyHomeShowcaseImage() {
    const img = document.getElementById('home-showcase-image');
    if (!img) return;
    const url = String(getSiteSetting('home_showcase_image', '') || '').trim();
    if (url) img.src = url;
  }

  async function saveCategoryToSupabase(category) {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const slug = String(category?.slug || '').trim().toLowerCase();
    if (!slug) return false;
    const payload = { slug, title: String(category.title || titleFromSlug(slug)).trim(), description: String(category.description || '').trim(), is_core: CATEGORY_ORDER.includes(slug), deleted_at: null, updated_at: new Date().toISOString() };
    const result = await supabase.from('hg_categories').upsert(payload, { onConflict: 'slug' });
    if (result?.error) throw result.error;
    supabaseCategoriesLoaded = false;
    clearSessionCache('hg_categories_cache_v1');
    return true;
  }

  async function deleteCategoryFromSupabase(slug) {
    const supabase = getSupabaseClient();
    const key = String(slug || '').trim().toLowerCase();
    if (!supabase || !key || CATEGORY_ORDER.includes(key)) return false;
    await supabase.from('hg_videos').update({ category_slug: 'creator-picks', category_title: categoryDisplayName('creator-picks'), category: categoryDisplayName('creator-picks'), updated_at: new Date().toISOString() }).eq('category_slug', key);
    const result = await supabase.from('hg_categories').update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('slug', key);
    if (result?.error) throw result.error;
    supabaseCategoriesLoaded = false;
    supabaseVideosLoaded = false;
    clearSessionCache('hg_categories_cache_v1');
    clearSessionCache('hg_public_videos_cache_v1');
    return true;
  }

  async function uploadVideoToSupabaseStorage(file, id) {
    const supabase = getSupabaseClient();
    if (!supabase || !file) return null;
    const ext = ((file.name || '').split('.').pop() || 'mp4').toLowerCase();
    const path = `videos/${id}/main.${ext}`;
    const result = await supabase.storage.from('hg-videos').upload(path, file, { upsert: true, contentType: file.type || 'video/mp4', cacheControl: '3600' });
    if (result?.error) throw new Error(extractErrorMessage(result.error, 'Storage upload failed.'));
    return { path, fileName: file.name || `main.${ext}`, mimeType: file.type || 'video/mp4' };
  }

  async function createSignedVideoUrl(path) {
    const supabase = getSupabaseClient();
    if (!supabase || !path) return '';
    const result = await supabase.storage.from('hg-videos').createSignedUrl(path, 60 * 60);
    if (result?.error) throw result.error;
    return result?.data?.signedUrl || '';
  }

  async function removeVideoFromSupabase(id, storagePath = '') {
    const supabase = getSupabaseClient();
    if (!supabase || !id) return;
    if (storagePath) {
      try { await supabase.storage.from('hg-videos').remove([storagePath]); } catch (error) { console.error(error); }
    }
    const result = await supabase.from('hg_videos').delete().eq('id', id);
    if (result?.error) throw result.error;
    supabaseVideosLoaded = false;
    adminSupabaseVideosLoaded = false;
    clearSessionCache('hg_public_videos_cache_v1');
  }

  function stripUnsupportedHgVideoColumns(payload, error) {
    const message = String(error?.message || error?.details || error?.hint || error || '');
    const match = message.match(/Could not find the '([^']+)' column of 'hg_videos'/i);
    if (!match || !match[1] || !(match[1] in payload)) return null;
    const nextPayload = { ...payload };
    delete nextPayload[match[1]];
    return nextPayload;
  }

  async function upsertHgVideoPayload(supabase, payload) {
    let nextPayload = { ...payload };
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const result = await supabase.from('hg_videos').upsert(nextPayload, { onConflict: 'id' });
      if (!result?.error) return result;
      const stripped = stripUnsupportedHgVideoColumns(nextPayload, result.error);
      if (!stripped) throw result.error;
      nextPayload = stripped;
    }
    throw new Error('Video save failed because the hg_videos schema is missing required columns. Run the latest SQL update and try again.');
  }

  async function saveVideoToSupabase(item) {
    const supabase = getSupabaseClient();
    const user = await getSessionUser();
    if (!supabase) throw new Error('Supabase is not configured in config.js.');
    if (!user) throw new Error('You must be signed in before saving a video.');
    const resolvedCategoryTitle = categoryDisplayName(item.categorySlug, item.categoryTitle || item.category || '');
    const payload = {
      id: item.id,
      title: item.title,
      description: item.description,
      image: item.image || '',
      thumbnail_url: item.image || '',
      video_url: item.sourceType === 'link' ? (item.videoUrl || '') : '',
      video_file: item.sourceType === 'file' ? (item.videoFile || '') : '',
      video_file_name: item.videoFileName || '',
      video_mime_type: item.videoMimeType || '',
      source_type: item.sourceType || (item.videoStoragePath ? 'file' : 'link'),
      category: resolvedCategoryTitle,
      category_slug: item.categorySlug,
      category_title: resolvedCategoryTitle,
      access_type: item.access,
      price_cents: normalizePriceCents(item.priceCents),
      video_storage_path: item.videoStoragePath || null,
      preview_image_enabled: item.previewImageEnabled !== false,
      preview_video_enabled: !!item.previewVideoEnabled,
      preview_image_url: item.previewImage || item.previewImageUrl || null,
      preview_video_url: item.previewVideo || item.previewVideoUrl || null,
      external_file_url: item.externalFileUrl || null,
      paypal_url: item.paypalUrl || item.paymentUrl || null,
      is_published: item.isPublished !== false,
      deleted_at: null,
      created_by: user.id,
      updated_at: new Date().toISOString()
    };
    const result = await upsertHgVideoPayload(supabase, payload);
    if (result?.error) throw new Error(extractErrorMessage(result.error, 'Database save failed.'));
    supabaseVideosLoaded = false;
    adminSupabaseVideosLoaded = false;
    clearSessionCache('hg_public_videos_cache_v1');
    return true;
  }

  function getRoleForAccount(user, email, profile) {
    const normalized = String(email || user?.email || '').trim().toLowerCase();
    const userId = String(user?.id || profile?.id || '').trim().toLowerCase();
    if (userId && ADMIN_USER_IDS.includes(userId)) return 'admin';
    if (normalized && ADMIN_EMAILS.includes(normalized)) return 'admin';
    const override = normalized ? storage.getRoleOverride(normalized) : '';
    if (override === 'admin') return 'admin';
    if (override === 'vip') return 'vip';
    if (override === 'guest') return 'guest';
    if (profile?.role && ['guest','vip','admin'].includes(String(profile.role).toLowerCase())) return String(profile.role).toLowerCase();
    if (profile?.is_vip) return 'vip';
    return 'guest';
  }

  async function getState() {
    const user = await getSessionUser();
    const profile = await getProfile();
    const email = profile.email || user?.email || '';
    const role = getRoleForAccount(user, email, profile);
    return { user, profile: { ...profile, email, role }, email, role, unlocked: storage.getUnlocked() };
  }

  function hasConfiguredPaymentFunction() {
    return !!PAYMENT_FUNCTION_URL && !PAYMENT_FUNCTION_URL.includes('REPLACE_WITH');
  }

  async function getSupabaseAccessToken(forceRefresh = false) {
    const supabase = getSupabaseClient();
    if (!supabase?.auth?.getSession) return '';
    try {
      let result = await supabase.auth.getSession();
      let session = result?.data?.session || null;
      if ((forceRefresh || !session?.access_token) && supabase.auth.refreshSession) {
        const refreshed = await supabase.auth.refreshSession();
        session = refreshed?.data?.session || session;
      }
      return session?.access_token || '';
    } catch (error) {
      if (isInvalidJwtError(error)) await resetSupabaseSession(extractErrorMessage(error, 'Invalid JWT'));
      return '';
    }
  }

  async function updateCurrentUserProfile(patch = {}) {
    const user = await getSessionUser();
    if (!user?.id || !user?.email) throw new Error('Please sign in before updating your account.');
    const email = String(user.email || '').trim().toLowerCase();
    const cached = storage.getCachedProfile(email) || { email, is_vip: false, role: 'guest' };
    const next = { ...cached, ...patch, email };
    const isConfiguredAdmin = ADMIN_EMAILS.includes(email) || ADMIN_USER_IDS.includes(String(user.id || '').toLowerCase());
    if (isConfiguredAdmin) next.role = 'admin';
    else if (typeof next.is_vip !== 'undefined' && next.role !== 'admin') next.role = next.is_vip ? 'vip' : 'guest';
    storage.cacheProfile(email, next);
    const supabase = getSupabaseClient();
    if (supabase) {
      const payload = { id: user.id, email, is_vip: !!next.is_vip, role: next.role || (next.is_vip ? 'vip' : 'guest') };
      const result = await supabase.from('profiles').upsert(payload).select('email, is_vip, role').single();
      if (result?.error) throw result.error;
      const merged = { ...next, ...(result.data || {}), email };
      storage.cacheProfile(email, merged);
      window.dispatchEvent(new CustomEvent('hg:state-changed'));
      return merged;
    }
    window.dispatchEvent(new CustomEvent('hg:state-changed'));
    return next;
  }

  async function callPaymentFunction(payload) {
    if (!hasConfiguredPaymentFunction()) throw new Error('Stripe/payment function is not configured in config.js.');

    const sendRequest = async (accessToken) => {
      const response = await fetch(PAYMENT_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(payload)
      });
      const raw = await response.text().catch(() => '');
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { error: raw || '' }; }
      return { response, data };
    };

    let accessToken = await getSupabaseAccessToken();
    if (!accessToken) accessToken = await getSupabaseAccessToken(true);
    if (!accessToken) throw new Error('Please sign in again before checkout so Hidden Gems can connect the payment to your account.');

    let { response, data } = await sendRequest(accessToken);
    if (!response.ok) {
      const details = data && typeof data === 'object' ? String(data.error || data.message || data.details || '').trim() : '';
      if (response.status === 401 || /invalid jwt/i.test(details)) {
        const refreshedAccessToken = await getSupabaseAccessToken(true);
        if (refreshedAccessToken && refreshedAccessToken !== accessToken) {
          ({ response, data } = await sendRequest(refreshedAccessToken));
        }
      }
    }

    if (!response.ok) {
      const details = data && typeof data === 'object' ? (data.error || data.message || data.details || '') : '';
      throw new Error(String(details || `Payment service error (${response.status}).`).trim());
    }
    return data;
  }
  const PENDING_STRIPE_VIP_KEY = 'hg_pending_stripe_vip';
  const PENDING_STRIPE_VIP_MAX_AGE_MS = 2 * 60 * 60 * 1000;

  async function startVipCheckout() {
    const target = String(STRIPE_VIP_SUBSCRIPTION_LINK || '').trim();
    if (!target || target.includes('REPLACE_WITH')) throw new Error('Add your real VIP checkout link in config.js.');
    let state = {};
    try { state = await getState(); } catch (_) {}
    if (!state?.user?.id || !state?.email) {
      try { sessionStorage.setItem('hg_return_after_login', 'vip-checkout.html'); } catch (_) {}
      toast('Please sign in before starting VIP checkout so VIP unlocks on the correct account.', 'error');
      setTimeout(() => { window.location.href = 'login.html'; }, 900);
      return false;
    }
    const createdAt = new Date();
    writeJson(PENDING_STRIPE_VIP_KEY, { email: String(state.email || '').trim().toLowerCase(), userId: String(state.user.id || '').trim(), createdAt: createdAt.toISOString(), expiresAt: new Date(createdAt.getTime() + PENDING_STRIPE_VIP_MAX_AGE_MS).toISOString() });
    try {
      const url = new URL(target, window.location.href);
      if (state.email && !url.searchParams.has('prefilled_email')) url.searchParams.set('prefilled_email', state.email);
      if (state.user?.id && !url.searchParams.has('client_reference_id')) url.searchParams.set('client_reference_id', `hg_vip:user:${state.user.id}`);
      window.location.href = url.toString();
    } catch (_) { window.location.href = target; }
    return true;
  }

  async function finalizeCheckoutFromUrl() {
    const query = new URLSearchParams(window.location.search || '');
    const token = String(query.get('token') || '').trim();
    const kind = String(query.get('kind') || '').trim();
    const packId = String(query.get('pack') || '').trim();
    if (!token) return { status: 'idle' };
    if (!hasConfiguredPaymentFunction()) {
      throw new Error('The payment capture function is not configured yet, so automatic purchase/VIP fulfillment cannot complete.');
    }
    const result = await callPaymentFunction({ action: 'capture', orderId: token, kind, packId });
    const state = await getState();
    return { ...result, role: state.role };
  }

  async function syncVipForCurrentUser(isVip) {
    const user = await getSessionUser();
    if (!user?.email) return false;
    const email = user.email;
    const cached = storage.getCachedProfile(email) || { email, is_vip: false, role: 'guest' };
    storage.cacheProfile(email, { ...cached, email, is_vip: !!isVip });
    const supabase = getSupabaseClient();
    if (supabase) {
      try { await supabase.from('profiles').upsert({ id: user.id, email, is_vip: !!isVip, role: isVip ? 'vip' : (cached.role || 'guest') }); } catch (error) {}
    }
    window.dispatchEvent(new CustomEvent('hg:state-changed'));
    return true;
  }

  function allCategories() {
    const baseCatalog = window.HIDDEN_GEMS_CATALOG || {};
    const deleted = new Set(storage.getDeletedCategories ? storage.getDeletedCategories() : []);
    const localMeta = storage.getCategoryMeta ? storage.getCategoryMeta() : {};
    const catalog = Object.fromEntries(Object.entries(baseCatalog).map(([slug, category]) => [slug, {
      ...category, title: categoryDisplayName(slug, category.title), subtitle: categoryDescription(slug, category.subtitle),
      count: '0 videos', slug, vip: slug === 'vip-exclusives', access: slug === 'vip-exclusives' ? 'vip' : 'guest', videos: []
    }]));
    Object.entries(localMeta).forEach(([slug, meta]) => {
      if (!slug || deleted.has(slug)) return;
      if (!catalog[slug]) catalog[slug] = { title: categoryDisplayName(slug, meta.title), subtitle: categoryDescription(slug, meta.description), count: '0 videos', slug, access: 'guest', videos: [] };
      catalog[slug].title = categoryDisplayName(slug, meta.title); catalog[slug].subtitle = categoryDescription(slug, meta.description || catalog[slug].subtitle);
    });
    supabaseCategoriesCache.forEach((meta) => {
      const slug = String(meta.slug || '').trim().toLowerCase(); if (!slug || deleted.has(slug)) return;
      if (!catalog[slug]) catalog[slug] = { title: categoryDisplayName(slug, meta.title), subtitle: categoryDescription(slug, meta.description), count: '0 videos', slug, access: 'guest', videos: [] };
      catalog[slug].title = categoryDisplayName(slug, meta.title); catalog[slug].subtitle = categoryDescription(slug, meta.description || catalog[slug].subtitle);
    });
    Object.entries(catalog).forEach(([slug, category]) => { category.slug = slug; category.title = categoryDisplayName(slug, category.title); category.subtitle = categoryDescription(slug, category.subtitle); category.access = category.vip ? 'vip' : 'guest'; category.videos = []; });
    for (const rawVideo of storage.getCustomVideos()) {
      const video = normalizeVideoItem({ ...normalizeVideoItem(rawVideo), ...rawVideo, isCustom: true });
      const slug = deleted.has(video.categorySlug) ? 'creator-picks' : (video.categorySlug || 'creator-picks');
      if (!catalog[slug]) catalog[slug] = { title: categoryDisplayName(slug, video.categoryTitle), subtitle: categoryDescription(slug, 'Custom admin-managed category.'), count: 'Custom', slug, access: video.access, videos: [] };
      catalog[slug].title = categoryDisplayName(slug, catalog[slug].title || video.categoryTitle); catalog[slug].videos.push({ ...video, categorySlug: slug, category: catalog[slug].title, categoryTitle: catalog[slug].title });
    }
    for (const rawVideo of supabaseVideosCache) {
      const video = normalizeVideoItem({ ...rawVideo, isCustom: true });
      const slug = deleted.has(video.categorySlug) ? 'creator-picks' : (video.categorySlug || 'creator-picks');
      if (!catalog[slug]) catalog[slug] = { title: categoryDisplayName(slug, video.categoryTitle), subtitle: categoryDescription(slug, 'Custom admin-managed category.'), count: 'Custom', slug, access: video.access, videos: [] };
      catalog[slug].title = categoryDisplayName(slug, catalog[slug].title || video.categoryTitle);
      const existingIndex = (catalog[slug].videos || []).findIndex((entry) => String(entry.id) === String(video.id));
      const mergedVideo = { ...video, categorySlug: slug, category: catalog[slug].title, categoryTitle: catalog[slug].title };
      if (existingIndex >= 0) catalog[slug].videos[existingIndex] = mergedVideo; else catalog[slug].videos.push(mergedVideo);
    }
    Object.entries(catalog).forEach(([slug, category]) => {
      category.title = categoryDisplayName(slug, category.title); category.subtitle = categoryDescription(slug, category.subtitle);
      category.vip = slug === 'vip-exclusives' || (category.videos || []).some((video) => String(video.access || '').toLowerCase() === 'vip');
      category.access = category.vip ? 'vip' : 'guest';
      category.videos = uniqueVideos((category.videos || []).map((video) => ({ ...video, category: categoryDisplayName(video.categorySlug || slug, video.category || category.title), categoryTitle: categoryDisplayName(video.categorySlug || slug, video.categoryTitle || category.title) })));
      category.count = `${category.videos.length} videos`;
    });
    return Object.fromEntries(Object.entries(catalog).filter(([slug]) => !deleted.has(slug)).sort((a, b) => categorySortIndex(a[0]) - categorySortIndex(b[0])));
  }

  function allVideos() {
    const catalog = allCategories();
    const overrides = storage.getVideoOverrides ? storage.getVideoOverrides() : {};
    return uniqueVideos(Object.entries(catalog).flatMap(([slug, category]) => (category.videos || []).map((video) => {
      const override = overrides[String(video.id)] || {};
      const merged = { ...video, ...override };
      return {
        ...normalizeVideoItem(merged),
        ...override,
        category: categoryDisplayName(merged.categorySlug || slug, merged.categoryTitle || category.title),
        categoryTitle: categoryDisplayName(merged.categorySlug || slug, merged.categoryTitle || category.title),
        categorySlug: merged.categorySlug || slug,
        access: merged.access === 'vip' ? 'vip' : 'guest',
        vip: merged.access === 'vip'
      };
    })));
  }

  function getCategory(slug) { const catalog = allCategories(); return catalog[slug] ? { ...catalog[slug], slug, title: categoryDisplayName(slug, catalog[slug].title), videos: allVideos().filter((video) => video.categorySlug === slug) } : null; }
  function getVideo(id) { return allVideos().find((video) => video.id === id) || null; }
  function adminAllVideos() {
    const catalog = allCategories();
    const videos = uniqueVideos([...storage.getCustomVideos(), ...supabaseVideosCache, ...adminSupabaseVideosCache].map((rawVideo) => {
      const video = normalizeVideoItem({ ...normalizeVideoItem(rawVideo), ...rawVideo, isCustom: true });
      const slug = video.categorySlug || 'creator-picks';
      const category = catalog[slug];
      const title = categoryDisplayName(slug, video.categoryTitle || video.category || category?.title || titleFromSlug(slug));
      return { ...video, categorySlug: slug, category: title, categoryTitle: title };
    }));
    return videos;
  }
  function getAdminVideo(id) { return adminAllVideos().find((video) => String(video.id) === String(id)) || getVideo(id); }
  function canAccessVideo(role, video) { if (!video) return false; if (role === 'admin') return true; if (video.access === 'guest') return true; return role === 'vip'; }

  const VIP_DEAL = { regular: '$39.99', sale: '$19.99', discount: '50% OFF', duration: '30 days' };

  function vipDealMarkup(extraClass = '') {
    return `<div class="${extraClass} rounded-2xl border border-pink-400/30 bg-pink-500/10 p-4"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-xs font-semibold uppercase tracking-[0.25em] text-pink-300">Limited VIP Deal</p><div class="mt-2 flex flex-wrap items-end gap-3"><span class="text-3xl font-black text-white">${VIP_DEAL.sale}</span><span class="pb-1 text-lg text-neutral-500 line-through">${VIP_DEAL.regular}</span><span class="mb-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-200">${VIP_DEAL.discount}</span></div><p class="mt-1 text-sm text-neutral-300">VIP access for ${VIP_DEAL.duration}.</p></div><div class="text-left sm:text-right"><p class="text-xs uppercase tracking-[0.2em] text-neutral-400">Deal timer</p><p data-vip-countdown class="mt-1 font-mono text-lg font-bold text-pink-200">Loading...</p></div></div></div>`;
  }

  let vipCountdownTimer = null;
  function updateVipCountdown() {
    const deadline = Date.parse(storage.getVipDealDeadline ? storage.getVipDealDeadline() : new Date(Date.now() + 30 * 86400000).toISOString());
    const remaining = Math.max(0, deadline - Date.now());
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const label = `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    document.querySelectorAll('[data-vip-countdown]').forEach((node) => { node.textContent = label; });
  }

  function startVipDealCountdown() {
    updateVipCountdown();
    if (vipCountdownTimer) return;
    vipCountdownTimer = setInterval(updateVipCountdown, 1000);
  }

  function roleBadge(role) {
    const map = {
      admin: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
      vip: 'border-pink-400/30 bg-pink-500/10 text-pink-300',
      guest: 'border-white/10 bg-white/5 text-neutral-300'
    };
    return `<span class="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${map[role] || map.guest}">${role}</span>`;
  }

  function shellHeader() {
    return `
      <header class="sticky top-0 z-50 border-b border-white/10 bg-black/75 backdrop-blur-xl">
        <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="index.html" class="flex items-center gap-4">
            <img data-hg-theme-logo="true" src="./assets/hidden-gems-logo.png" alt="${BRAND_NAME} logo" class="h-14 w-14 rounded-2xl object-contain shadow-lg shadow-pink-500/20" />
            <div>
              <h1 class="text-2xl font-bold tracking-[0.08em] text-pink-400">${BRAND_NAME.toUpperCase()}</h1>
              <p class="text-xs text-neutral-400">Guest, VIP, and admin access built in</p>
            </div>
          </a>
          <nav class="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2 py-2 text-sm text-neutral-300 lg:flex">
            <a data-nav-link="home" href="index.html" class="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-pink-300">Home</a>
            <a data-nav-link="all-videos" href="all-videos.html" class="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-pink-300">All Videos</a>
            <a data-nav-link="new-releases" href="index.html#categories" class="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-pink-300">Categories</a>
            <a data-nav-link="vip-exclusives" href="vip-exclusives.html" class="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-pink-300">VIP</a>
            <a data-nav-link="my-library" href="my-library.html" class="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-pink-300">Library</a>
            <a data-nav-link="account" href="account.html" class="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-pink-300">Account</a>
            <a data-nav-link="settings" href="settings.html" class="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-pink-300">Settings</a>
            <a id="header-admin-link" data-nav-link="admin" href="admin.html" class="hidden rounded-full px-4 py-2 text-amber-200 transition hover:bg-amber-500/10">Admin</a>
          </nav>
          <div class="flex items-center gap-3">
            <button id="mobile-menu-button" class="rounded-xl border border-white/10 px-3 py-2 text-sm text-white md:hidden">Menu</button>
            <div id="desktop-auth-slot" class="hidden items-center gap-3 md:flex"></div>
          </div>
        </div>
        <div id="mobile-menu" class="hidden border-t border-white/10 bg-black/95 px-6 py-4 md:hidden">
          <div class="flex flex-col gap-4 text-sm text-neutral-300">
            <a href="index.html">Home</a>
            <a href="index.html#categories">Categories</a>
            <a href="all-videos.html">All Videos</a>
            <a href="index.html#categories">Categories</a>
            <a href="vip-exclusives.html">VIP</a>
            <a href="my-library.html">Library</a>
            <a href="account.html">Account</a>
            <a href="settings.html">Settings</a>
            <a id="mobile-header-admin-link" href="admin.html" class="hidden text-amber-200">Admin Portal</a>
            <div id="mobile-auth-slot" class="mt-2 flex flex-col gap-3 border-t border-white/10 pt-4"></div>
          </div>
        </div>
      </header>`;
  }

  function shellFooter() {
    return `<footer class="border-t border-white/10 bg-black/60"><div class="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1.2fr_1fr_1fr_1fr]"><div><h4 class="text-xl font-bold text-pink-400">${BRAND_NAME}</h4><p class="mt-3 max-w-sm text-sm text-neutral-400">Premium digital video access with secure checkout, VIP vault content, and approved PikPak/Mega delivery links.</p></div><div><h5 class="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-300">Explore</h5><div class="mt-4 space-y-3"><a href="new-releases.html" class="block text-sm text-neutral-400 transition hover:text-white">New Releases</a><a href="most-popular.html" class="block text-sm text-neutral-400 transition hover:text-white">Most Popular</a><a href="vip-exclusives.html" class="block text-sm text-neutral-400 transition hover:text-white">VIP Exclusives</a></div></div><div><h5 class="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-300">Account</h5><div class="mt-4 space-y-3"><a href="account.html" class="block text-sm text-neutral-400 transition hover:text-white">Account</a><a href="my-library.html" class="block text-sm text-neutral-400 transition hover:text-white">My Library</a><a href="all-videos.html" class="block text-sm text-neutral-400 transition hover:text-white">All Videos</a><a href="points-store.html" class="block text-sm text-neutral-400 transition hover:text-white">Access Info</a><a id="footer-admin-link" href="admin.html" class="hidden block text-sm text-neutral-400 transition hover:text-white">Admin Portal</a></div></div><div><h5 class="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-300">Policies</h5><div class="mt-4 space-y-3"><a href="about.html" class="block text-sm text-neutral-400 transition hover:text-white">About</a><a href="contact.html" class="block text-sm text-neutral-400 transition hover:text-white">Contact</a><a href="privacy.html" class="block text-sm text-neutral-400 transition hover:text-white">Privacy Policy</a><a href="terms.html" class="block text-sm text-neutral-400 transition hover:text-white">Terms</a><a href="refund-policy.html" class="block text-sm text-neutral-400 transition hover:text-white">Refund Policy</a></div></div></div></footer>`;
  }

  function authButtonsMarkup() { return `<a href="login.html" class="rounded-xl border border-white/15 px-4 py-2 text-sm text-white transition hover:bg-white/5">Log In</a><a href="signup.html" class="rounded-xl bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-pink-500/20 transition hover:bg-pink-400">Sign Up</a>`; }

  function desktopAccountMarkup(state) {
    return `<div class="relative"><button id="account-menu-button" class="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-3 text-left text-white transition hover:border-pink-400/30 hover:bg-white/10"><span class="flex h-10 w-10 items-center justify-center rounded-full bg-pink-500/20 text-sm font-bold text-pink-300">${initialsFromEmail(state.email)}</span><span class="hidden max-w-[160px] truncate text-sm font-medium xl:block">${escapeHtml(state.email)}</span><svg class="h-4 w-4 text-neutral-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.512a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg></button><div id="account-menu-dropdown" class="hidden absolute right-0 top-[calc(100%+12px)] z-50 w-72 overflow-hidden rounded-[1.5rem] border border-white/10 bg-neutral-950/95 p-2 shadow-2xl shadow-black/60"><div class="rounded-[1.25rem] border border-white/5 bg-white/[0.03] p-4"><div class="flex items-start justify-between gap-3"><div><p class="truncate text-sm font-semibold text-white">${escapeHtml(state.email)}</p><p class="mt-1 text-xs text-neutral-400">Signed in to ${BRAND_NAME}</p></div>${roleBadge(state.role)}</div><p class="mt-3 text-xs text-neutral-500">Use the header links for navigation. This menu is only for account status and logout.</p></div><button id="logout-button-menu" class="mt-2 w-full rounded-xl px-4 py-3 text-left text-sm text-rose-200 transition hover:bg-rose-500/10">Log Out</button></div></div>`;
  }

  function mobileAccountMarkup(state) {
    return `<a href="account.html" class="transition hover:text-pink-300">Your Account</a><a href="my-library.html" class="transition hover:text-pink-300">My Library</a><a href="settings.html" class="transition hover:text-pink-300">Settings</a><a href="points-store.html" class="transition hover:text-pink-300">Access Info</a><a href="vip-checkout.html" class="transition hover:text-pink-300">VIP Checkout</a>${state.role === 'admin' ? '<a href="admin.html" class="text-amber-200 transition hover:text-amber-100">Admin Portal</a>' : ''}<div class="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-neutral-400">Signed in as <span class="font-semibold text-white">${escapeHtml(state.email)}</span> · <span class="uppercase text-pink-300">${state.role}</span></div><button id="logout-button-mobile" class="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-left text-rose-200 transition hover:bg-rose-500/20">Log Out</button>`;
  }

  async function signOutUser() {
    const supabase = getSupabaseClient();
    if (supabase) { try { await supabase.auth.signOut(); } catch (error) {} }
    window.location.href = 'index.html';
  }

  async function refreshHeaderUi() {
    const desktop = document.getElementById('desktop-auth-slot');
    const mobile = document.getElementById('mobile-auth-slot');
    if (!desktop && !mobile) return;
    const state = await getState();
    if (desktop) { desktop.innerHTML = state.email ? desktopAccountMarkup(state) : authButtonsMarkup(); desktop.classList.remove('hidden'); desktop.classList.add('flex'); }
    if (mobile) mobile.innerHTML = state.email ? mobileAccountMarkup(state) : '<a href="login.html">Log In</a><a href="signup.html">Create Account</a>';
    document.querySelectorAll('#header-admin-link, #mobile-header-admin-link, #legacy-home-admin-link').forEach((link) => link.classList.toggle('hidden', state.role !== 'admin'));
    document.querySelectorAll('[data-nav-link]').forEach((link) => { if (link.dataset.navLink === currentPageKey()) link.classList.add('bg-white/10', 'text-pink-300'); });
    const menuButton = document.getElementById('account-menu-button');
    const dropdown = document.getElementById('account-menu-dropdown');
    if (menuButton && dropdown) {
      const close = () => dropdown.classList.add('hidden');
      menuButton.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); dropdown.classList.toggle('hidden'); });
      document.addEventListener('click', (event) => { if (!dropdown.contains(event.target) && !menuButton.contains(event.target)) close(); });
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
    }
    document.getElementById('logout-button-menu')?.addEventListener('click', signOutUser);
    document.getElementById('logout-button-mobile')?.addEventListener('click', signOutUser);
  }

  function bindCommonUi() { document.getElementById('mobile-menu-button')?.addEventListener('click', () => document.getElementById('mobile-menu')?.classList.toggle('hidden')); refreshHeaderUi(); }
  function mountSharedHeader(targetId = 'app-header') { const target = document.getElementById(targetId); if (!target) return; target.outerHTML = shellHeader(); bindCommonUi(); }

  function syncLegacyHomeHeader(state) {
    const loggedOut = document.getElementById('logged-out-actions');
    const loggedIn = document.getElementById('logged-in-actions');
    if (!loggedOut || !loggedIn) return;
    if (!state.email) { loggedOut.classList.remove('hidden'); loggedIn.classList.add('hidden'); return; }
    loggedOut.classList.add('hidden'); loggedIn.classList.remove('hidden');
    const short = document.getElementById('account-email-short');
    const full = document.getElementById('account-email-full');
    const avatar = document.getElementById('account-avatar');
    if (short) short.textContent = state.email;
    if (full) full.textContent = state.email;
    if (avatar) avatar.textContent = initialsFromEmail(state.email);
    const dropdown = document.getElementById('account-dropdown');
    const button = document.getElementById('account-menu-button');
    button?.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); dropdown?.classList.toggle('hidden'); });
    document.addEventListener('click', (event) => { if (dropdown && button && !dropdown.contains(event.target) && !button.contains(event.target)) dropdown.classList.add('hidden'); });
    if (document.getElementById('legacy-home-admin-link')) document.getElementById('legacy-home-admin-link').classList.toggle('hidden', state.role !== 'admin');
    if (false && state.role === 'admin' && !document.getElementById('legacy-admin-link')) {
      const adminLink = document.createElement('a');
      adminLink.id = 'legacy-admin-link';
      adminLink.href = 'admin.html';
      adminLink.className = 'block rounded-xl px-3 py-3 text-sm text-amber-200 transition hover:bg-white/5';
      adminLink.textContent = 'Admin Portal';
      dropdown?.querySelector('.p-2')?.insertBefore(adminLink, document.getElementById('logout-button'));
    }
    if (false && !document.getElementById('legacy-settings-link')) {
      const settingsLink = document.createElement('a');
      settingsLink.id = 'legacy-settings-link';
      settingsLink.href = 'settings.html';
      settingsLink.className = 'block rounded-xl px-3 py-3 text-sm text-white transition hover:bg-white/5';
      settingsLink.textContent = 'Settings';
      dropdown?.querySelector('.p-2')?.insertBefore(settingsLink, document.getElementById('logout-button'));
    }
    document.getElementById('logout-button')?.addEventListener('click', signOutUser);
  }

  function renderHomeFeaturedGrid(state, videos) {
    const grid = document.getElementById('featured-grid');
    if (!grid) return;
    const featured = videos.slice().sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
      return bTime - aTime;
    }).slice(0, 3);
    if (!featured.length) {
      grid.innerHTML = '<div class="md:col-span-2 xl:col-span-3 rounded-[1.75rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-neutral-300">No live videos yet. Add videos from the admin portal and they will appear here automatically.</div>';
      return;
    }
    renderVideoCards(grid, featured, state);
  }

  function renderHomeCategoryGrid(categories) {
    const grid = document.getElementById('category-grid-home'); if (!grid) return;
    const cards = Object.entries(categories).sort((a, b) => categorySortIndex(a[0]) - categorySortIndex(b[0])).map(([slug, category]) => {
      const subtitle = categoryDescription(slug, category.subtitle);
      return `<div ${slug === 'vip-exclusives' ? 'id="vip-category-card"' : ''} class="rounded-[1.75rem] border border-white/10 bg-neutral-900/70 p-6 transition hover:border-pink-400/30 hover:bg-neutral-900"><div class="mb-8 inline-flex rounded-2xl bg-pink-500/10 px-4 py-2 text-sm font-medium text-pink-300">${(category.videos || []).length} videos</div><h4 class="text-2xl font-bold">${escapeHtml(category.title || categoryDisplayName(slug))}</h4><p class="mt-3 text-sm text-neutral-400">${escapeHtml(subtitle)}</p><a href="${categoryPageHref(slug)}" class="mt-6 inline-block text-sm font-semibold text-pink-300 transition hover:text-pink-200">View category →</a></div>`;
    }).join('');
    grid.innerHTML = cards;
  }

  function updateHomeStateUi(state) {
    syncLegacyHomeHeader(state);
    startVipDealCountdown();
    if (!supabaseVideosLoaded) {
      const featuredGrid = document.getElementById('featured-grid');
      const categoryGrid = document.getElementById('category-grid-home');
      if (featuredGrid) featuredGrid.innerHTML = '<div class="md:col-span-2 xl:col-span-3 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-8 text-center text-neutral-300">Loading your live videos...</div>';
      if (categoryGrid) categoryGrid.innerHTML = '<div class="md:col-span-2 xl:col-span-4 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-8 text-center text-neutral-300">Loading live categories...</div>';
      return;
    }
    const access = document.getElementById('hero-access-text');
    const pricingText = document.getElementById('hero-pricing-text');
    const status = document.getElementById('hero-vip-status');
    if (access) access.textContent = state.role === 'admin' ? 'Admin / All Access' : (state.role === 'vip' ? 'Guest + VIP' : 'Guest Access');
    if (pricingText) pricingText.textContent = 'Per-video link';
    applyHomeShowcaseImage();
    if (status) status.textContent = state.role.charAt(0).toUpperCase() + state.role.slice(1);

    const categories = allCategories();
    const videos = allVideos();
    renderHomeFeaturedGrid(state, videos);

    document.querySelectorAll('section .text-2xl.font-bold.text-white').forEach((node) => {
      const label = node.nextElementSibling?.textContent?.trim()?.toLowerCase() || '';
      if (label === 'videos available') node.textContent = String(videos.length);
      if (label === 'categories') node.textContent = String(Object.keys(categories).length);
    });

    renderHomeCategoryGrid(categories);

    const overlay = document.getElementById('vip-feature-overlay');
    const primary = document.getElementById('vip-feature-primary');
    if (overlay && primary) {
      if (state.role === 'vip' || state.role === 'admin') { overlay.classList.add('hidden'); primary.textContent = 'Open VIP Vault'; primary.href = 'vip-exclusives.html'; }
      else { overlay.classList.remove('hidden'); overlay.classList.add('flex'); primary.textContent = 'Join VIP'; primary.href = 'vip-checkout.html'; }
    }
  }

  const PENDING_STRIPE_VIDEO_KEY = 'hg_pending_stripe_video';
  const PENDING_STRIPE_VIDEO_MAX_AGE_MS = 2 * 60 * 60 * 1000;

  function buildStripeVideoCheckoutUrl(video, state = {}) {
    const base = stripeVideoLinkForPrice(video);
    if (!base || base.includes('REPLACE_WITH')) throw new Error('Purchase link coming soon.');
    try {
      const url = new URL(base, window.location.href);
      if (state?.email && !url.searchParams.has('prefilled_email')) url.searchParams.set('prefilled_email', state.email);
      if (video?.id && state?.user?.id && !url.searchParams.has('client_reference_id')) {
        url.searchParams.set('client_reference_id', `hg_video:${video.id}:user:${state.user.id}`);
      }
      return url.toString();
    } catch (_) {
      return base;
    }
  }

  function savePendingStripeVideo(video, state = {}) {
    const createdAt = new Date();
    const pending = {
      id: String(video?.id || ''),
      title: String(video?.title || 'Purchased video'),
      amountCents: normalizePriceCents(video?.priceCents || video?.amountCents || video?.price),
      priceLabel: moneyLabelFromVideo(video),
      email: String(state?.email || '').trim().toLowerCase(),
      userId: String(state?.user?.id || '').trim(),
      returnTo: `video.html?id=${encodeURIComponent(String(video?.id || ''))}`,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + PENDING_STRIPE_VIDEO_MAX_AGE_MS).toISOString()
    };
    writeJson(PENDING_STRIPE_VIDEO_KEY, pending);
    return pending;
  }

  async function finalizeStripeVideoCheckoutFromLocalStorage() {
    const query = new URLSearchParams(window.location.search || '');
    const queryVideoId = String(query.get('video') || query.get('id') || '').trim();
    const paymentId = String(query.get('session_id') || query.get('payment_intent') || query.get('token') || '').trim();
    const pending = readJson(PENDING_STRIPE_VIDEO_KEY, {});
    const pendingVideoId = String(pending?.id || '').trim();
    const videoId = queryVideoId || pendingVideoId;
    if (!videoId) return { status: 'idle' };

    if (!queryVideoId && pending?.createdAt) {
      const createdAtMs = Date.parse(pending.createdAt);
      if (Number.isFinite(createdAtMs) && Date.now() - createdAtMs > PENDING_STRIPE_VIDEO_MAX_AGE_MS) {
        try { window.localStorage.removeItem(PENDING_STRIPE_VIDEO_KEY); } catch (_) {}
        throw new Error('This pending Stripe unlock is too old. Please return to the video and click Buy Access again.');
      }
    }

    let state = { email: pending?.email || '', role: 'guest' };
    try { state = await getState(); } catch (_) {}
    if (!state?.user?.id || !state?.email) throw new Error('Please sign in again so Hidden Gems can attach this purchase to your account.');
    const pendingEmail = String(pending?.email || '').trim().toLowerCase();
    const pendingUserId = String(pending?.userId || '').trim();
    if (!queryVideoId && pendingEmail && String(state.email || '').trim().toLowerCase() !== pendingEmail) {
      throw new Error('This Stripe checkout was started by a different account on this browser. Please buy the video again while signed into the correct account.');
    }
    if (!queryVideoId && pendingUserId && String(state.user.id || '').trim() !== pendingUserId) {
      throw new Error('This Stripe checkout was started by a different account on this browser. Please buy the video again while signed into the correct account.');
    }

    const video = getVideo(videoId) || { id: videoId, title: pending?.title || 'Purchased video', priceCents: pending?.amountCents || 0 };
    await unlockVideoForState(state, video, { provider: 'stripe-link', paymentId, sessionId: paymentId, status: 'completed' });
    storage.addTransaction({ type: 'stripe-video', videoId, title: video.title || pending?.title || 'Purchased video', amountCents: normalizePriceCents(video.priceCents || pending?.amountCents) });
    try { window.localStorage.removeItem(PENDING_STRIPE_VIDEO_KEY); } catch (_) {}
    window.dispatchEvent(new CustomEvent('hg:state-changed'));
    return { status: 'complete', videoUnlocked: true, title: video.title || pending?.title || '', videoId };
  }

  async function finalizeStripeVipCheckoutFromLocalStorage() {
    const query = new URLSearchParams(window.location.search || '');
    const explicitVip = ['vip', 'subscription', 'membership'].includes(String(query.get('kind') || query.get('type') || '').trim().toLowerCase());
    const paymentId = String(query.get('session_id') || query.get('payment_intent') || query.get('token') || '').trim();
    const pending = readJson(PENDING_STRIPE_VIP_KEY, {});
    if (!explicitVip && !pending?.createdAt) return { status: 'idle' };
    if (pending?.createdAt) {
      const createdAtMs = Date.parse(pending.createdAt);
      if (Number.isFinite(createdAtMs) && Date.now() - createdAtMs > PENDING_STRIPE_VIP_MAX_AGE_MS) {
        try { window.localStorage.removeItem(PENDING_STRIPE_VIP_KEY); } catch (_) {}
        throw new Error('This pending VIP checkout is too old. Please return to the VIP page and start checkout again.');
      }
    }
    const state = await getState();
    if (!state?.user?.id || !state?.email) throw new Error('Please sign in again so Hidden Gems can attach VIP access to your account.');
    const pendingEmail = String(pending?.email || '').trim().toLowerCase();
    const pendingUserId = String(pending?.userId || '').trim();
    if (pendingEmail && String(state.email || '').trim().toLowerCase() !== pendingEmail) throw new Error('This VIP checkout was started by a different account on this browser. Please buy VIP again while signed into the correct account.');
    if (pendingUserId && String(state.user.id || '').trim() !== pendingUserId) throw new Error('This VIP checkout was started by a different account on this browser. Please buy VIP again while signed into the correct account.');
    await syncVipForCurrentUser(true);
    storage.addTransaction({ type: 'stripe-vip', title: 'VIP Subscription', paymentId, amountCents: 0 });
    try { window.localStorage.removeItem(PENDING_STRIPE_VIP_KEY); } catch (_) {}
    window.dispatchEvent(new CustomEvent('hg:state-changed'));
    return { status: 'complete', vipUnlocked: true, title: 'VIP Subscription' };
  }

  async function startVideoCheckout(video) {
    if (!video?.id) throw new Error('That video is not configured correctly yet.');
    let state = {};
    try { state = await getState(); } catch (_) {}
    if (!state?.user?.id || !state?.email) {
      try { sessionStorage.setItem('hg_return_after_login', `video.html?id=${encodeURIComponent(video.id)}`); } catch (_) {}
      toast('Please sign in before purchasing so this video unlocks for the correct account.', 'error');
      setTimeout(() => { window.location.href = 'login.html'; }, 900);
      return false;
    }
    if (storage.isUnlockedForUser(state.email, video.id)) {
      window.location.href = `video.html?id=${encodeURIComponent(video.id)}`;
      return true;
    }
    savePendingStripeVideo(video, state);
    window.location.href = buildStripeVideoCheckoutUrl(video, state);
    return true;
  }

  async function buyVideo(video) {
    if (!video) return;
    if (video.access === 'vip') { window.location.href = 'vip-checkout.html'; return; }
    try {
      await startVideoCheckout(video);
    } catch (error) {
      toast(extractErrorMessage(error, 'Purchase link coming soon.'), 'error');
    }
  }

  
  function videoPrimaryAction(state, video) {
    if (!canAccessVideo(state.role, video)) return { text: 'Join VIP', href: 'vip-checkout.html', kind: 'link' };
    if (state.role === 'admin' || state.role === 'vip' || storage.isUnlockedForUser(state.email, video.id)) return { text: video.videoUrl ? 'Watch Now' : 'Open Video', href: `video.html?id=${video.id}`, kind: 'link' };
    return { text: 'Buy Access', href: '#', kind: 'buy' };
  }

  function renderVideoCards(container, videos, state) {
    container.innerHTML = videos.map((video) => {
      const action = videoPrimaryAction(state, video);
      const lockedByVip = !canAccessVideo(state.role, video);
      return `<article class="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-pink-400/30 ${lockedByVip ? 'opacity-80' : ''}"><div class="relative"><img src="${escapeHtml(video.image)}" alt="${escapeHtml(video.title)}" loading="lazy" decoding="async" class="h-64 w-full object-cover transition duration-500 group-hover:scale-105" /><div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div><span class="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur">${escapeHtml(video.category)}</span>${lockedByVip ? '<div class="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold uppercase tracking-[0.2em] text-pink-300">VIP Only</div>' : ''}</div><div class="p-5"><div class="flex items-start justify-between gap-4"><div><h4 class="text-xl font-semibold">${escapeHtml(video.title)}</h4><p class="mt-1 text-sm text-neutral-400">${escapeHtml(video.description)}</p></div><div class="rounded-xl bg-pink-500/10 px-3 py-2 text-right text-sm font-semibold text-pink-300">${video.access === 'vip' ? '<div>VIP</div><div class="text-[11px] text-neutral-400">VIP vault</div>' : '<div>' + escapeHtml(moneyLabelFromVideo(video)) + '</div><div class="text-[11px] text-neutral-400">Stripe checkout</div>'}</div></div><div class="mt-5 flex gap-3"><a href="${action.href}" data-video-primary="${video.id}" class="flex-1 rounded-xl bg-pink-500 px-4 py-3 text-center font-medium text-white transition hover:bg-pink-400">${action.text}</a><a href="video.html?id=${video.id}" class="rounded-xl border border-white/15 px-4 py-3 text-sm text-neutral-300 transition hover:bg-white/5">Preview</a></div></div></article>`;
    }).join('');
    container.querySelectorAll('[data-video-primary]').forEach((button) => button.addEventListener('click', (event) => {
      const video = getVideo(button.dataset.videoPrimary);
      const action = videoPrimaryAction(state, video);
      if (action.kind === 'buy') { event.preventDefault(); buyVideo(video); }
    }));
  }

  function renderCategoryPage(slug) {
    applyBg();
    document.body.innerHTML = shellHeader() + `<main><section class="mx-auto max-w-7xl px-6 py-16"><a href="index.html" class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/10">← Back to Home</a><div id="category-hero" class="mt-8 rounded-[2rem] border border-pink-400/20 bg-gradient-to-br from-pink-500/10 via-fuchsia-500/10 to-transparent p-8"></div></section><section class="mx-auto max-w-7xl px-6 pb-20"><div id="access-summary" class="mb-6 rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 text-sm text-neutral-300">Loading access details...</div><div id="category-grid" class="grid gap-6 md:grid-cols-2 xl:grid-cols-3"></div></section></main>` + shellFooter();
    bindCommonUi();
    const mount = async () => {
      await refreshSupabaseVideos(false);
      await refreshSupabaseCategories(false);
      const category = getCategory(slug); if (!category) return;
      document.getElementById('category-hero').innerHTML = `<div class="flex flex-wrap items-start justify-between gap-6"><div><p class="text-sm uppercase tracking-[0.25em] text-pink-300">Category</p><h2 class="mt-3 text-4xl font-black">${escapeHtml(category.title)}</h2><p class="mt-4 max-w-2xl text-neutral-300">${escapeHtml(category.subtitle || 'Premium titles ready to unlock.')}</p></div><div class="rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-right"><p class="text-xs uppercase tracking-[0.25em] text-neutral-400">Access tier</p><p class="mt-2 text-2xl font-bold text-white">${category.vip ? 'VIP' : 'Guest'}</p><p class="mt-3 text-xs uppercase tracking-[0.25em] text-neutral-400">Videos in category</p><p class="mt-2 text-2xl font-bold text-white">${category.videos.length}</p><p class="text-sm text-neutral-400">Admin can access everything</p></div></div>`;
      const state = await getState();
      document.getElementById('access-summary').innerHTML = `Role: <span class="font-bold text-pink-300">${state.role}</span> · Purchases unlock per video · Signed in: <span class="font-bold text-white">${state.email || 'No'}</span>`;
      await getPurchasedVideoIds(state);
      renderVideoCards(document.getElementById('category-grid'), category.videos, state);
    };
    mount(); window.addEventListener('hg:state-changed', mount);
  }

  function renderVideoPage() {
    const requestedId = qs('id');
    applyBg();
    const mount = async () => {
      await refreshSupabaseVideos(false);
      await refreshSupabaseCategories(false);
      const video = getVideo(requestedId);
      if (!video) {
        document.body.innerHTML = shellHeader() + `<main class="mx-auto max-w-5xl px-6 py-14"><div class="rounded-[2rem] border border-rose-400/20 bg-rose-500/10 p-8"><h1 class="text-3xl font-black">Video not found</h1><p class="mt-4 text-neutral-300">This video may have been removed or the link is invalid.</p><a href="index.html" class="mt-6 inline-flex rounded-2xl bg-pink-500 px-6 py-3 font-semibold text-white">Back to Home</a></div></main>` + shellFooter();
        bindCommonUi();
        return;
      }
      document.body.innerHTML = shellHeader() + `<main class="mx-auto max-w-6xl px-6 py-14"><a href="${categoryPageHref(video.categorySlug)}" class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-300 transition hover:bg-white/10">← Back</a><div class="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]"><section class="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-xl shadow-black/20"><div class="relative"><img src="${escapeHtml(video.image)}" class="h-[420px] w-full object-cover" alt="${escapeHtml(video.title)}" fetchpriority="high" decoding="async"><div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"></div><div class="absolute bottom-6 left-6"><p class="text-xs uppercase tracking-[0.25em] text-pink-300">${escapeHtml(video.category)}</p><h1 class="mt-2 text-4xl font-black">${escapeHtml(video.title)}</h1></div></div><div class="p-6"><div id="video-access-banner" class="rounded-[1.5rem] border border-white/10 bg-neutral-950/70 p-5 text-neutral-300">Checking access...</div><div id="video-player-shell" class="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-5"></div><div id="video-description-shell" class="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5"><p class="text-xs uppercase tracking-[0.25em] text-neutral-500">Description</p><p class="mt-3 text-neutral-200">${escapeHtml(video.description || 'No description added yet.')}</p>${trustedExternalHostNotice('mt-4')}</div><div id="video-external-file-shell" class="mt-4 hidden rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5"><p class="text-xs uppercase tracking-[0.25em] text-neutral-500">Official download/file link</p><div id="video-external-file-link" class="mt-3"></div><p class="mt-3 text-xs text-neutral-400">PikPak and Mega links are approved Hidden Gems file sources.</p></div></div></section><aside class="rounded-[2rem] border border-white/10 bg-white/5 p-6"><p class="text-xs uppercase tracking-[0.25em] text-pink-300">Access details</p><div class="mt-5 space-y-4"><div class="rounded-2xl bg-neutral-900/80 p-4"><p class="text-sm text-neutral-400">Category</p><p class="mt-1 text-lg font-semibold text-white">${escapeHtml(video.category)}</p></div><div class="rounded-2xl bg-neutral-900/80 p-4"><p class="text-sm text-neutral-400">Purchase</p><p class="mt-1 text-lg font-semibold text-white">${video.access === 'vip' ? 'VIP / Admin' : 'Shared Stripe checkout'}</p></div><div class="rounded-2xl bg-neutral-900/80 p-4"><p class="text-sm text-neutral-400">Price</p><p class="mt-1 text-lg font-semibold text-white">${escapeHtml(moneyLabelFromVideo(video))}</p></div><div class="rounded-2xl bg-neutral-900/80 p-4"><p class="text-sm text-neutral-400">Role access</p><p class="mt-1 text-lg font-semibold text-white">Guest/VIP: preview and on-site playback only · Admin: full management access</p></div></div><div class="mt-6 flex flex-col gap-3"><a id="video-action-button" href="#" class="rounded-2xl bg-pink-500 px-6 py-3 text-center font-semibold text-white transition hover:bg-pink-400">Loading...</a><a href="all-videos.html" class="rounded-2xl border border-white/15 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/5">Browse videos</a></div></aside></div></main>` + shellFooter();
      bindCommonUi();
      const state = await getState();
      const actionButton = document.getElementById('video-action-button');
      const banner = document.getElementById('video-access-banner');
      const player = document.getElementById('video-player-shell');
      const externalFileShell = document.getElementById('video-external-file-shell');
      const externalFileLink = document.getElementById('video-external-file-link');
      const accessible = canAccessVideo(state.role, video);
      const purchasedIds = new Set(await getPurchasedVideoIds(state));
      const unlocked = state.role === 'admin' || state.role === 'vip' || purchasedIds.has(String(video.id)) || storage.isUnlockedForUser(state.email, video.id);
      const hasPlaybackAccess = accessible && (state.role === 'guest' ? unlocked : true);
      const canRevealExternalFile = !!video.externalFileUrl && hasPlaybackAccess && state.role === 'admin';
      if (externalFileShell) {
        externalFileShell.classList.toggle('hidden', !canRevealExternalFile);
      }
      if (externalFileLink && canRevealExternalFile) {
        externalFileLink.innerHTML = `<a href="${escapeHtml(video.externalFileUrl)}" target="_blank" rel="noopener noreferrer" class="break-all text-pink-300 transition hover:text-pink-200">${escapeHtml(video.externalFileUrl)}</a>`;
      }
      if (!accessible) {
        banner.innerHTML = '<p class="text-sm uppercase tracking-[0.2em] text-pink-300">VIP Preview</p><h3 class="mt-2 text-2xl font-bold text-white">Preview before joining VIP</h3><p class="mt-3 text-neutral-300">Guests can preview this VIP title before upgrading. Downloads stay disabled for guests and VIP. Join VIP to unlock on-site VIP playback.</p>';
        player.innerHTML = await renderPublicPreviewShell(video, 'Preview only. Join VIP to unlock on-site VIP playback. Downloads stay disabled for customer roles.');
        actionButton.textContent = 'Join VIP'; actionButton.href = 'vip-checkout.html'; actionButton.onclick = null;
        return;
      }
      if (!unlocked && state.role === 'guest' && video.access === 'guest') {
        banner.innerHTML = `<p class="text-sm uppercase tracking-[0.2em] text-pink-300">Guest Preview</p><h3 class="mt-2 text-2xl font-bold text-white">Preview before buying</h3><p class="mt-3 text-neutral-300">Guests can preview this title before purchase. Buy direct access using the shared Stripe checkout for this price tier. Current price: <span class="font-semibold text-white">${escapeHtml(moneyLabelFromVideo(video))}</span>.</p>`;
        player.innerHTML = await renderPublicPreviewShell(video, `Preview only. Buy this title with Stripe checkout to unlock full playback.`);
        actionButton.textContent = 'Buy Access'; actionButton.href = '#'; actionButton.onclick = (event) => { event.preventDefault(); buyVideo(video); setTimeout(mount, 350); };
        return;
      }
      const source = getVideoSource(video);
      banner.innerHTML = `<p class="text-sm uppercase tracking-[0.2em] ${state.role === 'guest' ? 'text-pink-300' : 'text-emerald-300'}">${state.role === 'guest' ? 'Guest preview access' : 'Access granted'}</p><h3 class="mt-2 text-2xl font-bold text-white">${state.role === 'guest' ? 'Protected preview enabled' : 'You can open this video'}</h3><p class="mt-3 text-neutral-300">${state.role === 'guest' ? 'Guest and VIP accounts can watch unlocked videos on-site only. Downloads stay disabled for customer roles.' : 'Unlocked customer accounts can watch on-site only. Admin can manage source files.'}</p>`;
      if (source.type === 'file' && hasPlaybackAccess) {
        let playableSrc = source.value;
        if (!playableSrc && video.videoStoragePath) {
          try { playableSrc = await createSignedVideoUrl(video.videoStoragePath); } catch (error) { console.error(error); }
        }
        if (!playableSrc && source.ref) {
          try {
            const blob = await getVideoBlob(source.ref);
            if (blob) playableSrc = URL.createObjectURL(blob);
          } catch (error) { console.error(error); }
        }
        if (playableSrc) {
          const downloadButton = state.role === 'admin' ? `<a href="${escapeHtml(playableSrc)}" download="${escapeHtml(source.fileName || `${video.id}.mp4`)}" class="inline-flex rounded-2xl border border-white/15 px-4 py-2 text-sm text-white transition hover:bg-white/5">Admin download source</a>` : '<p class="text-sm text-neutral-500">Downloads are disabled for guest and VIP accounts. Playback stays on-site only.</p>';
          player.innerHTML = `<div class="space-y-4"><div class="relative overflow-hidden rounded-2xl border border-white/10 bg-black"><video controls playsinline preload="metadata" class="w-full rounded-2xl bg-black"><source src="${escapeHtml(playableSrc)}" type="${escapeHtml(source.mimeType || 'video/mp4')}" />Your browser does not support embedded video playback for this file.</video></div><div class="flex flex-wrap items-center justify-between gap-3">${source.fileName ? `<p class="text-sm text-neutral-500 break-all">${escapeHtml(source.fileName)}</p>` : '<span></span>'}${downloadButton}</div></div>`;
        } else {
          player.innerHTML = '<p class="text-neutral-400">This uploaded video file could not be loaded. Re-save the file from the admin page.</p>';
        }
        actionButton.textContent = 'Watching video'; actionButton.href = '#video-player-shell'; actionButton.target = '_self'; actionButton.rel = ''; actionButton.onclick = null;
      } else if (source.type === 'link' && hasPlaybackAccess) {
        const directVideoLink = /\.(mp4|webm|mov)(\?.*)?$/i.test(String(source.value || ''));
        if (directVideoLink) {
          player.innerHTML = `<div class="space-y-4"><div class="relative overflow-hidden rounded-2xl border border-white/10 bg-black"><video controls playsinline preload="metadata" class="w-full rounded-2xl bg-black"><source src="${escapeHtml(source.value)}" type="video/mp4" />Your browser does not support embedded video playback for this link.</video></div><p class="text-sm text-neutral-500 break-all">${escapeHtml(source.value)}</p></div>`;
          actionButton.textContent = 'Watching video'; actionButton.href = '#video-player-shell'; actionButton.target = '_self'; actionButton.rel = ''; actionButton.onclick = null;
        } else {
          player.innerHTML = `<div class="space-y-4"><p class="text-neutral-300">This title uses an external video destination.</p><a href="${escapeHtml(source.value)}" target="_blank" rel="noopener noreferrer" class="inline-flex rounded-2xl bg-pink-500 px-5 py-3 font-semibold text-white transition hover:bg-pink-400">Open Video Link</a><p class="text-sm text-neutral-500 break-all">${escapeHtml(source.value)}</p></div>`;
          actionButton.textContent = 'Open Video Link'; actionButton.href = source.value; actionButton.target = '_blank'; actionButton.rel = 'noopener noreferrer'; actionButton.onclick = null;
        }
      } else if (state.role === 'guest' && unlocked) {
        const previewImage = await resolveStillPreviewImage(video);
        player.innerHTML = renderStillPreviewShell(previewImage, video.title, 'This purchase was unlocked, but the current source cannot be played directly on-site. Use the external file link below when one is provided.');
        actionButton.textContent = 'Purchased'; actionButton.href = '#video-player-shell'; actionButton.target = '_self'; actionButton.rel = ''; actionButton.onclick = null;
      } else {
        player.innerHTML = '<p class="text-neutral-400">No video source has been added yet. Add one from the admin portal.</p>';
        actionButton.textContent = 'Back to Library'; actionButton.href = 'my-library.html'; actionButton.target = '_self'; actionButton.rel = ''; actionButton.onclick = null;
      }
    };
    mount(); window.addEventListener('hg:state-changed', mount);
  }

  function renderPointsStore() {
    applyBg();
    document.body.innerHTML = shellHeader() + `<main class="mx-auto max-w-7xl px-6 py-14"><div class="rounded-[2rem] border border-pink-400/20 bg-gradient-to-br from-pink-500/10 via-fuchsia-500/10 to-transparent p-8"><p class="text-sm uppercase tracking-[0.25em] text-pink-300">Access</p><h1 class="mt-3 text-4xl font-black">Per-video access checkout</h1><p class="mt-4 max-w-3xl text-neutral-300">Hidden Gems uses secure Stripe checkout links by price tier. Pick a video, complete checkout, and the site unlocks that title for your signed-in account.</p></div><div id="pricing-access-banner" class="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 text-sm text-neutral-300">Loading account status...</div><div class="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><div class="rounded-[2rem] border border-white/10 bg-white/5 p-8"><p class="text-sm uppercase tracking-[0.25em] text-pink-300">How it works</p><ol class="mt-5 space-y-4 text-neutral-300"><li>1. Sign in to your Hidden Gems account.</li><li>2. Open any guest-access video and click <span class="font-semibold text-white">Buy Access</span>.</li><li>3. Complete checkout on the Stripe payment link for that price tier.</li><li>4. After Stripe returns you to Hidden Gems, the site unlocks the selected video for the same signed-in account.</li></ol><div class="mt-6 flex flex-wrap gap-3"><a href="all-videos.html" class="rounded-2xl bg-pink-500 px-6 py-3 font-semibold text-white transition hover:bg-pink-400">Browse all videos</a><a href="contact.html" class="rounded-2xl border border-white/15 px-6 py-3 font-semibold text-white transition hover:bg-white/5">Contact support</a></div></div><div class="rounded-[2rem] border border-white/10 bg-white/5 p-8"><p class="text-sm uppercase tracking-[0.25em] text-pink-300">VIP vault</p><p class="mt-4 text-neutral-300">VIP access remains separate from individual video purchases. Guest and VIP accounts use on-site playback only; downloads stay disabled for customer roles.</p><a href="vip-checkout.html" class="mt-6 inline-flex rounded-2xl bg-pink-500 px-5 py-3 font-semibold text-white transition hover:bg-pink-400">Open VIP checkout</a></div></div></main>` + shellFooter();
    bindCommonUi();
    const mount = async () => {
      const state = await getState();
      const banner = document.getElementById('pricing-access-banner');
      if (!banner) return;
      if (!state.user?.id) banner.innerHTML = 'Sign in before buying access so purchases can be attached to the correct Hidden Gems account.';
      else if (state.role === 'vip') banner.innerHTML = `Signed in: <span class="font-bold text-white">${state.email}</span> · Role: <span class="font-bold text-pink-300">VIP</span> · VIP videos are available for on-site playback.`;
      else if (state.role === 'admin') banner.innerHTML = `Signed in: <span class="font-bold text-white">${state.email}</span> · Role: <span class="font-bold text-pink-300">admin</span> · Admin can manage Stripe payment links for each video.`;
      else banner.innerHTML = `Signed in: <span class="font-bold text-white">${state.email}</span> · Role: <span class="font-bold text-pink-300">guest</span> · Direct purchases unlock one video at a time for this account.`;
    };
    mount();
    window.addEventListener('hg:state-changed', mount);
  }

  function renderVipCheckoutPage() {
    applyBg();
    document.body.innerHTML = shellHeader() + `<main class="mx-auto flex min-h-[75vh] max-w-3xl items-center px-6 py-16"><div class="w-full rounded-[2rem] border border-pink-400/20 bg-gradient-to-br from-pink-500/10 via-fuchsia-500/10 to-transparent p-8 shadow-xl shadow-black/20"><div class="flex items-center gap-4"><img data-hg-theme-logo="true" src="./assets/hidden-gems-logo.png" alt="${BRAND_NAME} logo" class="h-14 w-14 rounded-2xl object-contain" /><div><h1 class="text-3xl font-black text-pink-400">${BRAND_NAME} VIP</h1><p class="text-neutral-400">VIP vault access</p></div></div><p class="mt-6 text-neutral-300">Use the secure checkout below to start 30 days of VIP access. After payment, return to Hidden Gems to use the VIP vault.</p>${vipDealMarkup('mt-6')}<div id="vip-checkout-note" class="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-neutral-300">Checking VIP checkout status...</div><div class="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5"><p class="text-sm uppercase tracking-[0.25em] text-pink-300">Secure checkout</p><div class="mt-4 flex flex-col gap-3 sm:flex-row"><button id="vip-checkout-button" class="inline-block rounded-2xl bg-pink-500 px-6 py-3 font-semibold text-white transition hover:bg-pink-400 text-center">Open VIP Checkout</button></div></div><div class="mt-8 grid gap-4 md:grid-cols-2"><div class="rounded-2xl bg-white/5 p-4"><p class="font-semibold">VIP-only vault</p><p class="mt-1 text-sm text-neutral-400">Special titles reserved for VIP members.</p></div><div class="rounded-2xl bg-white/5 p-4"><p class="font-semibold">On-site playback</p><p class="mt-1 text-sm text-neutral-400">VIP unlocks member videos for streaming on the site.</p></div></div><a href="index.html" class="mt-6 inline-block text-sm text-neutral-400 hover:text-white">← Back to ${BRAND_NAME}</a></div></main>` + shellFooter();
    bindCommonUi();
    startVipDealCountdown();
    const note = document.getElementById('vip-checkout-note');
    const button = document.getElementById('vip-checkout-button');
    getState().then((state) => {
      if (state.role === 'admin') note.textContent = 'Admin account detected. VIP purchases are intended for customer/member accounts, but the checkout button is still available for testing.';
      else if (state.role === 'vip') note.textContent = 'This account already has VIP access. You can still use checkout again if you are testing the flow.';
      else if (!STRIPE_VIP_SUBSCRIPTION_LINK) note.textContent = 'Add your VIP checkout link in config.js before testing checkout.';
      else note.textContent = 'VIP checkout is ready. This simple setup redirects customers to the configured VIP payment link.';
    });
    button.addEventListener('click', async () => {
      try {
        await startVipCheckout();
      } catch (error) {
        toast(extractErrorMessage(error, 'Unable to start VIP checkout right now.'), 'error');
      }
    });
  }

  function renderLibraryPage() {
    applyBg();
    document.body.innerHTML = shellHeader() + `<main class="mx-auto max-w-7xl px-6 py-14"><div class="rounded-[2rem] border border-pink-400/20 bg-gradient-to-br from-pink-500/10 via-fuchsia-500/10 to-transparent p-8"><p class="text-sm uppercase tracking-[0.25em] text-pink-300">My Library</p><h1 class="mt-3 text-4xl font-black">Accessible videos for your account</h1><p class="mt-4 max-w-2xl text-neutral-300">Guest accounts see unlocked standard titles, VIP sees VIP and standard, admin sees all titles.</p></div><div id="library-summary" class="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 text-sm text-neutral-300">Loading library...</div><div id="library-grid" class="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3"></div></main>` + shellFooter();
    bindCommonUi();
    const mount = async () => {
      await refreshSupabaseVideos(false);
      const state = await getState();
      const purchasedIds = new Set(await getPurchasedVideoIds(state));
      const videos = allVideos().filter((video) => {
        if (!canAccessVideo(state.role, video)) return false;
        if (state.role === 'admin' || state.role === 'vip') return true;
        return purchasedIds.has(String(video.id)) || storage.isUnlockedForUser(state.email, video.id);
      });
      document.getElementById('library-summary').innerHTML = `Role: <span class="font-bold text-pink-300">${state.role}</span> · Accessible titles: <span class="font-bold text-white">${videos.length}</span> · Direct purchases stay tied to this account`;
      if (!videos.length) document.getElementById('library-grid').innerHTML = '<div class="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-neutral-300 md:col-span-2 xl:col-span-3">No videos are in your library yet. After a purchase completes, the title should appear here automatically.</div>';
      else renderVideoCards(document.getElementById('library-grid'), videos, state);
    };
    mount(); window.addEventListener('hg:state-changed', mount);
  }

  function renderAllVideosPage() {
    applyBg();
    document.body.innerHTML = shellHeader() + `<main class="mx-auto max-w-7xl px-6 py-14"><div class="rounded-[2rem] border border-pink-400/20 bg-gradient-to-br from-pink-500/10 via-fuchsia-500/10 to-transparent p-8"><p class="text-sm uppercase tracking-[0.25em] text-pink-300">All Videos</p><h1 class="mt-3 text-4xl font-black">Browse the full catalog</h1><p class="mt-4 max-w-2xl text-neutral-300">This page shows the videos your current account is allowed to see, with live sorting and filtering.</p></div><div id="all-videos-summary" class="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 text-sm text-neutral-300">Loading videos...</div><div class="mt-6 grid gap-4 lg:grid-cols-5"><label class="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-neutral-300">Sort<select id="all-videos-sort" class="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="title">Name</option><option value="access">Access type</option></select></label><label class="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-neutral-300">Category<select id="all-videos-category" class="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white"></select></label><label class="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-neutral-300">Access<select id="all-videos-access" class="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white"><option value="all">All access</option><option value="guest">Guest</option><option value="vip">VIP</option></select></label><label class="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-neutral-300 lg:col-span-2">Search<input id="all-videos-search" placeholder="Search by title or description" class="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-white" /></label></div><div id="all-videos-grid" class="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3"></div></main>` + shellFooter();
    bindCommonUi();
    const mount = async () => {
      await refreshSupabaseVideos(false);
      await refreshSupabaseCategories(false);
      const state = await getState();
      const categorySelect = document.getElementById('all-videos-category');
      const all = allVideos().filter((video) => canAccessVideo(state.role, video));
      const categories = [...new Set(all.map((video) => video.categorySlug))].sort((a, b) => categorySortIndex(a) - categorySortIndex(b));
      categorySelect.innerHTML = `<option value="all">All categories</option>` + categories.map((slug) => `<option value="${escapeHtml(slug)}">${escapeHtml(categoryDisplayName(slug, getCategory(slug)?.title || ''))}</option>`).join('');
      const requestedCategory = String(qs('category') || '').trim().toLowerCase();
      if (requestedCategory && categories.includes(requestedCategory)) categorySelect.value = requestedCategory;
      const render = () => {
        const sort = document.getElementById('all-videos-sort').value;
        const category = document.getElementById('all-videos-category').value;
        const access = document.getElementById('all-videos-access').value;
        const search = String(document.getElementById('all-videos-search').value || '').trim().toLowerCase();
        let visible = all.filter((video) => {
          
          if (category !== 'all' && video.categorySlug !== category) return false;
          if (access !== 'all' && video.access !== access) return false;
          if (search && !(video.title + ' ' + video.description).toLowerCase().includes(search)) return false;
          return true;
        });
        visible.sort((a, b) => {
          if (sort === 'oldest') return String(a.id).localeCompare(String(b.id));
          if (sort === 'title') return a.title.localeCompare(b.title);
          if (sort === 'access') return String(a.access).localeCompare(String(b.access));
          return String(b.id).localeCompare(String(a.id));
        });
        document.getElementById('all-videos-summary').innerHTML = `Role: <span class="font-bold text-pink-300">${state.role}</span> · Visible videos: <span class="font-bold text-white">${visible.length}</span> · Categories: <span class="font-bold text-white">${categories.length}</span>`;
        const grid = document.getElementById('all-videos-grid');
        if (!visible.length) grid.innerHTML = '<div class="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-neutral-300 md:col-span-2 xl:col-span-3">No videos match your current filters.</div>';
        else renderVideoCards(grid, visible, state);
      };
      ['all-videos-sort','all-videos-category','all-videos-access','all-videos-search'].forEach((id) => document.getElementById(id)?.addEventListener(id === 'all-videos-search' ? 'input' : 'change', render));
      render();
    };
    mount(); window.addEventListener('hg:state-changed', mount);
  }

  function renderAdminPage() {
    applyBg();
    document.body.innerHTML = shellHeader() + `<main class="mx-auto max-w-7xl px-6 py-14"><div id="admin-gate"></div></main>` + shellFooter();
    bindCommonUi();
    const mount = async () => {
      await refreshSupabaseVideos(true);
      await refreshSupabaseCategories(true);
      const state = await getState();
      const gate = document.getElementById('admin-gate');
      if (state.role !== 'admin') { gate.innerHTML = `<div class="rounded-[2rem] border border-amber-400/30 bg-amber-500/10 p-8"><p class="text-sm uppercase tracking-[0.25em] text-amber-200">Admin only</p><h1 class="mt-3 text-4xl font-black">Access denied</h1><p class="mt-4 max-w-2xl text-neutral-200">Only accounts marked admin in your profile or listed in config.js can open this page.</p><a href="index.html" class="mt-6 inline-flex rounded-2xl bg-pink-500 px-6 py-3 font-semibold text-white">Back to Home</a></div>`; return; }
      await refreshAdminSupabaseVideos(true);
      const categories = Object.entries(allCategories()).map(([slug, category]) => `<option value="${slug}">${escapeHtml(category.title)}</option>`).join('');
      gate.innerHTML = `<section class="rounded-[2rem] border border-pink-400/20 bg-gradient-to-br from-pink-500/10 via-fuchsia-500/10 to-transparent p-8"><p class="text-sm uppercase tracking-[0.25em] text-pink-300">Admin Portal</p><h1 class="mt-3 text-4xl font-black">Manage videos, Stripe payment links, files, and user roles</h1><p class="mt-4 max-w-3xl text-neutral-300">Manage live catalog content, assign access levels, control preview assets, and keep customer-facing video information ready for promotion.</p><p class="mt-3 text-sm text-amber-200">Uploaded files use your configured storage path when available, with your existing workflow kept intact.</p></section><section class="mt-8 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]"><div class="space-y-8"><div class="rounded-[2rem] border border-white/10 bg-white/5 p-6"><div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="text-2xl font-bold">Add or edit video</h2><p class="mt-2 text-sm text-neutral-400">Use a direct video file or link, set the display price, and add an optional per-video Stripe link if this title should not use the shared price-tier link.</p></div><span id="admin-form-mode" class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.25em] text-neutral-300">Add mode</span></div><form id="admin-video-form" class="mt-6 grid gap-4 md:grid-cols-2"><input type="hidden" name="videoId" /><input type="hidden" name="isCustom" value="true" /><div class="md:col-span-2"><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Title</label><input required name="title" placeholder="Video title" class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white" /></div><div class="md:col-span-2"><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Description</label><textarea required name="description" placeholder="Description" class="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white"></textarea></div><div><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Access type</label><select name="access" class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white"><option value="guest">Guest video</option><option value="vip">VIP video</option></select></div><div><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Video price</label><input name="priceCents" inputmode="decimal" placeholder="7.00" class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white" /><p class="mt-2 text-xs text-neutral-500">Enter the customer-facing price in dollars. Example: 7.00</p></div><div class="md:col-span-2"><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Saved Stripe payment link</label><select id="admin-payment-link-select" name="paymentLinkPreset" class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white"></select><label class="mb-2 mt-4 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Stripe purchase link for this video</label><input name="paypalUrl" placeholder="https://buy.stripe.com/..." class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white" /><p class="mt-2 text-xs text-neutral-500">Pick a saved link by name, paste a custom link, or leave blank so the site uses the matching shared price-tier link in config.js.</p></div><div><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Category</label><select name="categorySlug" class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white">${categories}</select></div><div><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Custom category title</label><input name="categoryTitle" placeholder="Optional custom category title" class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white" /></div><div class="md:col-span-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"><input id="video-published" type="checkbox" name="isPublished" checked class="h-4 w-4 rounded border-white/20 bg-black/40 text-pink-500" /><label for="video-published" class="text-sm text-neutral-300">Published on site</label></div><div class="md:col-span-2 rounded-[1.5rem] border border-white/10 bg-black/20 p-4"><div class="grid gap-4 md:grid-cols-2"><div><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Thumbnail upload</label><input type="file" name="thumbnailFile" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" class="block w-full rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 py-3 text-sm text-neutral-300 file:mr-4 file:rounded-xl file:border-0 file:bg-pink-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" /></div><div><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Thumbnail URL fallback</label><input name="image" placeholder="Optional image URL" class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white" /></div></div><div class="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div class="flex flex-wrap items-center justify-between gap-3"><div><p class="text-sm font-semibold text-white">Saved thumbnail library</p><p class="mt-1 text-xs text-neutral-400">Pick a thumbnail you already uploaded instead of adding it again.</p></div><button type="button" id="admin-refresh-thumbnails" class="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white">Refresh library</button></div><div id="admin-thumbnail-library" class="mt-4 grid max-h-72 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3"></div></div><div id="admin-thumbnail-preview" class="mt-4 hidden overflow-hidden rounded-2xl border border-white/10 bg-black/30"><img src="" alt="Thumbnail preview" class="h-48 w-full object-cover" /></div></div><div class="md:col-span-2 rounded-[1.5rem] border border-white/10 bg-black/20 p-4"><div class="grid gap-4 md:grid-cols-2"><div><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Video link</label><input name="videoUrl" placeholder="https://..." class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white" /></div><div><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Video file upload</label><input type="file" name="videoFile" accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime" class="block w-full rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 py-3 text-sm text-neutral-300 file:mr-4 file:rounded-xl file:border-0 file:bg-pink-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" /></div></div><p class="mt-3 text-sm text-neutral-400">Source priority: uploaded video file first, then video link.</p><div id="admin-video-source-note" class="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-300">No source selected yet.</div><div class="mt-4"><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">External file link (PikPak / Mega)</label><input name="externalFileUrl" placeholder="https://mypikpak.com/... or https://mega.nz/..." class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white" /></div></div><div class="md:col-span-2 rounded-[1.5rem] border border-white/10 bg-black/20 p-4"><div class="flex flex-wrap items-center gap-6"><label class="flex items-center gap-3 text-sm text-neutral-300"><input id="preview-image-enabled" type="checkbox" name="previewImageEnabled" checked class="h-4 w-4 rounded border-white/20 bg-black/40 text-pink-500" />Enable image preview</label><label class="flex items-center gap-3 text-sm text-neutral-300"><input id="preview-video-enabled" type="checkbox" name="previewVideoEnabled" class="h-4 w-4 rounded border-white/20 bg-black/40 text-pink-500" />Enable video preview assets</label></div><p class="mt-3 text-sm text-neutral-400">Guests and VIP visitors can see preview images/videos before purchase. Full source videos and downloads stay protected.</p><div id="admin-preview-settings" class="mt-4 grid gap-4 md:grid-cols-2"><div><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Preview image upload</label><input type="file" name="previewImageFile" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" class="block w-full rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 py-3 text-sm text-neutral-300 file:mr-4 file:rounded-xl file:border-0 file:bg-pink-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" /></div><div><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Preview image URL</label><input name="previewImageUrl" placeholder="Optional preview image URL" class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white" /></div><div><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Preview video upload</label><input type="file" name="previewVideoFile" accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime" class="block w-full rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 py-3 text-sm text-neutral-300 file:mr-4 file:rounded-xl file:border-0 file:bg-pink-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" /></div><div><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Preview video URL</label><input name="previewVideoUrl" placeholder="Optional preview video URL" class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white" /></div></div><div id="admin-preview-note" class="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-300">Guests and VIP visitors can preview this asset before purchase. Full playback stays locked until purchase/VIP access.</div></div><div class="md:col-span-2 flex flex-wrap gap-3"><button class="rounded-2xl bg-pink-500 px-6 py-3 font-semibold text-white">Save video</button><button type="button" id="admin-form-reset" class="rounded-2xl border border-white/15 px-6 py-3 font-semibold text-white">Clear form</button></div></form></div><div class="rounded-[2rem] border border-white/10 bg-white/5 p-6"><div class="flex items-center justify-between gap-4"><div><h2 class="text-2xl font-bold">Manage saved videos</h2><p class="mt-2 text-sm text-neutral-400">Every saved video shows its access label, thumbnail preview, and edit/delete actions.</p></div><a href="index.html" class="rounded-xl border border-white/15 px-4 py-2 text-sm text-white">Back to site</a></div><div class="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4"><label class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Search saved videos</label><input id="admin-video-search" type="search" placeholder="Start typing a video title..." class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white" /><p id="admin-video-search-count" class="mt-2 text-xs text-neutral-500">Type to narrow the admin video list.</p></div><div id="admin-video-list" class="mt-6 space-y-4"></div></div></div><div class="space-y-8"><div class="rounded-[2rem] border border-white/10 bg-white/5 p-6"><h2 class="text-2xl font-bold">Role manager</h2><p class="mt-2 text-sm text-neutral-400">Use this to mark a user as guest, VIP, or admin on this site.</p><form id="admin-role-form" class="mt-6 space-y-4"><input required type="email" name="email" placeholder="user@example.com" class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white" /><select name="role" class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white"><option value="guest">Guest</option><option value="vip">VIP</option><option value="admin">Admin</option></select><button class="w-full rounded-2xl bg-pink-500 px-6 py-3 font-semibold text-white">Save role</button></form><div id="admin-role-list" class="mt-6 space-y-3"></div></div><div class="rounded-[2rem] border border-white/10 bg-white/5 p-6"><h2 class="text-2xl font-bold">Category manager</h2><p class="mt-2 text-sm text-neutral-400">Create, delete, rename, and describe categories. These sync through Supabase when your database table is installed.</p><form id="admin-category-create-form" class="mt-6 space-y-3"><input name="title" required placeholder="New category name" class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white" /><textarea name="description" placeholder="Category description" class="min-h-[90px] w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white"></textarea><button class="w-full rounded-2xl bg-pink-500 px-6 py-3 font-semibold text-white">Add category</button></form><form id="admin-category-form" class="mt-6 space-y-4"></form></div><div class="rounded-[2rem] border border-white/10 bg-white/5 p-6"><h2 class="text-2xl font-bold">Homepage showcase image</h2><p class="mt-2 text-sm text-neutral-400">Change the large image on the homepage without editing code. Use an image URL or upload a JPG/PNG/WEBP file.</p><form id="admin-showcase-form" class="mt-6 space-y-4"><input name="showcaseUrl" placeholder="Homepage showcase image URL" class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white" /><input type="file" name="showcaseFile" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" class="block w-full rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 py-3 text-sm text-neutral-300 file:mr-4 file:rounded-xl file:border-0 file:bg-pink-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" /><div id="admin-showcase-preview" class="hidden overflow-hidden rounded-2xl border border-white/10 bg-black/30"><img src="" alt="Homepage showcase preview" class="h-48 w-full object-cover" /></div><button class="w-full rounded-2xl bg-pink-500 px-6 py-3 font-semibold text-white">Save homepage image</button></form></div><div class="rounded-[2rem] border border-white/10 bg-white/5 p-6"><h2 class="text-2xl font-bold">VIP quick actions</h2><p class="mt-2 text-sm text-neutral-400">Open the VIP checkout page to confirm the customer-facing membership flow before promotion.</p><a href="vip-checkout.html" class="mt-4 inline-flex rounded-2xl border border-white/15 px-5 py-3 text-white">Open VIP Checkout Page</a></div></div></section>`;

      const adminVideoListElInitial = document.getElementById('admin-video-list');
      if (adminVideoListElInitial) adminVideoListElInitial.innerHTML = '<div class="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-neutral-300">Loading saved videos from Supabase...</div>';

      const form = document.getElementById('admin-video-form');
      const modeBadge = document.getElementById('admin-form-mode');
      const resetButton = document.getElementById('admin-form-reset');
      const thumbnailPreviewWrap = document.getElementById('admin-thumbnail-preview');
      const thumbnailPreviewImage = thumbnailPreviewWrap.querySelector('img');
      const thumbnailLibraryEl = document.getElementById('admin-thumbnail-library');
      const refreshThumbnailsButton = document.getElementById('admin-refresh-thumbnails');
      const sourceNote = document.getElementById('admin-video-source-note');
      const paymentLinkSelect = document.getElementById('admin-payment-link-select');
      const adminVideoSearch = document.getElementById('admin-video-search');
      const adminVideoSearchCount = document.getElementById('admin-video-search-count');
      if (paymentLinkSelect) paymentLinkSelect.innerHTML = paymentLinkOptionsMarkup(form.elements.paypalUrl?.value || '');
      const syncPaymentLinkSelect = () => {
        if (!paymentLinkSelect) return;
        const current = String(form.elements.paypalUrl?.value || '').trim();
        paymentLinkSelect.innerHTML = paymentLinkOptionsMarkup(current);
      };
      paymentLinkSelect?.addEventListener('change', () => {
        const selectedOption = paymentLinkSelect.options[paymentLinkSelect.selectedIndex];
        const selectedUrl = String(paymentLinkSelect.value || '').trim();
        if (selectedUrl && selectedUrl !== '__custom__' && form.elements.paypalUrl) form.elements.paypalUrl.value = selectedUrl;
        const selectedPrice = Number(selectedOption?.dataset?.priceCents || 0);
        if (selectedPrice > 0 && form.elements.priceCents) form.elements.priceCents.value = priceInputValueFromCents(selectedPrice);
        if (selectedOption?.dataset?.kind === 'vip' && form.elements.access) form.elements.access.value = 'vip';
      });
      form.elements.paypalUrl?.addEventListener('input', syncPaymentLinkSelect);

      let thumbnailData = '';
      let selectedThumbnailUrl = '';
      let videoData = '';
      let videoMimeType = '';
      let videoFileName = '';
      let videoFileRef = '';
      let videoStoragePath = '';
      let previewImageData = '';
      let previewVideoData = '';
      let previewVideoMimeType = '';
      let previewVideoFileName = '';

      const updatePreviewNote = () => {
        const imageEnabled = !!form.elements.previewImageEnabled?.checked;
        const videoEnabled = !!form.elements.previewVideoEnabled?.checked;
        const imageUrl = String(form.elements.previewImageUrl?.value || '').trim();
        const videoUrl = String(form.elements.previewVideoUrl?.value || '').trim();
        const note = document.getElementById('admin-preview-note');
        if (!note) return;
        if (imageEnabled && (previewImageData || imageUrl)) note.innerHTML = '<span class="font-semibold text-emerald-300">Custom image preview ready</span> · Guests will see this before purchase.';
        else if (videoEnabled && (previewVideoData || videoUrl)) note.innerHTML = '<span class="font-semibold text-pink-300">Preview video asset ready</span> · Guests will see this before purchase.';
        else note.textContent = 'Guests and VIP visitors can preview this asset before purchase. Full playback stays locked until purchase/VIP access.';
      };

      const setThumbnailPreview = (value, options = {}) => {
        if (options.fromLibrary) selectedThumbnailUrl = value || '';
        else if (options.fromUpload) selectedThumbnailUrl = '';
        thumbnailData = options.fromUpload ? (value || '') : '';
        const fallbackValue = String(form.elements.image.value || '').trim();
        const preview = thumbnailData || selectedThumbnailUrl || fallbackValue;
        if (preview) {
          thumbnailPreviewWrap.classList.remove('hidden');
          thumbnailPreviewImage.src = preview;
        } else {
          thumbnailPreviewWrap.classList.add('hidden');
          thumbnailPreviewImage.src = '';
        }
      };

      const renderThumbnailLibrary = () => {
        if (!thumbnailLibraryEl) return;
        const library = buildThumbnailLibrary();
        thumbnailLibraryEl.innerHTML = library.length ? library.map((thumb) => `<button type="button" data-select-thumbnail="${escapeHtml(thumb.url)}" class="overflow-hidden rounded-2xl border ${selectedThumbnailUrl === thumb.url ? 'border-pink-400 bg-pink-500/10' : 'border-white/10 bg-black/30'} text-left transition hover:border-pink-400/40"><img src="${escapeHtml(thumb.url)}" alt="${escapeHtml(thumb.title || 'Saved thumbnail')}" class="h-24 w-full object-cover" /><span class="block truncate px-3 py-2 text-xs text-neutral-300">${escapeHtml(thumb.title || thumb.fileName || 'Saved thumbnail')}</span></button>`).join('') : '<p class="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-neutral-400">No saved thumbnails yet. Upload one and save a video to add it here.</p>';
        thumbnailLibraryEl.querySelectorAll('[data-select-thumbnail]').forEach((button) => button.addEventListener('click', () => {
          const url = button.dataset.selectThumbnail || '';
          if (form.elements.thumbnailFile) form.elements.thumbnailFile.value = '';
          if (form.elements.image) form.elements.image.value = url;
          setThumbnailPreview(url, { fromLibrary: true });
          renderThumbnailLibrary();
        }));
      };

      const updateSourceNote = () => {
        const link = String(form.elements.videoUrl.value || '').trim();
        if (videoData) sourceNote.innerHTML = `<span class="font-semibold text-emerald-300">Using newly uploaded file</span>${videoFileName ? ` · ${escapeHtml(videoFileName)}` : ''}`;
        else if (videoFileRef || videoStoragePath) sourceNote.innerHTML = `<span class="font-semibold text-emerald-300">Keeping existing uploaded file</span>${videoFileName ? ` · ${escapeHtml(videoFileName)}` : ''}<br><span class="text-xs text-neutral-500">You can edit the title, price, category, preview, or payment link without re-uploading the video.</span>`;
        else if (link) sourceNote.innerHTML = `<span class="font-semibold text-pink-300">Using video link</span> · ${escapeHtml(link)}`;
        else sourceNote.textContent = 'No source selected yet.';
      };

      const populateVideoForm = (video) => {
        form.elements.videoId.value = video.id || '';
        form.elements.isCustom.value = video.isCustom ? 'true' : 'false';
        form.elements.title.value = video.title || '';
        form.elements.description.value = video.description || '';
        form.elements.access.value = video.access === 'vip' ? 'vip' : 'guest';
        if (form.elements.paypalUrl) form.elements.paypalUrl.value = video.paypalUrl || video.paymentUrl || '';
        syncPaymentLinkSelect();
        if (form.elements.priceCents) form.elements.priceCents.value = priceInputValueFromCents(video.priceCents);
        form.elements.categorySlug.value = video.categorySlug || 'creator-picks';
        form.elements.categoryTitle.value = video.categoryTitle || '';
        form.elements.image.value = video.image || '';
        selectedThumbnailUrl = video.image || '';
        form.elements.videoUrl.value = video.videoUrl || '';
        if (form.elements.isPublished) form.elements.isPublished.checked = video.isPublished !== false;
        thumbnailData = video.image && video.image.startsWith('data:image/') ? video.image : '';
        videoData = video.videoFile || '';
        videoMimeType = video.videoMimeType || '';
        videoFileName = video.videoFileName || '';
        videoFileRef = video.videoFileRef || '';
        videoStoragePath = video.videoStoragePath || '';
        if (form.elements.thumbnailFile) form.elements.thumbnailFile.value = '';
        if (form.elements.videoFile) form.elements.videoFile.value = '';
        if (form.elements.externalFileUrl) form.elements.externalFileUrl.value = video.externalFileUrl || '';
        if (form.elements.previewImageEnabled) form.elements.previewImageEnabled.checked = video.previewImageEnabled !== false;
        if (form.elements.previewVideoEnabled) form.elements.previewVideoEnabled.checked = !!video.previewVideoEnabled;
        if (form.elements.previewImageUrl) form.elements.previewImageUrl.value = video.previewImageUrl || video.previewImage || '';
        if (form.elements.previewVideoUrl) form.elements.previewVideoUrl.value = video.previewVideoUrl || video.previewVideo || '';
        if (form.elements.previewImageFile) form.elements.previewImageFile.value = '';
        if (form.elements.previewVideoFile) form.elements.previewVideoFile.value = '';
        previewImageData = video.previewImage || '';
        previewVideoData = video.previewVideo || '';
        previewVideoMimeType = video.previewVideoMimeType || '';
        previewVideoFileName = video.previewVideoFileName || '';
        setThumbnailPreview(video.image || '', { fromLibrary: true });
        renderThumbnailLibrary();
        updateSourceNote();
        updatePreviewNote();
        modeBadge.textContent = `Edit mode · ${video.access === 'vip' ? 'VIP' : 'Guest'}`;
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };

      const resetVideoForm = () => {
        form.reset();
        form.elements.videoId.value = '';
        form.elements.isCustom.value = 'true';
        form.elements.access.value = 'guest';
        if (form.elements.paypalUrl) form.elements.paypalUrl.value = '';
        syncPaymentLinkSelect();
        if (form.elements.priceCents) form.elements.priceCents.value = '';
        if (form.elements.isPublished) form.elements.isPublished.checked = true;
        thumbnailData = '';
        selectedThumbnailUrl = '';
        videoData = '';
        videoMimeType = '';
        videoFileName = '';
        videoFileRef = '';
        videoStoragePath = '';
        previewImageData = '';
        previewVideoData = '';
        previewVideoMimeType = '';
        previewVideoFileName = '';
        if (form.elements.externalFileUrl) form.elements.externalFileUrl.value = '';
        if (form.elements.previewImageEnabled) form.elements.previewImageEnabled.checked = true;
        if (form.elements.previewVideoEnabled) form.elements.previewVideoEnabled.checked = false;
        if (form.elements.previewImageUrl) form.elements.previewImageUrl.value = '';
        if (form.elements.previewVideoUrl) form.elements.previewVideoUrl.value = '';
        setThumbnailPreview('');
        renderThumbnailLibrary();
        updateSourceNote();
        updatePreviewNote();
        modeBadge.textContent = 'Add mode';
      };

      form.elements.previewImageUrl?.addEventListener('input', updatePreviewNote);
      form.elements.previewVideoUrl?.addEventListener('input', updatePreviewNote);
      form.elements.previewImageEnabled?.addEventListener('change', updatePreviewNote);
      form.elements.previewVideoEnabled?.addEventListener('change', updatePreviewNote);
      form.elements.previewImageFile?.addEventListener('change', async () => {
        const file = form.elements.previewImageFile.files?.[0];
        if (!file) { previewImageData = ''; updatePreviewNote(); return; }
        previewImageData = await fileToDataUrl(file);
        updatePreviewNote();
      });
      form.elements.previewVideoFile?.addEventListener('change', async () => {
        const file = form.elements.previewVideoFile.files?.[0];
        if (!file) { previewVideoData = ''; previewVideoMimeType = ''; previewVideoFileName = ''; updatePreviewNote(); return; }
        previewVideoData = await fileToDataUrl(file);
        previewVideoMimeType = file.type || 'video/mp4';
        previewVideoFileName = file.name || '';
        updatePreviewNote();
      });

      const renderRoleList = () => {
        const map = storage.getRoleOverrides(); const entries = Object.entries(map);
        document.getElementById('admin-role-list').innerHTML = entries.length ? entries.map(([email, role]) => `<div class="flex items-center justify-between rounded-2xl bg-neutral-900/80 px-4 py-4"><div><p class="font-medium text-white">${escapeHtml(email)}</p><p class="text-sm text-neutral-400 uppercase">${escapeHtml(role)}</p></div><button data-remove-role="${escapeHtml(email)}" class="rounded-xl border border-white/10 px-3 py-2 text-sm text-white">Remove</button></div>`).join('') : '<p class="text-sm text-neutral-400">No local role overrides yet.</p>';
        document.querySelectorAll('[data-remove-role]').forEach((button) => button.addEventListener('click', () => { storage.setRoleOverride(button.dataset.removeRole, null); renderRoleList(); window.dispatchEvent(new CustomEvent('hg:state-changed')); }));
      };

      const renderCategoryManager = () => {
        const formEl = document.getElementById('admin-category-form'); if (!formEl) return;
        const cats = Object.entries(allCategories()).sort((a, b) => categorySortIndex(a[0]) - categorySortIndex(b[0]));
        formEl.innerHTML = cats.map(([slug, category]) => {
          const core = CATEGORY_ORDER.includes(slug);
          return `<div class="rounded-2xl border border-white/10 bg-black/20 p-4"><div class="flex items-center justify-between gap-3"><p class="text-xs uppercase tracking-[0.2em] text-neutral-500">${escapeHtml(slug)}${core ? ' · core' : ''}</p>${!core ? `<button type="button" data-delete-category="${escapeHtml(slug)}" class="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">Delete</button>` : ''}</div><label class="mt-3 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Name</label><input data-category-title="${escapeHtml(slug)}" value="${escapeHtml(category.title)}" class="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white" /><label class="mt-3 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Description</label><textarea data-category-description="${escapeHtml(slug)}" class="mt-2 min-h-[90px] w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white">${escapeHtml(categoryDescription(slug, category.subtitle))}</textarea><button type="button" data-save-category="${escapeHtml(slug)}" class="mt-3 w-full rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Save category</button></div>`;
        }).join('');
      };

      const renderVideoList = () => {
        const listEl = document.getElementById('admin-video-list');
        if (!listEl) return;
        try {
        const allAdminVideoRows = adminAllVideos().sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
          return bTime - aTime;
        });
        const searchTerm = String(adminVideoSearch?.value || '').trim().toLowerCase();
        const videos = searchTerm ? allAdminVideoRows.filter((video) => String(video.title || '').trim().toLowerCase().startsWith(searchTerm)) : allAdminVideoRows;
        if (adminVideoSearchCount) adminVideoSearchCount.textContent = searchTerm ? `Showing ${videos.length} of ${allAdminVideoRows.length} video(s) starting with "${searchTerm}".` : `${allAdminVideoRows.length} saved video(s) available.`;
        const supabaseReady = !!getSupabaseClient();
        const currentUserId = state?.user?.id || '';
        const debugSummary = `<div class="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4 text-sm text-sky-100"><p class="font-semibold text-white">Admin video debug</p><p class="mt-2">Total shown: <span class="font-bold">${videos.length}</span> · Supabase public rows: <span class="font-bold">${supabaseVideosCache.length}</span> · Supabase admin rows: <span class="font-bold">${adminSupabaseVideosCache.length}</span> · Local fallback rows: <span class="font-bold">${storage.getCustomVideos().length}</span></p><div class="mt-3 grid gap-2 text-xs text-sky-100/90 md:grid-cols-2"><p>Supabase configured: <span class="font-bold">${supabaseReady ? 'yes' : 'no'}</span></p><p>Current role: <span class="font-bold uppercase">${escapeHtml(state?.role || 'unknown')}</span></p><p class="break-all">Current email: <span class="font-bold">${escapeHtml(state?.email || 'not signed in')}</span></p><p class="break-all">User ID: <span class="font-bold">${escapeHtml(currentUserId || 'missing')}</span></p></div><p class="mt-2 text-sky-200/80">If admin rows stay at 0 while another admin uploaded videos, the problem is almost always Supabase RLS or a query policy on <code>hg_videos</code>. Run the included universal admin SQL, then reload this panel.</p>${lastAdminVideoLoadError ? `<p class="mt-2 break-all text-rose-200">Last Supabase error: ${escapeHtml(lastAdminVideoLoadError)}</p>` : ''}<button type="button" id="admin-reload-videos" class="mt-3 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Reload videos</button></div>`;
        document.getElementById('admin-video-list').innerHTML = debugSummary + (videos.length ? videos.map((video) => {

          const source = getVideoSource(video);
          const accessClass = video.access === 'vip' ? 'border-pink-400/30 bg-pink-500/10 text-pink-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200';
          const publishClass = video.isPublished === false ? 'border-amber-400/30 bg-amber-500/10 text-amber-200' : 'border-sky-400/30 bg-sky-500/10 text-sky-200';
          return `<div class="rounded-[1.75rem] border border-white/10 bg-neutral-900/80 p-4"><div class="grid gap-4 md:grid-cols-[180px_1fr]"><div class="overflow-hidden rounded-2xl border border-white/10 bg-black/30">${video.image ? `<img src="${escapeHtml(video.image)}" alt="${escapeHtml(video.title)}" loading="lazy" decoding="async" class="h-40 w-full object-cover" />` : '<div class="flex h-40 items-center justify-center text-sm text-neutral-500">No thumbnail</div>'}</div><div><div class="flex flex-wrap items-start justify-between gap-3"><div><div class="flex flex-wrap items-center gap-2"><p class="text-lg font-semibold text-white">${escapeHtml(video.title)}</p><span class="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${accessClass}">${video.access}</span><span class="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${publishClass}">${video.isPublished === false ? 'draft' : 'published'}</span>${video.isCustom ? '<span class=\"rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-300\">Custom</span>' : '<span class=\"rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400\">Catalog</span>'}${video.previewImageEnabled !== false ? '<span class=\"rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-200\">Image preview</span>' : ''}${video.previewVideoEnabled ? '<span class=\"rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-fuchsia-200\">Video preview asset</span>' : ''}</div><p class="mt-2 text-sm text-neutral-400">${escapeHtml(video.category)} · Price: ${escapeHtml(moneyLabelFromVideo(video))}</p></div><div class="text-sm text-neutral-400">${source.type === 'file' ? 'Uploaded file' : source.type === 'link' ? 'Video link' : 'No source'}</div></div><p class="mt-3 text-sm text-neutral-300">${escapeHtml(video.description || 'No description added yet.')}</p>${video.externalFileUrl ? `<p class="mt-2 text-xs text-pink-200 break-all">PikPak/Mega external file link saved</p>` : ''}<div class="mt-4 flex flex-wrap gap-3"><button data-edit-video="${video.id}" class="rounded-xl bg-pink-500 px-4 py-2 text-sm font-semibold text-white">Edit</button><button data-delete-video="${video.id}" class="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">Delete</button></div></div></div></div>`;
        }).join('') : `<div class="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-neutral-300"><p class="font-semibold text-white">No videos found in the admin list.</p><p class="mt-2 text-sm text-neutral-400">This usually means the admin video query returned zero rows or Supabase blocked the read. Public videos loaded: ${supabaseVideosCache.length}. Admin rows loaded: ${adminSupabaseVideosCache.length}. Local fallback rows: ${storage.getCustomVideos().length}.</p><div class="mt-3 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4 text-xs text-sky-100"><p>Supabase configured: <span class="font-bold">${getSupabaseClient() ? 'yes' : 'no'}</span></p><p>Current role: <span class="font-bold uppercase">${escapeHtml(state?.role || 'unknown')}</span></p><p class="break-all">Current email: <span class="font-bold">${escapeHtml(state?.email || 'not signed in')}</span></p><p class="break-all">User ID: <span class="font-bold">${escapeHtml(state?.user?.id || 'missing')}</span></p></div>${lastAdminVideoLoadError ? `<p class="mt-2 break-all text-sm text-rose-200">Supabase error: ${escapeHtml(lastAdminVideoLoadError)}</p>` : '<p class="mt-2 text-sm text-amber-200">No Supabase error came back. If another admin has uploads, RLS is likely returning zero rows instead of throwing an error.</p>'}<button type="button" id="admin-reload-videos" class="mt-4 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Reload videos</button></div>`);

        document.querySelectorAll('[data-edit-video]').forEach((button) => button.addEventListener('click', () => {
          const video = getAdminVideo(button.dataset.editVideo);
          if (video) populateVideoForm(video);
        }));

        document.querySelectorAll('[data-delete-video]').forEach((button) => button.addEventListener('click', async () => {
          const id = button.dataset.deleteVideo;
          if (!window.confirm('Delete this video from the site? This cannot be undone.')) return;
          const custom = storage.getCustomVideos();
          const targetCustom = custom.find((item) => item.id === id);
          const targetOverride = storage.getVideoOverrides()[id] || null;
          const targetSupabase = [...adminSupabaseVideosCache, ...supabaseVideosCache].find((item) => String(item.id) === String(id));
          if (targetCustom?.videoFileRef) { try { await removeVideoBlob(targetCustom.videoFileRef); } catch (error) {} }
          if (targetOverride?.videoFileRef) { try { await removeVideoBlob(targetOverride.videoFileRef); } catch (error) {} }
          try {
            if (targetSupabase) await removeVideoFromSupabase(id, targetSupabase.videoStoragePath || '');
          } catch (error) {
            console.error(error);
            toast('Delete failed in Supabase.', 'error');
            return;
          }
          if (custom.some((item) => item.id === id)) {
            storage.setCustomVideos(custom.filter((item) => item.id !== id));
          }
          storage.removeVideoOverride(id);
          storage.setHiddenVideos(storage.getHiddenVideos().filter((videoId) => String(videoId) !== String(id)));
          if (form.elements.videoId.value === id) resetVideoForm();
          await refreshSupabaseVideos(true);
          await refreshAdminSupabaseVideos(true);
          toast('Video removed from the site view.', 'success');
          renderVideoList();
          window.dispatchEvent(new CustomEvent('hg:state-changed'));
        }));
        document.getElementById('admin-reload-videos')?.addEventListener('click', async () => {
          await refreshSupabaseVideos(true);
          await refreshAdminSupabaseVideos(true);
          renderVideoList();
          toast(`Reloaded ${adminSupabaseVideosCache.length} admin video row(s).`, 'success');
        });
        } catch (error) {
          console.error('Admin video list render failed', error);
          listEl.innerHTML = `<div class="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-100"><p class="font-semibold text-white">The admin video list hit a JavaScript error.</p><p class="mt-2 text-sm">${escapeHtml(extractErrorMessage(error, 'Unknown render error.'))}</p><button type="button" id="admin-reload-videos" class="mt-4 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Try loading videos again</button></div>`;
          document.getElementById('admin-reload-videos')?.addEventListener('click', async () => {
            await refreshSupabaseVideos(true);
            await refreshAdminSupabaseVideos(true);
            renderVideoList();
          });
        }
      };

      adminVideoSearch?.addEventListener('input', renderVideoList);

      form.elements.thumbnailFile?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) { setThumbnailPreview(''); return; }
        if (!/image\/(jpeg|png|webp)/i.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name || '')) { toast('Thumbnail must be JPG, JPEG, PNG, or WEBP.', 'error'); event.target.value = ''; return; }
        try { setThumbnailPreview(await readFileAsDataUrl(file), { fromUpload: true }); renderThumbnailLibrary(); } catch (error) { toast('Thumbnail upload failed.', 'error'); }
      });
      form.elements.image.addEventListener('input', () => { selectedThumbnailUrl = ''; setThumbnailPreview(thumbnailData || String(form.elements.image.value || '').trim(), thumbnailData ? { fromUpload: true } : {}); renderThumbnailLibrary(); });
      refreshThumbnailsButton?.addEventListener('click', async () => { await refreshSupabaseThumbnails(true); renderThumbnailLibrary(); toast('Thumbnail library refreshed.', 'success'); });
      form.elements.videoUrl.addEventListener('input', updateSourceNote);
      form.elements.videoFile?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) { videoData = ''; videoMimeType = ''; videoFileName = ''; updateSourceNote(); return; }
        if (!/video\/(mp4|webm|quicktime)/i.test(file.type) && !/\.(mp4|webm|mov)$/i.test(file.name || '')) { toast('Video file must be MP4, WEBM, or MOV.', 'error'); event.target.value = ''; return; }
        try {
          videoData = await readFileAsDataUrl(file);
          videoMimeType = file.type || '';
          videoFileName = file.name || '';
          videoFileRef = '';
          videoStoragePath = '';
          updateSourceNote();
        } catch (error) { toast('Video upload failed.', 'error'); }
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = form.querySelector('button[type="submit"], button:not([type])');
        if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Saving...'; }
        const data = new FormData(form);
        const id = String(data.get('videoId') || '').trim() || ('custom-' + Date.now());
        const isCustom = String(data.get('isCustom') || 'true') === 'true';
        const imageValue = thumbnailData || selectedThumbnailUrl || String(data.get('image') || '').trim();
        const videoUrl = String(data.get('videoUrl') || '').trim();
        const selectedCategorySlug = String(data.get('categorySlug') || 'creator-picks').trim() || 'creator-picks';
        const selectedCategoryTitle = String(data.get('categoryTitle') || '').trim() || categoryDisplayName(selectedCategorySlug);
        const item = normalizeVideoItem({
          id,
          title: String(data.get('title') || '').trim(),
          description: String(data.get('description') || '').trim(),
          image: imageValue,
          videoUrl,
          videoFile: videoData,
          videoFileName,
          videoMimeType,
          videoFileRef,
          videoStoragePath,
          sourceType: (videoData || videoFileRef || videoStoragePath) ? 'file' : 'link',
          categorySlug: selectedCategorySlug,
          categoryTitle: selectedCategoryTitle,
          category: selectedCategoryTitle,
          access: String(data.get('access') || 'guest').trim(),
          priceCents: priceCentsFromFormValue(data.get('priceCents')),
          paypalUrl: String(data.get('paypalUrl') || '').trim(),
          isPublished: !!form.elements.isPublished?.checked,
          isCustom,
          externalFileUrl: String(data.get('externalFileUrl') || '').trim(),
          previewImageEnabled: !!form.elements.previewImageEnabled?.checked,
          previewVideoEnabled: !!form.elements.previewVideoEnabled?.checked,
          previewImage: previewImageData || String(data.get('previewImageUrl') || '').trim(),
          previewImageUrl: String(data.get('previewImageUrl') || '').trim(),
          previewVideo: previewVideoData || String(data.get('previewVideoUrl') || '').trim(),
          previewVideoUrl: String(data.get('previewVideoUrl') || '').trim(),
          previewVideoMimeType,
          previewVideoFileName
        });

        if (!item.title || !item.description) { toast('Title and description are required.', 'error'); if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Save video'; } return; }
        if (!item.image) { toast('Add a thumbnail upload or image URL.', 'error'); if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Save video'; } return; }
        if (!item.videoFile && !item.videoFileRef && !item.videoStoragePath && !item.videoUrl) { toast('Add a video file or a video link.', 'error'); if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Save video'; } return; }

        try {
          const pickedVideoFile = form.elements.videoFile?.files?.[0] || null;
          const hasSharedBackend = !!getSupabaseClient();
          if (pickedVideoFile) {
            if (hasSharedBackend) {
              const uploaded = await uploadVideoToSupabaseStorage(pickedVideoFile, id);
              if (!uploaded?.path) {
                throw new Error('Storage upload did not return a file path.');
              }
              item.videoStoragePath = uploaded.path;
              item.videoFileName = uploaded.fileName;
              item.videoMimeType = uploaded.mimeType;
              item.videoFile = '';
              item.videoFileRef = '';
              item.videoUrl = '';
              item.sourceType = 'file';
            } else {
              const blobRef = `hg-video-${id}`;
              await saveVideoBlob(blobRef, pickedVideoFile);
              item.videoFileRef = blobRef;
              item.videoFile = '';
              item.sourceType = 'file';
            }
          }

          if (imageValue) {
            try {
              await saveThumbnailToSupabase({
                id: `thumb-${id}-${Math.abs(hashString(imageValue))}`,
                url: imageValue,
                title: item.title ? `${item.title} thumbnail` : 'Saved thumbnail',
                fileName: form.elements.thumbnailFile?.files?.[0]?.name || '',
                linkedVideoId: id
              });
            } catch (error) {
              console.error('Thumbnail library save failed', error);
              storage.addThumbnail({ url: imageValue, title: item.title ? `${item.title} thumbnail` : 'Saved thumbnail', linkedVideoId: id });
            }
          }

          let savedToSupabase = false;
          let saveErrorMessage = '';
          try {
            savedToSupabase = await saveVideoToSupabase(item);
          } catch (error) {
            console.error(error);
            saveErrorMessage = extractErrorMessage(error, 'Shared catalog save failed.');
          }
          if (hasSharedBackend && !savedToSupabase) {
            throw new Error(saveErrorMessage || 'Shared catalog save failed.');
          }

          if (savedToSupabase) {
            storage.setCustomVideos(storage.getCustomVideos().filter((video) => video.id !== id));
            storage.setVideoOverride(id, { previewImageEnabled: item.previewImageEnabled, previewVideoEnabled: item.previewVideoEnabled, previewImage: item.previewImage, previewImageUrl: item.previewImageUrl, previewVideo: item.previewVideo, previewVideoUrl: item.previewVideoUrl, previewVideoMimeType: item.previewVideoMimeType, previewVideoFileName: item.previewVideoFileName });
          } else if (!hasSharedBackend && isCustom) {
            const items = storage.getCustomVideos().filter((video) => video.id !== id);
            items.push(item);
            storage.setCustomVideos(items);
          } else if (!hasSharedBackend) {
            storage.setVideoOverride(id, {
              title: item.title,
              description: item.description,
              image: item.image,
              videoUrl: item.videoUrl,
              videoFile: item.videoFile,
              videoFileRef: item.videoFileRef,
              videoFileName: item.videoFileName,
              videoMimeType: item.videoMimeType,
              videoStoragePath: item.videoStoragePath || '',
              sourceType: item.sourceType,
              externalFileUrl: item.externalFileUrl,
              categorySlug: item.categorySlug,
              categoryTitle: item.categoryTitle,
              access: item.access,
              priceCents: item.priceCents,
              paypalUrl: item.paypalUrl || item.paymentUrl || '',
              paymentUrl: item.paypalUrl || item.paymentUrl || '',
              previewImageEnabled: item.previewImageEnabled,
              previewVideoEnabled: item.previewVideoEnabled,
              previewImage: item.previewImage,
              previewImageUrl: item.previewImageUrl,
              previewVideo: item.previewVideo,
              previewVideoUrl: item.previewVideoUrl,
              previewVideoMimeType: item.previewVideoMimeType,
              previewVideoFileName: item.previewVideoFileName
            });
                        storage.setVideoLink(id, item.videoUrl);
          }

          await refreshSupabaseVideos(true);
          resetVideoForm();
          renderVideoList();
          toast(savedToSupabase ? `Video saved and synced as ${item.access.toUpperCase()}.` : `Video saved locally as ${item.access.toUpperCase()}.`, 'success');
          window.dispatchEvent(new CustomEvent('hg:state-changed'));
        } catch (error) {
          console.error(error);
          toast(`Video save failed: ${extractErrorMessage(error, 'Check Supabase storage, SQL columns, and bucket policies.')}`, 'error');
        } finally {
          if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Save video'; }
        }
      });

      resetButton.addEventListener('click', resetVideoForm);
      document.getElementById('admin-role-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const email = String(formData.get('email') || '').trim().toLowerCase();
        const role = String(formData.get('role') || 'guest').trim();
        storage.setRoleOverride(email, role);
        const cached = storage.getCachedProfile(email) || { email, is_vip: false, role: 'guest' };
        storage.cacheProfile(email, { ...cached, email, is_vip: role === 'vip' || role === 'admin', role });
        toast('Role saved.', 'success'); event.currentTarget.reset(); renderRoleList(); window.dispatchEvent(new CustomEvent('hg:state-changed'));
      });

      document.getElementById('admin-category-create-form')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const title = String(formData.get('title') || '').trim();
        const description = String(formData.get('description') || '').trim();
        const slug = makeCategorySlug(title);
        if (!title) { toast('Category name is required.', 'error'); return; }
        storage.restoreCategory(slug);
        storage.setCategoryMeta(slug, { title, description });
        try { await saveCategoryToSupabase({ slug, title, description }); toast('Category added and synced.', 'success'); }
        catch (error) { toast(`Category saved locally. Run the category SQL to sync sitewide: ${extractErrorMessage(error, 'Supabase category table missing.')}`, 'error'); }
        await refreshSupabaseCategories(true);
        event.currentTarget.reset();
        renderCategoryManager();
        window.dispatchEvent(new CustomEvent('hg:state-changed'));
      });

      document.getElementById('admin-category-form')?.addEventListener('click', async (event) => {
        const saveSlug = event.target?.dataset?.saveCategory;
        const deleteSlug = event.target?.dataset?.deleteCategory;
        if (saveSlug) {
          const title = String(document.querySelector(`[data-category-title="${saveSlug}"]`)?.value || '').trim() || titleFromSlug(saveSlug);
          const description = String(document.querySelector(`[data-category-description="${saveSlug}"]`)?.value || '').trim();
          storage.setCategoryNameOverride(saveSlug, title);
          storage.setCategoryMeta(saveSlug, { title, description });
          try { await saveCategoryToSupabase({ slug: saveSlug, title, description }); toast('Category updated for all users.', 'success'); }
          catch (error) { toast(`Category updated locally. Run the category SQL to sync all users: ${extractErrorMessage(error, 'Supabase category table missing.')}`, 'error'); }
          await refreshSupabaseCategories(true); renderCategoryManager(); window.dispatchEvent(new CustomEvent('hg:state-changed'));
        }
        if (deleteSlug) {
          if (!confirm(`Delete category "${categoryDisplayName(deleteSlug)}"? Videos in it will move to Creator Picks.`)) return;
          storage.markCategoryDeleted(deleteSlug); storage.removeCategoryMeta(deleteSlug);
          const updatedLocalVideos = storage.getCustomVideos().map((video) => String(video.categorySlug || '').toLowerCase() === deleteSlug ? { ...video, categorySlug: 'creator-picks', categoryTitle: categoryDisplayName('creator-picks'), category: categoryDisplayName('creator-picks') } : video);
          storage.setCustomVideos(updatedLocalVideos);
          try { await deleteCategoryFromSupabase(deleteSlug); toast('Category deleted and videos moved.', 'success'); }
          catch (error) { toast(`Category deleted locally. Run the category SQL to sync all users: ${extractErrorMessage(error, 'Supabase category table missing.')}`, 'error'); }
          await refreshSupabaseCategories(true); await refreshSupabaseVideos(true); renderCategoryManager(); renderVideoList(); window.dispatchEvent(new CustomEvent('hg:state-changed'));
        }
      });

      const showcaseForm = document.getElementById('admin-showcase-form');
      if (showcaseForm) {
        const input = showcaseForm.elements.showcaseUrl;
        const preview = document.getElementById('admin-showcase-preview');
        const previewImg = preview?.querySelector('img');
        const currentShowcase = String(getSiteSetting('home_showcase_image', '') || '').trim();
        if (input) input.value = currentShowcase;
        if (preview && previewImg && currentShowcase) { preview.classList.remove('hidden'); previewImg.src = currentShowcase; }
        showcaseForm.elements.showcaseFile?.addEventListener('change', async () => {
          const file = showcaseForm.elements.showcaseFile.files?.[0];
          if (!file) return;
          const dataUrl = await readFileAsDataUrl(file);
          if (preview && previewImg) { preview.classList.remove('hidden'); previewImg.src = dataUrl; }
        });
        showcaseForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          const button = showcaseForm.querySelector('button');
          const oldText = button?.textContent || 'Save homepage image';
          if (button) { button.disabled = true; button.textContent = 'Saving...'; }
          try {
            const file = showcaseForm.elements.showcaseFile?.files?.[0];
            const dataUrl = file ? await readFileAsDataUrl(file) : '';
            const url = dataUrl || String(showcaseForm.elements.showcaseUrl?.value || '').trim();
            if (!url) throw new Error('Add an image URL or choose an image file first.');
            await saveSiteSettingToSupabase('home_showcase_image', url);
            if (showcaseForm.elements.showcaseUrl) showcaseForm.elements.showcaseUrl.value = url.startsWith('data:') ? '' : url;
            if (preview && previewImg) { preview.classList.remove('hidden'); previewImg.src = url; }
            toast('Homepage showcase image saved.', 'success');
            window.dispatchEvent(new CustomEvent('hg:state-changed'));
          } catch (error) {
            toast(`Homepage image saved locally only or failed to sync: ${extractErrorMessage(error, 'Run the latest SQL update.')}`, 'error');
          } finally {
            if (button) { button.disabled = false; button.textContent = oldText; }
          }
        });
      }

      resetVideoForm();
      renderVideoList();
      try { renderRoleList(); } catch (error) { console.error('Role list render failed', error); }
      try { renderThumbnailLibrary(); } catch (error) { console.error('Thumbnail library render failed', error); }
      refreshSupabaseThumbnails().then(() => { try { renderThumbnailLibrary(); } catch (error) { console.error('Thumbnail library refresh render failed', error); } }).catch((error) => console.error('Thumbnail library refresh failed', error));
      try { renderCategoryManager(); } catch (error) { console.error('Category manager render failed', error); }
    };
    mount();
  }

  function renderSettingsPage() {
    applyBg();
    const prefs = storage.getUserPreferences ? storage.getUserPreferences() : {};
    document.body.innerHTML = shellHeader() + `<main class="mx-auto max-w-5xl px-6 py-14"><div class="rounded-[2rem] border border-pink-400/20 bg-gradient-to-br from-pink-500/10 via-fuchsia-500/10 to-transparent p-8"><p class="text-sm uppercase tracking-[0.25em] text-pink-300">Settings</p><h1 class="mt-3 text-4xl font-black">Personalize your Hidden Gems experience</h1><p class="mt-4 max-w-3xl text-neutral-300">Choose simple viewing preferences for this device. These settings are saved locally, so they will not affect other users.</p></div><form id="settings-form" class="mt-8 grid gap-6"><div class="rounded-[2rem] border border-white/10 bg-white/5 p-6"><h2 class="text-2xl font-bold">Display</h2><div class="mt-6 grid gap-4 md:grid-cols-2"><label class="block"><span class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Theme style</span><select name="theme" class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white"><option value="dark">Pink neon</option><option value="midnight">Midnight blue</option><option value="light">Light mode</option><option value="gold">Gold & Black</option></select></label><label class="block"><span class="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Card spacing</span><select name="cardDensity" class="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label></div></div><div class="rounded-[2rem] border border-white/10 bg-white/5 p-6"><h2 class="text-2xl font-bold">Playback quality of life</h2><div class="mt-5 space-y-4"><label class="flex items-center gap-3 text-sm text-neutral-300"><input type="checkbox" name="autoplayPreviews" class="h-4 w-4 rounded border-white/20 bg-black/40 text-pink-500" /> Allow preview videos to autoplay when the browser permits it</label><label class="flex items-center gap-3 text-sm text-neutral-300"><input type="checkbox" name="reducedMotion" class="h-4 w-4 rounded border-white/20 bg-black/40 text-pink-500" /> Reduce motion and visual effects</label></div></div><div class="rounded-[2rem] border border-white/10 bg-white/5 p-6"><h2 class="text-2xl font-bold">Account & membership</h2><div id="settings-account-summary" class="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-neutral-300">Loading account status...</div></div><div class="flex flex-wrap gap-3"><button class="rounded-2xl bg-pink-500 px-6 py-3 font-semibold text-white transition hover:bg-pink-400">Save Settings</button><a href="index.html" class="rounded-2xl border border-white/15 px-6 py-3 font-semibold text-white transition hover:bg-white/5">Back Home</a></div></form></main>` + shellFooter();
    bindCommonUi();
    const form = document.getElementById('settings-form');
    if (form) {
      form.elements.theme.value = prefs.theme || 'dark';
      form.elements.cardDensity.value = prefs.cardDensity || 'comfortable';
      form.elements.autoplayPreviews.checked = prefs.autoplayPreviews !== false;
      form.elements.reducedMotion.checked = !!prefs.reducedMotion;
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        storage.setUserPreferences({ theme: form.elements.theme.value, cardDensity: form.elements.cardDensity.value, autoplayPreviews: !!form.elements.autoplayPreviews.checked, reducedMotion: !!form.elements.reducedMotion.checked });
        applyBg();
        renderSettingsPage();
        toast('Settings saved for this device.', 'success');
      });
    }
    getState().then((state) => {
      const summary = document.getElementById('settings-account-summary');
      if (!summary) return;
      if (!state.user?.id) summary.innerHTML = 'You are currently browsing as a guest. Sign in to connect library and VIP access.';
      else summary.innerHTML = `Signed in as <span class="font-bold text-white">${escapeHtml(state.email)}</span> · Access: <span class="font-bold text-pink-300 uppercase">${escapeHtml(state.role)}</span>`;
    });
  }

  function renderSimplePage(title, eyebrow, copy) { applyBg(); document.body.innerHTML = shellHeader() + `<main class="mx-auto max-w-5xl px-6 py-14"><div class="rounded-[2rem] border border-pink-400/20 bg-gradient-to-br from-pink-500/10 via-fuchsia-500/10 to-transparent p-8"><p class="text-sm uppercase tracking-[0.25em] text-pink-300">${eyebrow}</p><h1 class="mt-3 text-4xl font-black">${title}</h1><div class="mt-6 max-w-none space-y-4 text-neutral-300">${copy}</div></div></main>` + shellFooter(); bindCommonUi(); }
  function initHomePage() { Promise.all([refreshSupabaseVideos(false), refreshSupabaseCategories(false), refreshSiteSettings(false)]).then(() => getState().then(updateHomeStateUi)); window.addEventListener('hg:state-changed', async () => { await refreshSupabaseVideos(false); await refreshSupabaseCategories(false); await refreshSiteSettings(false); updateHomeStateUi(await getState()); }); }
  function initVipCheckoutPage() { renderVipCheckoutPage(); }

  function initPage() {
    applyBg();
    const key = currentPageKey();
    if (key === 'home') { bindCommonUi(); initHomePage(); return; }
    if (['new-releases', 'most-popular', 'behind-the-scenes', 'live-sessions', 'short-films', 'creator-picks', 'vip-exclusives'].includes(key)) { renderCategoryPage(key); return; }
    if (key === 'video') { renderVideoPage(); return; }
    if (key === 'points-store') { renderPointsStore(); return; }
    if (key === 'vip-checkout') { renderVipCheckoutPage(); return; }
    if (key === 'my-library') { renderLibraryPage(); return; }
    if (key === 'all-videos') { renderAllVideosPage(); return; }
    if (key === 'admin') { renderAdminPage(); return; }
    if (key === 'settings') { renderSettingsPage(); return; }
    if (key === 'about') { renderSimplePage('About Hidden Gems', 'About', '<p>Hidden Gems is a premium digital video storefront built for rare drops, curated vault content, and account-based access.</p><p>Guests can purchase individual videos through secure Stripe checkout. Once checkout returns to Hidden Gems, the selected title unlocks for that signed-in account and appears in My Library.</p><p>VIP members get access to exclusive vault releases, and download access is reserved for VIP-approved files when available.</p><p>Hidden Gems may use trusted external file partners like PikPak and Mega for official downloadable files, so those links are part of the approved Hidden Gems access flow.</p>'); return; }
    if (key === 'contact') { renderSimplePage('Contact Hidden Gems', 'Support', `<p>Need help with access, VIP status, or a video purchase? Email support anytime at <a class="break-all font-semibold text-pink-300" href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p><p>Please include the email used for your Hidden Gems account, the video title, and a short description of the issue so support can review it faster.</p><p class="text-sm text-neutral-400">Typical response window: 1–3 business days.</p>`); return; }
    if (key === 'privacy') { renderSimplePage('Privacy Policy', 'Privacy', '<p>Hidden Gems uses account information to sign users in, remember video access, manage VIP status, and support purchases.</p><p>Payments are processed through Stripe checkout links. Hidden Gems stores access records needed to unlock purchased videos for the correct signed-in account, but payment card details are handled by Stripe, not directly by this site.</p><p>Support requests may require your account email, video title, and a short description of the issue so access problems can be reviewed.</p>'); return; }
    if (key === 'terms') { renderSimplePage('Terms of Service', 'Terms', '<p>Hidden Gems provides digital video access for personal viewing. Purchased guest videos unlock view-only access for the signed-in account that completed checkout.</p><p>VIP membership provides access to VIP vault content and may include download access when an approved file link is available.</p><p>Redistributing, reselling, reposting, scraping, or sharing Hidden Gems content outside the platform is not permitted.</p><p>External file links through approved partners such as PikPak and Mega are considered official Hidden Gems delivery sources when shown on the site.</p>'); return; }
    if (key === 'refund-policy') { renderSimplePage('Refund Policy', 'Refunds', '<p>Hidden Gems sells digital video access. Because access can be granted instantly after checkout, purchases are generally treated as final once the video is unlocked.</p><p>If a duplicate purchase, failed unlock, billing mistake, or file-access issue happens, contact support with the account email, video title, and payment details so the issue can be reviewed.</p><p>VIP membership issues are reviewed case by case, especially when access was not correctly applied to the signed-in account.</p>'); return; }
    bindCommonUi();
  }

  document.addEventListener('DOMContentLoaded', initPage);
  let realtimeBound = false;
  async function bindRealtimeSync() {
    if (realtimeBound) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      supabase.channel('hg-videos-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hg_videos' }, async () => {
          supabaseVideosLoaded = false;
          adminSupabaseVideosLoaded = false;
          await Promise.all([refreshSupabaseVideos(true), refreshAdminSupabaseVideos(true)]);
          window.dispatchEvent(new CustomEvent('hg:state-changed'));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hg_categories' }, async () => {
          supabaseCategoriesLoaded = false;
          await refreshSupabaseCategories(true);
          window.dispatchEvent(new CustomEvent('hg:state-changed'));
        })
        .subscribe();
      realtimeBound = true;
    } catch (error) {
      console.error('Realtime binding failed', error);
    }
  }

  bindRealtimeSync();
  return { storage, getState, getVideo, getCategory, allVideos, renderCategoryPage, renderVideoPage, renderPointsStore, renderVipCheckoutPage, renderLibraryPage, renderAllVideosPage, renderSimplePage, shellHeader, shellFooter, bindCommonUi, initialsFromEmail, mountSharedHeader, refreshHeaderUi, signOutUser, syncVipForCurrentUser, canAccessVideo, refreshSupabaseCategories, refreshAdminSupabaseVideos, refreshSiteSettings, initVipCheckoutPage, startVipCheckout, startVideoCheckout, finalizeCheckoutFromUrl, finalizeStripeVideoCheckoutFromLocalStorage, finalizeStripeVipCheckoutFromLocalStorage, updateCurrentUserProfile, getSupabaseClient, resetSupabaseSession, getSessionUser };
})();
