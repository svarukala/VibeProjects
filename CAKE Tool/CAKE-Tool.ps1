#Requires -Modules Microsoft.Graph.Authentication, Microsoft.Graph.Files

<#
.SYNOPSIS
    Copilot Agent Knowledge Evaluator (CAKE) Tool
.DESCRIPTION
    This script authenticates a user to Microsoft 365, and then evaluates a specified SharePoint document library
    to provide statistics about its contents.
.NOTES
    Author: GitHub Copilot
    Date: 22/09/2025
#>

# --- Script Parameters ---
param(
    [string]$clientId = "475caa44-5d62-44ee-9ccb-71fda1c6a0a1",
    [string]$clientSecret = "TBD",
    [string]$tenantId = "144b8c80-398d-405e-8055-fc9a9d5013f8"
)

# --- Helper Functions ---

function Get-FolderItemsRecursive {
    param (
        [Microsoft.Graph.PowerShell.Models.IMicrosoftGraphDriveItem] $folder,
        [string] $driveId,
        [ref]$largeFiles,
        [ref]$emptyFolders
    )

    # Check if folder and required properties are not null
    if (-not $folder -or -not $folder.Id -or ([string]::IsNullOrEmpty($folder.Id)) -or -not $driveId) {
        Write-Warning "Invalid folder or drive ID passed to Get-FolderItemsRecursive"
        return
    }

    try {
        $children = @() # Initialize as empty array
        try {
            $children = @(Get-MgDriveItemChild -DriveId $driveId -DriveItemId $folder.Id -All)
        }
        catch {
            Write-Warning "Could not retrieve children for folder '$($folder.Name)' ($($folder.Id)). Error: $($_.Exception.Message)"
        }

        if ($null -eq $children -or $children.Count -eq 0) {
            $emptyFolders.Value += $folder.WebUrl
        }

        foreach ($child in $children) {
            # Check if child object is valid before processing
            if ($child -and $child.Id) {
                if ($child.Folder) {
                    Get-FolderItemsRecursive -folder $child -driveId $driveId -largeFiles $largeFiles -emptyFolders $emptyFolders
                }
                else {
                    if ($child.Size -gt 20MB) {
                        $largeFiles.Value += [PSCustomObject]@{
                            "File Name"         = $child.Name
                            "File Location"     = $child.WebUrl
                            "Size (MB)"         = [math]::Round($child.Size / 1MB, 2)
                            "File Extension"    = $child.Name.Split('.')[-1]
                        }
                    }
                }
            }
        }
    }
    catch {
        Write-Warning "Error accessing folder '$($folder.Name)': $($_.Exception.Message)"
    }
}

# --- Main Logic ---

# --- Welcome Message ---
Write-Host "Welcome to the Copilot Agent Knowledge Evaluator (CAKE) Tool!"
Write-Host "-----------------------------------------------------------"
Write-Host

# --- Authenticate to Microsoft Graph with app only scopes ---
try {
    Write-Host "Authenticating to Microsoft Graph..."
    # Convert the client secret to a secure string
    $secureClientSecret = ConvertTo-SecureString -String $clientSecret -AsPlainText -Force

    # Create a PSCredential object
    $credential = New-Object System.Management.Automation.PSCredential($clientId, $secureClientSecret)

    # Connect to Microsoft Graph using the client secret credential
    Connect-MgGraph -TenantId $tenantId -ClientSecretCredential $credential
    Write-Host "Successfully signed in to Microsoft 365." -ForegroundColor Green
}
catch {
    Write-Error "Failed to authenticate to Microsoft 365. Please check your credentials and permissions."
    Write-Error $_.Exception.Message
    return
}

# --- Get SharePoint Library Path ---
$libraryUrl = Read-Host -Prompt "Please enter the full URL of the SharePoint library to evaluate"

if (-not ($libraryUrl -like "https://*.sharepoint.com/*")) {
    Write-Error "Invalid SharePoint URL format. Please provide a valid URL (e.g., https://yourtenant.sharepoint.com/sites/yoursite/YourLibrary)."
    Disconnect-MgGraph
    return
}

# --- Process SharePoint Library ---
try {
    Write-Host "Evaluating SharePoint library: $libraryUrl"
    # 0. Remove the trailing slash if present
    if ($libraryUrl.EndsWith('/')) {
        $libraryUrl = $libraryUrl.TrimEnd('/')
    }

    # 1. Parse the URL
    $uri = New-Object System.Uri($libraryUrl)
    $hostname = $uri.Host
    $pathSegments = $uri.AbsolutePath.TrimStart('/').Split('/')

    if ($pathSegments[0] -eq 'sites') {
        $siteRelativePath = "/sites/$($pathSegments[1])"
    } else {
        # Handle root site case
        $siteRelativePath = "/"
    }
    
    $siteUrl = "https://$hostname$siteRelativePath"
    Write-Host "Identified Site URL: $siteUrl"

    # 2. Get Site ID from the parsed URL
    $site = Get-MgSite -SiteId "$($hostname):$($siteRelativePath)"
    
    if($site) {
        # 3. Get all drives (document libraries) in the site
        $drives = Get-MgSiteDrive -SiteId $site.Id
        
        # 4. Find the specific drive that matches the library name from the URL
        $drive = $drives | Where-Object { $_.WebUrl -eq $libraryUrl }

        if ($drive) {
            $libraryName = $drive.Name
            Write-Host "Successfully found library '$libraryName'."
            # Get all items that are not folders (i.e., files)
            $items = Get-MgDriveItem -DriveId $drive.Id -Filter "folder eq null" -All
            $fileCount = $items.Count
            
            Write-Host "--- Library Statistics ---" -ForegroundColor Cyan
            Write-Host "Total number of files: $fileCount"

            $largeFiles = @()
            $emptyFolders = @()

            # Get the root folder
            $rootFolder = Get-MgDriveRoot -DriveId $drive.Id
            
            if ($rootFolder) {
                Get-FolderItemsRecursive -folder $rootFolder -driveId $drive.Id -largeFiles ([ref]$largeFiles) -emptyFolders ([ref]$emptyFolders)
            } else {
                Write-Warning "Could not retrieve root folder for the drive."
            }

            if ($largeFiles.Count -gt 0) {
                $largeFiles | Export-Csv -Path "LargeFiles.csv" -NoTypeInformation
                Write-Host "Found $($largeFiles.Count) files larger than 20MB. Details exported to LargeFiles.csv" -ForegroundColor Green
            }
            else {
                Write-Host "No files larger than 20MB found."
            }

            if ($emptyFolders.Count -gt 0) {
                Write-Host "--- Empty Folders ---" -ForegroundColor Cyan
                $emptyFolders | ForEach-Object { Write-Host $_ }
            }
            else {
                Write-Host "No empty folders found."
            }
        }
        else {
            $libraryNameFromUrl = [System.Net.WebUtility]::UrlDecode($pathSegments[-1])
            Write-Error "Could not find a document library matching URL '$libraryUrl' at the site '$siteUrl'."
            Write-Host "Available libraries: $($drives.Name -join ', ')"
        }
    }
    else {
        Write-Error "Could not find the SharePoint site at '$siteUrl'. Please check the URL and your permissions."
    }
}
catch {
    Write-Error "An error occurred while processing the SharePoint library."
    Write-Error $_.Exception.Message
}
finally {
    # --- Disconnect ---
    Write-Host "Disconnecting from Microsoft Graph."
    Disconnect-MgGraph
}
