# SharePointLibraryAnalyzer.ps1
# Microsoft Graph PowerShell script for analyzing SharePoint Online library contents

param(
    [Parameter(Mandatory=$true, HelpMessage="SharePoint Online library URL (e.g., https://contoso.sharepoint.com/sites/SiteName/Shared%20Documents)")]
    [string]$LibraryUrl,

    [Parameter(Mandatory=$false, HelpMessage="Output CSV file path (default: SharePointLibraryAnalysis.csv)")]
    [string]$OutputPath = "SharePointLibraryAnalysis.csv",

    [Parameter(Mandatory=$false, HelpMessage="Maximum recursion depth (default: 10)")]
    [int]$MaxDepth = 10
)

# Import Microsoft Graph module
Import-Module Microsoft.Graph

# Set up client credentials with placeholders
[string]$clientId = "475caa44-5d62-44ee-9ccb-71fda1c6a0a1"
[string]$clientSecret = "TBD"
[string]$tenantId = "144b8c80-398d-405e-8055-fc9a9d5013f8"

# Create secure client secret
$secureClientSecret = ConvertTo-SecureString -String $clientSecret -AsPlainText -Force

# Create credential object
$credential = New-Object System.Management.Automation.PSCredential -ArgumentList $clientId, $secureClientSecret

# Connect to Microsoft Graph using client credentials
Write-Host "Connecting to Microsoft Graph..." -ForegroundColor Yellow
Connect-MgGraph -ClientSecretCredential $credential -TenantId $tenantId

# Verify connection
Write-Host "Connected to Microsoft Graph successfully!" -ForegroundColor Green

# Parse SharePoint URL to extract components
function Parse-SharePointUrl {
    param([string]$Url)

    try {
        if ($Url.EndsWith('/')) {
            $Url = $Url.TrimEnd('/')
        }

        $uri = [System.Uri]$Url
        $hostParts = $uri.Host.Split('.')
        $hostname = $uri.Host
        $pathSegments = $uri.AbsolutePath.TrimStart('/').Split('/')
        if ($pathSegments[0] -eq 'sites') {
            $siteRelativePath = "/sites/$($pathSegments[1])"
        } else {
            # Handle root site case
            $siteRelativePath = "/"
        }

        if ($hostParts.Length -ge 2) {
            $tenantName = $hostParts[0]
            $sitePath = $uri.AbsolutePath.TrimStart('/')

            # Handle different URL formats
            if ($sitePath -like "sites/*") {
                $sitePath = $sitePath.Substring(6) # Remove 'sites/' prefix
            }

            $siteName = $sitePath.Split('/')[0]
            $libraryPath = $sitePath.Substring($siteName.Length + 1)

            return @{
                TenantName = $tenantName
                SiteName = $siteName
                LibraryPath = $libraryPath
                FullSiteUrl = "https://$($tenantName).sharepoint.com/sites/$siteName"
                HostName = $hostname
                SiteRelativePath = $siteRelativePath
            }
        } else {
            throw "Invalid SharePoint URL format"
        }
    } catch {
        throw "Error parsing SharePoint URL: $($_.Exception.Message)"
    }
}

# Get folder contents recursively
function Get-FolderContents {
    param(
        [string]$SiteId,
        [string]$DriveId,
        [string]$FolderPath = "",
        [string]$ParentPath = "",
        [int]$CurrentDepth = 0
    )

    if ($CurrentDepth -gt $MaxDepth) {
        Write-Warning "Maximum recursion depth ($MaxDepth) reached for path: $ParentPath/$FolderPath"
        return @()
    }

    try {
        $items = @()

        # Construct the API path
        $apiPath = ""
        if ($FolderPath) {
            $apiPath = "/drives/$DriveId/root:${FolderPath}:/children"
        } else {
            $apiPath = "/drives/$DriveId/root/children"
        }

        Write-Host "Calling API: https://graph.microsoft.com/v1.0/sites/$SiteId$apiPath" -ForegroundColor Red
        $response = Invoke-MgGraphRequest -Method GET -Uri "https://graph.microsoft.com/v1.0/sites/$SiteId$apiPath" -OutputType PSObject

        foreach ($item in $response.value) {
            $relativePath = if ($ParentPath) { "$ParentPath/$($item.name)" } else { $item.name }

            if ($item.folder) {
                # This is a folder
                $folderContents = Get-FolderContents -SiteId $SiteId -DriveId $DriveId -FolderPath $relativePath -ParentPath $ParentPath -CurrentDepth ($CurrentDepth + 1)
                $items += $folderContents

                # Add folder info
                $fileCount = ($folderContents | Where-Object { $_.Type -eq "File" }).Count
                $items += [PSCustomObject]@{
                    Type = "Folder"
                    Name = $item.name
                    Extension = ""
                    Size = ""
                    FullPath = $relativePath
                    FileCount = $fileCount
                }
            } else {
                # This is a file
                $items += [PSCustomObject]@{
                    Type = "File"
                    Name = $item.name
                    Extension = if ($item.name.Contains('.')) { $item.name.Split('.')[-1] } else { "" }
                    Size = $item.size
                    FullPath = $relativePath
                    FileCount = ""
                }
            }
        }

        return $items
    } catch {
        Write-Warning "Error accessing folder '$FolderPath': $($_.Exception.Message)"
        return @()
    }
}

# Main execution
try {
    # Parse the SharePoint URL
    Write-Host "Parsing SharePoint library URL..." -ForegroundColor Yellow
    $urlInfo = Parse-SharePointUrl -Url $LibraryUrl

    Write-Host "Tenant: $($urlInfo.TenantName)" -ForegroundColor Cyan
    Write-Host "Site: $($urlInfo.SiteName)" -ForegroundColor Cyan
    Write-Host "Library Path: $($urlInfo.LibraryPath)" -ForegroundColor Cyan

    # Get site information
    Write-Host "Getting site information..." -ForegroundColor Yellow
    $site = Get-MgSite -SiteId "$($urlInfo.HostName):$($urlInfo.SiteRelativePath)"
    #$site = Get-MgSite -Search "*$($urlInfo.SiteName)*" | Where-Object { $_.DisplayName -eq $urlInfo.SiteName }

    if (-not $site) {
        throw "Site '$($urlInfo.SiteName)' not found"
    }

    $siteId = $site.Id
    Write-Host "Found site: $($site.DisplayName) ($siteId)" -ForegroundColor Green

    # Get drive information
    Write-Host "Getting drive information..." -ForegroundColor Yellow
    $drives = Get-MgSiteDrive -SiteId $siteId
    $libraryDrive = $drives | Where-Object { $_.Name -eq $urlInfo.LibraryPath -or $_.Name -eq "Documents" -or $_.Name -eq "Shared Documents" }

    if (-not $libraryDrive) {
        throw "Library '$($urlInfo.LibraryPath)' not found in site"
    }

    $driveId = $libraryDrive.Id
    Write-Host "Found library drive: $($libraryDrive.Name) ($driveId)" -ForegroundColor Green

    # Get library contents recursively
    Write-Host "Analyzing library contents recursively..." -ForegroundColor Yellow
    Write-Host "This may take some time depending on the size of your library." -ForegroundColor Yellow

    $allItems = Get-FolderContents -SiteId $siteId -DriveId $driveId

    # Export to CSV
    Write-Host "Exporting results to CSV..." -ForegroundColor Yellow
    $allItems | Export-Csv -Path $OutputPath -NoTypeInformation -Encoding UTF8

    Write-Host "Analysis complete!" -ForegroundColor Green
    Write-Host "Total items found: $($allItems.Count)" -ForegroundColor Green
    Write-Host "Files: $(($allItems | Where-Object { $_.Type -eq 'File' }).Count)" -ForegroundColor Green
    Write-Host "Folders: $(($allItems | Where-Object { $_.Type -eq 'Folder' }).Count)" -ForegroundColor Green
    Write-Host "Results saved to: $OutputPath" -ForegroundColor Green

} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "StackTrace: $($_.ScriptStackTrace)" -ForegroundColor Red
    exit 1
}

# Disconnect when done
Disconnect-MgGraph
Write-Host "Script completed successfully!" -ForegroundColor Green
