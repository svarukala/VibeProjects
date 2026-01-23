// Function to get the List Title from the current page URL
function getListTitleFromUrl() {
    const currentUrl = window.location.pathname;
    const parts = currentUrl.split('/');
    let libraryTitleEncoded = null;

    for (let i = 0; i < parts.length; i++) {
        if (parts[i].toLowerCase() === 'forms' || parts[i].toLowerCase().endsWith('.aspx')) {
            if (i > 0) {
                libraryTitleEncoded = parts[i - 1]; 
            }
            break;
        }
    }
    
    // Fallback for getting the title, though the above is usually reliable on a document library view.
    if (!libraryTitleEncoded && new URLSearchParams(window.location.search).get('List')) {
        console.error("Could not reliably determine the library title from the URL path.");
        return null;
    }

    try {
        return decodeURIComponent(libraryTitleEncoded);
    } catch (e) {
        return libraryTitleEncoded;
    }
}

// Main function to fetch all files with pagination
async function getAllFilesInLibrary() {
    const listTitle = "Documents"; //getListTitleFromUrl();

    if (!listTitle) {
        console.error("Operation aborted. Could not determine the library title.");
        return;
    }

    const webUrl = _spPageContextInfo ? _spPageContextInfo.webAbsoluteUrl : window.location.origin;
    const initialRestUrl = `${webUrl}/_api/web/lists/getbytitle('${listTitle}')/items?` +
                           `$select=ID,Title,FileLeafRef,FileRef,File/Length,File/Name&` +
                           `$expand=File&$filter=FSObjType eq 0&` +
                           `$top=500`; // Request up to 500 items per batch (SharePoint default max is often 100, but PnP uses 500/2000 for large list mode)
    
    let allFiles = [];
    let nextLink = initialRestUrl;
    let page = 1;
    let totalFilesFetched = 0;

    console.log(`Starting fetch from library: ${listTitle}`);

    do {
        console.log(`\nFetching batch ${page}...`);
        
        try {
            const response = await fetch(nextLink, {
                headers: {
                    'Accept': 'application/json;odata=verbose' // Use 'odata=verbose' to ensure __next property is returned
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const results = data.d.results;
            
            allFiles.push(...results);
            totalFilesFetched += results.length;
            
            // Check for the __next property to get the link for the next batch (pagination)
            nextLink = data.d.__next; 
            page++;
            console.log(`Fetched ${results.length} items. Total: ${totalFilesFetched}`);

        } catch (error) {
            console.error("\n❌ Error fetching data:", error);
            break; 
        }

    } while (nextLink); // The loop continues as long as a nextLink (pagination token) is present

    if (allFiles.length === 0) {
        console.log("No files found in the current library.");
        return;
    }

    // Format the output
    const fileDetails = allFiles.map(file => {
        const name = (file.File && file.File.Name) || file.FileLeafRef || '';
        const dot = name.lastIndexOf('.');
        const extension = dot > -1 ? name.slice(dot + 1).toLowerCase() : '';
        return {
        ID: file.ID,
        FileName: file.FileLeafRef,
        ServerRelativeUrl: file.FileRef,
        Size_MB: Number((file.File.Length / (1024 * 1024)).toFixed(2)),
        ExtensionType: extension
        };
    });

    console.log(`\n======================================================`);
    console.log(`✅ COMPLETE: Found a total of ${fileDetails.length} files in '${listTitle}'`);
    console.log(`======================================================\n`);
    
    console.table(fileDetails);
    
    // Return the array for use in the console
    return fileDetails;
}

// Function to export data to CSV and trigger download
function exportToCsv(data, fileNamePrefix = 'export') {
    if (!Array.isArray(data) || data.length === 0) {
        console.warn('No data to export to CSV.');
        return;
    }

    const keys = Object.keys(data[0]);

    const escapeCsv = (val) => {
        if (val === null || val === undefined) return '';
        const s = String(val);
        if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };

    const rows = [];
    rows.push(keys.map(k => escapeCsv(k)).join(',')); // Header row
    for (const item of data) {
        rows.push(keys.map(k => escapeCsv(item[k])).join(','));
    }

    const csvContent = '\uFEFF' + rows.join('\r\n'); // BOM for Excel compatibility
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const fileName = `${fileNamePrefix}_${new Date().toISOString().slice(0,10)}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);

    console.log(`CSV export started: ${fileName}`);
}

// Execute the function and store the complete result in a variable 'AllLibraryFiles'
const AllLibraryFiles = await getAllFilesInLibrary();

// Call the export function with the fetched data
exportToCsv(AllLibraryFiles, 'AllLibraryFiles');




/*
if (!Array.isArray(AllLibraryFiles) || AllLibraryFiles.length === 0) {
    console.warn('No data to export to CSV.');
} else {
    const keys = Object.keys(AllLibraryFiles[0]);

    const escapeCsv = (val) => {
        if (val === null || val === undefined) return '';
        const s = String(val);
        if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    };

    const rows = [];
    rows.push(keys.map(k => escapeCsv(k)).join(','));
    for (const item of AllLibraryFiles) {
        rows.push(keys.map(k => escapeCsv(item[k])).join(','));
    }

    const csvContent = '\uFEFF' + rows.join('\r\n'); // BOM for Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const fileName = `AllLibraryFiles_${new Date().toISOString().slice(0,10)}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);

    console.log(`CSV export started: ${fileName}`);
}
*/