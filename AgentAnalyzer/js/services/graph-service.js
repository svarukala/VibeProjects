/**
 * Microsoft Graph Service for AgentAnalyzer
 * Handles Microsoft Graph API interactions for deep analysis
 */

import { getSharePointToken, isSignedIn } from '../auth/msal-auth.js';

let graphClient = null;

/**
 * Initializes the Graph client with an access token
 * @returns {Promise<boolean>} True if initialization successful
 */
export async function initializeGraphClient() {
    if (!isSignedIn()) {
        console.warn('User not signed in. Graph client not initialized.');
        return false;
    }

    try {
        const accessToken = await getSharePointToken();
        if (!accessToken) {
            console.error('Failed to get access token');
            return false;
        }

        // Initialize the Graph client with the access token
        graphClient = MicrosoftGraph.Client.init({
            authProvider: (done) => {
                done(null, accessToken);
            }
        });

        return true;
    } catch (error) {
        console.error('Error initializing Graph client:', error);
        return false;
    }
}

/**
 * Gets the Graph client instance
 * @returns {Object|null} The Graph client or null
 */
export function getGraphClient() {
    return graphClient;
}

/**
 * Gets site information from a SharePoint URL
 * @param {string} siteUrl - The SharePoint site URL
 * @returns {Promise<Object|null>} Site information or null
 */
export async function getSiteInfo(siteUrl) {
    if (!graphClient) {
        await initializeGraphClient();
    }

    if (!graphClient) {
        return null;
    }

    try {
        // Parse the URL to extract hostname and site path
        const url = new URL(siteUrl);
        const hostname = url.hostname;
        const sitePath = url.pathname;

        // Get site by URL
        const site = await graphClient
            .api(`/sites/${hostname}:${sitePath}`)
            .get();

        return site;
    } catch (error) {
        console.error('Error getting site info:', error);
        return null;
    }
}

/**
 * Gets a drive (document library) from a site
 * @param {string} siteId - The site ID
 * @param {string} driveName - Optional drive name
 * @returns {Promise<Object|null>} Drive information or null
 */
export async function getDrive(siteId, driveName = null) {
    if (!graphClient) {
        await initializeGraphClient();
    }

    if (!graphClient) {
        return null;
    }

    try {
        if (driveName) {
            // Get specific drive by name
            const drives = await graphClient
                .api(`/sites/${siteId}/drives`)
                .get();

            return drives.value.find(d =>
                d.name.toLowerCase() === driveName.toLowerCase()
            );
        } else {
            // Get default drive
            const drive = await graphClient
                .api(`/sites/${siteId}/drive`)
                .get();

            return drive;
        }
    } catch (error) {
        console.error('Error getting drive:', error);
        return null;
    }
}

/**
 * Lists items in a drive or folder
 * @param {string} driveId - The drive ID
 * @param {string} itemPath - Optional path within the drive
 * @returns {Promise<Array>} Array of drive items
 */
export async function listDriveItems(driveId, itemPath = '') {
    if (!graphClient) {
        await initializeGraphClient();
    }

    if (!graphClient) {
        return [];
    }

    const allItems = [];
    let nextLink = null;

    try {
        let endpoint = `/drives/${driveId}/root/children`;
        if (itemPath) {
            endpoint = `/drives/${driveId}/root:/${itemPath}:/children`;
        }

        do {
            const response = nextLink
                ? await graphClient.api(nextLink).get()
                : await graphClient.api(endpoint).select('id,name,size,file,folder,sensitivityLabel,webUrl').get();

            allItems.push(...response.value);
            nextLink = response['@odata.nextLink'];
        } while (nextLink);

        return allItems;
    } catch (error) {
        console.error('Error listing drive items:', error);
        return [];
    }
}

/**
 * Recursively gets all files from a drive or folder
 * @param {string} driveId - The drive ID
 * @param {string} folderId - Optional folder ID (root if not specified)
 * @param {number} maxDepth - Maximum recursion depth
 * @returns {Promise<Array>} Array of all files
 */
export async function getAllFilesRecursive(driveId, folderId = 'root', maxDepth = 10) {
    if (!graphClient || maxDepth <= 0) {
        return [];
    }

    const allFiles = [];

    try {
        const endpoint = folderId === 'root'
            ? `/drives/${driveId}/root/children`
            : `/drives/${driveId}/items/${folderId}/children`;

        let nextLink = null;

        do {
            const response = nextLink
                ? await graphClient.api(nextLink).get()
                : await graphClient
                    .api(endpoint)
                    .select('id,name,size,file,folder,sensitivityLabel,webUrl')
                    .get();

            for (const item of response.value) {
                if (item.file) {
                    // It's a file
                    allFiles.push({
                        id: item.id,
                        name: item.name,
                        size: item.size || 0,
                        mimeType: item.file.mimeType,
                        sensitivityLabel: item.sensitivityLabel,
                        webUrl: item.webUrl
                    });
                } else if (item.folder) {
                    // It's a folder, recurse into it
                    const subFiles = await getAllFilesRecursive(driveId, item.id, maxDepth - 1);
                    allFiles.push(...subFiles);
                }
            }

            nextLink = response['@odata.nextLink'];
        } while (nextLink);

    } catch (error) {
        console.error('Error getting files recursively:', error);
    }

    return allFiles;
}

/**
 * Gets information about a specific file by URL
 * @param {string} fileUrl - The SharePoint file URL
 * @returns {Promise<Object|null>} File information or null
 */
export async function getFileByUrl(fileUrl) {
    if (!graphClient) {
        await initializeGraphClient();
    }

    if (!graphClient) {
        return null;
    }

    try {
        // Use the shares endpoint to get file by sharing URL
        const encodedUrl = btoa(fileUrl).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        const shareId = `u!${encodedUrl}`;

        const response = await graphClient
            .api(`/shares/${shareId}/driveItem`)
            .select('id,name,size,file,sensitivityLabel,webUrl')
            .get();

        return {
            id: response.id,
            name: response.name,
            size: response.size || 0,
            mimeType: response.file?.mimeType,
            sensitivityLabel: response.sensitivityLabel,
            webUrl: response.webUrl
        };
    } catch (error) {
        console.error('Error getting file by URL:', error);
        return null;
    }
}

/**
 * Gets information about a file by SharePoint IDs
 * @param {string} siteId - The site ID
 * @param {string} driveId - The drive/list ID
 * @param {string} itemId - The item ID
 * @returns {Promise<Object|null>} File information or null
 */
export async function getFileByIds(siteId, driveId, itemId) {
    if (!graphClient) {
        await initializeGraphClient();
    }

    if (!graphClient) {
        return null;
    }

    try {
        const response = await graphClient
            .api(`/sites/${siteId}/drives/${driveId}/items/${itemId}`)
            .select('id,name,size,file,sensitivityLabel,webUrl')
            .get();

        return {
            id: response.id,
            name: response.name,
            size: response.size || 0,
            mimeType: response.file?.mimeType,
            sensitivityLabel: response.sensitivityLabel,
            webUrl: response.webUrl
        };
    } catch (error) {
        console.error('Error getting file by IDs:', error);
        return null;
    }
}

/**
 * Parses a SharePoint URL to extract site and path information
 * @param {string} url - The SharePoint URL
 * @returns {Object} Parsed URL information
 */
export function parseSharePointUrl(url) {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname;
        const pathname = parsed.pathname;

        // Extract site path
        const siteMatch = pathname.match(/\/sites\/([^\/]+)/);
        const siteName = siteMatch ? siteMatch[1] : null;

        // Extract library/folder path
        const pathParts = pathname.split('/').filter(p => p);
        const libraryIndex = pathParts.indexOf('Shared%20Documents') !== -1
            ? pathParts.indexOf('Shared%20Documents')
            : pathParts.indexOf('Documents');

        let libraryPath = '';
        if (libraryIndex !== -1) {
            libraryPath = pathParts.slice(libraryIndex + 1).join('/');
        }

        return {
            hostname,
            siteName,
            siteUrl: siteName ? `https://${hostname}/sites/${siteName}` : null,
            libraryPath: decodeURIComponent(libraryPath),
            isFile: pathname.includes('.') && !pathname.endsWith('/')
        };
    } catch (error) {
        console.error('Error parsing SharePoint URL:', error);
        return null;
    }
}

/**
 * Clears the Graph client
 */
export function clearGraphClient() {
    graphClient = null;
}
