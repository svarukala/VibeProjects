// Function to get the List Title from the current page URL
function getListTitleFromUrl() {
    // This part tries to extract the list title from the URL path.
    // It looks for a part of the path that matches a typical list URL (e.g., /Shared%20Documents/Forms/AllItems.aspx)
    const currentUrl = window.location.pathname;
    const parts = currentUrl.split('/');
    let libraryTitleEncoded = null;

    // A common pattern is that the list name is the segment before 'Forms' or 'AllItems.aspx'
    for (let i = 0; i < parts.length; i++) {
        if (parts[i].toLowerCase() === 'forms' || parts[i].toLowerCase().endsWith('.aspx')) {
            // The library title should be the segment before 'Forms' or the .aspx page
            if (i > 0) {
                // Decode the title for use in the REST API (GetByTitle)
                libraryTitleEncoded = parts[i - 1]; 
            }
            break;
        }
    }

    if (!libraryTitleEncoded) {
        // Fallback for modern pages or other views
        const listQuery = new URLSearchParams(window.location.search).get('List');
        if (listQuery) {
            // If 'List' query parameter exists (contains the List ID/GUID), it's harder to get the title directly.
            // In this common scenario, we'll try to get the title from the page's hidden field, 
            // but for simplicity and reliability in the console, we'll ask the user to provide it if the URL method fails.
            console.error("Could not reliably determine the library title from the URL. You may need to manually provide the list title.");
            return null;
        }
    }
    
    // Attempt to decode the title (e.g., "Shared%20Documents" -> "Shared Documents")
    try {
        return decodeURIComponent(libraryTitleEncoded);
    } catch (e) {
        return libraryTitleEncoded; // Return encoded if decoding fails
    }
}

// Main function to fetch the files
async function getFilesInLibrary() {
    const listTitle = "Documents"; //getListTitleFromUrl();

    if (!listTitle) {
        console.error("Operation aborted. Please ensure you are viewing the document library directly.");
        return;
    }

    const webUrl = _spPageContextInfo ? _spPageContextInfo.webAbsoluteUrl : window.location.origin;

    // REST API URL to get all list items. 
    // $select: specifies which fields to retrieve (FileLeafRef is the file name, FileRef is the server-relative URL)
    // $expand: expands the File object to access its properties.
    // $filter: Filters out folders and only returns files. (FileSystemObjectType eq 0 means a file)
    const restUrl = `${webUrl}/_api/web/lists/getbytitle('${listTitle}')/items?$select=ID,Title,FileLeafRef,FileRef,File/Length,File/Name&` +
                    `$expand=File&$filter=FSObjType eq 0`; 
    
    console.log(`Fetching files from library: ${listTitle}`);
    console.log(`Using REST URL: ${restUrl}`);

    try {
        const response = await fetch(restUrl, {
            headers: {
                // Ensure we get JSON data
                'Accept': 'application/json;odata=nometadata' 
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const files = data.value;

        if (files.length === 0) {
            console.log("No files found in the current library (or query failed to return files).");
            return;
        }

        // Format the output
        const fileDetails = files.map(file => {
            const name = (file.File && file.File.Name) || file.FileLeafRef || '';
            const dot = name.lastIndexOf('.');
            const extension = dot > -1 ? name.slice(dot + 1).toLowerCase() : '';
            return {
            ID: file.ID,
            FileName: file.FileLeafRef,
            ServerRelativeUrl: file.FileRef,
            Size_Bytes: file.File && file.File.Length,
            ExtensionType: extension
            };
        });

        console.log(`\n✅ Found ${fileDetails.length} files in '${listTitle}':\n`);
        console.table(fileDetails);
        
        // Optionally return the array for further use
        return fileDetails;

    } catch (error) {
        console.error("\n❌ Error fetching data:", error);
        console.warn("Check if the list title was correctly identified and if you have permissions.");
    }
}

// Execute the function and store the result in a variable 'LibraryFiles'
// Note: This only gets the first batch (usually 100 items). For large libraries, you'd need pagination.
const LibraryFiles = await getFilesInLibrary();