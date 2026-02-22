document.addEventListener("DOMContentLoaded", function() {
  const numLines = 10;
  const container = document.body;
  
  for (let i = 0; i < numLines; i++) {
      let line = document.createElement('div');
      line.className = 'animated-line';
      container.appendChild(line);
      animateLine(line, i * 2000);
  }
  
  function animateLine(line, delay) {
      setTimeout(() => {
          line.style.top = `${Math.random() * 100}vh`;
          line.style.left = `${Math.random() * 100}vw`;
          line.style.animation = 'moveLine 5s linear infinite';
      }, delay);
  }
    const collectionStatsSearchApi = 'https://api-mainnet.magiceden.dev/collection_stats/search/bitcoin';
    const collectionStatsByIdApi = 'https://api-mainnet.magiceden.dev/collection_stats/stats?chain=bitcoin&collectionId=';
    const corsProxyBase = 'https://api.allorigins.win/raw?url=';

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

    const metadataNameAliases = {
        'palindrome-punks': {
            'punk rocker': 'rocker'
        },
        'art-drops': {
            'moon boi': 'lunatic',
            'life is a beach': 'beach'
        }
    };

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
        const maxFractionDigits = parsed >= 1 ? 2 : 4;
        return `${parsed.toLocaleString('en-US', { maximumFractionDigits: maxFractionDigits })} BTC`;
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
        statsStatus.textContent = message;
        statsStatus.classList.toggle('is-error', Boolean(isError));
    }

    function setUpdated(statsWindow, message) {
        const statsUpdated = statsWindow.querySelector('.collection-stats-updated');
        if (statsUpdated) statsUpdated.textContent = message;
    }

    function buildProxiedUrl(url) {
        return `${corsProxyBase}${encodeURIComponent(url)}`;
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

    function downloadUpscaledJpegFromImage(img, fileNameBase) {
        if (!img) return;

        const performDownload = function() {
            const sourceWidth = img.naturalWidth || img.width;
            const sourceHeight = img.naturalHeight || img.height;
            if (!sourceWidth || !sourceHeight) return;

            const upscaleFactor = 4;
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

    function createWalletResultCard(match) {
        const resultCard = document.createElement('div');
        resultCard.className = 'gallery-item';

        const isBlokchainPreview = match.collectionSymbol === 'blokchain-surveillance';
        let image = null;

        if (isBlokchainPreview) {
            const frameCrop = document.createElement('div');
            frameCrop.className = 'wallet-blokchain-frame-crop';

            const frame = document.createElement('iframe');
            frame.className = 'wallet-blokchain-frame';
            frame.loading = 'lazy';
            frame.src = './Blokchain/index_blokchain.html';
            frame.title = match.displayName || 'Blokchain Surveillance Preview';
            frame.tabIndex = -1;
            frame.setAttribute('aria-hidden', 'true');
            frameCrop.appendChild(frame);

            resultCard.appendChild(frameCrop);
        } else {
            image = document.createElement('img');
            image.loading = 'lazy';
            image.src = match.imageSrc;
            image.alt = match.imageAlt || match.displayName;
            resultCard.appendChild(image);
        }

        const titleFooter = document.createElement('div');
        titleFooter.className = 'image-title';
        titleFooter.textContent = match.displayName || match.inscriptionId;
        resultCard.appendChild(titleFooter);

        const downloadButton = document.createElement('button');
        downloadButton.type = 'button';
        downloadButton.className = 'download-button';
        downloadButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v10.17l3.59-3.58L17 11l-5 5-5-5 1.41-1.41L11 13.17V3h1zm-7 14h14v2H5v-2z"></path></svg>';

        if (isBlokchainPreview) {
            downloadButton.setAttribute('aria-label', 'Download HTML file');
            downloadButton.addEventListener('click', event => {
                event.stopPropagation();
                downloadFileAsset('./Blokchain/index_blokchain.html', 'index_blokchain.html');
            });
        } else if (image) {
            downloadButton.setAttribute('aria-label', 'Download upscaled JPEG');
            downloadButton.addEventListener('click', event => {
                event.stopPropagation();
                downloadUpscaledJpegFromImage(image, match.displayName || match.inscriptionId);
            });
        }

        resultCard.appendChild(downloadButton);

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

    function resolveMetadataAlias(collectionSymbol, name) {
        const normalized = normalizeWalletText(name);
        const collectionAliases = metadataNameAliases[collectionSymbol] || {};
        return collectionAliases[normalized] || name;
    }

    function resolveMetadataImage(collection, metadataEntry, imageLookup) {
        const metadataName = String(metadataEntry?.meta?.name || '').trim();
        const editionNumber = extractEditionNumber(metadataName);
        if (editionNumber && imageLookup.byNumber.has(editionNumber)) {
            return imageLookup.byNumber.get(editionNumber);
        }

        const aliasedName = resolveMetadataAlias(collection.symbol, metadataName);
        const candidateKeys = Array.from(new Set([
            ...getNameCandidates(aliasedName),
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

    async function fetchOrdJsonOrThrow(endpoint, requestLabel) {
        let response;

        try {
            response = await fetch(endpoint, {
                headers: { Accept: 'application/json' }
            });
        } catch (error) {
            const requestError = new Error(`Could not reach ord node for ${requestLabel}. Check ord node URL and browser/network access.`);
            requestError.status = 0;
            requestError.endpoint = endpoint;
            requestError.requestLabel = requestLabel;
            throw requestError;
        }

        if (!response.ok) {
            let responseText = '';
            try {
                responseText = await response.text();
            } catch (error) {
                responseText = '';
            }

            const normalizedText = String(responseText || '').toLowerCase();
            if (normalizedText.includes('index-addresses') || normalizedText.includes('address index')) {
                const requestError = new Error('Ord node address index is not enabled. Start ord with --index-addresses.');
                requestError.status = response.status;
                requestError.endpoint = endpoint;
                requestError.requestLabel = requestLabel;
                requestError.responseText = responseText;
                throw requestError;
            }
            if (response.status === 404 && normalizedText.includes('file not found')) {
                const requestError = new Error('Ord node URL points to a static file server. Set ord node URL to your ord HTTP server (for example: http://127.0.0.1:80).');
                requestError.status = response.status;
                requestError.endpoint = endpoint;
                requestError.requestLabel = requestLabel;
                requestError.responseText = responseText;
                throw requestError;
            }
            if (response.status === 404 && requestLabel === 'address') {
                const requestError = new Error('Ord node address endpoint was not found. Confirm ord node URL and ensure your ord version supports GET /address/<ADDRESS>.');
                requestError.status = response.status;
                requestError.endpoint = endpoint;
                requestError.requestLabel = requestLabel;
                requestError.responseText = responseText;
                throw requestError;
            }

            const condensedText = String(responseText || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 180);
            const detail = condensedText ? ` ${condensedText}` : '';
            const requestError = new Error(`Ord node ${requestLabel} request failed (${response.status}).${detail}`);
            requestError.status = response.status;
            requestError.endpoint = endpoint;
            requestError.requestLabel = requestLabel;
            requestError.responseText = responseText;
            throw requestError;
        }

        try {
            return await response.json();
        } catch (error) {
            const requestError = new Error(`Ord node ${requestLabel} endpoint did not return JSON.`);
            requestError.status = response.status;
            requestError.endpoint = endpoint;
            requestError.requestLabel = requestLabel;
            throw requestError;
        }
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
                try {
                    const probeResponse = await fetch(probeEndpoint, { method: 'GET' });
                    if (probeResponse.ok) {
                        return { reachable: true, endpoint: probeEndpoint };
                    }
                } catch (error) {
                    continue;
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

        const shouldTryOutputsFallback = Boolean(addressError && Number(addressError.status) === 404)
            || Boolean(!addressError && inscriptionIds.length === 0 && Array.isArray(payload?.outputs));

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

        metadataEntries.forEach((entry, index) => {
            const inscriptionId = normalizeInscriptionId(entry?.id);
            if (!inscriptionId) return;

            const displayName = String(entry?.meta?.name || `${collection.name} #${index + 1}`).trim();
            const resolvedImage = resolveMetadataImage(collection, entry, imageLookup);
            const imageSrc = resolvedImage?.src || collection.fallbackImageSrc || '';
            if (!imageSrc) return;

            byInscriptionId.set(inscriptionId, {
                collectionSymbol: collection.symbol,
                collectionName: collection.name,
                inscriptionId,
                displayName,
                imageSrc,
                imageAlt: resolvedImage?.alt || displayName,
                editionNumber: extractEditionNumber(displayName)
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
        const walletSearchStatus = document.getElementById('wallet-search-status');
        const walletSearchResults = document.getElementById('wallet-search-results');

        if (!walletSearchForm || !walletSearchInput || !walletSearchStatus || !walletSearchResults) return;
        const ordNodeBase = defaultOrdNodeApiBase;

        let walletIndexPromise = null;
        let autoSearchTimer = null;
        let searchSequence = 0;

        const resetWalletResults = function() {
            walletSearchResults.hidden = true;
            walletSearchResults.replaceChildren();
        };

        const setOrdNodeStatus = function() {
            if (ordNodeBase) {
                setWalletStatus(walletSearchStatus, `Using ord node: ${ordNodeBase}.`, false);
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
                resetWalletResults();
                setWalletStatus(walletSearchStatus, 'Ord node URL is not configured. Set data-ord-node-base on the <body> element.', true);
                return;
            }

            const currentAddress = String(address || '').trim();
            const currentSearchSequence = ++searchSequence;
            resetWalletResults();
            setWalletStatus(walletSearchStatus, `Checking ${ordNodeBase}/address/${currentAddress} and cross-referencing metadata...`, false);

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
            }
        };

        setOrdNodeStatus();

        walletSearchInput.addEventListener('input', () => {
            const address = walletSearchInput.value.trim();

            if (autoSearchTimer) {
                clearTimeout(autoSearchTimer);
                autoSearchTimer = null;
            }

            if (!address) {
                searchSequence += 1;
                resetWalletResults();
                setOrdNodeStatus();
                return;
            }

            if (!isValidBitcoinAddress(address)) {
                searchSequence += 1;
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
                resetWalletResults();
                setOrdNodeStatus();
                return;
            }
            if (!isValidBitcoinAddress(address)) {
                searchSequence += 1;
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
            floorPrice: rawStats.fp ?? rawStats.fpListingPrice,
            volume24h: rawStats.vol,
            totalVolume: rawStats.totalVol,
            listedCount: rawStats.listedCount,
            ownerCount: rawStats.ownerCount,
            totalSupply: rawStats.totalSupply
        };
    }

    function mapCollectionStatsById(rawStats) {
        if (!rawStats || typeof rawStats !== 'object') return null;

        return {
            source: 'Magic Eden collection stats API',
            floorPrice: rawStats.floorPrice?.native ?? satsToBtc(rawStats.floorPrice?.amount),
            volume24h: satsToBtc(rawStats.volume24hr ?? rawStats.volume24h),
            totalVolume: satsToBtc(rawStats.totalVol),
            listedCount: rawStats.listedCount,
            ownerCount: rawStats.ownerCount,
            totalSupply: rawStats.tokenCount ?? rawStats.totalSupply ?? rawStats.supply
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

    function findCollectionStatsInPayload(searchPayload, collectionSymbol) {
        if (!Array.isArray(searchPayload)) return null;
        return searchPayload.find(item => {
            const symbol = String(item?.collectionSymbol || '').toLowerCase();
            const collectionId = String(item?.collectionId || '').toLowerCase();
            return symbol === collectionSymbol || collectionId === collectionSymbol;
        }) || null;
    }

    async function refreshCollectionStats(statsWindow, sharedSearchPayload) {
        const collectionSymbol = String(statsWindow.dataset.collectionSymbol || '').trim().toLowerCase();
        if (!collectionSymbol) return;

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

            const matchedStats = findCollectionStatsInPayload(searchPayload, collectionSymbol);
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
            setStatus(statsWindow, `Live data from ${mappedStats.source}`, false);
        } catch (error) {
            clearStats(statsWindow);
            setUpdated(statsWindow, 'Update failed');
            setStatus(statsWindow, 'Unable to load collection stats right now.', true);
            console.error(`Collection stats load failed (${collectionSymbol}):`, error);
        } finally {
            if (statsRefresh) statsRefresh.disabled = false;
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
        });

        let allCollectionStatsRefreshInProgress = false;

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
        setInterval(refreshAllCollectionStats, 5 * 60 * 1000);
    }

    initializeWalletSearch();

    // Gallery-grid search: inject an <input> before each grid.
    // Matching results are moved below the search bar while searching.
document.querySelectorAll('.gallery-grid').forEach(grid => {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Search by Collection ID';
        input.className = 'gallery-search';

        const gridSymbol = String(grid.dataset.collectionSymbol || '').trim().toLowerCase();
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
        grid.parentNode.insertBefore(searchRow, grid);

        const resultsGrid = document.createElement('div');
        resultsGrid.className = 'gallery-grid gallery-search-results';
        resultsGrid.style.display = 'none';
        grid.parentNode.insertBefore(resultsGrid, grid);

        if (gridSymbol) {
            const linkedStatsWindow = document.querySelector(`.collection-stats-window[data-collection-symbol="${gridSymbol}"]`);
            if (linkedStatsWindow) {
                searchRow.insertAdjacentElement('beforebegin', linkedStatsWindow);
                linkedStatsWindow.classList.remove('collection-stats-window--hero');
            }
        }

        let originalItems = null;
        let loadMoreDisplayBeforeSearch = null;
        let itemDisplayBeforeSearch = null;

        function getGalleryItems() {
            const wrappedItems = Array.from(grid.querySelectorAll('.gallery-item'));
            if (wrappedItems.length > 0) return wrappedItems;
            return Array.from(grid.querySelectorAll('img'));
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

        function normalizeCollectionId(value) {
            const normalized = String(value || '').trim().toLowerCase();
            if (/^\d+$/.test(normalized)) {
                return String(parseInt(normalized, 10));
            }
            return normalized;
        }

        function itemMatchesQuery(item, normalizedQuery) {
            const img = getImageFromItem(item);
            if (!img) return false;
            const src = img.getAttribute('src') || '';
            const name = src.split('/').pop().toLowerCase();
            const collectionId = name.split('?')[0].replace(/\.[^.]+$/, '');
            return normalizeCollectionId(collectionId) === normalizedQuery;
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

        input.addEventListener('input', () => {
            const q = input.value.trim().toLowerCase();
            if (!q) {
                restoreOriginalGrid();
                return;
            }
            const normalizedQuery = normalizeCollectionId(q);

            ensureOriginalItems();
            const fragment = document.createDocumentFragment();

            if (!itemDisplayBeforeSearch) {
                itemDisplayBeforeSearch = new Map();
                originalItems.forEach(item => {
                    itemDisplayBeforeSearch.set(item, item.style.display);
                });
            }

            originalItems.forEach(item => {
                if (itemMatchesQuery(item, normalizedQuery)) {
                    item.style.display = '';
                    fragment.appendChild(item);
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
        });
    });

    // Some collections use non-grid layouts (iframe/flex). Keep the marketplace
    // link directly above media by placing stats just above that link.
    ['blokchain-surveillance', 'art-drops'].forEach(collectionSymbol => {
        const statsWindow = document.querySelector(`.collection-stats-window[data-collection-symbol="${collectionSymbol}"]`);
        const marketplaceLink = document.querySelector(`a[href*="/marketplace/${collectionSymbol}"]`);
        if (!statsWindow || !marketplaceLink) return;
        marketplaceLink.insertAdjacentElement('beforebegin', statsWindow);
        statsWindow.classList.remove('collection-stats-window--hero');
    });
});
