param(
    [Parameter(Mandatory = $true, HelpMessage = "The URL of the SharePoint document library.")]
    [string]$libraryUrl = "https://m365cpi05184678.sharepoint.com/sites/ProductionDepartment/OrgData",

    [Parameter(Mandatory = $false, HelpMessage = "The output path for the large files CSV.")]
    [string]$outputFile = ".\large_files.csv",

    [Parameter(Mandatory = $false, HelpMessage = "The output path for the empty folders CSV.")]
    [string]$emptyFoldersFile = ".\empty_folders.csv",

    [Parameter(Mandatory = $false, HelpMessage = "The size threshold in MB for large files.")]
    [int]$sizeThresholdMB = 20
)

$clientId = "475caa44-5d62-44ee-9ccb-71fda1c6a0a1"
$clientSecret = "TBD"
$tenantId = "144b8c80-398d-405e-8055-fc9a9d5013f8"
$scopes = "Sites.Read.All"

$uri = New-Object System.Uri($libraryUrl)
$hostname = $uri.Host
$urlSegments = $uri.AbsolutePath.Split("/") | Where-Object { $_ }
$sitePath = "/$($urlSegments[0])/$($urlSegments[1])"
$driveName = [System.Uri]::UnescapeDataString(($urlSegments | Select-Object -Last 1))

# --- Authenticate to Microsoft Graph with app only scopes ---
# Convert the client secret to a secure string
$secureClientSecret = ConvertTo-SecureString -String $clientSecret -AsPlainText -Force

# Create a PSCredential object
$credential = New-Object System.Management.Automation.PSCredential($clientId, $secureClientSecret)

# Connect to Microsoft Graph using the client secret credential
Connect-MgGraph -TenantId $tenantId -ClientSecretCredential $credential

try {
    $siteResource = "$($hostname):$($sitePath)"
    $siteId = (Get-MgSite -SiteId $siteResource -ErrorAction Stop).Id
    $uri = "https://graph.microsoft.com/v1.0/sites/$siteId/drives?`$filter=name eq '$driveName'"
    $driveResponse = Invoke-MgGraphRequest -Uri $uri -Method GET -ErrorAction Stop
    if ($driveResponse.Value.Count -eq 0) {
        Write-Error "No drive with name '$driveName' found in site '$($siteResource)'."
        Disconnect-MgGraph
        return
    }
    $driveId = $driveResponse.Value[0].Id
}
catch {
    Write-Error "Error during site/drive lookup: $($_.Exception.Message)"
    Disconnect-MgGraph
    return
}

$largeFiles = @()
$emptyFolders = @()

function Process-Folder {
    param(
        [string]$driveId,
        [string]$itemId,
        [string]$currentPath
    )
    
    $children = Get-MgDriveItemChild -DriveId $driveId -DriveItemId $itemId -All
    
    if (-not $children) {
        $emptyFolders += New-Object PSObject -Property @{
            FolderPath = $currentPath
        }
        return
    }
    
    $hasFiles = $false
    $childFolders = @()
    
    foreach ($child in $children) {
        if ($child.folder) {
            $childFolders += $child
        }
        elseif ($child.file) {
            $hasFiles = $true
            if ($child.size -gt ($sizeThresholdMB * 1MB)) {
                $extension = [System.IO.Path]::GetExtension($child.name)
                $largeFiles += New-Object PSObject -Property @{
                    FileName = $child.name
                    FilePath = "$currentPath/$($child.name)"
                    SizeMB = [math]::Round($child.size / 1MB, 2)
                    Extension = $extension
                }
            }
        }
    }
    
    if (-not $hasFiles -and -not $childFolders) {
        $emptyFolders += New-Object PSObject -Property @{
            FolderPath = $currentPath
        }
    }
    
    foreach ($childFolder in $childFolders) {
        $newPath = "$currentPath/$($childFolder.name)"
        Process-Folder -driveId $driveId -itemId $childFolder.Id -currentPath $newPath
    }
}

Process-Folder -driveId $driveId -itemId "root" -currentPath ""

if ($largeFiles) {
    $largeFiles | Export-Csv -Path $outputFile -NoTypeInformation
    Write-Host "Found $($largeFiles.Count) files over $($sizeThresholdMB)MB. Exported to '$outputFile'"
} else {
    Write-Host "No files over $($sizeThresholdMB)MB found."
}

if ($emptyFolders) {
    $emptyFolders | Export-Csv -Path $emptyFoldersFile -NoTypeInformation
    Write-Host "Found $($emptyFolders.Count) empty folders. Exported to '$emptyFoldersFile'"
} else {
    Write-Host "No empty folders found."
}

Disconnect-MgGraph
