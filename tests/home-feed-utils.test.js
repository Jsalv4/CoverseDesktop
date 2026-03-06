const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeFeedType,
  normalizeFeedFilterType,
  getDisplayTypeLabel,
  getFeedFilterAllowedTypes,
  getActiveFeedFilter,
  applyFeedFilter,
  normalizeMarketplaceFilterType,
  mapMarketplaceFilterToTypes,
  normalizeGenreValue,
  parseBpmFilter,
  getMarketplacePriceBucket,
  matchesPriceFilter,
  parseTagTerms,
  matchesTagTerms,
  filterMarketplaceItems,
  mapMarketplaceItemToFeedItem,
  deriveActionState,
  dedupeAndSortFeedItems,
  getFeedPriceLabel
} = require('../src/home-feed-utils');

test('home feed type normalization and aliases follow canonical tokens', () => {
  assert.equal(normalizeFeedType('sample pack'), 'sample-pack');
  assert.equal(normalizeFeedType('drum kit'), 'drum-pack');
  assert.equal(normalizeFeedType('Beat Instrumental'), 'beat');
  assert.equal(normalizeFeedType('song'), 'music');
  assert.equal(normalizeFeedType('collaboration request'), 'collab');
  assert.equal(normalizeFeedType('unknown kind'), 'sample');

  assert.equal(normalizeFeedFilterType('SAMPLES'), 'sample');
  assert.equal(normalizeFeedFilterType('instrumentals'), 'beat');
  assert.equal(normalizeFeedFilterType('songs'), 'music');
  assert.equal(normalizeFeedFilterType('invalid'), 'all');
});

test('feed helper labels and active filter detection work with canonical values', () => {
  assert.equal(getDisplayTypeLabel('sample-pack'), 'Sample Pack');
  assert.equal(getDisplayTypeLabel('beat'), 'Beat');
  assert.equal(getDisplayTypeLabel('music'), 'Music');

  const fakeRoot = {
    querySelector() {
      return { dataset: { filter: 'drum-pack' } };
    }
  };

  assert.equal(getActiveFeedFilter('samples', 'all'), 'sample');
  assert.equal(getActiveFeedFilter('', 'all', { root: fakeRoot }), 'drum-pack');
  assert.equal(getActiveFeedFilter('invalid', 'all'), 'all');
});

test('sample-pack filter includes grouped pack-related types', () => {
  assert.deepEqual(getFeedFilterAllowedTypes('sample-pack'), [
    'sample-pack',
    'drum-pack',
    'fx-pack',
    'midi-pack',
    'preset-pack',
    'one-shot',
    'loop',
    'vocal'
  ]);

  const items = [
    { id: 'sample-pack', normalizedType: 'sample-pack' },
    { id: 'drum-pack', normalizedType: 'drum-pack' },
    { id: 'fx-pack', normalizedType: 'fx-pack' },
    { id: 'midi-pack', normalizedType: 'midi-pack' },
    { id: 'preset-pack', normalizedType: 'preset-pack' },
    { id: 'one-shot', normalizedType: 'one-shot' },
    { id: 'loop', normalizedType: 'loop' },
    { id: 'vocal', normalizedType: 'vocal' },
    { id: 'sample', normalizedType: 'sample' },
    { id: 'beat', normalizedType: 'beat' }
  ];

  assert.deepEqual(applyFeedFilter(items, 'sample-pack').map((item) => item.id), [
    'sample-pack',
    'drum-pack',
    'fx-pack',
    'midi-pack',
    'preset-pack',
    'one-shot',
    'loop',
    'vocal'
  ]);
  assert.deepEqual(applyFeedFilter(items, 'all').map((item) => item.id), items.map((item) => item.id));

  const collabItems = [
    { id: 'collab', type: 'collab' },
    { id: 'collaboration', type: 'collaboration request' },
    { id: 'sample', type: 'sample' }
  ];
  assert.deepEqual(applyFeedFilter(collabItems, 'collabs').map((item) => item.id), ['collab', 'collaboration']);
});

test('marketplace filter mapping matches deterministic top-level mapping', () => {
  const expected = {
    samples: ['sample'],
    instrumentals: ['beat'],
    'sample-packs': ['sample-pack', 'drum-pack', 'fx-pack', 'midi-pack', 'preset-pack', 'one-shot', 'loop', 'vocal'],
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
  };

  assert.deepEqual(mapMarketplaceFilterToTypes('all'), []);

  for (const [filter, types] of Object.entries(expected)) {
    assert.deepEqual(mapMarketplaceFilterToTypes(filter), types, `Unexpected mapping for ${filter}`);
  }

  assert.equal(normalizeMarketplaceFilterType('service'), 'services');
  assert.equal(normalizeMarketplaceFilterType('plugin'), 'plugins');
  assert.equal(normalizeMarketplaceFilterType('beat'), 'instrumentals');
});

test('parseBpmFilter supports exact, range, and minimum input', () => {
  assert.deepEqual(parseBpmFilter('120'), { kind: 'exact', value: 120 });
  assert.deepEqual(parseBpmFilter('90-110'), { kind: 'range', min: 90, max: 110 });
  assert.deepEqual(parseBpmFilter('140+'), { kind: 'min', min: 140 });
  assert.deepEqual(parseBpmFilter(''), { kind: 'any' });
  assert.equal(parseBpmFilter('abc').kind, 'invalid');
});

test('marketplace price buckets and filters classify free/stream/paid ranges', () => {
  const freeItem = { isFree: true, price: 0 };
  const streamItem = { streamOnly: true, price: 0 };
  const underTen = { price: 9.99 };
  const tenToTwentyFive = { price: 24.99 };
  const twentyFiveToFifty = { price: 30 };
  const fiftyToHundred = { price: 75 };
  const hundredPlus = { price: 120 };

  assert.equal(getMarketplacePriceBucket(freeItem), 'free');
  assert.equal(getMarketplacePriceBucket(streamItem), 'stream');
  assert.equal(getMarketplacePriceBucket(underTen), 'under-10');
  assert.equal(getMarketplacePriceBucket(tenToTwentyFive), '10-25');
  assert.equal(getMarketplacePriceBucket(twentyFiveToFifty), '25-50');
  assert.equal(getMarketplacePriceBucket(fiftyToHundred), '50-100');
  assert.equal(getMarketplacePriceBucket(hundredPlus), '100+');
  assert.equal(getMarketplacePriceBucket({}), 'paid');

  assert.equal(matchesPriceFilter(freeItem, 'free'), true);
  assert.equal(matchesPriceFilter(freeItem, 'paid'), false);
  assert.equal(matchesPriceFilter(streamItem, 'stream'), true);
  assert.equal(matchesPriceFilter(streamItem, 'under-10'), false);
  assert.equal(matchesPriceFilter(underTen, 'under-10'), true);
  assert.equal(matchesPriceFilter(tenToTwentyFive, '10-25'), true);
  assert.equal(matchesPriceFilter(twentyFiveToFifty, '25-50'), true);
  assert.equal(matchesPriceFilter(fiftyToHundred, '50-100'), true);
  assert.equal(matchesPriceFilter(hundredPlus, '100+'), true);
});

test('tag parser/matcher and genre normalization preserve parity behavior', () => {
  assert.deepEqual(parseTagTerms('trap, dark #melodic trap'), ['trap', 'dark', 'melodic']);
  assert.equal(matchesTagTerms(['trap soul', 'hard'], ['trap']), true);
  assert.equal(matchesTagTerms(['ambient', 'cinematic'], ['trap']), false);

  assert.equal(normalizeGenreValue('R&B'), 'rnb');
  assert.equal(normalizeGenreValue('RnB'), 'rnb');
  assert.equal(normalizeGenreValue('r and b'), 'rnb');
  assert.equal(normalizeGenreValue('West Coast'), 'west-coast');
});

test('filterMarketplaceItems applies top-level mapping, exclusions, and subfilters', () => {
  const items = [
    {
      id: 'sample-1',
      sampleType: 'sample',
      genre: 'R&B',
      bpm: 120,
      key: 'C#m',
      isFree: true,
      price: 0,
      tags: ['trap', 'melodic']
    },
    {
      id: 'beat-1',
      sampleType: 'beat',
      genre: 'Drill',
      bpm: 140,
      key: 'Fm',
      price: 29.99,
      tags: ['dark', 'drill']
    },
    {
      id: 'drum-pack-1',
      sampleType: 'drum-pack',
      genre: 'Trap',
      bpm: 150,
      key: '',
      price: 15,
      tags: ['808', 'hard']
    },
    {
      id: 'video-1',
      sampleType: 'video',
      genre: 'Trap',
      price: 0,
      tags: ['visual']
    },
    {
      id: 'collab-1',
      sampleType: 'collab',
      genre: 'Trap',
      price: 0,
      tags: ['collab']
    }
  ];

  assert.deepEqual(filterMarketplaceItems(items, 'all', {}).map((item) => item.id), ['sample-1', 'beat-1', 'drum-pack-1']);
  assert.deepEqual(filterMarketplaceItems(items, 'instrumentals', {}).map((item) => item.id), ['beat-1']);
  assert.deepEqual(filterMarketplaceItems(items, 'sample-packs', {}).map((item) => item.id), ['drum-pack-1']);

  assert.deepEqual(filterMarketplaceItems(items, 'samples', {
    genre: 'rnb',
    bpm: '120',
    key: 'c#m',
    price: 'free',
    tags: 'melodic'
  }).map((item) => item.id), ['sample-1']);

  assert.deepEqual(filterMarketplaceItems(items, 'sample-packs', {
    packType: 'drum-pack',
    price: '10-25',
    tags: '808'
  }).map((item) => item.id), ['drum-pack-1']);
});

test('mapMarketplaceItemToFeedItem normalizes price and identity fields', () => {
  const mapped = mapMarketplaceItemToFeedItem({
    id: 'mk_1',
    title: 'Starter Pack',
    type: 'sample',
    sellerId: 'creator_1',
    userName: 'Creator',
    createdAt: '2026-01-05T10:00:00.000Z',
    licenseTiers: [
      { id: 'basic', price: 19.99 },
      { id: 'pro', price: 39.99 }
    ]
  });

  assert.equal(mapped.id, 'mk_1');
  assert.equal(mapped.postId, 'mk_1');
  assert.equal(mapped.normalizedType, 'sample');
  assert.equal(mapped.displayType, 'Sample');
  assert.equal(mapped.priceValue, 19.99);
  assert.equal(mapped.priceLabel, 'From $19.99');
  assert.equal(mapped.sellerId, 'creator_1');
  assert.ok(Array.isArray(mapped.identityKeys));
  assert.ok(mapped.identityKeys.includes('mk_1'));
});

test('dedupeAndSortFeedItems keeps preferred duplicate and sorts newest-first', () => {
  const items = [
    {
      id: 'post_1',
      postId: 'post_1',
      title: 'Old Version',
      createdAt: '2026-01-01T00:00:00.000Z',
      description: 'old',
      identityKeys: ['post_1']
    },
    {
      id: 'post_1',
      postId: 'post_1',
      title: 'New Version',
      createdAt: '2026-01-02T00:00:00.000Z',
      description: 'new',
      image: 'https://example.com/cover.png',
      identityKeys: ['post_1']
    },
    {
      id: 'post_2',
      postId: 'post_2',
      title: 'Newest Item',
      createdAt: '2026-01-03T00:00:00.000Z',
      identityKeys: ['post_2']
    }
  ];

  const deduped = dedupeAndSortFeedItems(items);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].id, 'post_2');
  assert.equal(deduped[1].id, 'post_1');
  assert.equal(deduped[1].title, 'New Version');
});

test('deriveActionState resolves ownership/cart/stream/free/buy', () => {
  const baseItem = mapMarketplaceItemToFeedItem({
    id: 'item_1',
    sellerId: 'seller_1',
    type: 'sample',
    price: 10
  });

  const ownedState = deriveActionState(baseItem, {
    currentUserId: 'user_1',
    ownedIds: ['item_1'],
    cartIds: []
  });
  assert.equal(ownedState.action, 'owned');
  assert.equal(ownedState.disabled, true);

  const cartState = deriveActionState(baseItem, {
    currentUserId: 'user_1',
    ownedIds: [],
    cartIds: ['item_1']
  });
  assert.equal(cartState.action, 'in-cart');

  const streamState = deriveActionState({ ...baseItem, streamOnly: true }, {
    currentUserId: 'user_1',
    ownedIds: [],
    cartIds: []
  });
  assert.equal(streamState.action, 'stream');

  const freeState = deriveActionState({ ...baseItem, isFree: true, priceValue: 0 }, {
    currentUserId: 'user_1',
    ownedIds: [],
    cartIds: []
  });
  assert.equal(freeState.action, 'download');

  const buyState = deriveActionState(baseItem, {
    currentUserId: 'user_1',
    ownedIds: [],
    cartIds: []
  });
  assert.equal(buyState.action, 'buy');

  const selfState = deriveActionState({ ...baseItem, sellerId: 'user_1' }, {
    currentUserId: 'user_1',
    ownedIds: [],
    cartIds: []
  });
  assert.equal(selfState.action, 'self');
});

test('getFeedPriceLabel supports stream-only and free labels', () => {
  assert.equal(getFeedPriceLabel({ streamOnly: true, price: 25 }), 'Stream Only');
  assert.equal(getFeedPriceLabel({ isFree: true, price: 0 }), 'Free');
  assert.equal(getFeedPriceLabel({ price: 12.5 }), '$12.50');
});
