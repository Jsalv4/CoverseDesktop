(function bootstrapHomeFeedUtils(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.CoverseFeedUtils = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createHomeFeedUtils() {
  function toTrimmedString(value) {
    return String(value == null ? '' : value).trim();
  }

  function slugifyToken(value) {
    return toTrimmedString(value)
      .toLowerCase()
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function normalizeIdentityKey(value) {
    return toTrimmedString(value).toLowerCase();
  }

  function parseBoolean(value, fallback = null) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
      if (['false', '0', 'no', 'n', ''].includes(normalized)) return false;
    }
    return fallback;
  }

  function parseNumberCandidate(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^\d.-]/g, '').trim();
      if (!cleaned) return NaN;
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
  }

  const FEED_FILTER_TYPES = Object.freeze([
    'all',
    'music',
    'sample',
    'sample-pack',
    'drum-pack',
    'loop',
    'vocal',
    'one-shot',
    'fx-pack',
    'midi-pack',
    'preset-pack',
    'beat',
    'collabs',
    'video',
    'service',
    'plugin'
  ]);

  const FEED_FILTER_ALIAS = Object.freeze({
    samples: 'sample',
    sample: 'sample',
    songs: 'music',
    song: 'music',
    instrumentals: 'beat',
    instrumental: 'beat',
    collab: 'collabs',
    collaboration: 'collabs',
    collaborations: 'collabs',
    collabs: 'collabs'
  });

  const FEED_SAMPLE_PACK_TYPES = Object.freeze([
    'sample-pack',
    'drum-pack',
    'fx-pack',
    'midi-pack',
    'preset-pack',
    'one-shot',
    'loop',
    'vocal'
  ]);

  const MARKETPLACE_FILTER_TYPES = Object.freeze([
    'all',
    'samples',
    'instrumentals',
    'sample-packs',
    'drum-kits',
    'loops',
    'vocals',
    'one-shots',
    'fx',
    'midi-packs',
    'preset-banks',
    'songs',
    'services',
    'plugins'
  ]);

  const MARKETPLACE_FILTER_ALIAS = Object.freeze({
    sample: 'samples',
    beat: 'instrumentals',
    instrumental: 'instrumentals',
    song: 'songs',
    service: 'services',
    plugin: 'plugins'
  });

  const MARKETPLACE_FILTER_TO_TYPES = Object.freeze({
    samples: ['sample'],
    instrumentals: ['beat'],
    'sample-packs': [...FEED_SAMPLE_PACK_TYPES],
    'drum-kits': ['drum-pack'],
    loops: ['loop'],
    vocals: ['vocal'],
    'one-shots': ['one-shot'],
    fx: ['fx-pack'],
    'midi-packs': ['midi-pack'],
    'preset-banks': ['preset-pack'],
    songs: ['music'],
    services: ['service'],
    plugins: ['plugin']
  });

  const MARKETPLACE_EXCLUDED_TYPES = new Set(['video', 'collab', 'collaboration', 'collabs', 'post', 'text']);
  const MARKETPLACE_PRICE_FILTERS = new Set(['free', 'stream', 'paid', 'under-10', '10-25', '25-50', '50-100', '100+']);

  function canonicalizeContentType(value = '', { fallback = 'sample', preserveUnknown = false } = {}) {
    const raw = toTrimmedString(value).toLowerCase();
    if (!raw) return fallback;

    const compact = raw
      .replace(/[_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const slug = compact
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '');

    if (/(^|[\s-])collab(oration)?s?($|[\s-])/.test(compact) || compact.includes('collaboration')) {
      return 'collab';
    }

    if (compact === 'post' || compact.includes(' text post ') || compact.endsWith(' post')) {
      return 'post';
    }

    if (compact === 'text' || compact.includes(' text ')) {
      return 'text';
    }

    if (compact.includes('video')) {
      return 'video';
    }

    if (compact.includes('service')) {
      return 'service';
    }

    if (compact.includes('plugin') || compact.includes('vst') || compact.includes('au plugin')) {
      return 'plugin';
    }

    if (compact.includes('sample pack') || compact.includes('sample-pack')) {
      return 'sample-pack';
    }

    if (
      compact.includes('drum pack') ||
      compact.includes('drum-pack') ||
      compact.includes('drum kit') ||
      compact.includes('drum-kit')
    ) {
      return 'drum-pack';
    }

    if (
      compact.includes('fx pack') ||
      compact.includes('fx-pack') ||
      compact.includes('effect pack') ||
      compact.includes('effects pack')
    ) {
      return 'fx-pack';
    }

    if (compact.includes('midi pack') || compact.includes('midi-pack')) {
      return 'midi-pack';
    }

    if (
      compact.includes('preset pack') ||
      compact.includes('preset-pack') ||
      compact.includes('preset bank') ||
      compact.includes('preset-bank')
    ) {
      return 'preset-pack';
    }

    if (compact.includes('one shot') || compact.includes('one-shot') || compact.includes('oneshot')) {
      return 'one-shot';
    }

    if (/(^|[\s-])loop(s)?($|[\s-])/.test(compact)) {
      return 'loop';
    }

    if (compact.includes('vocal')) {
      return 'vocal';
    }

    if (
      compact.includes('instrumental') ||
      compact.includes('type beat') ||
      compact.includes('type-beat') ||
      compact.includes('backing track') ||
      compact.includes('backing-track') ||
      compact.includes(' beat') ||
      compact.startsWith('beat') ||
      compact.startsWith('prod ') ||
      compact.startsWith('prod-')
    ) {
      return 'beat';
    }

    if (
      compact.includes('song') ||
      compact.includes('music') ||
      compact.includes('record') ||
      compact.includes('single') ||
      compact === 'track'
    ) {
      return 'music';
    }

    if (compact.includes('sample')) {
      return 'sample';
    }

    return preserveUnknown ? slug : fallback;
  }

  function normalizeFeedType(value = '') {
    return canonicalizeContentType(value, { fallback: 'sample', preserveUnknown: false });
  }

  function normalizeMarketplaceType(value = '') {
    return canonicalizeContentType(value, { fallback: '', preserveUnknown: true });
  }

  function normalizeFeedFilterType(value = '', fallback = 'all') {
    const token = slugifyToken(value);
    const mapped = FEED_FILTER_ALIAS[token] || token;
    if (FEED_FILTER_TYPES.includes(mapped)) return mapped;

    const fallbackToken = FEED_FILTER_ALIAS[slugifyToken(fallback)] || slugifyToken(fallback);
    return FEED_FILTER_TYPES.includes(fallbackToken) ? fallbackToken : 'all';
  }

  function getDisplayTypeLabel(value = '') {
    const normalized = normalizeFeedType(value);
    const map = {
      music: 'Music',
      sample: 'Sample',
      'sample-pack': 'Sample Pack',
      'drum-pack': 'Drum Pack',
      loop: 'Loop',
      vocal: 'Vocal',
      'one-shot': 'One Shot',
      'fx-pack': 'FX Pack',
      'midi-pack': 'MIDI Pack',
      'preset-pack': 'Preset Pack',
      beat: 'Beat',
      collab: 'Collab',
      video: 'Video',
      service: 'Service',
      plugin: 'Plugin'
    };
    if (map[normalized]) return map[normalized];
    if (!normalized) return 'Sample';
    return normalized
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function getFeedFilterAllowedTypes(filterType = 'all') {
    const normalizedFilter = normalizeFeedFilterType(filterType, 'all');
    if (normalizedFilter === 'all') return [];
    if (normalizedFilter === 'sample-pack') return [...FEED_SAMPLE_PACK_TYPES];
    if (normalizedFilter === 'collabs') return ['collab'];
    return [normalizedFilter];
  }

  function getActiveFeedFilter(value = '', fallback = 'all', options = {}) {
    const explicit = toTrimmedString(value);
    if (explicit) {
      return normalizeFeedFilterType(explicit, fallback);
    }

    const scope = options.root || (typeof document !== 'undefined' ? document : null);
    if (scope && typeof scope.querySelector === 'function') {
      const activeChip = scope.querySelector('.home-feed-filter[data-filter].active, .home-feed-filter[data-filter].bg-accent-neon');
      if (activeChip?.dataset?.filter) {
        return normalizeFeedFilterType(activeChip.dataset.filter, fallback);
      }
    }

    return normalizeFeedFilterType(fallback, 'all');
  }

  function applyFeedFilter(items = [], filter = 'all') {
    const source = Array.isArray(items) ? items : [];
    const activeFilter = getActiveFeedFilter(filter, 'all');
    if (activeFilter === 'all') return source.slice();

    const allowedTypes = new Set(getFeedFilterAllowedTypes(activeFilter));

    return source.filter((item) => {
      const normalizedType = normalizeFeedType(item?.normalizedType || item?.type || item?.sampleType || item?.rawType || '');
      return allowedTypes.has(normalizedType);
    });
  }

  function normalizeMarketplaceFilterType(value = '', fallback = 'all') {
    const token = slugifyToken(value);
    const mapped = MARKETPLACE_FILTER_ALIAS[token] || token;
    if (MARKETPLACE_FILTER_TYPES.includes(mapped)) return mapped;

    const fallbackToken = MARKETPLACE_FILTER_ALIAS[slugifyToken(fallback)] || slugifyToken(fallback);
    return MARKETPLACE_FILTER_TYPES.includes(fallbackToken) ? fallbackToken : 'all';
  }

  function mapMarketplaceFilterToTypes(filterType = 'all') {
    const normalizedFilter = normalizeMarketplaceFilterType(filterType, 'all');
    if (normalizedFilter === 'all') return [];
    return Array.isArray(MARKETPLACE_FILTER_TO_TYPES[normalizedFilter])
      ? MARKETPLACE_FILTER_TO_TYPES[normalizedFilter].slice()
      : [];
  }

  function isMarketplaceExcludedType(typeValue = '') {
    const normalized = normalizeMarketplaceType(typeValue);
    const token = slugifyToken(typeValue);
    return MARKETPLACE_EXCLUDED_TYPES.has(normalized)
      || MARKETPLACE_EXCLUDED_TYPES.has(token)
      || MARKETPLACE_EXCLUDED_TYPES.has(String(typeValue || '').toLowerCase());
  }

  function normalizeGenreValue(value = '') {
    const raw = toTrimmedString(value).toLowerCase();
    if (!raw) return '';

    if (/^r\s*&\s*b$/.test(raw) || /^rnb$/.test(raw) || /^r\s*and\s*b$/.test(raw)) {
      return 'rnb';
    }

    const normalized = raw
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalized === 'r and b' || normalized === 'rnb') {
      return 'rnb';
    }

    return normalized.replace(/\s+/g, '-');
  }

  function parseBpmFilter(input = '') {
    const raw = toTrimmedString(input).toLowerCase();
    if (!raw) return { kind: 'any' };

    const exactMatch = raw.match(/^(\d+(?:\.\d+)?)$/);
    if (exactMatch) {
      return { kind: 'exact', value: Number(exactMatch[1]) };
    }

    const rangeMatch = raw.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
      const minValue = Number(rangeMatch[1]);
      const maxValue = Number(rangeMatch[2]);
      if (Number.isFinite(minValue) && Number.isFinite(maxValue) && minValue <= maxValue) {
        return { kind: 'range', min: minValue, max: maxValue };
      }
      return { kind: 'invalid', value: raw };
    }

    const minMatch = raw.match(/^(\d+(?:\.\d+)?)\s*\+$/);
    if (minMatch) {
      return { kind: 'min', min: Number(minMatch[1]) };
    }

    return { kind: 'invalid', value: raw };
  }

  function matchesBpmFilter(bpmValue, rule = { kind: 'any' }) {
    if (!rule || rule.kind === 'any') return true;
    if (rule.kind === 'invalid') return false;

    const bpm = Number(bpmValue);
    if (!Number.isFinite(bpm)) return false;

    if (rule.kind === 'exact') return bpm === Number(rule.value);
    if (rule.kind === 'range') return bpm >= Number(rule.min) && bpm <= Number(rule.max);
    if (rule.kind === 'min') return bpm >= Number(rule.min);
    return false;
  }

  function getMarketplaceMinPaidPrice(item = {}) {
    if (!item || typeof item !== 'object') return NaN;

    const tierPrices = (Array.isArray(item.licenseTiers) ? item.licenseTiers : [])
      .map((tier) => parseNumberCandidate(tier?.price ?? tier?.amount ?? tier?.value))
      .filter((candidate) => Number.isFinite(candidate) && candidate > 0)
      .sort((first, second) => first - second);

    if (tierPrices.length) return tierPrices[0];

    const legacyPrices = [
      item.basicPrice,
      item.personalPrice,
      item.commercialPrice,
      item.exclusivePrice,
      item.priceValue,
      item.price
    ]
      .map((candidate) => parseNumberCandidate(candidate))
      .filter((candidate) => Number.isFinite(candidate) && candidate > 0)
      .sort((first, second) => first - second);

    if (legacyPrices.length) return legacyPrices[0];
    return NaN;
  }

  function getMarketplacePriceBucket(item = {}) {
    const isFree = parseBoolean(item?.isFree, false) === true;
    if (isFree) return 'free';

    const isStreamOnly = parseBoolean(item?.streamOnly, false) === true
      || parseBoolean(item?.previewOnly, false) === true
      || parseBoolean(item?.isPreviewOnly, false) === true;
    if (isStreamOnly) return 'stream';

    const minPaidPrice = getMarketplaceMinPaidPrice(item);
    if (!Number.isFinite(minPaidPrice) || minPaidPrice <= 0) return 'paid';
    if (minPaidPrice < 10) return 'under-10';
    if (minPaidPrice <= 25) return '10-25';
    if (minPaidPrice <= 50) return '25-50';
    if (minPaidPrice <= 100) return '50-100';
    return '100+';
  }

  function normalizeMarketplacePriceFilter(value = '') {
    const token = slugifyToken(value);
    return MARKETPLACE_PRICE_FILTERS.has(token) ? token : '';
  }

  function matchesPriceFilter(item = {}, priceFilter = '') {
    const normalizedFilter = normalizeMarketplacePriceFilter(priceFilter);
    if (!normalizedFilter) return true;

    const bucket = getMarketplacePriceBucket(item);
    if (normalizedFilter === 'free') return bucket === 'free';
    if (normalizedFilter === 'stream') return bucket === 'stream';
    if (normalizedFilter === 'paid') {
      return bucket !== 'free' && bucket !== 'stream';
    }

    if (bucket === 'free' || bucket === 'stream') return false;

    const minPaidPrice = getMarketplaceMinPaidPrice(item);
    if (!Number.isFinite(minPaidPrice) || minPaidPrice <= 0) return false;

    if (normalizedFilter === 'under-10') return minPaidPrice < 10;
    if (normalizedFilter === '10-25') return minPaidPrice >= 10 && minPaidPrice <= 25;
    if (normalizedFilter === '25-50') return minPaidPrice >= 25 && minPaidPrice <= 50;
    if (normalizedFilter === '50-100') return minPaidPrice >= 50 && minPaidPrice <= 100;
    if (normalizedFilter === '100+') return minPaidPrice >= 100;

    return true;
  }

  function parseTagTerms(value = '') {
    return String(value || '')
      .split(/[,\s#]+/)
      .map((term) => term.trim().toLowerCase())
      .filter(Boolean)
      .filter((term, index, list) => list.indexOf(term) === index);
  }

  function normalizeTagList(tags) {
    if (Array.isArray(tags)) {
      return tags
        .map((entry) => toTrimmedString(entry).toLowerCase())
        .filter(Boolean);
    }

    if (typeof tags === 'string') {
      return tags
        .split(/[,\s#]+/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
    }

    return [];
  }

  function matchesTagTerms(itemTags, terms = []) {
    const tagTerms = Array.isArray(terms) ? terms : parseTagTerms(String(terms || ''));
    if (!tagTerms.length) return true;

    const normalizedTags = normalizeTagList(itemTags);
    if (!normalizedTags.length) return false;

    return tagTerms.some((term) => normalizedTags.some((tag) => tag.includes(term)));
  }

  function filterMarketplaceItems(items = [], filterType = 'all', subfilters = {}) {
    const source = Array.isArray(items) ? items : [];
    const normalizedFilter = normalizeMarketplaceFilterType(filterType, 'all');
    const allowedTypes = new Set(mapMarketplaceFilterToTypes(normalizedFilter));

    const selectedGenre = normalizeGenreValue(subfilters?.genre || '');
    const bpmRule = parseBpmFilter(subfilters?.bpm || '');
    const selectedKey = toTrimmedString(subfilters?.key || '').toLowerCase();
    const selectedPackType = normalizeMarketplaceType(subfilters?.packType || '');
    const selectedPrice = normalizeMarketplacePriceFilter(subfilters?.price || '');
    const selectedTagTerms = parseTagTerms(subfilters?.tags || '');

    return source.filter((item) => {
      const itemType = normalizeMarketplaceType(item?.sampleType || item?.type || item?.rawType || item?.category || '');
      if (isMarketplaceExcludedType(itemType)) return false;

      if (normalizedFilter !== 'all' && !allowedTypes.has(itemType)) {
        return false;
      }

      if (selectedGenre) {
        const itemGenre = normalizeGenreValue(item?.genre || '');
        if (!itemGenre || itemGenre !== selectedGenre) return false;
      }

      if (!matchesBpmFilter(item?.bpm, bpmRule)) {
        return false;
      }

      if (selectedKey) {
        const itemKey = toTrimmedString(item?.key || '').toLowerCase();
        if (!itemKey || itemKey !== selectedKey) return false;
      }

      if (selectedPackType && selectedPackType !== itemType) {
        return false;
      }

      if (selectedPrice && !matchesPriceFilter(item, selectedPrice)) {
        return false;
      }

      if (selectedTagTerms.length) {
        if (!matchesTagTerms(item?.tags, selectedTagTerms)) {
          return false;
        }
      }

      return true;
    });
  }

  function getFeedTimestampMs(value) {
    if (!value) return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.toDate === 'function') {
      const fromDate = value.toDate();
      const millis = fromDate?.getTime?.();
      return Number.isFinite(millis) ? millis : 0;
    }
    if (typeof value === 'object' && Number.isFinite(Number(value.seconds))) {
      const millis = Number(value.seconds) * 1000 + Number(value.nanoseconds || 0) / 1e6;
      return Number.isFinite(millis) ? millis : 0;
    }
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function parseTags(value) {
    if (Array.isArray(value)) {
      return value
        .map((entry) => toTrimmedString(entry))
        .filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return [];
  }

  function getFeedMinPrice(item = {}) {
    const licenseTiers = Array.isArray(item.licenseTiers) ? item.licenseTiers : [];
    const tierPrices = licenseTiers
      .map((tier) => parseNumberCandidate(tier?.price ?? tier?.amount ?? tier?.value))
      .filter((price) => Number.isFinite(price) && price > 0)
      .sort((a, b) => a - b);

    if (tierPrices.length > 0) {
      return tierPrices[0];
    }

    const explicitCandidates = [
      item.priceValue,
      item.price,
      item.amount,
      item.unitPrice,
      item.priceUsd,
      item.priceUSD,
      item.priceInUsd,
      item.minPrice,
      item.startingPrice,
      item.basicPrice,
      item.personalPrice,
      item.commercialPrice,
      item.exclusivePrice
    ]
      .map((candidate) => parseNumberCandidate(candidate))
      .filter((candidate) => Number.isFinite(candidate) && candidate >= 0)
      .sort((a, b) => a - b);

    if (explicitCandidates.length > 0) {
      return explicitCandidates[0];
    }

    const centCandidates = [item.priceCents, item.amountCents]
      .map((candidate) => parseNumberCandidate(candidate))
      .filter((candidate) => Number.isFinite(candidate) && candidate >= 0)
      .sort((a, b) => a - b);

    if (centCandidates.length > 0) {
      return centCandidates[0] / 100;
    }

    return NaN;
  }

  function getFeedPriceLabel(item = {}) {
    const streamOnly = parseBoolean(item.streamOnly, false) === true
      || parseBoolean(item.previewOnly, false) === true
      || parseBoolean(item.isPreviewOnly, false) === true;

    if (streamOnly) return 'Stream Only';

    const explicitIsFree = parseBoolean(item.isFree, null);
    if (explicitIsFree === true) return 'Free';

    const minPrice = getFeedMinPrice(item);
    if (Number.isFinite(minPrice) && minPrice > 0) {
      const licenseTiers = Array.isArray(item.licenseTiers) ? item.licenseTiers : [];
      if (licenseTiers.length > 1) return `From $${Number(minPrice).toFixed(2)}`;
      return `$${Number(minPrice).toFixed(2)}`;
    }

    if (Number.isFinite(minPrice) && minPrice === 0) {
      return 'Free';
    }

    const text = toTrimmedString(item.priceLabel);
    return text || 'Price unavailable';
  }

  function buildIdentityKeys(item = {}) {
    const keys = [
      item.id,
      item.postId,
      item.itemId,
      item.marketplaceId,
      item.sourceId,
      item.purchaseId,
      item.raw?.id,
      item.raw?.postId,
      item.raw?.itemId,
      item.rawItem?.id,
      item.rawMarketplaceItem?.id,
      item.rawMarketplaceItem?.postId
    ]
      .map(normalizeIdentityKey)
      .filter(Boolean);

    return Array.from(new Set(keys));
  }

  function mapMarketplaceItemToFeedItem(item = {}, index = 0) {
    const title = toTrimmedString(item.title || item.name || item.caption || item.description || 'Untitled');
    const sellerName = toTrimmedString(item.userName || item.sellerName || item.creatorName || item.displayName || item.username || item.ownerName || 'Unknown');
    const createdAt = item.createdAt || item.uploadedAt || item.updatedAt || item.timestamp || item.publishedAt || item.date || null;

    const normalizedType = normalizeFeedType(item.sampleType || item.type || item.category || '');
    const displayType = getDisplayTypeLabel(normalizedType);

    const minPrice = getFeedMinPrice(item);
    const explicitIsFree = parseBoolean(item.isFree, null);
    const explicitStreamOnly = parseBoolean(item.streamOnly, null);
    const streamOnly = explicitStreamOnly === true
      || parseBoolean(item.previewOnly, false) === true
      || parseBoolean(item.isPreviewOnly, false) === true;
    const isFree = explicitIsFree === true
      ? true
      : (explicitIsFree === false
        ? false
        : (Number.isFinite(minPrice) && minPrice === 0 && !streamOnly));

    const idFallback = `${title || 'untitled'}::${sellerName || 'unknown'}::${index}`;
    const id = toTrimmedString(item.id || item.itemId || item.postId || item._id || item.slug || idFallback);
    const postId = toTrimmedString(item.postId || item.id || item.itemId || item._id || id);

    const audioUrl = toTrimmedString(
      item.audioUrl || item.audioURL || item.previewAudioUrl || item.sampleUrl || item.demoUrl || item.downloadURL || item.fileUrl || item.url || item.sourceAudioUrl || ''
    );
    const fileUrl = toTrimmedString(item.fileUrl || item.downloadURL || audioUrl || '');
    const storagePath = toTrimmedString(item.storagePath || item.audioPath || item.filePath || item.path || item.mediaPath || item.firebasePath || '');

    const mapped = {
      ...item,
      id,
      postId,
      sourceId: toTrimmedString(item.sourceId || item.itemId || item.postId || item.id || ''),
      title,
      description: toTrimmedString(item.description || item.caption || ''),
      normalizedType,
      type: normalizedType,
      rawType: toTrimmedString(item.sampleType || item.type || item.category || ''),
      displayType,
      image: toTrimmedString(item.image || item.coverImage || item.coverImageUrl || item.thumbnailURL || item.thumbnailUrl || item.previewUrl || item.imageUrl || ''),
      userName: sellerName,
      userAvatar: toTrimmedString(item.userAvatar || item.avatarUrl || item.photoURL || item.creatorAvatar || ''),
      genre: toTrimmedString(item.genre || ''),
      bpm: Number(item.bpm || 0),
      key: toTrimmedString(item.key || ''),
      tags: parseTags(item.tags),
      price: Number.isFinite(minPrice) ? minPrice : 0,
      priceValue: Number.isFinite(minPrice) ? minPrice : 0,
      priceLabel: getFeedPriceLabel(item),
      hasPriceValue: Number.isFinite(minPrice),
      isFree,
      streamOnly,
      audioUrl,
      downloadURL: toTrimmedString(item.downloadURL || item.fileUrl || audioUrl || ''),
      fileUrl,
      storagePath,
      sellerId: toTrimmedString(item.sellerId || item.userId || item.ownerUid || item.uid || ''),
      license: item.license || null,
      licenseTiers: Array.isArray(item.licenseTiers) ? item.licenseTiers : [],
      hasPreview: Boolean(audioUrl || fileUrl || storagePath),
      source: toTrimmedString(item.source || 'marketplace') || 'marketplace',
      sourceKind: 'marketplace',
      createdAt,
      timestampMs: getFeedTimestampMs(createdAt),
      rawMarketplaceItem: item,
      rawItem: item
    };

    mapped.identityKeys = buildIdentityKeys(mapped);
    return mapped;
  }

  function getFeedDedupeKey(item = {}, index = 0) {
    const ids = buildIdentityKeys(item);
    if (ids.length > 0) return `id:${ids[0]}`;

    const title = normalizeIdentityKey(item.title || item.name || item.label || '');
    const seller = normalizeIdentityKey(item.sellerId || item.userId || item.userName || item.ownerUid || '');
    if (title && seller) {
      return `meta:${seller}|${title}`;
    }

    return `idx:${index}`;
  }

  function scoreFeedItem(item = {}) {
    let score = 0;
    if (toTrimmedString(item.image || item.coverImage || item.thumbnailURL)) score += 3;
    if (toTrimmedString(item.audioUrl || item.downloadURL || item.fileUrl || item.storagePath)) score += 3;
    if (toTrimmedString(item.description)) score += 2;
    if (toTrimmedString(item.userName || item.sellerName)) score += 2;
    if (Array.isArray(item.tags) && item.tags.length > 0) score += 1;
    if (Array.isArray(item.licenseTiers) && item.licenseTiers.length > 0) score += 1;
    if (Number.isFinite(Number(item.priceValue))) score += 1;
    return score;
  }

  function mergeIdentityKeys(existing = {}, incoming = {}) {
    const keys = [
      ...(Array.isArray(existing.identityKeys) ? existing.identityKeys : []),
      ...(Array.isArray(incoming.identityKeys) ? incoming.identityKeys : []),
      ...buildIdentityKeys(existing),
      ...buildIdentityKeys(incoming)
    ]
      .map(normalizeIdentityKey)
      .filter(Boolean);

    return Array.from(new Set(keys));
  }

  function pickPreferredFeedItem(existing = {}, incoming = {}) {
    const existingTs = getFeedTimestampMs(existing.timestampMs || existing.createdAt || existing.updatedAt || existing.uploadedAt || existing.publishedAt);
    const incomingTs = getFeedTimestampMs(incoming.timestampMs || incoming.createdAt || incoming.updatedAt || incoming.uploadedAt || incoming.publishedAt);

    let winner = existing;
    let loser = incoming;

    if (incomingTs > existingTs) {
      winner = incoming;
      loser = existing;
    } else if (incomingTs === existingTs) {
      const incomingScore = scoreFeedItem(incoming);
      const existingScore = scoreFeedItem(existing);
      if (incomingScore >= existingScore) {
        winner = incoming;
        loser = existing;
      }
    }

    const merged = {
      ...loser,
      ...winner
    };

    merged.identityKeys = mergeIdentityKeys(existing, incoming);
    merged.timestampMs = Math.max(existingTs, incomingTs, 0);
    return merged;
  }

  function dedupeFeedItems(items = []) {
    const source = Array.isArray(items) ? items : [];
    const byKey = new Map();

    source.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const key = getFeedDedupeKey(item, index);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, item);
        return;
      }
      byKey.set(key, pickPreferredFeedItem(existing, item));
    });

    return Array.from(byKey.values());
  }

  function sortFeedItemsNewestFirst(items = []) {
    const source = Array.isArray(items) ? items : [];
    return source
      .slice()
      .sort((a, b) => {
        const aTs = getFeedTimestampMs(a?.timestampMs || a?.createdAt || a?.updatedAt || a?.uploadedAt || a?.publishedAt);
        const bTs = getFeedTimestampMs(b?.timestampMs || b?.createdAt || b?.updatedAt || b?.uploadedAt || b?.publishedAt);
        return bTs - aTs;
      });
  }

  function dedupeAndSortFeedItems(items = []) {
    return sortFeedItemsNewestFirst(dedupeFeedItems(items));
  }

  function toSet(value) {
    if (value instanceof Set) return value;
    if (Array.isArray(value)) {
      return new Set(value.map(normalizeIdentityKey).filter(Boolean));
    }
    return new Set();
  }

  function deriveActionState(item = {}, options = {}) {
    const ownedIds = toSet(options.ownedIds);
    const cartIds = toSet(options.cartIds);
    const currentUserId = normalizeIdentityKey(options.currentUserId || '');

    const sellerId = normalizeIdentityKey(item.sellerId || item.userId || item.ownerUid || item.uid || '');
    const ids = mergeIdentityKeys(item, item).map(normalizeIdentityKey).filter(Boolean);

    const isOwned = ids.some((id) => ownedIds.has(id));
    const isInCart = ids.some((id) => cartIds.has(id));
    const isSelf = Boolean(currentUserId && sellerId && currentUserId === sellerId);

    const streamOnly = parseBoolean(item.streamOnly, false) === true;
    const parsedPrice = parseNumberCandidate(item.priceValue ?? item.price);
    const isFree = parseBoolean(item.isFree, false) === true || (Number.isFinite(parsedPrice) && parsedPrice === 0);
    const canPreview = Boolean(item.hasPreview || item.audioUrl || item.downloadURL || item.fileUrl || item.storagePath);

    if (isSelf) {
      return {
        action: 'self',
        label: 'Your item',
        disabled: true,
        muted: true,
        canPreview
      };
    }

    if (isOwned) {
      return {
        action: 'owned',
        label: 'Owned',
        disabled: true,
        muted: true,
        canPreview
      };
    }

    if (isInCart) {
      return {
        action: 'in-cart',
        label: 'In cart',
        disabled: true,
        muted: true,
        canPreview
      };
    }

    if (streamOnly) {
      return {
        action: 'stream',
        label: 'Stream',
        disabled: !canPreview,
        muted: false,
        canPreview
      };
    }

    if (isFree) {
      return {
        action: 'download',
        label: 'Download',
        disabled: false,
        muted: false,
        canPreview
      };
    }

    return {
      action: 'buy',
      label: 'Add to cart',
      disabled: false,
      muted: false,
      canPreview
    };
  }

  return {
    FEED_FILTER_TYPES,
    FEED_SAMPLE_PACK_TYPES,
    MARKETPLACE_FILTER_TYPES,
    MARKETPLACE_FILTER_TO_TYPES,
    normalizeFeedType,
    normalizeMarketplaceType,
    getDisplayTypeLabel,
    getFeedFilterAllowedTypes,
    getActiveFeedFilter,
    normalizeFeedFilterType,
    applyFeedFilter,
    normalizeMarketplaceFilterType,
    mapMarketplaceFilterToTypes,
    isMarketplaceExcludedType,
    normalizeGenreValue,
    parseBpmFilter,
    matchesBpmFilter,
    getMarketplaceMinPaidPrice,
    getMarketplacePriceBucket,
    matchesPriceFilter,
    parseTagTerms,
    matchesTagTerms,
    filterMarketplaceItems,
    mapMarketplaceItemToFeedItem,
    deriveActionState,
    getFeedTimestampMs,
    getFeedDedupeKey,
    dedupeFeedItems,
    sortFeedItemsNewestFirst,
    dedupeAndSortFeedItems,
    getFeedMinPrice,
    getFeedPriceLabel,
    normalizeIdentityKey
  };
}));
