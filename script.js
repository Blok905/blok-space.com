document.addEventListener("DOMContentLoaded", function() {
    const collectionStatsSearchApi = 'https://api-mainnet.magiceden.dev/collection_stats/search/bitcoin';
    const collectionStatsByIdApi = 'https://api-mainnet.magiceden.dev/collection_stats/stats?chain=bitcoin&collectionId=';
    const corsProxyBase = 'https://api.allorigins.win/raw?url=';
    const ordProxyBases = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?'
    ];

    const collectionSupplyOverrides = {
        'blok-boyz': 1000,
        'blok-space': 1000
    };

    const walletCollectionConfig = [
        {
            symbol: 'palindrome-punks',
            name: 'Palindrome Punks',
            metadataPath: './palindrome-punks-metadata.json',
            imageSelector: '.gallery-grid[data-collection-symbol="palindrome-punks"] img'
        },
        {
            symbol: 'blok-boyz',
            name: 'Blok Boyz',
            metadataPath: './blok-boyz-metadata.json',
            imageSelector: '.gallery-grid[data-collection-symbol="blok-boyz"] img'
        },
        {
            symbol: 'blok-space',
            name: 'Blok Space',
            metadataPath: './blok-space-metadata.json',
            imageSelector: '.gallery-grid[data-collection-symbol="blok-space"] img'
        },
        {
            symbol: 'blokchain-surveillance',
            name: 'Blokchain Surveillance',
            metadataPath: './blokchain-surveillance-metadata.json',
            fallbackImageSrc: './Images/Surveillance.png',
            fallbackImageAlt: 'Blokchain Surveillance'
        },
        {
            symbol: 'art-drops',
            name: 'Art-Drops',
            metadataPath: './art-drops-metadata.json',
            imageSelector: '.gallery-flex img'
        }
    ];
    const magicEdenItemBaseUrl = 'https://magiceden.io/ordinals/item-details/';
    const magicEdenIconPath = './Images/ME.png';

    function sanitizeOrdNodeBase(value) {
        const trimmed = String(value || '').trim();
        if (!trimmed) return '';
        return trimmed.replace(/\/+$/, '');
    }

    const remoteOrdNodeFallback = 'http://64.20.33.102:52025';

    const defaultOrdNodeApiBase = (function resolveOrdNodeApiBase() {
        const configuredBase = document.body?.dataset?.ordNodeBase || window.ORD_NODE_API_BASE || window.ORD_NODE_BASE_URL;
        const fallbackBase = configuredBase || remoteOrdNodeFallback;
        return sanitizeOrdNodeBase(fallbackBase);
    })();

    function parseNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;

        const normalized = String(value).replace(/,/g, '').trim().toLowerCase();
        if (!normalized) return null;

        const compactMatch = normalized.match(/^(-?\d+(?:\.\d+)?)\s*([kmb])(?:\b|$)/i);
        if (compactMatch) {
            const base = Number(compactMatch[1]);
            const suffix = compactMatch[2].toLowerCase();
            const multiplier = suffix === 'k' ? 1e3 : suffix === 'm' ? 1e6 : 1e9;
            const compactValue = base * multiplier;
            return Number.isFinite(compactValue) ? compactValue : null;
        }

        const direct = Number(normalized);
        if (Number.isFinite(direct)) return direct;

        const extracted = normalized.match(/-?\d+(?:\.\d+)?/);
        if (!extracted) return null;

        const extractedValue = Number(extracted[0]);
        return Number.isFinite(extractedValue) ? extractedValue : null;
    }

    function formatCount(value) {
        const parsed = parseNumber(value);
        return parsed === null ? '--' : Math.round(parsed).toLocaleString('en-US');
    }

    function formatBtc(value) {
        const parsed = parseNumber(value);
        if (parsed === null) return '--';
        return `${parsed.toLocaleString('en-US', {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3
        })} ₿`;
    }

    function setStatValue(statsWindow, statName, value) {
        const stat = statsWindow.querySelector(`[data-stat="${statName}"]`);
        if (stat) stat.textContent = value;
    }

    function clearStats(statsWindow) {
        setStatValue(statsWindow, 'floor', '--');
        setStatValue(statsWindow, 'volume-24h', '--');
        setStatValue(statsWindow, 'volume-total', '--');
        setStatValue(statsWindow, 'listed', '--');
        setStatValue(statsWindow, 'owners', '--');
        setStatValue(statsWindow, 'supply', '--');
    }

    function setStatus(statsWindow, message, isError) {
        const statsStatus = statsWindow.querySelector('.collection-stats-status');
        if (!statsStatus) return;
        const normalizedMessage = String(message || '').trim();
        statsStatus.textContent = normalizedMessage;
        statsStatus.hidden = normalizedMessage.length === 0;
        statsStatus.classList.toggle('is-error', Boolean(isError));
    }

    function setUpdated(statsWindow, message) {
        const statsUpdated = statsWindow.querySelector('.collection-stats-updated');
        if (statsUpdated) statsUpdated.textContent = message;
    }

    function buildProxiedUrl(url) {
        return `${corsProxyBase}${encodeURIComponent(url)}`;
    }

    function buildJinaProxyUrl(url) {
        const normalized = String(url || '').trim();
        if (!normalized) return '';
        return `https://r.jina.ai/http://${normalized.replace(/^https?:\/\//i, '')}`;
    }

    function shouldUseOrdProxyFallback(endpoint) {
        const value = String(endpoint || '').trim();
        if (!value) return false;
        if (value.startsWith(corsProxyBase)) return false;

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
            ordProxyBases.forEach(proxyBase => {
                requestUrls.push(`${proxyBase}${encodeURIComponent(endpoint)}`);
            });
            const jinaProxyUrl = buildJinaProxyUrl(endpoint);
            if (jinaProxyUrl) requestUrls.push(jinaProxyUrl);
        }
        return Array.from(new Set(requestUrls.filter(Boolean)));
    }

    function satsToBtc(value) {
        const parsed = parseNumber(value);
        return parsed === null ? null : parsed / 100000000;
    }

    async function fetchJsonWithFallback(url) {
        const requestUrls = [url, buildProxiedUrl(url)];
        let lastError = null;

        for (const requestUrl of requestUrls) {
            try {
                const response = await fetch(requestUrl, {
                    headers: { Accept: 'application/json' }
                });
                if (!response.ok) {
                    throw new Error(`Request failed with status ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Failed to load JSON payload');
    }

    async function fetchTextWithFallback(url) {
        const requestUrls = [url, buildProxiedUrl(url)];
        let lastError = null;

        for (const requestUrl of requestUrls) {
            try {
                const response = await fetch(requestUrl);
                if (!response.ok) {
                    throw new Error(`Request failed with status ${response.status}`);
                }
                return await response.text();
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Failed to load text payload');
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

    function addLookupKey(map, key, value) {
        if (!key || map.has(key)) return;
        map.set(key, value);
    }

    function setWalletStatus(statusNode, message, isError) {
        if (!statusNode) return;
        statusNode.textContent = message;
        statusNode.classList.toggle('is-error', Boolean(isError));
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
        if (isLikelyInscriptionId(normalizedInscriptionId)) {
            const magicEdenLink = document.createElement('a');
            magicEdenLink.className = 'item-magic-eden-link';
            magicEdenLink.href = `${magicEdenItemBaseUrl}${normalizedInscriptionId}`;
            magicEdenLink.target = '_blank';
            magicEdenLink.rel = 'noopener noreferrer';
            magicEdenLink.style.backgroundImage = `url(${magicEdenIconPath})`;
            magicEdenLink.title = 'View on Magic Eden';
            magicEdenLink.setAttribute(
                'aria-label',
                `View ${match.displayName || normalizedInscriptionId} on Magic Eden`
            );
            magicEdenLink.addEventListener('click', event => {
                event.stopPropagation();
                blurInteractiveControl(magicEdenLink);
            });
            visualContainer.appendChild(magicEdenLink);
        }

        return resultCard;
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

        const candidateKeys = Array.from(new Set([
            ...getNameCandidates(metadataName)
        ]));

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

    function isLikelyInscriptionId(value) {
        return /^[0-9a-f]{64}i\d+$/i.test(String(value || '').trim());
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

    function extractInscriptionIdsFromResponseText(responseText) {
        const ids = new Set();
        const normalizedText = String(responseText || '');
        const matches = normalizedText.match(/[0-9a-f]{64}i\d+/ig) || [];
        matches.forEach(match => ids.add(normalizeInscriptionId(match)));
        return Array.from(ids);
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
                    const detail = condensedText ? ` ${condensedText}` : '';
                    requestError = new Error(`Ord node ${requestLabel} request failed (${response.status}).${detail}`);
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
                return JSON.parse(responseText);
            } catch (error) {
                const extractedIds = extractInscriptionIdsFromResponseText(responseText);
                if ((requestLabel === 'address' || requestLabel === 'outputs') && extractedIds.length > 0) {
                    return { inscriptions: extractedIds };
                }

                const requestError = new Error(`Ord node ${requestLabel} endpoint did not return JSON.`);
                requestError.status = response.status;
                requestError.endpoint = endpoint;
                requestError.requestLabel = requestLabel;
                requestError.responseText = responseText;
                lastError = requestError;
            }
        }

        if (
            (requestLabel === 'address' || requestLabel === 'outputs')
            && lastError
            && /did not return json/i.test(String(lastError.message || ''))
        ) {
            return { inscriptions: [] };
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

        const probeOrdServer = async function(baseUrl) {
            const probeEndpoints = [
                `${baseUrl}/blockheight`,
                `${baseUrl}/status`
            ];

            for (const probeEndpoint of probeEndpoints) {
                const probeUrls = buildOrdRequestUrls(probeEndpoint);
                for (const probeUrl of probeUrls) {
                    try {
                        const probeResponse = await fetch(probeUrl, { method: 'GET' });
                        if (probeResponse.ok) {
                            return { reachable: true, endpoint: probeEndpoint };
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }

            return { reachable: false, endpoint: '' };
        };

        const addressEndpoint = `${ordNodeBase}/address/${encodeURIComponent(address)}`;
        const outputsEndpoint = `${ordNodeBase}/outputs/${encodeURIComponent(address)}?type=inscribed`;

        let payload = null;
        let inscriptionIds = [];
        let addressError = null;

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
        )
            || Boolean(!addressError && inscriptionIds.length === 0);

        if (shouldTryOutputsFallback) {
            try {
                const outputsPayload = await fetchOrdJsonOrThrow(outputsEndpoint, 'outputs');
                const outputInscriptionIds = getWalletInscriptionIds(outputsPayload);
                return {
                    payload: payload || outputsPayload,
                    endpoint: payload ? addressEndpoint : outputsEndpoint,
                    inscriptionIds: outputInscriptionIds
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

    function getWalletInscriptionIds(addressPayload) {
        const inscriptionIds = new Set();

        collectInscriptionIds(addressPayload?.inscriptions, inscriptionIds);
        collectInscriptionIds(addressPayload?.ids, inscriptionIds);
        collectInscriptionIds(addressPayload?.outputs, inscriptionIds);
        collectInscriptionIds(addressPayload, inscriptionIds);

        return Array.from(inscriptionIds);
    }

    async function buildWalletCollectionIndex(collection) {
        const metadataPayload = await fetchJsonWithFallback(collection.metadataPath);
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
                return {
                    src: `./Blok Boyz/${editionNumber}.png`,
                    alt: `Blok Boyz #${editionNumber}`
                };
            }

            if (collection.symbol === 'blok-space') {
                return {
                    src: `./Blok Space/${editionNumber}.png`,
                    alt: `Blok Space #${editionNumber}`
                };
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
            const imageSrc = resolvedImage?.src || collection.fallbackImageSrc || '';
            if (!imageSrc) return;

            byInscriptionId.set(inscriptionId, {
                collectionSymbol: collection.symbol,
                collectionName: collection.name,
                inscriptionId,
                displayName,
                imageSrc,
                imageAlt: resolvedImage?.alt || displayName,
                editionNumber
            });
        });

        return {
            ...collection,
            byInscriptionId
        };
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

                const walletInscriptionIds = Array.from(new Set(inscriptionIds));
                const matchesByCollection = new Map();

                walletInscriptionIds.forEach(inscriptionId => {
                    const matchedEntry = byInscriptionId.get(inscriptionId);
                    if (!matchedEntry) return;
                    if (!matchesByCollection.has(matchedEntry.collectionSymbol)) {
                        matchesByCollection.set(matchedEntry.collectionSymbol, []);
                    }
                    matchesByCollection.get(matchedEntry.collectionSymbol).push(matchedEntry);
                });

                const totalMatches = renderWalletSearchResults(walletSearchResults, collectionIndexes, matchesByCollection);
                if (totalMatches === 0) {
                    setWalletStatus(walletSearchStatus, 'No inscriptions from your tracked collections were found in this wallet.', false);
                } else {
                    const walletCount = walletInscriptionIds.length;
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

    function mapSearchStats(rawStats) {
        if (!rawStats || typeof rawStats !== 'object') return null;
        return {
            source: 'Magic Eden collection stats API',
            floorPrice: rawStats.fp ?? rawStats.fpListingPrice ?? rawStats.floorPrice,
            volume24h: rawStats.vol ?? rawStats.volume24h ?? rawStats.volume24hr,
            totalVolume: rawStats.totalVol ?? rawStats.totalVolume ?? rawStats.volumeTotal,
            listedCount: rawStats.listedCount ?? rawStats.listed,
            ownerCount: rawStats.ownerCount ?? rawStats.owners,
            totalSupply: rawStats.totalSupply ?? rawStats.supply
        };
    }

    function mapCollectionStatsById(rawStats) {
        if (!rawStats || typeof rawStats !== 'object') return null;
        const statsPayload = rawStats?.stats && typeof rawStats.stats === 'object'
            ? rawStats.stats
            : rawStats;

        return {
            source: 'Magic Eden collection stats API',
            floorPrice: statsPayload.floorPrice?.native
                ?? satsToBtc(statsPayload.floorPrice?.amount)
                ?? statsPayload.fp
                ?? statsPayload.fpListingPrice,
            volume24h: satsToBtc(statsPayload.volume24hr ?? statsPayload.volume24h ?? statsPayload.vol24hSats)
                ?? statsPayload.volume24hBtc
                ?? statsPayload.vol
                ?? statsPayload.volume24h,
            totalVolume: satsToBtc(statsPayload.totalVol ?? statsPayload.totalVolumeSats)
                ?? statsPayload.totalVolumeBtc
                ?? statsPayload.totalVol
                ?? statsPayload.totalVolume,
            listedCount: statsPayload.listedCount ?? statsPayload.listed,
            ownerCount: statsPayload.ownerCount ?? statsPayload.owners,
            totalSupply: statsPayload.tokenCount ?? statsPayload.totalSupply ?? statsPayload.supply
        };
    }

    function parseMarketplaceStats(html) {
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
        if (!nextDataMatch || !nextDataMatch[1]) return null;

        let nextData;
        try {
            nextData = JSON.parse(nextDataMatch[1]);
        } catch (error) {
            return null;
        }

        const statRows = nextData?.props?.pageProps?.stats;
        if (!Array.isArray(statRows) || statRows.length === 0) return null;

        const readStat = function(traitName) {
            const row = statRows.find(item => {
                return String(item?.trait_type || '').toLowerCase() === traitName.toLowerCase();
            });
            return row ? row.value : null;
        };

        return {
            source: 'Magic Eden marketplace page',
            floorPrice: readStat('Floor Price'),
            volume24h: readStat('24h Vol'),
            totalVolume: readStat('All Vol'),
            listedCount: readStat('Listed'),
            ownerCount: readStat('Owners'),
            totalSupply: readStat('Total Supply')
        };
    }

    function normalizeCollectionKey(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '');
    }

    function findCollectionStatsInPayload(searchPayload, collectionSymbol, collectionName) {
        if (!Array.isArray(searchPayload)) return null;

        const normalizedSymbol = String(collectionSymbol || '').toLowerCase();
        const normalizedName = String(collectionName || '').toLowerCase();
        const normalizedSymbolKey = normalizeCollectionKey(normalizedSymbol);
        const normalizedNameKey = normalizeCollectionKey(normalizedName);

        const directMatch = searchPayload.find(item => {
            const symbol = String(item?.collectionSymbol || item?.symbol || '').toLowerCase();
            const collectionId = String(item?.collectionId || item?.id || '').toLowerCase();
            return symbol === normalizedSymbol || collectionId === normalizedSymbol;
        });
        if (directMatch) return directMatch;

        return searchPayload.find(item => {
            const candidateKeys = [
                item?.collectionSymbol,
                item?.collectionId,
                item?.symbol,
                item?.id,
                item?.name,
                item?.collectionName,
                item?.displayName
            ]
                .map(normalizeCollectionKey)
                .filter(Boolean);

            return candidateKeys.some(candidateKey => {
                if (normalizedSymbolKey) {
                    if (candidateKey === normalizedSymbolKey) return true;
                    if (candidateKey.includes(normalizedSymbolKey) || normalizedSymbolKey.includes(candidateKey)) return true;
                }
                if (normalizedNameKey) {
                    if (candidateKey === normalizedNameKey) return true;
                    if (candidateKey.includes(normalizedNameKey) || normalizedNameKey.includes(candidateKey)) return true;
                }
                return false;
            });
        }) || null;
    }

    const collectionStatsRetryDelayMs = 30 * 1000;
    const collectionStatsRetryTimers = new WeakMap();
    const collectionStatsRefreshInProgress = new WeakSet();

    function clearCollectionStatsRetry(statsWindow) {
        const retryTimer = collectionStatsRetryTimers.get(statsWindow);
        if (!retryTimer) return;
        clearTimeout(retryTimer);
        collectionStatsRetryTimers.delete(statsWindow);
    }

    function scheduleCollectionStatsRetry(statsWindow) {
        if (!statsWindow || collectionStatsRetryTimers.has(statsWindow)) return;
        const retryTimer = setTimeout(() => {
            collectionStatsRetryTimers.delete(statsWindow);
            void refreshCollectionStats(statsWindow, null);
        }, collectionStatsRetryDelayMs);
        collectionStatsRetryTimers.set(statsWindow, retryTimer);
    }

    function syncCollectionStatCardWidth(statsWindow) {
        const statsGrid = statsWindow?.querySelector('.collection-stats-grid');
        if (!statsGrid) return;

        const statCards = Array.from(statsGrid.querySelectorAll('.collection-stat'));
        if (statCards.length === 0) return;

        statsGrid.style.removeProperty('--collection-stat-card-width');

        const firstCardStyle = window.getComputedStyle(statCards[0]);
        const horizontalPadding = (parseFloat(firstCardStyle.paddingLeft) || 0) + (parseFloat(firstCardStyle.paddingRight) || 0);
        const horizontalBorder = (parseFloat(firstCardStyle.borderLeftWidth) || 0) + (parseFloat(firstCardStyle.borderRightWidth) || 0);
        const edgeAllowance = 2;

        let widestTextWidth = 0;
        statCards.forEach(card => {
            const labelNode = card.querySelector('.collection-stat-label');
            const valueNode = card.querySelector('.collection-stat-value');
            if (labelNode) widestTextWidth = Math.max(widestTextWidth, Math.ceil(labelNode.scrollWidth));
            if (valueNode) widestTextWidth = Math.max(widestTextWidth, Math.ceil(valueNode.scrollWidth));
        });

        if (widestTextWidth <= 0) return;

        const desiredWidth = Math.ceil(widestTextWidth + horizontalPadding + horizontalBorder + edgeAllowance);
        const statsGridStyle = window.getComputedStyle(statsGrid);
        const gridGap = parseFloat(statsGridStyle.columnGap || statsGridStyle.gap || '0') || 0;
        const availableWidth = Math.max(1, statsGrid.clientWidth);

        const resolvedCardWidth = Math.max(1, desiredWidth);
        const statCount = Math.max(1, statCards.length);
        const singleRowMaxCardWidth = Math.floor((availableWidth - (gridGap * (statCount - 1))) / statCount);
        const canFitSingleRow = singleRowMaxCardWidth >= resolvedCardWidth;

        statsGrid.style.setProperty('--collection-stat-card-width', `${resolvedCardWidth}px`);
        statsGrid.style.flexWrap = canFitSingleRow ? 'nowrap' : 'wrap';
    }

    function scheduleCollectionStatCardWidthSync(statsWindow) {
        if (!statsWindow) return;
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => syncCollectionStatCardWidth(statsWindow));
            return;
        }
        setTimeout(() => syncCollectionStatCardWidth(statsWindow), 0);
    }

    function syncTraitFilterCardWidth(traitFilterWindow) {
        const traitControls = traitFilterWindow?.querySelector('.trait-filter-controls');
        if (!traitControls) return;

        const traitCards = Array.from(traitControls.querySelectorAll('.trait-filter-control'));
        if (traitCards.length === 0) return;

        traitControls.style.removeProperty('--trait-filter-card-width');

        const linkedCollectionSymbol = String(traitFilterWindow?.dataset.collectionSymbol || '').trim().toLowerCase();
        let linkedStatCardWidth = 0;
        if (linkedCollectionSymbol) {
            const linkedStatsWindow = document.querySelector(`.collection-stats-window[data-collection-symbol="${linkedCollectionSymbol}"]`);
            const linkedStatsGrid = linkedStatsWindow?.querySelector('.collection-stats-grid');
            const linkedStatCard = linkedStatsWindow?.querySelector('.collection-stat');
            if (linkedStatsGrid) {
                const explicitGridWidth = parseFloat(linkedStatsGrid.style.getPropertyValue('--collection-stat-card-width'));
                if (Number.isFinite(explicitGridWidth) && explicitGridWidth > 0) linkedStatCardWidth = explicitGridWidth;
            }
            if (linkedStatCardWidth <= 0 && linkedStatCard) {
                linkedStatCardWidth = Math.ceil(linkedStatCard.getBoundingClientRect().width);
            }
        }

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
        const resolvedCardWidth = linkedStatCardWidth > 0
            ? linkedStatCardWidth
            : Math.max(minCardWidth, Math.min(desiredWidth, maxCardWidth));
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

    async function refreshCollectionStats(statsWindow, sharedSearchPayload) {
        if (collectionStatsRefreshInProgress.has(statsWindow)) return;
        collectionStatsRefreshInProgress.add(statsWindow);

        const collectionSymbol = String(statsWindow.dataset.collectionSymbol || '').trim().toLowerCase();
        if (!collectionSymbol) {
            collectionStatsRefreshInProgress.delete(statsWindow);
            return;
        }
        const collectionName = String(statsWindow.dataset.collectionName || '').trim();

        const statsRefresh = statsWindow.querySelector('.collection-stats-refresh');
        const collectionStatsPageUrl = `https://magiceden.io/ordinals/marketplace/${collectionSymbol}`;

        if (statsRefresh) statsRefresh.disabled = true;
        setStatus(statsWindow, 'Fetching Magic Eden stats...', false);

        try {
            let mappedStats = null;
            let searchPayload = sharedSearchPayload;

            try {
                const perCollectionStats = await fetchJsonWithFallback(
                    `${collectionStatsByIdApi}${encodeURIComponent(collectionSymbol)}`
                );
                mappedStats = mapCollectionStatsById(perCollectionStats);
            } catch (error) {
                mappedStats = null;
            }

            if (!Array.isArray(searchPayload)) {
                try {
                    searchPayload = await fetchJsonWithFallback(collectionStatsSearchApi);
                } catch (error) {
                    searchPayload = null;
                }
            }

            const matchedStats = findCollectionStatsInPayload(searchPayload, collectionSymbol, collectionName);
            if (!mappedStats && matchedStats) {
                mappedStats = mapSearchStats(matchedStats);
            }

            if (!mappedStats) {
                const pageHtml = await fetchTextWithFallback(collectionStatsPageUrl);
                mappedStats = parseMarketplaceStats(pageHtml);
            }

            if (!mappedStats) {
                throw new Error(`Could not locate collection stats for ${collectionSymbol}`);
            }

            setStatValue(statsWindow, 'floor', formatBtc(mappedStats.floorPrice));
            setStatValue(statsWindow, 'volume-24h', formatBtc(mappedStats.volume24h));
            setStatValue(statsWindow, 'volume-total', formatBtc(mappedStats.totalVolume));
            setStatValue(statsWindow, 'listed', formatCount(mappedStats.listedCount));
            setStatValue(statsWindow, 'owners', formatCount(mappedStats.ownerCount));
            const resolvedSupply = parseNumber(mappedStats.totalSupply) ?? collectionSupplyOverrides[collectionSymbol] ?? null;
            setStatValue(statsWindow, 'supply', formatCount(resolvedSupply));

            setUpdated(statsWindow, `Updated ${new Date().toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short'
            })}`);
            setStatus(statsWindow, '', false);
            scheduleCollectionStatCardWidthSync(statsWindow);
            clearCollectionStatsRetry(statsWindow);
        } catch (error) {
            clearStats(statsWindow);
            setUpdated(statsWindow, 'Update failed');
            setStatus(
                statsWindow,
                `Unable to load collection stats right now. Retrying in ${Math.round(collectionStatsRetryDelayMs / 1000)} seconds...`,
                true
            );
            scheduleCollectionStatCardWidthSync(statsWindow);
            scheduleCollectionStatsRetry(statsWindow);
            console.error(`Collection stats load failed (${collectionSymbol}):`, error);
        } finally {
            if (statsRefresh) statsRefresh.disabled = false;
            collectionStatsRefreshInProgress.delete(statsWindow);
        }
    }

    const statsWindows = Array.from(document.querySelectorAll('.collection-stats-window[data-collection-symbol]'));
    if (statsWindows.length > 0) {
        statsWindows.forEach(statsWindow => {
            const collectionName = statsWindow.dataset.collectionName;
            const nameNode = statsWindow.querySelector('.collection-stats-name');
            if (collectionName && nameNode) nameNode.textContent = collectionName;

            const statsUpdated = statsWindow.querySelector('.collection-stats-updated');
            const statsFooter = statsWindow.querySelector('.collection-stats-footer');
            if (statsUpdated && statsFooter) {
                const statsStatus = statsFooter.querySelector('.collection-stats-status');
                if (statsStatus) {
                    statsStatus.insertAdjacentElement('afterend', statsUpdated);
                } else {
                    statsFooter.appendChild(statsUpdated);
                }
            }

            const statsRefresh = statsWindow.querySelector('.collection-stats-refresh');
            if (statsRefresh) statsRefresh.remove();
            scheduleCollectionStatCardWidthSync(statsWindow);
        });

        let allCollectionStatsRefreshInProgress = false;
        let collectionStatsResizeDebounce = null;

        const refreshAllCollectionStats = async function() {
            if (allCollectionStatsRefreshInProgress) return;
            allCollectionStatsRefreshInProgress = true;

            try {
                let sharedSearchPayload = null;
                try {
                    sharedSearchPayload = await fetchJsonWithFallback(collectionStatsSearchApi);
                } catch (error) {
                    sharedSearchPayload = null;
                }

                await Promise.all(statsWindows.map(statsWindow => {
                    return refreshCollectionStats(statsWindow, sharedSearchPayload);
                }));
            } finally {
                allCollectionStatsRefreshInProgress = false;
            }
        };

        refreshAllCollectionStats();

        window.addEventListener('resize', () => {
            clearTimeout(collectionStatsResizeDebounce);
            collectionStatsResizeDebounce = setTimeout(() => {
                statsWindows.forEach(scheduleCollectionStatCardWidthSync);
            }, 120);
        });
    }

    const traitFilterCollectionSymbols = new Set(['blok-boyz', 'blok-space']);
    const collectionMetadataPathBySymbol = new Map(
        walletCollectionConfig.map(collection => [collection.symbol, collection.metadataPath])
    );
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

            const traitDataPromise = fetchJsonWithFallback(metadataPath).then(metadataPayload => {
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
        const searchLeftSlot = document.createElement('div');
        searchLeftSlot.className = 'gallery-search-slot gallery-search-slot--left';
        const searchCenterSlot = document.createElement('div');
        searchCenterSlot.className = 'gallery-search-slot gallery-search-slot--center';
        const searchRightSlot = document.createElement('div');
        searchRightSlot.className = 'gallery-search-slot gallery-search-slot--right';

        if (gridSymbol) {
            let marketplaceLink = grid.previousElementSibling;
            while (marketplaceLink) {
                const href = String(marketplaceLink.getAttribute?.('href') || '').toLowerCase();
                if (marketplaceLink.tagName === 'A' && href.includes(`/marketplace/${gridSymbol}`)) {
                    break;
                }
                marketplaceLink = marketplaceLink.previousElementSibling;
            }

            if (marketplaceLink && marketplaceLink.tagName === 'A') {
                searchLeftSlot.appendChild(marketplaceLink);
            }
        }

        searchCenterSlot.appendChild(input);
        searchRow.appendChild(searchLeftSlot);
        searchRow.appendChild(searchCenterSlot);
        searchRow.appendChild(searchRightSlot);

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
        let loadMoreDisplayBeforeSearch = null;
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

        function getLoadMoreButton() {
            let node = grid.nextElementSibling;
            while (node) {
                if (node.classList && node.classList.contains('load-more-button')) return node;
                node = node.nextElementSibling;
            }
            return null;
        }

        function restoreOriginalGrid() {
            ensureOriginalItems();
            const fragment = document.createDocumentFragment();
            originalItems.forEach(item => fragment.appendChild(item));
            grid.appendChild(fragment);

            if (itemDisplayBeforeSearch) {
                originalItems.forEach(item => {
                    const previousDisplay = itemDisplayBeforeSearch.get(item);
                    item.style.display = previousDisplay === undefined ? '' : previousDisplay;
                });
            }

            resultsGrid.style.display = 'none';
            resultsGrid.replaceChildren();
            grid.style.display = '';

            const loadMoreBtn = getLoadMoreButton();
            if (loadMoreBtn) {
                loadMoreBtn.style.display = loadMoreDisplayBeforeSearch === null ? '' : loadMoreDisplayBeforeSearch;
            }
            loadMoreDisplayBeforeSearch = null;
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

            const loadMoreBtn = getLoadMoreButton();
            if (loadMoreBtn) {
                if (loadMoreDisplayBeforeSearch === null) {
                    loadMoreDisplayBeforeSearch = loadMoreBtn.style.display;
                }
                loadMoreBtn.style.display = 'none';
            }

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

    // Some collections use non-grid layouts (iframe/flex). Keep the marketplace
    // link directly above media by placing stats just above that link.
    ['blokchain-surveillance', 'art-drops'].forEach(collectionSymbol => {
        const statsWindow = document.querySelector(`.collection-stats-window[data-collection-symbol="${collectionSymbol}"]`);
        const marketplaceLink = document.querySelector(`a[href*="/marketplace/${collectionSymbol}"]`);
        if (!statsWindow || !marketplaceLink) return;
        marketplaceLink.insertAdjacentElement('beforebegin', statsWindow);
    });
});
