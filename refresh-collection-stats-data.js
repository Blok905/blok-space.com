const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');

const BESTINSLOT_API_KEY = String(
    process.env.BESTINSLOT_API_KEY || 'cbeb7786-f506-4fdd-b2d3-933d3a57b50c'
).trim();
const BESTINSLOT_BASE_URL = 'https://api.bestinslot.xyz/v3/collection';
const OUTPUT_PATH = path.join(__dirname, 'collection-stats-data.js');
const COLLECTIONS = [
    { symbol: 'palindrome-punks', name: 'Palindrome Punks' },
    { symbol: 'blok-boyz', name: 'Blok Boyz' },
    { symbol: 'blok-space', name: 'Blok Space' }
];

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, {
            headers: {
                Accept: 'application/json',
                'x-api-key': BESTINSLOT_API_KEY
            }
        }, response => {
            let body = '';

            response.setEncoding('utf8');
            response.on('data', chunk => {
                body += chunk;
            });
            response.on('end', () => {
                if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
                    reject(new Error(`Best in Slot request failed (${response.statusCode || 0}): ${body.trim()}`));
                    return;
                }

                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(new Error(`Failed to parse Best in Slot JSON: ${error.message}`));
                }
            });
        });

        request.on('error', reject);
    });
}

function satsToBtc(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue / 100000000 : null;
}

function parseCount(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? Math.round(parsedValue) : null;
}

function loadExistingSnapshot() {
    if (!fs.existsSync(OUTPUT_PATH)) return null;

    const fileContents = fs.readFileSync(OUTPUT_PATH, 'utf8');
    const sandbox = { window: {} };

    vm.runInNewContext(fileContents, sandbox, { filename: 'collection-stats-data.js' });

    const snapshot = sandbox.window && sandbox.window.COLLECTION_STATS_DATA;
    return snapshot && typeof snapshot === 'object' ? snapshot : null;
}

function normalizeCollectionMapForComparison(collectionMap) {
    if (!collectionMap || typeof collectionMap !== 'object') return null;

    return Object.fromEntries(Object.entries(collectionMap).map(([symbol, snapshot]) => {
        if (!snapshot || typeof snapshot !== 'object') return [symbol, snapshot];

        const {
            updatedAt,
            ...comparableSnapshot
        } = snapshot;

        return [symbol, comparableSnapshot];
    }));
}

async function buildCollectionSnapshot(collection, generatedAt) {
    const slug = encodeURIComponent(collection.symbol);
    const [marketInfo, salesInfo, holdersInfo] = await Promise.all([
        fetchJson(`${BESTINSLOT_BASE_URL}/market_info?slug=${slug}`),
        fetchJson(`${BESTINSLOT_BASE_URL}/sales_info?slug=${slug}`),
        fetchJson(`${BESTINSLOT_BASE_URL}/holders?slug=${slug}`)
    ]);

    const marketData = marketInfo && typeof marketInfo.data === 'object' ? marketInfo.data : {};
    const salesData = salesInfo && typeof salesInfo.data === 'object' ? salesInfo.data : {};
    const holdersData = Array.isArray(holdersInfo?.data) ? holdersInfo.data : [];

    return {
        name: collection.name,
        source: 'Best in Slot snapshot',
        updatedAt: generatedAt,
        floorPrice: satsToBtc(marketData.floor_price),
        volume24h: satsToBtc(salesData.vol_1d),
        totalVolume: satsToBtc(salesData.vol_total),
        listedCount: parseCount(marketData.listed_count),
        ownerCount: holdersData.length,
        totalSupply: parseCount(marketData.supply)
    };
}

async function main() {
    if (!BESTINSLOT_API_KEY) {
        throw new Error('BESTINSLOT_API_KEY is not configured.');
    }

    const generatedAt = new Date().toISOString();
    const existingSnapshot = loadExistingSnapshot();
    const collectionEntries = await Promise.all(COLLECTIONS.map(async collection => {
        const snapshot = await buildCollectionSnapshot(collection, generatedAt);
        return [collection.symbol, snapshot];
    }));

    const nextCollections = Object.fromEntries(collectionEntries);
    const existingCollections = existingSnapshot && typeof existingSnapshot.collections === 'object'
        ? normalizeCollectionMapForComparison(existingSnapshot.collections)
        : null;

    if (existingCollections && JSON.stringify(existingCollections) === JSON.stringify(nextCollections)) {
        console.log('Collection stats snapshot is already up to date.');
        return;
    }

    const payload = {
        generatedAt,
        source: 'Best in Slot snapshot',
        collections: nextCollections
    };

    const fileContents = [
        `// Generated by refresh-collection-stats-data.js on ${generatedAt}`,
        `window.COLLECTION_STATS_DATA = ${JSON.stringify(payload, null, 4)};`,
        ''
    ].join('\n');

    fs.writeFileSync(OUTPUT_PATH, fileContents, 'utf8');
    console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
});
