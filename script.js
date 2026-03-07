function applyImageLoadingStrategy(img, shouldPreload) {
    if (!img || img.tagName !== 'IMG') return;

    img.dataset.preloadPriority = shouldPreload ? 'high' : 'low';
    img.loading = shouldPreload ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.setAttribute('fetchpriority', shouldPreload ? 'high' : 'low');
}

const collectionPreloadCountBySymbol = new Map([
    ['blok-boyz', 160],
    ['blok-space', 160]
]);

function getCollectionPreloadCount(symbol, fallbackCount = 0) {
    const normalizedSymbol = String(symbol || '').trim().toLowerCase();
    if (!normalizedSymbol) return Math.max(0, Number(fallbackCount) || 0);

    const configuredCount = Number(collectionPreloadCountBySymbol.get(normalizedSymbol));
    if (Number.isFinite(configuredCount) && configuredCount > 0) {
        return configuredCount;
    }

    return Math.max(0, Number(fallbackCount) || 0);
}

function seedLargeCollectionGrid(symbol, folderPath, labelPrefix, totalItems, totalPreloadItems) {
    const normalizedSymbol = String(symbol || '').trim().toLowerCase();
    if (!normalizedSymbol) return;

    const galleryGrid = document.querySelector(`.gallery-grid[data-collection-symbol="${normalizedSymbol}"]`);
    if (!galleryGrid) return;
    if (galleryGrid.dataset.seededFromScript === 'true') return;

    const existingImages = galleryGrid.querySelectorAll('img');
    if (existingImages.length > 0) {
        galleryGrid.dataset.seededFromScript = 'true';
        return;
    }

    const fragment = document.createDocumentFragment();
    const safeTotal = Math.max(0, Number(totalItems) || 0);
    const safePreloadCount = Math.max(0, Math.min(safeTotal, getCollectionPreloadCount(normalizedSymbol, totalPreloadItems)));

    for (let i = 1; i <= safeTotal; i += 1) {
        const img = document.createElement('img');
        const shouldPreload = i <= safePreloadCount;
        applyImageLoadingStrategy(img, shouldPreload);
        img.src = `${folderPath}${i}.webp`;
        img.alt = `${labelPrefix}${i}`;
        fragment.appendChild(img);
    }

    galleryGrid.appendChild(fragment);
    galleryGrid.dataset.seededFromScript = 'true';
}

(function bootstrapGeneratedCollectionGrids() {
    function runSeeders() {
        seedLargeCollectionGrid('blok-boyz', './Blok Boyz/', 'Blok Boyz #', 1000, 160);
        seedLargeCollectionGrid('blok-space', './Blok Space/', 'Blok Space #', 1000, 160);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runSeeders, { once: true });
    } else {
        runSeeders();
    }
})();
document.addEventListener("DOMContentLoaded", function() {
    const walletCollectionConfig = [
        {
            symbol: 'palindrome-punks',
            name: 'Palindrome Punks',
            metadataPath: './Metadata/palindrome-punks-metadata.json',
            imageSelector: '.gallery-grid[data-collection-symbol="palindrome-punks"] img'
        },
        {
            symbol: 'blok-boyz',
            name: 'Blok Boyz',
            metadataPath: './Metadata/blok-boyz-metadata.json',
            imageSelector: '.gallery-grid[data-collection-symbol="blok-boyz"] img'
        },
        {
            symbol: 'blok-space',
            name: 'Blok Space',
            metadataPath: './Metadata/blok-space-metadata.json',
            imageSelector: '.gallery-grid[data-collection-symbol="blok-space"] img'
        },
        {
            symbol: 'blokchain-surveillance',
            name: 'Blokchain Surveillance',
            metadataPath: './Metadata/blokchain-surveillance-metadata.json',
            fallbackImageSrc: './Images/Surveillance.webp',
            fallbackImageAlt: 'Blokchain Surveillance'
        },
        {
            symbol: 'art-drops',
            name: 'Art-Drops',
            metadataPath: './Metadata/art-drops-metadata.json',
            imageSelector: '.gallery-flex img'
        }
    ];
    const collectionMetadataPathBySymbol = new Map(walletCollectionConfig.map(collection => [collection.symbol, collection.metadataPath]));
    const ordProxyBases = [
        'https://api.codetabs.com/v1/proxy/?quest=',
        'https://api.allorigins.win/raw?url='
    ];
    const magicEdenItemBaseUrl = 'https://magiceden.io/ordinals/item-details/';
    const magicEdenIconPath = './Images/ME.webp';
    const satFlowItemBaseUrl = 'https://www.satflow.com/ordinal/';
    const satFlowIconPath = './Images/SatFlow.png';
    const satFlowCollectionSymbols = new Set(['palindrome-punks', 'blok-boyz', 'blok-space', 'blokchain-surveillance']);
    const remoteOrdNodeFallback = 'http://64.20.33.102:52025';

    function sanitizeOrdNodeBase(value) {
        const trimmed = String(value || '').trim();
        if (!trimmed) return '';
        return trimmed.replace(/\/+$/, '');
    }

    const defaultOrdNodeApiBase = (function resolveOrdNodeApiBase() {
        const configuredBase = document.body?.dataset?.ordNodeBase || window.ORD_NODE_API_BASE || window.ORD_NODE_BASE_URL;
        const fallbackBase = configuredBase || remoteOrdNodeFallback;
        return sanitizeOrdNodeBase(fallbackBase);
    })();

    function parseCollectionStatNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        const parsedValue = Number(value);
        return Number.isFinite(parsedValue) ? parsedValue : null;
    }

    function formatCollectionStatCount(value) {
        const parsedValue = parseCollectionStatNumber(value);
        return parsedValue === null ? '--' : Math.round(parsedValue).toLocaleString('en-US');
    }

    function formatCollectionStatBtc(value, options = {}) {
        const parsedValue = parseCollectionStatNumber(value);
        if (parsedValue === null) return '--';
        if (options.zeroAsEmpty && parsedValue === 0) return '\u2014';
        const fractionDigits = Number.isInteger(options.fractionDigits) && options.fractionDigits >= 0
            ? options.fractionDigits
            : 3;
        const roundingFactor = 10 ** fractionDigits;
        const roundedValue = Math.round(parsedValue * roundingFactor) / roundingFactor;

        return `${roundedValue.toLocaleString('en-US', {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits
        })} BTC`;
    }

    function formatCollectionStatsTimestamp(value) {
        const timestamp = new Date(value);
        if (Number.isNaN(timestamp.getTime())) return 'Snapshot time unavailable';

        return timestamp.toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    }

    function setCollectionStatValue(statsWindow, statName, value) {
        const statNode = statsWindow?.querySelector(`[data-stat="${statName}"]`);
        if (statNode) statNode.textContent = value;
    }

    function setCollectionStatsStatus(statsWindow, message, isError) {
        const statusNode = statsWindow?.querySelector('.collection-stats-status');
        if (!statusNode) return;

        statusNode.textContent = String(message || '').trim();
        statusNode.classList.toggle('is-error', Boolean(isError));
    }

    function setCollectionStatsUpdatedText(statsWindow, message) {
        const updatedNode = statsWindow?.querySelector('.collection-stats-updated');
        if (updatedNode) updatedNode.textContent = String(message || '').trim();
    }

    function clearCollectionStatsWindow(statsWindow, statusMessage) {
        ['floor', 'volume-24h', 'volume-total', 'listed', 'owners', 'supply'].forEach(statName => {
            setCollectionStatValue(statsWindow, statName, '--');
        });
        setCollectionStatsUpdatedText(statsWindow, 'Collection stats unavailable');
        setCollectionStatsStatus(statsWindow, statusMessage, true);
    }

    function renderCollectionStatsWindow(statsWindow, snapshot, generatedAt) {
        if (!statsWindow || !snapshot || typeof snapshot !== 'object') return;

        setCollectionStatValue(statsWindow, 'floor', formatCollectionStatBtc(snapshot.floorPrice, { zeroAsEmpty: true, fractionDigits: 4 }));
        setCollectionStatValue(statsWindow, 'volume-24h', formatCollectionStatBtc(snapshot.volume24h, { zeroAsEmpty: true, fractionDigits: 4 }));
        setCollectionStatValue(statsWindow, 'volume-total', formatCollectionStatBtc(snapshot.totalVolume));
        setCollectionStatValue(statsWindow, 'listed', formatCollectionStatCount(snapshot.listedCount));
        setCollectionStatValue(statsWindow, 'owners', formatCollectionStatCount(snapshot.ownerCount));
        setCollectionStatValue(statsWindow, 'supply', formatCollectionStatCount(snapshot.totalSupply));

        const updatedAt = snapshot.updatedAt || generatedAt || '';
        setCollectionStatsUpdatedText(
            statsWindow,
            updatedAt ? `Updated ${formatCollectionStatsTimestamp(updatedAt)}` : 'Best in Slot snapshot loaded'
        );
        setCollectionStatsStatus(statsWindow, 'Auto-refreshed from Best in Slot.', false);
    }

    function initializeCollectionStatsWindows() {
        const statsWindows = Array.from(document.querySelectorAll('.collection-stats-window[data-collection-symbol]'));
        if (statsWindows.length === 0) return;

        const snapshotPayload = window.COLLECTION_STATS_DATA;
        const collectionSnapshots = snapshotPayload && typeof snapshotPayload.collections === 'object'
            ? snapshotPayload.collections
            : null;
        const generatedAt = snapshotPayload && typeof snapshotPayload.generatedAt === 'string'
            ? snapshotPayload.generatedAt
            : '';

        if (!collectionSnapshots) {
            statsWindows.forEach(statsWindow => {
                clearCollectionStatsWindow(statsWindow, 'Automated snapshot data is not available yet.');
            });
            return;
        }

        statsWindows.forEach(statsWindow => {
            const collectionSymbol = String(statsWindow.dataset.collectionSymbol || '').trim().toLowerCase();
            const snapshot = collectionSymbol ? collectionSnapshots[collectionSymbol] : null;

            if (!snapshot) {
                clearCollectionStatsWindow(statsWindow, 'No automated snapshot was found for this collection.');
                return;
            }

            renderCollectionStatsWindow(statsWindow, snapshot, generatedAt);
        });
    }

    initializeCollectionStatsWindows();

    async function fetchLocalJson(url) {
        const response = await fetch(url, {
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json();
    }

    function buildJinaProxyUrl(url) {
        const normalized = String(url || '').trim();
        if (!normalized) return '';
        return `https://r.jina.ai/http://${normalized.replace(/^https?:\/\//i, '')}`;
    }

    function shouldUseOrdProxyFallback(endpoint) {
        const value = String(endpoint || '').trim();
        if (!value) return false;

        if (typeof window === 'undefined' || !window.location) return false;

        try {
            const endpointUrl = new URL(value, window.location.href);
            const pageUrl = window.location;
            const isMixedContent = pageUrl.protocol === 'https:' && endpointUrl.protocol === 'http:';
            const isCrossOrigin = endpointUrl.origin !== pageUrl.origin;
            return isMixedContent || isCrossOrigin;
        } catch (error) {
            return false;
        }
    }

    function buildOrdRequestUrls(endpoint) {
        const requestUrls = [endpoint];
        if (shouldUseOrdProxyFallback(endpoint)) {
            const jinaProxyUrl = buildJinaProxyUrl(endpoint);
            if (jinaProxyUrl) requestUrls.push(jinaProxyUrl);
            ordProxyBases.forEach(proxyBase => {
                requestUrls.push(`${proxyBase}${encodeURIComponent(endpoint)}`);
            });
        }
        return Array.from(new Set(requestUrls.filter(Boolean)));
    }

    function normalizeWalletText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/\.[^.]+$/, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function normalizeInscriptionId(value) {
        return String(value || '').trim().toLowerCase();
    }

    function isValidBitcoinAddress(value) {
        const address = String(value || '').trim();
        if (!address || /\s/.test(address)) return false;

        const lowerAddress = address.toLowerCase();
        const isBech32 = /^(bc1|tb1|bcrt1)[ac-hj-np-z02-9]{11,71}$/.test(lowerAddress);
        if (isBech32) return true;

        return /^[123mn2][1-9A-HJ-NP-Za-km-z]{25,62}$/.test(address);
    }

    function normalizeBitcoinAddressForLookup(value) {
        const address = String(value || '').trim();
        if (!address) return '';
        if (/^(bc1|tb1|bcrt1)/i.test(address)) return address.toLowerCase();
        return address;
    }

    function extractEditionNumber(value) {
        const normalized = String(value || '').trim();
        if (!normalized) return null;
        const hashMatch = normalized.match(/#\s*(\d+)/i);
        if (hashMatch && hashMatch[1]) return String(parseInt(hashMatch[1], 10));
        if (/^\d+$/.test(normalized)) return String(parseInt(normalized, 10));
        return null;
    }

    function getImageStemFromSrc(src) {
        const withoutQuery = String(src || '').split('?')[0];
        const fileName = withoutQuery.split('/').pop() || '';
        return fileName.replace(/\.[^.]+$/, '');
    }

    function getNameCandidates(value) {
        const raw = String(value || '').trim();
        if (!raw) return [];
        const withoutPunkSuffix = raw.replace(/\s+punk$/i, '');
        const withoutEditionNumber = raw.replace(/\s*#\s*\d+$/i, '');
        return Array.from(new Set([
            normalizeWalletText(raw),
            normalizeWalletText(withoutPunkSuffix),
            normalizeWalletText(withoutEditionNumber)
        ].filter(Boolean)));
    }

    function sanitizeDownloadBaseName(value) {
        const sanitized = String(value || 'image')
            .replace(/[\\/:*?"<>|]/g, '')
            .trim();
        return sanitized || 'image';
    }

    function getImageSourceUrl(img) {
        return String(img?.currentSrc || img?.getAttribute?.('src') || img?.src || '').trim();
    }

    function getImageSourceExtension(img) {
        const sourceUrl = getImageSourceUrl(img).split('#')[0].split('?')[0];
        const extensionMatch = sourceUrl.match(/\.([a-z0-9]+)$/i);
        return extensionMatch ? extensionMatch[1].toLowerCase() : '';
    }

    function downloadUpscaledJpegFromImage(img, fileNameBase) {
        if (!img) return;
        const upscaleFactor = 4;

        if (getImageSourceExtension(img) === 'gif') {
            const sourceUrl = getImageSourceUrl(img);
            if (!sourceUrl) return;
            downloadFileAsset(sourceUrl, `${sanitizeDownloadBaseName(fileNameBase)}.gif`);
            return;
        }

        const performDownload = function() {
            const sourceWidth = img.naturalWidth || img.width;
            const sourceHeight = img.naturalHeight || img.height;
            if (!sourceWidth || !sourceHeight) return;

            const canvas = document.createElement('canvas');
            canvas.width = sourceWidth * upscaleFactor;
            canvas.height = sourceHeight * upscaleFactor;

            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(blob => {
                if (!blob) return;
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${sanitizeDownloadBaseName(fileNameBase)}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(link.href), 0);
            }, 'image/jpeg', 0.95);
        };

        if (!img.complete || !img.naturalWidth) {
            img.addEventListener('load', performDownload, { once: true });
            return;
        }

        performDownload();
    }

    function downloadFileAsset(fileUrl, suggestedFileName) {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = suggestedFileName || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function blurInteractiveControl(control) {
        if (!control || typeof control.blur !== 'function') return;
        control.blur();
        setTimeout(() => control.blur(), 0);
    }

    function setWalletStatus(statusNode, message, isError) {
        if (!statusNode) return;
        statusNode.textContent = message;
        statusNode.classList.toggle('is-error', Boolean(isError));
    }

    function isLikelyInscriptionId(value) {
        return /^[0-9a-f]{64}i\d+$/i.test(String(value || '').trim());
    }

    function buildOrdinalItemLinkConfig(collectionSymbol, inscriptionId, itemLabel) {
        const normalizedCollectionSymbol = String(collectionSymbol || '').trim().toLowerCase();
        const normalizedInscriptionId = normalizeInscriptionId(inscriptionId);
        if (!isLikelyInscriptionId(normalizedInscriptionId)) return null;
        if (normalizedCollectionSymbol === 'art-drops') return null;

        const resolvedItemLabel = String(itemLabel || normalizedInscriptionId).trim() || normalizedInscriptionId;

        if (satFlowCollectionSymbols.has(normalizedCollectionSymbol)) {
            return {
                href: `${satFlowItemBaseUrl}${normalizedInscriptionId}`,
                iconPath: satFlowIconPath,
                title: 'View on SatFlow',
                ariaLabel: `View ${resolvedItemLabel} on SatFlow`
            };
        }

        return {
            href: `${magicEdenItemBaseUrl}${normalizedInscriptionId}`,
            iconPath: magicEdenIconPath,
            title: 'View on Magic Eden',
            ariaLabel: `View ${resolvedItemLabel} on Magic Eden`
        };
    }

    function addLookupKey(map, key, value) {
        if (!key || map.has(key)) return;
        map.set(key, value);
    }

    function buildCollectionImageLookup(collection) {
        const byName = new Map();
        const byNumber = new Map();
        const images = collection.imageSelector
            ? Array.from(document.querySelectorAll(collection.imageSelector))
            : [];

        images.forEach(img => {
            const src = String(img.getAttribute('src') || '').trim();
            if (!src) return;

            const fallbackAlt = getImageStemFromSrc(src);
            const alt = String(img.getAttribute('alt') || fallbackAlt).trim();
            const imageData = { src, alt: alt || fallbackAlt };

            getNameCandidates(alt).forEach(key => addLookupKey(byName, key, imageData));
            getNameCandidates(fallbackAlt).forEach(key => addLookupKey(byName, key, imageData));

            const altNumber = extractEditionNumber(alt);
            const stemNumber = extractEditionNumber(fallbackAlt);
            if (altNumber && !byNumber.has(altNumber)) byNumber.set(altNumber, imageData);
            if (stemNumber && !byNumber.has(stemNumber)) byNumber.set(stemNumber, imageData);
        });

        return {
            byName,
            byNumber,
            hasSourceImages: images.length > 0
        };
    }

    function resolveMetadataImage(collection, metadataEntry, imageLookup) {
        const metadataName = String(metadataEntry?.meta?.name || '').trim();
        const editionNumber = extractEditionNumber(metadataName);
        if (editionNumber && imageLookup.byNumber.has(editionNumber)) {
            return imageLookup.byNumber.get(editionNumber);
        }

        const candidateKeys = Array.from(new Set(getNameCandidates(metadataName)));
        for (const candidateKey of candidateKeys) {
            const foundImage = imageLookup.byName.get(candidateKey);
            if (foundImage) return foundImage;
        }

        if (!imageLookup.hasSourceImages && collection.fallbackImageSrc) {
            return {
                src: collection.fallbackImageSrc,
                alt: collection.fallbackImageAlt || collection.name
            };
        }

        return null;
    }

    function collectInscriptionIds(source, targetSet) {
        if (source === null || source === undefined) return;

        if (Array.isArray(source)) {
            source.forEach(item => collectInscriptionIds(item, targetSet));
            return;
        }

        if (typeof source === 'string') {
            if (isLikelyInscriptionId(source)) {
                targetSet.add(normalizeInscriptionId(source));
            }
            return;
        }

        if (typeof source !== 'object') return;

        if (isLikelyInscriptionId(source.id)) {
            targetSet.add(normalizeInscriptionId(source.id));
        }

        if (Array.isArray(source.inscriptions)) {
            collectInscriptionIds(source.inscriptions, targetSet);
        }

        if (Array.isArray(source.ids)) {
            collectInscriptionIds(source.ids, targetSet);
        }
    }

    function getWalletInscriptionIds(addressPayload) {
        const inscriptionIds = new Set();
        collectInscriptionIds(addressPayload?.inscriptions, inscriptionIds);
        collectInscriptionIds(addressPayload?.ids, inscriptionIds);
        collectInscriptionIds(addressPayload?.outputs, inscriptionIds);
        collectInscriptionIds(addressPayload, inscriptionIds);
        return Array.from(inscriptionIds);
    }

    function extractInscriptionIdsFromResponseText(responseText) {
        const ids = new Set();
        const matches = String(responseText || '').match(/[0-9a-f]{64}i\d+/ig) || [];
        matches.forEach(match => ids.add(normalizeInscriptionId(match)));
        return Array.from(ids);
    }

    function inferOrdResponseFailureHint(responseText) {
        const normalizedText = String(responseText || '').toLowerCase();
        if (!normalizedText) return '';
        if (
            normalizedText.includes('direct ip access not allowed')
            || (normalizedText.includes('cloudflare') && normalizedText.includes('error code 1003'))
        ) {
            return 'Proxy blocked direct-IP access to the ord node.';
        }
        if (normalizedText.includes('<!doctype html') || normalizedText.includes('<html')) {
            return 'Received an HTML error page instead of ord data.';
        }
        if (normalizedText.includes('500 internal server error')) {
            return 'Proxy returned a 500 error page.';
        }
        return '';
    }

    function isLikelyOrdAddressPage(responseText) {
        const normalizedText = String(responseText || '').toLowerCase();
        if (!normalizedText) return false;

        const hasAddressHeading = normalizedText.includes('<h1>address ')
            || normalizedText.includes('title: address ');
        const hasOrdNavigation = normalizedText.includes('ordinals<sup>beta</sup>')
            || normalizedText.includes(' title=home>ordinals');
        const hasInscriptionsSection = normalizedText.includes('<dt>inscriptions</dt>')
            || normalizedText.includes(' inscriptions[](');

        return hasAddressHeading && (hasOrdNavigation || hasInscriptionsSection);
    }

    function isLikelyOrdAddressJsonPayload(payload) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
        return (
            Object.prototype.hasOwnProperty.call(payload, 'sat_balance')
            || Array.isArray(payload.inscriptions)
            || Array.isArray(payload.outputs)
            || Array.isArray(payload.runes_balances)
        );
    }

    function isLikelyOrdOutputsJsonPayload(payload) {
        if (!Array.isArray(payload)) return false;
        if (payload.length === 0) return true;
        return payload.some(item => {
            if (!item || typeof item !== 'object') return false;
            return (
                typeof item.outpoint === 'string'
                || typeof item.address === 'string'
                || Array.isArray(item.inscriptions)
            );
        });
    }

    async function fetchOrdJsonOrThrow(endpoint, requestLabel) {
        const requestUrls = buildOrdRequestUrls(endpoint);
        let lastError = null;

        for (const requestUrl of requestUrls) {
            let response;

            try {
                response = await fetch(requestUrl, {
                    headers: { Accept: 'application/json' }
                });
            } catch (error) {
                lastError = error;
                continue;
            }

            if (!response.ok) {
                let responseText = '';
                try {
                    responseText = await response.text();
                } catch (error) {
                    responseText = '';
                }

                const normalizedText = String(responseText || '').toLowerCase();
                let requestError;

                if (normalizedText.includes('index-addresses') || normalizedText.includes('address index')) {
                    requestError = new Error('Ord node address index is not enabled. Start ord with --index-addresses.');
                } else if (response.status === 404 && normalizedText.includes('file not found')) {
                    requestError = new Error('Ord node URL points to a static file server. Set ord node URL to your ord HTTP server (for example: http://127.0.0.1:80).');
                } else if (response.status === 404 && requestLabel === 'address') {
                    requestError = new Error('Ord node address endpoint was not found. Confirm ord node URL and ensure your ord version supports GET /address/<ADDRESS>.');
                } else {
                    const condensedText = String(responseText || '')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .slice(0, 180);
                    requestError = new Error(`Ord node ${requestLabel} request failed (${response.status}).${condensedText ? ` ${condensedText}` : ''}`);
                }

                requestError.status = response.status;
                requestError.endpoint = endpoint;
                requestError.requestLabel = requestLabel;
                requestError.responseText = responseText;
                lastError = requestError;
                continue;
            }

            let responseText = '';
            try {
                responseText = await response.text();
            } catch (error) {
                responseText = '';
            }

            try {
                const parsedPayload = JSON.parse(responseText);
                if (requestLabel === 'address') {
                    const extractedIds = getWalletInscriptionIds(parsedPayload);
                    if (extractedIds.length > 0 || isLikelyOrdAddressJsonPayload(parsedPayload)) {
                        return parsedPayload;
                    }
                    lastError = new Error('Ord node address response JSON was not recognized as an address payload.');
                    continue;
                }

                if (requestLabel === 'outputs') {
                    const extractedIds = getWalletInscriptionIds(parsedPayload);
                    if (extractedIds.length > 0 || isLikelyOrdOutputsJsonPayload(parsedPayload)) {
                        return parsedPayload;
                    }
                    lastError = new Error('Ord node outputs response JSON was not recognized as an outputs payload.');
                    continue;
                }

                return parsedPayload;
            } catch (error) {
                const extractedIds = extractInscriptionIdsFromResponseText(responseText);
                if ((requestLabel === 'address' || requestLabel === 'outputs') && extractedIds.length > 0) {
                    return { inscriptions: extractedIds };
                }

                if (requestLabel === 'address' && isLikelyOrdAddressPage(responseText)) {
                    return { inscriptions: [] };
                }

                const responseHint = inferOrdResponseFailureHint(responseText);
                const requestError = new Error(
                    responseHint
                        ? `Ord node ${requestLabel} lookup failed. ${responseHint}`
                        : `Ord node ${requestLabel} endpoint did not return JSON.`
                );
                requestError.status = response.status;
                requestError.endpoint = endpoint;
                requestError.requestLabel = requestLabel;
                requestError.responseText = responseText;
                lastError = requestError;
            }
        }

        if (lastError && lastError instanceof Error && lastError.requestLabel) {
            throw lastError;
        }

        const mixedContentHint = (
            typeof window !== 'undefined'
            && window.location?.protocol === 'https:'
            && /^http:\/\//i.test(String(endpoint || '').trim())
        )
            ? ' This site is HTTPS, so direct HTTP ord-node calls may be blocked by the browser.'
            : '';

        const requestError = new Error(`Could not reach ord node for ${requestLabel}. Check ord node URL and browser/network access.${mixedContentHint}`);
        requestError.status = 0;
        requestError.endpoint = endpoint;
        requestError.requestLabel = requestLabel;
        throw requestError;
    }

    async function fetchOrdAddressPayload(address, ordNodeBase) {
        if (!ordNodeBase) {
            throw new Error('Set your ord node URL before searching (for example: http://127.0.0.1:80).');
        }

        const normalizedAddress = normalizeBitcoinAddressForLookup(address);
        const addressEndpoint = `${ordNodeBase}/address/${encodeURIComponent(normalizedAddress)}`;
        const outputsEndpoint = `${ordNodeBase}/outputs/${encodeURIComponent(normalizedAddress)}?type=inscribed`;
        let payload = null;
        let inscriptionIds = [];
        let addressError = null;

        const probeOrdServer = async function(baseUrl) {
            const probeEndpoints = [`${baseUrl}/blockheight`, `${baseUrl}/status`];

            for (const probeEndpoint of probeEndpoints) {
                const probeUrls = buildOrdRequestUrls(probeEndpoint);
                for (const probeUrl of probeUrls) {
                    try {
                        const probeResponse = await fetch(probeUrl, { method: 'GET' });
                        if (probeResponse.ok) return { reachable: true };
                    } catch (error) {
                        continue;
                    }
                }
            }

            return { reachable: false };
        };

        try {
            payload = await fetchOrdJsonOrThrow(addressEndpoint, 'address');
            inscriptionIds = getWalletInscriptionIds(payload);
        } catch (error) {
            addressError = error;
        }

        const shouldTryOutputsFallback = Boolean(
            addressError
            && (
                Number(addressError.status) === 404
                || /did not return json/i.test(String(addressError?.message || ''))
            )
        ) || Boolean(!addressError && inscriptionIds.length === 0);

        if (shouldTryOutputsFallback) {
            try {
                const outputsPayload = await fetchOrdJsonOrThrow(outputsEndpoint, 'outputs');
                return {
                    payload: payload || outputsPayload,
                    endpoint: payload ? addressEndpoint : outputsEndpoint,
                    inscriptionIds: getWalletInscriptionIds(outputsPayload)
                };
            } catch (outputsError) {
                if (addressError && Number(addressError.status) === 404 && Number(outputsError?.status) === 404) {
                    const ordProbe = await probeOrdServer(ordNodeBase);
                    if (ordProbe.reachable) {
                        throw new Error('Ord server is reachable, but address APIs are unavailable. Start ord with --index-addresses, ensure --disable-json-api is not set, and use a build that includes GET /address/<ADDRESS>.');
                    }
                    throw new Error('Ord node URL does not appear to be an ord API server. Confirm the base URL before searching (for example: http://127.0.0.1:80).');
                }
                throw outputsError;
            }
        }

        if (addressError) throw addressError;
        return { payload, endpoint: addressEndpoint, inscriptionIds };
    }

    function createWalletResultCard(match) {
        const resultCard = document.createElement('div');
        resultCard.className = 'gallery-item';

        const visualContainer = document.createElement('div');
        visualContainer.className = 'gallery-item-visual';
        resultCard.appendChild(visualContainer);

        const isBlokchainPreview = match.collectionSymbol === 'blokchain-surveillance';
        let image = null;

        if (isBlokchainPreview) {
            const frameCrop = document.createElement('div');
            frameCrop.className = 'wallet-blokchain-frame-crop';

            const frame = document.createElement('iframe');
            frame.className = 'wallet-blokchain-frame';
            frame.src = './Blokchain/index_blokchain.html';
            frame.title = match.displayName || 'Blokchain Surveillance Preview';
            frame.tabIndex = -1;
            frame.setAttribute('aria-hidden', 'true');
            frameCrop.appendChild(frame);
            visualContainer.appendChild(frameCrop);
        } else {
            image = document.createElement('img');
            image.src = match.imageSrc;
            image.alt = match.imageAlt || match.displayName;
            visualContainer.appendChild(image);
        }

        const titleFooter = document.createElement('div');
        titleFooter.className = 'image-title';
        titleFooter.textContent = match.displayName || match.inscriptionId;
        visualContainer.appendChild(titleFooter);

        const downloadButton = document.createElement('button');
        downloadButton.type = 'button';
        downloadButton.className = 'download-button';
        downloadButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v10.17l3.59-3.58L17 11l-5 5-5-5 1.41-1.41L11 13.17V3h1zm-7 14h14v2H5v-2z"></path></svg>';

        if (isBlokchainPreview) {
            downloadButton.setAttribute('aria-label', 'Download HTML file');
            downloadButton.addEventListener('click', event => {
                event.stopPropagation();
                blurInteractiveControl(downloadButton);
                downloadFileAsset('./Blokchain/index_blokchain.html', 'index_blokchain.html');
            });
        } else if (image) {
            downloadButton.setAttribute(
                'aria-label',
                getImageSourceExtension(image) === 'gif' ? 'Download original GIF' : 'Download upscaled JPEG'
            );
            downloadButton.addEventListener('click', event => {
                event.stopPropagation();
                blurInteractiveControl(downloadButton);
                downloadUpscaledJpegFromImage(image, match.displayName || match.inscriptionId);
            });
        }

        visualContainer.appendChild(downloadButton);

        const normalizedInscriptionId = normalizeInscriptionId(match?.inscriptionId);
        const itemLinkConfig = buildOrdinalItemLinkConfig(
            match?.collectionSymbol,
            normalizedInscriptionId,
            match.displayName || normalizedInscriptionId
        );
        if (itemLinkConfig) {
            const itemMarketplaceLink = document.createElement('a');
            itemMarketplaceLink.className = 'item-market-link';
            itemMarketplaceLink.href = itemLinkConfig.href;
            itemMarketplaceLink.target = '_blank';
            itemMarketplaceLink.rel = 'noopener noreferrer';
            itemMarketplaceLink.style.backgroundImage = `url(${itemLinkConfig.iconPath})`;
            itemMarketplaceLink.title = itemLinkConfig.title;
            itemMarketplaceLink.setAttribute('aria-label', itemLinkConfig.ariaLabel);
            itemMarketplaceLink.addEventListener('click', event => {
                event.stopPropagation();
                blurInteractiveControl(itemMarketplaceLink);
            });
            visualContainer.appendChild(itemMarketplaceLink);
        }

        return resultCard;
    }

    async function buildWalletCollectionIndex(collection) {
        const metadataPayload = await fetchLocalJson(collection.metadataPath);
        const metadataEntries = Array.isArray(metadataPayload) ? metadataPayload : [];
        const imageLookup = buildCollectionImageLookup(collection);
        const byInscriptionId = new Map();

        const inferEditionNumber = function(entry, index, displayName) {
            const fromDisplayName = extractEditionNumber(displayName);
            if (fromDisplayName) return fromDisplayName;

            const fromMetadataName = extractEditionNumber(entry?.meta?.name);
            if (fromMetadataName) return fromMetadataName;

            const fromCollectionId = buildMetadataCollectionId(entry, index);
            if (/^\d+$/.test(String(fromCollectionId || '').trim())) {
                return String(parseInt(fromCollectionId, 10));
            }

            return String(index + 1);
        };

        const resolveFallbackCollectionImage = function(editionNumber) {
            if (!editionNumber) return null;
            if (collection.symbol === 'blok-boyz') {
                return { src: `./Blok Boyz/${editionNumber}.webp`, alt: `Blok Boyz #${editionNumber}` };
            }
            if (collection.symbol === 'blok-space') {
                return { src: `./Blok Space/${editionNumber}.webp`, alt: `Blok Space #${editionNumber}` };
            }
            return null;
        };

        metadataEntries.forEach((entry, index) => {
            const inscriptionId = normalizeInscriptionId(entry?.id);
            if (!inscriptionId) return;

            const displayName = String(entry?.meta?.name || `${collection.name} #${index + 1}`).trim();
            const editionNumber = inferEditionNumber(entry, index, displayName);
            const resolvedImage = resolveMetadataImage(collection, entry, imageLookup)
                || resolveFallbackCollectionImage(editionNumber);
            const imageSrc = resolvedImage?.src || collection.fallbackImageSrc || magicEdenIconPath;
            const imageAlt = resolvedImage?.alt || collection.fallbackImageAlt || displayName;

            byInscriptionId.set(inscriptionId, {
                collectionSymbol: collection.symbol,
                collectionName: collection.name,
                inscriptionId,
                displayName,
                imageSrc,
                imageAlt,
                editionNumber
            });
        });

        return { ...collection, byInscriptionId };
    }

    function compareWalletMatchEntries(a, b) {
        const aNumber = a.editionNumber ? Number(a.editionNumber) : NaN;
        const bNumber = b.editionNumber ? Number(b.editionNumber) : NaN;
        const aHasNumber = Number.isFinite(aNumber);
        const bHasNumber = Number.isFinite(bNumber);

        if (aHasNumber && bHasNumber) return aNumber - bNumber;
        if (aHasNumber) return -1;
        if (bHasNumber) return 1;

        return String(a.displayName || '').localeCompare(String(b.displayName || ''), 'en', {
            numeric: true,
            sensitivity: 'base'
        });
    }

    function renderWalletSearchResults(container, collectionIndexes, matchesByCollection) {
        container.replaceChildren();

        let totalMatches = 0;
        collectionIndexes.forEach(collection => {
            const matches = matchesByCollection.get(collection.symbol) || [];
            if (matches.length === 0) return;

            totalMatches += matches.length;

            const resultSection = document.createElement('section');
            resultSection.className = 'wallet-result-collection';

            const resultTitle = document.createElement('h3');
            resultTitle.className = 'wallet-result-title';
            resultTitle.textContent = `${collection.name} (${matches.length})`;
            resultSection.appendChild(resultTitle);

            const resultGrid = document.createElement('div');
            resultGrid.className = 'wallet-results-grid';

            matches
                .slice()
                .sort(compareWalletMatchEntries)
                .forEach(match => {
                    resultGrid.appendChild(createWalletResultCard(match));
                });

            resultSection.appendChild(resultGrid);
            container.appendChild(resultSection);
        });

        container.hidden = totalMatches === 0;
        return totalMatches;
    }

    function initializeWalletSearch() {
        const walletSearchForm = document.getElementById('wallet-search-form');
        const walletSearchInput = document.getElementById('wallet-search-input');
        const walletSearchSpinner = document.getElementById('wallet-search-spinner');
        const walletSearchStatus = document.getElementById('wallet-search-status');
        const walletSearchResults = document.getElementById('wallet-search-results');

        if (!walletSearchForm || !walletSearchInput || !walletSearchStatus || !walletSearchResults) return;

        const ordNodeBase = defaultOrdNodeApiBase;
        let walletIndexPromise = null;
        let autoSearchTimer = null;
        let searchSequence = 0;
        let loadingSearchSequence = 0;

        const resetWalletResults = function() {
            walletSearchResults.hidden = true;
            walletSearchResults.replaceChildren();
        };

        const setWalletSearchLoading = function(isLoading, sequence) {
            if (!walletSearchSpinner) return;

            if (isLoading) {
                loadingSearchSequence = typeof sequence === 'number' ? sequence : loadingSearchSequence;
                walletSearchSpinner.classList.add('is-active');
                walletSearchSpinner.setAttribute('aria-hidden', 'false');
                return;
            }

            if (typeof sequence === 'number' && loadingSearchSequence !== sequence) return;
            loadingSearchSequence = 0;
            walletSearchSpinner.classList.remove('is-active');
            walletSearchSpinner.setAttribute('aria-hidden', 'true');
        };

        const setOrdNodeStatus = function() {
            if (ordNodeBase) {
                setWalletStatus(walletSearchStatus, '', false);
            } else {
                setWalletStatus(walletSearchStatus, 'Ord node URL is not configured. Set data-ord-node-base on the <body> element.', true);
            }
        };

        const ensureWalletIndex = async function() {
            if (!walletIndexPromise) {
                walletIndexPromise = Promise.all(walletCollectionConfig.map(buildWalletCollectionIndex))
                    .then(collectionIndexes => {
                        const byInscriptionId = new Map();
                        collectionIndexes.forEach(collection => {
                            collection.byInscriptionId.forEach((entry, inscriptionId) => {
                                if (!byInscriptionId.has(inscriptionId)) {
                                    byInscriptionId.set(inscriptionId, entry);
                                }
                            });
                        });
                        return { collectionIndexes, byInscriptionId };
                    });
            }

            try {
                return await walletIndexPromise;
            } catch (error) {
                walletIndexPromise = null;
                throw error;
            }
        };

        const runWalletLookup = async function(address) {
            if (!ordNodeBase) {
                setWalletSearchLoading(false);
                resetWalletResults();
                setWalletStatus(walletSearchStatus, 'Ord node URL is not configured. Set data-ord-node-base on the <body> element.', true);
                return;
            }

            const currentAddress = String(address || '').trim();
            const currentSearchSequence = ++searchSequence;
            resetWalletResults();
            setWalletSearchLoading(true, currentSearchSequence);
            setWalletStatus(walletSearchStatus, '', false);

            try {
                const [{ collectionIndexes, byInscriptionId }, { inscriptionIds }] = await Promise.all([
                    ensureWalletIndex(),
                    fetchOrdAddressPayload(currentAddress, ordNodeBase)
                ]);
                if (currentSearchSequence !== searchSequence) return;

                const matchesByCollection = new Map();
                Array.from(new Set(inscriptionIds)).forEach(inscriptionId => {
                    const matchedEntry = byInscriptionId.get(inscriptionId);
                    if (!matchedEntry) return;
                    if (!matchesByCollection.has(matchedEntry.collectionSymbol)) {
                        matchesByCollection.set(matchedEntry.collectionSymbol, []);
                    }
                    matchesByCollection.get(matchedEntry.collectionSymbol).push(matchedEntry);
                });

                const walletCount = Array.from(new Set(inscriptionIds)).length;
                const totalMatches = renderWalletSearchResults(walletSearchResults, collectionIndexes, matchesByCollection);

                if (totalMatches === 0) {
                    setWalletStatus(
                        walletSearchStatus,
                        walletCount === 0
                            ? 'Ord lookup returned 0 inscriptions for this address. Try again in a few seconds.'
                            : `No tracked collection matches were found among ${walletCount} wallet inscription${walletCount === 1 ? '' : 's'}.`,
                        false
                    );
                } else {
                    setWalletStatus(
                        walletSearchStatus,
                        `Found ${totalMatches} matching inscription${totalMatches === 1 ? '' : 's'} out of ${walletCount} wallet inscription${walletCount === 1 ? '' : 's'}.`,
                        false
                    );
                }
            } catch (error) {
                if (currentSearchSequence !== searchSequence) return;
                resetWalletResults();
                setWalletStatus(
                    walletSearchStatus,
                    error?.message || 'Wallet lookup failed. Verify the address and ord node API availability.',
                    true
                );
                console.error('Wallet collection search failed:', error);
            } finally {
                setWalletSearchLoading(false, currentSearchSequence);
            }
        };

        setWalletSearchLoading(false);
        setOrdNodeStatus();

        walletSearchInput.addEventListener('input', () => {
            const address = walletSearchInput.value.trim();

            if (autoSearchTimer) {
                clearTimeout(autoSearchTimer);
                autoSearchTimer = null;
            }

            if (!address) {
                searchSequence += 1;
                setWalletSearchLoading(false);
                resetWalletResults();
                setOrdNodeStatus();
                return;
            }

            if (!isValidBitcoinAddress(address)) {
                searchSequence += 1;
                setWalletSearchLoading(false);
                resetWalletResults();
                setWalletStatus(walletSearchStatus, 'Enter a valid Bitcoin wallet address.', false);
                return;
            }

            autoSearchTimer = setTimeout(() => {
                autoSearchTimer = null;
                const latestAddress = walletSearchInput.value.trim();
                if (!isValidBitcoinAddress(latestAddress)) return;
                void runWalletLookup(latestAddress);
            }, 400);
        });

        walletSearchForm.addEventListener('submit', event => {
            event.preventDefault();

            if (autoSearchTimer) {
                clearTimeout(autoSearchTimer);
                autoSearchTimer = null;
            }

            const address = walletSearchInput.value.trim();
            if (!address) {
                searchSequence += 1;
                setWalletSearchLoading(false);
                resetWalletResults();
                setOrdNodeStatus();
                return;
            }

            if (!isValidBitcoinAddress(address)) {
                searchSequence += 1;
                setWalletSearchLoading(false);
                resetWalletResults();
                setWalletStatus(walletSearchStatus, 'Enter a valid Bitcoin wallet address.', true);
                return;
            }

            void runWalletLookup(address);
        });
    }

    function syncTraitFilterCardWidth(traitFilterWindow) {
        const traitControls = traitFilterWindow?.querySelector('.trait-filter-controls');
        if (!traitControls) return;

        const traitCards = Array.from(traitControls.querySelectorAll('.trait-filter-control'));
        if (traitCards.length === 0) return;

        traitControls.style.removeProperty('--trait-filter-card-width');

        const firstCardStyle = window.getComputedStyle(traitCards[0]);
        const horizontalPadding = (parseFloat(firstCardStyle.paddingLeft) || 0) + (parseFloat(firstCardStyle.paddingRight) || 0);
        const horizontalBorder = (parseFloat(firstCardStyle.borderLeftWidth) || 0) + (parseFloat(firstCardStyle.borderRightWidth) || 0);
        const edgeAllowance = 30;

        let widestTextWidth = 0;
        traitCards.forEach(card => {
            const labelNode = card.querySelector('.trait-filter-label');
            const selectNode = card.querySelector('.trait-filter-select');
            if (labelNode) widestTextWidth = Math.max(widestTextWidth, Math.ceil(labelNode.scrollWidth));
            if (selectNode) widestTextWidth = Math.max(widestTextWidth, Math.ceil(selectNode.scrollWidth));
        });

        if (widestTextWidth <= 0) return;

        const desiredWidth = Math.ceil(widestTextWidth + horizontalPadding + horizontalBorder + edgeAllowance);
        const controlsStyle = window.getComputedStyle(traitControls);
        const controlsGap = parseFloat(controlsStyle.columnGap || controlsStyle.gap || '0') || 0;
        const availableWidth = Math.max(1, traitControls.clientWidth);

        const minCardWidth = 130;
        const maxCardWidth = 340;
        const resolvedCardWidth = Math.max(minCardWidth, Math.min(desiredWidth, maxCardWidth));
        const traitCount = Math.max(1, traitCards.length);
        const singleRowMaxCardWidth = Math.floor((availableWidth - (controlsGap * (traitCount - 1))) / traitCount);
        const canFitSingleRow = singleRowMaxCardWidth >= resolvedCardWidth;

        traitControls.style.setProperty('--trait-filter-card-width', `${resolvedCardWidth}px`);
        traitControls.style.flexWrap = canFitSingleRow ? 'nowrap' : 'wrap';
    }

    function scheduleTraitFilterCardWidthSync(traitFilterWindow) {
        if (!traitFilterWindow) return;
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => syncTraitFilterCardWidth(traitFilterWindow));
            return;
        }
        setTimeout(() => syncTraitFilterCardWidth(traitFilterWindow), 0);
    }

    const traitFilterCollectionSymbols = new Set(['blok-boyz', 'blok-space']);
    const traitFilterDataPromiseBySymbol = new Map();
    const traitFilterWindows = [];

    function normalizeCollectionId(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (/^\d+$/.test(normalized)) {
            return String(parseInt(normalized, 10));
        }
        return normalized;
    }

    function normalizeTraitValue(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    function buildMetadataCollectionId(metadataEntry, entryIndex) {
        const nameNumber = extractEditionNumber(metadataEntry?.meta?.name);
        if (nameNumber) return normalizeCollectionId(nameNumber);

        const inscriptionId = String(metadataEntry?.id || '').trim().toLowerCase();
        const inscriptionMatch = inscriptionId.match(/i(\d+)$/);
        if (inscriptionMatch && inscriptionMatch[1]) {
            const parsedInscriptionIndex = Number.parseInt(inscriptionMatch[1], 10);
            if (Number.isFinite(parsedInscriptionIndex)) {
                return normalizeCollectionId(parsedInscriptionIndex + 1);
            }
        }

        return normalizeCollectionId(entryIndex + 1);
    }

    function getCollectionIdFromImageElement(img) {
        if (!img) return '';
        const src = img.getAttribute('src') || '';
        const imageName = src.split('/').pop() || '';
        const collectionId = imageName.split('?')[0].replace(/\.[^.]+$/, '');
        return normalizeCollectionId(collectionId);
    }

    const carouselCollectionSymbols = new Set(['palindrome-punks', 'blok-boyz', 'blok-space']);
    const fullPreloadCollectionSymbols = new Set(['palindrome-punks']);
    const preloadCountByCollectionSymbol = collectionPreloadCountBySymbol;
    const carouselRowCount = 3;
    const fallbackCarouselPixelsPerSecond = 180;
    const carouselSpeedScale = 0.4;
    const palindromeReferenceDurationSeconds = 31.2;
    let sharedCarouselPixelsPerSecond = null;
    const galleryMetadataIndexPromiseBySymbol = new Map();
    const carouselEnhancedGrids = new Set();
    let carouselResizeSyncHandle = null;

    function getImageDisplayTitle(img) {
        if (!img) return 'Untitled';
        const altText = String(img.getAttribute('alt') || '').trim();
        if (altText) return altText;

        const sourceStem = getImageStemFromSrc(getImageSourceUrl(img));
        if (!sourceStem) return 'Untitled';

        try {
            const decodedStem = decodeURIComponent(sourceStem);
            return decodedStem || 'Untitled';
        } catch (error) {
            return sourceStem;
        }
    }

    function shouldPreloadCollectionImage(collectionSymbol, imageIndex) {
        const normalizedCollectionSymbol = String(collectionSymbol || '').trim().toLowerCase();
        if (!normalizedCollectionSymbol) return false;
        if (fullPreloadCollectionSymbols.has(normalizedCollectionSymbol)) return true;

        const configuredPreloadCount = Number(preloadCountByCollectionSymbol.get(normalizedCollectionSymbol) || 0);
        if (!Number.isFinite(configuredPreloadCount) || configuredPreloadCount <= 0) return false;

        return imageIndex < configuredPreloadCount;
    }

    function ensureGalleryItemStructure(img, collectionSymbol) {
        if (!img || img.tagName !== 'IMG') return null;

        const normalizedCollectionSymbol = String(collectionSymbol || '').trim().toLowerCase();
        const existingItem = img.closest('.gallery-item');
        let galleryItem = existingItem;
        let visualNode = null;

        if (!galleryItem) {
            galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-item';

            visualNode = document.createElement('div');
            visualNode.className = 'gallery-item-visual';

            const parentNode = img.parentNode;
            if (!parentNode) return null;
            parentNode.insertBefore(galleryItem, img);
            visualNode.appendChild(img);
            galleryItem.appendChild(visualNode);
        } else {
            visualNode = galleryItem.querySelector(':scope > .gallery-item-visual');
            if (!visualNode) {
                visualNode = document.createElement('div');
                visualNode.className = 'gallery-item-visual';

                while (galleryItem.firstChild) {
                    visualNode.appendChild(galleryItem.firstChild);
                }
                galleryItem.appendChild(visualNode);
            }
        }

        if (normalizedCollectionSymbol) {
            galleryItem.dataset.collectionSymbol = normalizedCollectionSymbol;
        }

        galleryItem.dataset.carouselClone = galleryItem.dataset.carouselClone === 'true' ? 'true' : 'false';

        applyImageLoadingStrategy(img, String(img.dataset.preloadPriority || '').toLowerCase() === 'high');

        const downloadButton = visualNode.querySelector('.download-button') || document.createElement('button');
        if (!downloadButton.classList.contains('download-button')) {
            downloadButton.className = 'download-button';
        }
        downloadButton.type = 'button';
        downloadButton.setAttribute('aria-label', getImageSourceExtension(img) === 'gif' ? 'Download original GIF' : 'Download upscaled JPEG');
        downloadButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v10.17l3.59-3.58L17 11l-5 5-5-5 1.41-1.41L11 13.17V3h1zm-7 14h14v2H5v-2z"></path></svg>';
        if (!downloadButton.parentElement) visualNode.appendChild(downloadButton);

        const imageTitleNode = visualNode.querySelector('.image-title') || document.createElement('div');
        if (!imageTitleNode.classList.contains('image-title')) {
            imageTitleNode.className = 'image-title';
        }
        imageTitleNode.textContent = getImageDisplayTitle(img);
        if (!imageTitleNode.parentElement) visualNode.appendChild(imageTitleNode);

        return galleryItem;
    }

    function buildGalleryMetadataIndex(symbol, metadataEntries) {
        const normalizedSymbol = String(symbol || '').trim().toLowerCase();
        const byCollectionId = new Map();
        const entries = Array.isArray(metadataEntries) ? metadataEntries : [];

        entries.forEach((entry, index) => {
            const collectionId = buildMetadataCollectionId(entry, index);
            const inscriptionId = normalizeInscriptionId(entry?.id);
            if (!isLikelyInscriptionId(inscriptionId)) return;

            if (collectionId && !byCollectionId.has(collectionId)) {
                byCollectionId.set(collectionId, inscriptionId);
            }

            const metadataName = String(entry?.meta?.name || '').trim();
            getNameCandidates(metadataName).forEach(candidateKey => {
                if (!candidateKey || byCollectionId.has(candidateKey)) return;
                byCollectionId.set(candidateKey, inscriptionId);
            });
        });

        if ((normalizedSymbol === 'blok-boyz' || normalizedSymbol === 'blok-space') && byCollectionId.size === 0) {
            entries.forEach((entry, index) => {
                const fallbackCollectionId = normalizeCollectionId(index + 1);
                const inscriptionId = normalizeInscriptionId(entry?.id);
                if (!fallbackCollectionId || !isLikelyInscriptionId(inscriptionId)) return;
                if (!byCollectionId.has(fallbackCollectionId)) byCollectionId.set(fallbackCollectionId, inscriptionId);
            });
        }

        return byCollectionId;
    }

    function resolveInscriptionIdForGalleryImage(metadataIndex, img) {
        if (!metadataIndex || typeof metadataIndex.get !== 'function' || !img) return '';

        const candidateKeys = [];
        const collectionId = getCollectionIdFromImageElement(img);
        if (collectionId) candidateKeys.push(collectionId);

        getNameCandidates(getImageDisplayTitle(img)).forEach(candidate => candidateKeys.push(candidate));
        getNameCandidates(getImageStemFromSrc(getImageSourceUrl(img))).forEach(candidate => candidateKeys.push(candidate));

        const uniqueKeys = Array.from(new Set(candidateKeys.filter(Boolean)));
        for (const candidateKey of uniqueKeys) {
            const matchedInscriptionId = normalizeInscriptionId(metadataIndex.get(candidateKey));
            if (isLikelyInscriptionId(matchedInscriptionId)) return matchedInscriptionId;
        }

        return '';
    }

    async function loadGalleryMetadataIndex(symbol) {
        const normalizedSymbol = String(symbol || '').trim().toLowerCase();
        if (!normalizedSymbol) return new Map();
        if (galleryMetadataIndexPromiseBySymbol.has(normalizedSymbol)) {
            return galleryMetadataIndexPromiseBySymbol.get(normalizedSymbol);
        }

        const metadataPath = collectionMetadataPathBySymbol.get(normalizedSymbol) || '';
        if (!metadataPath) return new Map();

        const metadataIndexPromise = fetchLocalJson(metadataPath)
            .then(payload => buildGalleryMetadataIndex(normalizedSymbol, payload))
            .catch(error => {
                console.error(`Gallery metadata load failed (${normalizedSymbol}):`, error);
                return new Map();
            });

        galleryMetadataIndexPromiseBySymbol.set(normalizedSymbol, metadataIndexPromise);
        return metadataIndexPromise;
    }

    function ensureOrdinalItemLink(galleryItem, collectionSymbol, inscriptionId, imageTitle) {
        if (!galleryItem) return;

        const visualNode = galleryItem.querySelector(':scope > .gallery-item-visual');
        if (!visualNode) return;

        const existingLink = visualNode.querySelector('.item-market-link');
        const normalizedInscriptionId = normalizeInscriptionId(inscriptionId);
        const itemLinkConfig = buildOrdinalItemLinkConfig(
            collectionSymbol,
            normalizedInscriptionId,
            String(imageTitle || normalizedInscriptionId).trim() || normalizedInscriptionId
        );

        if (!itemLinkConfig) {
            if (existingLink) existingLink.remove();
            return;
        }

        const itemMarketplaceLink = existingLink || document.createElement('a');
        itemMarketplaceLink.className = 'item-market-link';
        itemMarketplaceLink.href = itemLinkConfig.href;
        itemMarketplaceLink.target = '_blank';
        itemMarketplaceLink.rel = 'noopener noreferrer';
        itemMarketplaceLink.style.backgroundImage = `url(${itemLinkConfig.iconPath})`;
        itemMarketplaceLink.title = itemLinkConfig.title;
        itemMarketplaceLink.setAttribute('aria-label', itemLinkConfig.ariaLabel);

        if (!itemMarketplaceLink.parentElement) visualNode.appendChild(itemMarketplaceLink);
    }

    async function hydrateGalleryItemLinks(grid, symbol) {
        const normalizedSymbol = String(symbol || '').trim().toLowerCase();
        if (!grid || !normalizedSymbol) return;

        const metadataIndex = await loadGalleryMetadataIndex(normalizedSymbol);
        const galleryItems = Array.from(grid.querySelectorAll('.gallery-item'));
        galleryItems.forEach(item => {
            const img = item.querySelector('img');
            if (!img) return;

            const inscriptionId = resolveInscriptionIdForGalleryImage(metadataIndex, img);
            ensureOrdinalItemLink(item, normalizedSymbol, inscriptionId, getImageDisplayTitle(img));
        });
    }

    async function hydrateArtDropsItemLinks(artDropsGallery) {
        if (!artDropsGallery) return;

        const metadataIndex = await loadGalleryMetadataIndex('art-drops');
        const galleryItems = Array.from(artDropsGallery.querySelectorAll('.gallery-flex-item'));

        galleryItems.forEach(item => {
            const img = item.querySelector('img');
            if (!img) return;

            const inscriptionId = resolveInscriptionIdForGalleryImage(metadataIndex, img);
            ensureOrdinalItemLink(item, 'art-drops', inscriptionId, getImageDisplayTitle(img));
        });
    }

    function cloneGalleryItemForCarousel(sourceItem) {
        if (!sourceItem) return null;
        const clone = sourceItem.cloneNode(true);
        clone.dataset.carouselClone = 'true';
        const cloneImage = clone.querySelector('img');
        if (cloneImage) applyImageLoadingStrategy(cloneImage, false);
        return clone;
    }

    function distributeItemsByRow(sourceItems, rowCount) {
        const rows = Array.from({ length: Math.max(1, rowCount) }, () => []);
        sourceItems.forEach((item, index) => {
            rows[index % rows.length].push(item);
        });
        return rows;
    }

    function syncCarouselTrackDurations(grid, symbol) {
        if (!grid) return;

        const normalizedSymbol = String(symbol || '').trim().toLowerCase();
        const rows = Array.from(grid.querySelectorAll(':scope > .gallery-carousel-row'));
        rows.forEach((rowNode, rowIndex) => {
            const trackNode = rowNode.querySelector(':scope > .gallery-carousel-track');
            const sourceSegment = trackNode?.querySelector(':scope > .gallery-carousel-segment');
            if (!trackNode || !sourceSegment) return;

            const segmentWidth = sourceSegment.scrollWidth || 0;
            if (segmentWidth <= 0) return;

            if (normalizedSymbol === 'palindrome-punks' && rowIndex === 0) {
                sharedCarouselPixelsPerSecond = segmentWidth / palindromeReferenceDurationSeconds;
            }

            const effectivePixelsPerSecond = Math.max(
                40,
                (sharedCarouselPixelsPerSecond || fallbackCarouselPixelsPerSecond) * carouselSpeedScale
            );
            const durationSeconds = Math.max(12, segmentWidth / effectivePixelsPerSecond);
            trackNode.style.setProperty('--carousel-duration', `${durationSeconds.toFixed(2)}s`);
        });
    }

    function scheduleCarouselTrackDurationSync(grid, symbol) {
        if (!grid) return;
        const normalizedSymbol = String(symbol || '').trim().toLowerCase();
        const priorFrame = Number.parseInt(grid.dataset.carouselSyncFrame || '0', 10);
        if (Number.isFinite(priorFrame) && priorFrame > 0 && typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(priorFrame);
        }

        if (typeof window.requestAnimationFrame === 'function') {
            const frameId = window.requestAnimationFrame(() => {
                grid.dataset.carouselSyncFrame = '0';
                syncCarouselTrackDurations(grid, normalizedSymbol);
            });
            grid.dataset.carouselSyncFrame = String(frameId);
            return;
        }

        syncCarouselTrackDurations(grid, normalizedSymbol);
    }

    function rebuildCollectionGridLayout(grid, sourceItems, symbol) {
        const normalizedSymbol = String(symbol || '').trim().toLowerCase();
        const items = Array.isArray(sourceItems) ? sourceItems.filter(Boolean) : [];
        const fragment = document.createDocumentFragment();

        if (!carouselCollectionSymbols.has(normalizedSymbol)) {
            grid.classList.remove('gallery-grid--carousel', 'gallery-grid--carousel-active');
            grid.dataset.carouselEnabled = 'false';
            items.forEach(item => {
                item.dataset.carouselClone = 'false';
                fragment.appendChild(item);
            });
            grid.replaceChildren(fragment);
            return;
        }

        grid.classList.add('gallery-grid--carousel', 'gallery-grid--carousel-active');
        grid.dataset.carouselEnabled = 'true';

        const rowGroups = distributeItemsByRow(items, carouselRowCount);
        rowGroups.forEach((rowItems, rowIndex) => {
            const rowNode = document.createElement('div');
            rowNode.className = `gallery-carousel-row${rowIndex % 2 === 1 ? ' gallery-carousel-row--reverse' : ''}`;

            const trackNode = document.createElement('div');
            trackNode.className = 'gallery-carousel-track';

            const sourceSegment = document.createElement('div');
            sourceSegment.className = 'gallery-carousel-segment';

            const cloneSegment = document.createElement('div');
            cloneSegment.className = 'gallery-carousel-segment';

            rowItems.forEach(item => {
                item.dataset.carouselClone = 'false';
                sourceSegment.appendChild(item);

                const cloneItem = cloneGalleryItemForCarousel(item);
                if (cloneItem) cloneSegment.appendChild(cloneItem);
            });

            trackNode.appendChild(sourceSegment);
            trackNode.appendChild(cloneSegment);
            rowNode.appendChild(trackNode);
            fragment.appendChild(rowNode);
        });

        grid.replaceChildren(fragment);
        carouselEnhancedGrids.add(grid);
        scheduleCarouselTrackDurationSync(grid, normalizedSymbol);
    }

    function bindGalleryInteractionDelegation() {
        if (document.body.dataset.galleryInteractionDelegated === 'true') return;
        document.body.dataset.galleryInteractionDelegated = 'true';

        document.addEventListener('click', event => {
            const downloadButton = event.target.closest('.download-button');
            if (downloadButton) {
                if (downloadButton.closest('#wallet-search-results')) return;
                const galleryItem = downloadButton.closest('.gallery-item, .gallery-flex-item');
                const image = galleryItem ? galleryItem.querySelector('img') : null;
                if (!image) return;

                event.stopPropagation();
                blurInteractiveControl(downloadButton);
                downloadUpscaledJpegFromImage(image, getImageDisplayTitle(image));
                return;
            }

            const itemMarketplaceLink = event.target.closest('.item-market-link');
            if (itemMarketplaceLink) {
                if (itemMarketplaceLink.closest('#wallet-search-results')) return;
                event.stopPropagation();
                blurInteractiveControl(itemMarketplaceLink);
            }
        });
    }

    function enhanceArtDropsGallery() {
        const artDropsGallery = document.querySelector('.gallery-flex');
        if (!artDropsGallery) return;

        Array.from(artDropsGallery.querySelectorAll('.gallery-flex-item')).forEach(item => {
            const image = item.querySelector('img');
            if (!image) return;
            if (!item.querySelector('.gallery-item-visual')) {
                const visualNode = document.createElement('div');
                visualNode.className = 'gallery-item-visual';

                const nodesToMove = Array.from(item.childNodes);
                nodesToMove.forEach(node => visualNode.appendChild(node));
                item.appendChild(visualNode);
            }
            const titleNode = item.querySelector('.image-title');
            if (titleNode && !String(titleNode.textContent || '').trim()) {
                titleNode.textContent = getImageDisplayTitle(image);
            }
        });

        void hydrateArtDropsItemLinks(artDropsGallery);
    }

    function enhanceCollectionGallery(grid) {
        if (!grid) return;

        const gridSymbol = String(grid.dataset.collectionSymbol || '').trim().toLowerCase();
        const sourceItems = [];

        Array.from(grid.children).forEach(node => {
            if (!(node instanceof HTMLElement)) return;

            if (node.classList.contains('gallery-item')) {
                const image = node.querySelector('img');
                if (image) {
                    ensureGalleryItemStructure(image, gridSymbol);
                    sourceItems.push(node);
                }
                return;
            }

            if (node.tagName === 'IMG') {
                const wrappedItem = ensureGalleryItemStructure(node, gridSymbol);
                if (wrappedItem) sourceItems.push(wrappedItem);
            }
        });

        if (sourceItems.length === 0) return;
        sourceItems.forEach((item, itemIndex) => {
            const image = item.querySelector('img');
            if (!image) return;
            applyImageLoadingStrategy(image, shouldPreloadCollectionImage(gridSymbol, itemIndex));
        });
        rebuildCollectionGridLayout(grid, sourceItems, gridSymbol);
        void hydrateGalleryItemLinks(grid, gridSymbol);
    }

    function setupBlokchainResponsiveEmbed() {
        const frame = document.getElementById('blokchain-main-frame');
        if (!frame) return;

        function ensureResponsiveIframeStyles() {
            let frameDoc;
            let frameRoot;

            try {
                frameDoc = frame.contentDocument;
                frameRoot = frameDoc && frameDoc.documentElement;
            } catch (error) {
                return;
            }

            if (!frameDoc || !frameRoot) return;

            let styleNode = frameDoc.getElementById('blokchain-responsive-overrides');
            if (!styleNode) {
                styleNode = frameDoc.createElement('style');
                styleNode.id = 'blokchain-responsive-overrides';
                styleNode.textContent = `
                    :root {
                        --blokchain-scale: 1;
                        --blokchain-eye-size: clamp(150px, calc(250px * var(--blokchain-scale)), 460px);
                        --blokchain-pupil-size: clamp(72px, calc(120px * var(--blokchain-scale)), 220px);
                        --blokchain-path-size: clamp(12px, calc(20px * var(--blokchain-scale)), 36px);
                        --blokchain-block-size: clamp(22px, calc(40px * var(--blokchain-scale)), 72px);
                    }

                    .eye {
                        width: var(--blokchain-eye-size) !important;
                        height: var(--blokchain-eye-size) !important;
                    }

                    .pupil {
                        width: var(--blokchain-pupil-size) !important;
                        height: var(--blokchain-pupil-size) !important;
                    }

                    .chain-path {
                        background-size: var(--blokchain-path-size) var(--blokchain-path-size) !important;
                    }

                    .chain-path.top,
                    .chain-path.bottom {
                        height: var(--blokchain-path-size) !important;
                    }

                    .chain-path.left,
                    .chain-path.right {
                        width: var(--blokchain-path-size) !important;
                    }

                    .chain-block {
                        width: var(--blokchain-block-size) !important;
                        height: var(--blokchain-block-size) !important;
                        animation-name: moveChainResponsive !important;
                    }

                    @keyframes moveChainResponsive {
                        0% { top: 0; left: 0; }
                        25% { top: 0; left: calc(100% - var(--blokchain-block-size)); }
                        50% { top: calc(100% - var(--blokchain-block-size)); left: calc(100% - var(--blokchain-block-size)); }
                        75% { top: calc(100% - var(--blokchain-block-size)); left: 0; }
                        100% { top: 0; left: 0; }
                    }
                `;
                (frameDoc.head || frameRoot).appendChild(styleNode);
            }

            const frameWidth = Math.max(frame.clientWidth || 0, 1);
            const frameHeight = Math.max(frame.clientHeight || 0, 1);
            const widthScale = frameWidth / 1280;
            const heightScale = frameHeight / 720;
            const scale = Math.max(0.55, Math.min(1.65, Math.min(widthScale, heightScale) * 1.2));

            frameRoot.style.setProperty('--blokchain-scale', scale.toFixed(4));
        }

        function queueResponsiveIframeUpdate() {
            if (typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(ensureResponsiveIframeStyles);
                return;
            }
            window.setTimeout(ensureResponsiveIframeStyles, 0);
        }

        frame.addEventListener('load', function() {
            queueResponsiveIframeUpdate();
            window.setTimeout(queueResponsiveIframeUpdate, 120);
        });

        window.addEventListener('resize', queueResponsiveIframeUpdate);
        queueResponsiveIframeUpdate();
    }

    function enhanceAllCollectionGalleries() {
        bindGalleryInteractionDelegation();
        document.querySelectorAll('.gallery-grid[data-collection-symbol]').forEach(grid => {
            enhanceCollectionGallery(grid);
        });
        enhanceArtDropsGallery();

        if (carouselResizeSyncHandle === null) {
            window.addEventListener('resize', function() {
                if (carouselResizeSyncHandle !== null) window.clearTimeout(carouselResizeSyncHandle);
                carouselResizeSyncHandle = window.setTimeout(() => {
                    carouselResizeSyncHandle = null;
                    carouselEnhancedGrids.forEach(grid => {
                        const gridSymbol = String(grid.dataset.collectionSymbol || '').trim().toLowerCase();
                        syncCarouselTrackDurations(grid, gridSymbol);
                    });
                }, 120);
            });
        }
    }

    async function loadTraitFilterData(collectionSymbol) {
        const normalizedSymbol = String(collectionSymbol || '').trim().toLowerCase();
        if (!traitFilterCollectionSymbols.has(normalizedSymbol)) {
            throw new Error(`Trait filters are not configured for ${collectionSymbol || 'this collection'}.`);
        }

        if (!traitFilterDataPromiseBySymbol.has(normalizedSymbol)) {
            const metadataPath = collectionMetadataPathBySymbol.get(normalizedSymbol);
            if (!metadataPath) {
                throw new Error(`Metadata file not found for ${normalizedSymbol}.`);
            }

            const traitDataPromise = fetchLocalJson(metadataPath).then(metadataPayload => {
                const metadataEntries = Array.isArray(metadataPayload) ? metadataPayload : [];
                const traitsByCollectionId = new Map();
                const traitTypeBuckets = new Map();

                metadataEntries.forEach((entry, index) => {
                    const collectionId = buildMetadataCollectionId(entry, index);
                    if (!collectionId) return;

                    const traitsForItem = new Map();
                    const attributes = Array.isArray(entry?.meta?.attributes) ? entry.meta.attributes : [];

                    attributes.forEach(attribute => {
                        const traitTypeLabel = String(attribute?.trait_type || '').trim();
                        const traitValueLabel = String(attribute?.value || '').trim();
                        if (!traitTypeLabel || !traitValueLabel) return;

                        const traitTypeKey = normalizeTraitValue(traitTypeLabel);
                        const traitValueKey = normalizeTraitValue(traitValueLabel);
                        if (!traitTypeKey || !traitValueKey) return;

                        traitsForItem.set(traitTypeKey, traitValueKey);

                        let traitTypeBucket = traitTypeBuckets.get(traitTypeKey);
                        if (!traitTypeBucket) {
                            traitTypeBucket = {
                                key: traitTypeKey,
                                label: traitTypeLabel,
                                valuesByKey: new Map()
                            };
                            traitTypeBuckets.set(traitTypeKey, traitTypeBucket);
                        }

                        let valueBucket = traitTypeBucket.valuesByKey.get(traitValueKey);
                        if (!valueBucket) {
                            valueBucket = {
                                key: traitValueKey,
                                label: traitValueLabel,
                                count: 0
                            };
                            traitTypeBucket.valuesByKey.set(traitValueKey, valueBucket);
                        }

                        valueBucket.count += 1;
                    });

                    traitsByCollectionId.set(collectionId, traitsForItem);
                });

                const traitTypes = Array.from(traitTypeBuckets.values())
                    .map(traitType => {
                        const values = Array.from(traitType.valuesByKey.values())
                            .sort((a, b) => {
                                if (b.count !== a.count) return b.count - a.count;
                                return a.label.localeCompare(b.label, 'en', { sensitivity: 'base' });
                            });

                        return {
                            key: traitType.key,
                            label: traitType.label,
                            values
                        };
                    })
                    .sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }));

                return {
                    traitsByCollectionId,
                    traitTypes,
                    itemCount: traitsByCollectionId.size
                };
            });

            traitFilterDataPromiseBySymbol.set(normalizedSymbol, traitDataPromise);
        }

        try {
            return await traitFilterDataPromiseBySymbol.get(normalizedSymbol);
        } catch (error) {
            traitFilterDataPromiseBySymbol.delete(normalizedSymbol);
            throw error;
        }
    }

    initializeWalletSearch();
    setupBlokchainResponsiveEmbed();
    enhanceAllCollectionGalleries();

    // Gallery-grid search: inject an <input> before each grid.
    // Matching results are moved below the search bar while searching.
    let traitFilterWindowCounter = 0;

    document.querySelectorAll('.gallery-grid').forEach(grid => {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Collection ID';
        input.className = 'gallery-search';

        const gridSymbol = String(grid.dataset.collectionSymbol || '').trim().toLowerCase();
        const supportsTraitFilters = traitFilterCollectionSymbols.has(gridSymbol);
        const searchRow = document.createElement('div');
        searchRow.className = 'gallery-search-row';
        const searchCenterSlot = document.createElement('div');
        searchCenterSlot.className = 'gallery-search-slot';

        searchCenterSlot.appendChild(input);
        searchRow.appendChild(searchCenterSlot);

        let traitFilterControlsNode = null;
        let traitFilterStatusNode = null;
        let traitFilterToggleNode = null;
        let traitFilterContentNode = null;
        let traitFilterData = null;
        let traitFilterWindow = null;
        let traitFilterIsExpanded = false;
        const traitFilterSelectByType = new Map();

        if (supportsTraitFilters) {
            traitFilterWindow = document.createElement('div');
            traitFilterWindow.className = 'trait-filter-window is-collapsed';
            if (gridSymbol) traitFilterWindow.dataset.collectionSymbol = gridSymbol;
            traitFilterWindows.push(traitFilterWindow);

            traitFilterWindowCounter += 1;
            const contentNodeId = `trait-filter-content-${gridSymbol || 'collection'}-${traitFilterWindowCounter}`;

            traitFilterToggleNode = document.createElement('button');
            traitFilterToggleNode.type = 'button';
            traitFilterToggleNode.className = 'trait-filter-toggle';
            traitFilterToggleNode.setAttribute('aria-controls', contentNodeId);

            traitFilterControlsNode = document.createElement('div');
            traitFilterControlsNode.className = 'trait-filter-controls';

            traitFilterStatusNode = document.createElement('p');
            traitFilterStatusNode.className = 'trait-filter-status';
            traitFilterStatusNode.textContent = 'Loading trait filters from metadata...';

            traitFilterContentNode = document.createElement('div');
            traitFilterContentNode.className = 'trait-filter-content';
            traitFilterContentNode.id = contentNodeId;
            traitFilterContentNode.appendChild(traitFilterControlsNode);
            traitFilterContentNode.appendChild(traitFilterStatusNode);

            traitFilterWindow.appendChild(traitFilterToggleNode);
            traitFilterWindow.appendChild(traitFilterContentNode);
            grid.parentNode.insertBefore(traitFilterWindow, grid);
        }

        grid.parentNode.insertBefore(searchRow, grid);

        const resultsGrid = document.createElement('div');
        resultsGrid.className = 'gallery-grid gallery-search-results';
        resultsGrid.style.display = 'none';
        grid.parentNode.insertBefore(resultsGrid, grid);

        if (gridSymbol) {
            const linkedStatsWindow = document.querySelector(`.collection-stats-window[data-collection-symbol="${gridSymbol}"]`);
            if (linkedStatsWindow) {
                const statsAnchor = traitFilterWindow || searchRow;
                statsAnchor.insertAdjacentElement('beforebegin', linkedStatsWindow);
            }
        }

        let originalItems = null;
        let itemDisplayBeforeSearch = null;

        function getGalleryItems() {
            const wrappedItems = Array.from(grid.querySelectorAll('.gallery-item')).filter(item => {
                return item.dataset.carouselClone !== 'true';
            });
            if (wrappedItems.length > 0) return wrappedItems;
            return Array.from(grid.querySelectorAll('img')).filter(img => {
                const wrapped = img.closest('.gallery-item');
                return !wrapped || wrapped.dataset.carouselClone !== 'true';
            });
        }

        function ensureOriginalItems() {
            if (!originalItems) {
                originalItems = getGalleryItems();
            }
        }

        function getImageFromItem(item) {
            if (!item) return null;
            if (item.tagName === 'IMG') return item;
            return item.querySelector('img');
        }

        function setTraitFilterWindowExpanded(expanded) {
            if (!supportsTraitFilters || !traitFilterWindow || !traitFilterToggleNode || !traitFilterContentNode) return;

            traitFilterIsExpanded = Boolean(expanded);
            traitFilterWindow.classList.toggle('is-collapsed', !traitFilterIsExpanded);
            traitFilterToggleNode.setAttribute('aria-expanded', String(traitFilterIsExpanded));
            traitFilterToggleNode.textContent = traitFilterIsExpanded ? 'Hide Trait Filters' : 'Show Trait Filters';
            traitFilterContentNode.hidden = !traitFilterIsExpanded;
            if (traitFilterIsExpanded) scheduleTraitFilterCardWidthSync(traitFilterWindow);
        }

        function setTraitFilterStatus(message, isError) {
            if (!traitFilterStatusNode) return;
            traitFilterStatusNode.textContent = message;
            traitFilterStatusNode.classList.toggle('is-error', Boolean(isError));
            if (isError) setTraitFilterWindowExpanded(true);
        }

        function getActiveTraitFilters() {
            const activeFilters = [];
            traitFilterSelectByType.forEach((selectNode, traitTypeKey) => {
                const selectedValue = normalizeTraitValue(selectNode.value);
                if (!selectedValue) return;
                activeFilters.push({
                    traitTypeKey,
                    traitValueKey: selectedValue
                });
            });
            return activeFilters;
        }

        function updateTraitFilterStatus(matchCount, totalCount, activeTraitFilters, hasIdQuery) {
            if (!supportsTraitFilters || !traitFilterData) return;

            if (activeTraitFilters.length === 0 && !hasIdQuery) {
                setTraitFilterStatus('', false);
                return;
            }

            const activeFilterLabels = [];
            if (activeTraitFilters.length > 0) {
                const suffix = activeTraitFilters.length === 1 ? '' : 's';
                activeFilterLabels.push(`${activeTraitFilters.length} trait filter${suffix}`);
            }
            if (hasIdQuery) activeFilterLabels.push('Collection ID');
            const filterDetail = activeFilterLabels.length > 0 ? ` using ${activeFilterLabels.join(' + ')}` : '';

            setTraitFilterStatus(
                `Showing ${matchCount.toLocaleString('en-US')} of ${totalCount.toLocaleString('en-US')} items${filterDetail}.`,
                false
            );
        }

        function itemMatchesQuery(item, normalizedQuery) {
            const img = getImageFromItem(item);
            if (!img) return false;
            return getCollectionIdFromImageElement(img) === normalizedQuery;
        }

        function itemMatchesTraitFilters(item, activeTraitFilters) {
            if (activeTraitFilters.length === 0) return true;
            if (!traitFilterData) return false;

            const img = getImageFromItem(item);
            if (!img) return false;

            const collectionId = getCollectionIdFromImageElement(img);
            if (!collectionId) return false;

            const metadataTraits = traitFilterData.traitsByCollectionId.get(collectionId);
            if (!metadataTraits) return false;

            return activeTraitFilters.every(filter => {
                return metadataTraits.get(filter.traitTypeKey) === filter.traitValueKey;
            });
        }

        function restoreOriginalGrid() {
            ensureOriginalItems();
            if (grid.dataset.carouselEnabled === 'true') {
                rebuildCollectionGridLayout(grid, originalItems, gridSymbol);
            } else {
                const fragment = document.createDocumentFragment();
                originalItems.forEach(item => fragment.appendChild(item));
                grid.replaceChildren(fragment);
            }

            if (itemDisplayBeforeSearch) {
                originalItems.forEach(item => {
                    const previousDisplay = itemDisplayBeforeSearch.get(item);
                    item.style.display = previousDisplay === undefined ? '' : previousDisplay;
                });
            }

            resultsGrid.style.display = 'none';
            resultsGrid.replaceChildren();
            grid.style.display = '';
            itemDisplayBeforeSearch = null;
        }

        function applyGalleryFilters() {
            const q = input.value.trim().toLowerCase();
            const normalizedQuery = normalizeCollectionId(q);
            const activeTraitFilters = getActiveTraitFilters();
            const hasIdQuery = Boolean(normalizedQuery);
            const hasTraitFilters = activeTraitFilters.length > 0;

            if (!hasIdQuery && !hasTraitFilters) {
                restoreOriginalGrid();
                updateTraitFilterStatus(0, originalItems ? originalItems.length : 0, activeTraitFilters, false);
                return;
            }

            ensureOriginalItems();
            const fragment = document.createDocumentFragment();

            if (!itemDisplayBeforeSearch) {
                itemDisplayBeforeSearch = new Map();
                originalItems.forEach(item => {
                    itemDisplayBeforeSearch.set(item, item.style.display);
                });
            }

            let matchCount = 0;
            originalItems.forEach(item => {
                const matchesCollectionId = !hasIdQuery || itemMatchesQuery(item, normalizedQuery);
                const matchesTraits = !hasTraitFilters || itemMatchesTraitFilters(item, activeTraitFilters);
                if (matchesCollectionId && matchesTraits) {
                    item.style.display = '';
                    fragment.appendChild(item);
                    matchCount += 1;
                }
            });

            resultsGrid.replaceChildren(fragment);
            resultsGrid.style.display = '';
            grid.style.display = 'none';

            updateTraitFilterStatus(matchCount, originalItems.length, activeTraitFilters, hasIdQuery);
        }

        function buildTraitFilterControls(loadedTraitData) {
            if (!supportsTraitFilters || !traitFilterControlsNode) return;

            traitFilterData = loadedTraitData;
            traitFilterSelectByType.clear();
            traitFilterControlsNode.replaceChildren();

            loadedTraitData.traitTypes.forEach(traitType => {
                const traitControl = document.createElement('label');
                traitControl.className = 'trait-filter-control';
                traitControl.style.border = '0';
                traitControl.style.background = 'transparent';
                traitControl.style.borderRadius = '0';
                traitControl.style.boxShadow = 'none';
                traitControl.style.outline = '0';
                traitControl.style.padding = '0';

                const traitLabel = document.createElement('span');
                traitLabel.className = 'trait-filter-label';
                traitLabel.textContent = traitType.label;

                const traitSelect = document.createElement('select');
                traitSelect.className = 'trait-filter-select';
                traitSelect.setAttribute('data-trait-type', traitType.key);

                const anyOption = document.createElement('option');
                anyOption.value = '';
                anyOption.textContent = `any (${traitType.values.length})`;
                traitSelect.appendChild(anyOption);

                traitType.values.forEach(traitValue => {
                    const option = document.createElement('option');
                    option.value = traitValue.key;
                    option.textContent = `${traitValue.label} (${traitValue.count})`;
                    traitSelect.appendChild(option);
                });

                traitSelect.addEventListener('change', applyGalleryFilters);
                traitFilterSelectByType.set(traitType.key, traitSelect);

                traitControl.appendChild(traitLabel);
                traitControl.appendChild(traitSelect);
                traitFilterControlsNode.appendChild(traitControl);
            });
            setTraitFilterStatus('', false);
            scheduleTraitFilterCardWidthSync(traitFilterWindow);
        }

        input.addEventListener('input', applyGalleryFilters);

        let traitFilterLoadPromise = null;

        function ensureTraitFilterDataLoaded() {
            if (!supportsTraitFilters) return Promise.resolve(null);
            if (traitFilterLoadPromise) return traitFilterLoadPromise;

            traitFilterLoadPromise = loadTraitFilterData(gridSymbol)
                .then(loadedTraitData => {
                    buildTraitFilterControls(loadedTraitData);
                    applyGalleryFilters();
                    return loadedTraitData;
                })
                .catch(error => {
                    setTraitFilterStatus('Trait filters are unavailable right now.', true);
                    console.error(`Trait filter load failed (${gridSymbol}):`, error);
                    throw error;
                });

            return traitFilterLoadPromise;
        }

        if (supportsTraitFilters) {
            traitFilterToggleNode.addEventListener('click', () => {
                const nextExpandedState = !traitFilterIsExpanded;
                setTraitFilterWindowExpanded(nextExpandedState);
                if (nextExpandedState) {
                    void ensureTraitFilterDataLoaded();
                }
            });
            setTraitFilterWindowExpanded(false);
        }
    });

    if (traitFilterWindows.length > 0) {
        let traitFilterResizeDebounce = null;
        window.addEventListener('resize', () => {
            clearTimeout(traitFilterResizeDebounce);
            traitFilterResizeDebounce = setTimeout(() => {
                traitFilterWindows.forEach(scheduleTraitFilterCardWidthSync);
            }, 120);
        });
    }

});

(function() {
            var heading = document.querySelector('header h1');
            if (!heading || heading.dataset.letterized === 'true') return;
            var constrainedDevice = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (constrainedDevice) {
                heading.dataset.letterized = 'true';
                return;
            }

            var rawText = heading.getAttribute('data-text') || heading.textContent || '';
            if (!rawText) return;

            function seededNoise(seed) {
                var value = Math.sin(seed * 12.9898) * 43758.5453;
                return value - Math.floor(value);
            }

            var jitterVariants = ['h1-letter-jitter-a', 'h1-letter-jitter-b', 'h1-letter-jitter-c'];
            heading.textContent = '';
            var letterIndex = 0;

            rawText.split(/(\s+)/).forEach(function(token) {
                if (!token) return;

                if (/^\s+$/.test(token)) {
                    heading.appendChild(document.createTextNode(token));
                    return;
                }

                var wordNode = document.createElement('span');
                wordNode.className = 'h1-word';

                Array.from(token).forEach(function(character) {
                    var letterNode = document.createElement('span');
                    letterNode.className = 'h1-letter';
                    letterNode.textContent = character;

                    var base = letterIndex + 1;
                    var r1 = seededNoise(base * 1.17);
                    var r2 = seededNoise(base * 2.31);
                    var r3 = seededNoise(base * 3.73);
                    var r4 = seededNoise(base * 5.21);
                    var r5 = seededNoise(base * 7.97);
                    var r6 = seededNoise(base * 11.09);
                    var r7 = seededNoise(base * 13.37);
                    var r8 = seededNoise(base * 17.23);
                    var r9 = seededNoise(base * 19.61);

                    letterNode.style.setProperty('--h1-index', String(letterIndex));
                    letterNode.style.setProperty('--h1-jitter-name', jitterVariants[Math.floor(r1 * jitterVariants.length)]);
                    letterNode.style.setProperty('--h1-jitter-duration', (1.2 + r2 * 2.8).toFixed(3) + 's');
                    letterNode.style.setProperty('--h1-jitter-delay', (-r3 * 4.2).toFixed(3) + 's');
                    letterNode.style.setProperty('--h1-flicker-duration', (2.7 + r4 * 5.1).toFixed(3) + 's');
                    letterNode.style.setProperty('--h1-flicker-delay', (-r5 * 6.0).toFixed(3) + 's');
                    letterNode.style.setProperty('--h1-jitter-amplitude', (0.8 + r6 * 3.2).toFixed(3));
                    letterNode.style.setProperty('--h1-surge-duration', (3.6 + r7 * 4.4).toFixed(3) + 's');
                    letterNode.style.setProperty('--h1-surge-delay', (-r8 * 7.2).toFixed(3) + 's');
                    letterNode.style.setProperty('--h1-surge-intensity', (0.85 + r9 * 1.15).toFixed(3));

                    wordNode.appendChild(letterNode);
                    letterIndex += 1;
                });

                heading.appendChild(wordNode);
            });

            heading.dataset.letterized = 'true';
        })();

