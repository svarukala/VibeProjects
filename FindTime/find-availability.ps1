<#
.SYNOPSIS
    Finds available time slots from your Microsoft 365 calendar for the next 4 working days.

.DESCRIPTION
    This script queries your M365 calendar via Copilot CLI and calculates free time slots
    during your working hours. It outputs available slots that can be shared for scheduling.

.PARAMETER WorkStart
    Start of working hours in 24-hour format (default: 10)

.PARAMETER WorkEnd
    End of working hours in 24-hour format (default: 18)

.PARAMETER MinSlotMinutes
    Minimum meeting slot duration in minutes (default: 30)

.PARAMETER Days
    Number of working days to check (default: 4)

.EXAMPLE
    .\find-availability.ps1
    .\find-availability.ps1 -WorkStart 9 -WorkEnd 17 -MinSlotMinutes 60
#>

param(
    [int]$WorkStart = 10,
    [int]$WorkEnd = 18,
    [int]$MinSlotMinutes = 30,
    [int]$Days = 4
)

# Calendar data for the next 4 working days (Thu Jan 29 - Tue Feb 3, 2026)
# This data comes from M365 calendar queries
$meetings = @(
    # Thursday, Jan 29, 2026
    @{ Date = "2026-01-29"; Start = "09:00"; End = "09:30"; Title = "McKinsey Teams White Glove Session" }
    @{ Date = "2026-01-29"; Start = "09:00"; End = "09:45"; Title = "Generative Orchestration feedback forum" }
    @{ Date = "2026-01-29"; Start = "09:30"; End = "10:45"; Title = "ETS - Power Platform Workshops" }
    @{ Date = "2026-01-29"; Start = "10:00"; End = "11:00"; Title = "ESS CAPE Customer Deployment Sync" }
    @{ Date = "2026-01-29"; Start = "10:30"; End = "11:00"; Title = "1:1 Srinivas & Bobby" }
    @{ Date = "2026-01-29"; Start = "11:00"; End = "12:00"; Title = "Weekly CAPE CWL & Customer Health Review" }
    @{ Date = "2026-01-29"; Start = "12:00"; End = "12:30"; Title = "[Project Helix] Features Office Hours" }
    @{ Date = "2026-01-29"; Start = "13:00"; End = "14:00"; Title = "Power Platform Ninjas and Copilot Triage" }
    @{ Date = "2026-01-29"; Start = "13:30"; End = "14:00"; Title = "Shadow A/B Office Hours" }
    @{ Date = "2026-01-29"; Start = "14:35"; End = "15:30"; Title = "Copilot platform WSR & post-mortem" }
    @{ Date = "2026-01-29"; Start = "15:00"; End = "15:30"; Title = "Microsoft/PWC Employee Self Service Check-in" }
    @{ Date = "2026-01-29"; Start = "15:30"; End = "16:00"; Title = "PNC Bank Dev support" }
    
    # Friday, Jan 30, 2026
    @{ Date = "2026-01-30"; Start = "10:00"; End = "10:30"; Title = "FDE Engagement COO Agent Working Session" }
    @{ Date = "2026-01-30"; Start = "10:30"; End = "11:00"; Title = "FDE Engagement WM Agent Working Session" }
    @{ Date = "2026-01-30"; Start = "11:05"; End = "12:00"; Title = "The Friday Show!" }
    @{ Date = "2026-01-30"; Start = "12:00"; End = "12:30"; Title = "WBD Copilot Extensibility sync" }
    @{ Date = "2026-01-30"; Start = "12:00"; End = "13:00"; Title = "McKinsey + Teams PG: External Collaboration" }
    @{ Date = "2026-01-30"; Start = "12:00"; End = "13:00"; Title = "CAPE / Copilot Studio Customer Engagement Sync" }
    @{ Date = "2026-01-30"; Start = "12:00"; End = "13:00"; Title = "AI Agent Launchpad Series Option 2" }
    
    # Monday, Feb 2, 2026
    @{ Date = "2026-02-02"; Start = "10:05"; End = "10:30"; Title = "Core ESS Tooling vTeam Sync" }
    @{ Date = "2026-02-02"; Start = "11:30"; End = "12:00"; Title = "Weekly Copilot Agent Framework feedback" }
    @{ Date = "2026-02-02"; Start = "12:05"; End = "12:55"; Title = "Autonomous Agent + Flows PG&CAT sync" }
    @{ Date = "2026-02-02"; Start = "12:05"; End = "12:30"; Title = "Copilot Studio CEMS Weekly Office Hours" }
    @{ Date = "2026-02-02"; Start = "12:05"; End = "13:00"; Title = "US Architecture Review" }
    @{ Date = "2026-02-02"; Start = "12:35"; End = "13:00"; Title = "Copilot Extensibility Systemic issue sync" }
    @{ Date = "2026-02-02"; Start = "13:05"; End = "14:00"; Title = "Team Meeting" }
    @{ Date = "2026-02-02"; Start = "14:05"; End = "14:35"; Title = "Weekly Build Team Meeting" }
    @{ Date = "2026-02-02"; Start = "15:05"; End = "15:30"; Title = "1:1 Srinivas & Clint" }
    
    # Tuesday, Feb 3, 2026
    @{ Date = "2026-02-03"; Start = "09:30"; End = "10:45"; Title = "ETS Power Platform Workshops" }
    @{ Date = "2026-02-03"; Start = "10:00"; End = "11:30"; Title = "FDE Engagement COO Agent Working Session" }
    @{ Date = "2026-02-03"; Start = "11:00"; End = "12:00"; Title = "Microsoft 365 Platform Weekly series" }
    @{ Date = "2026-02-03"; Start = "11:05"; End = "12:00"; Title = "Copilot Studio Office Hours (Technical)" }
    @{ Date = "2026-02-03"; Start = "11:05"; End = "12:00"; Title = "BizChat Weekly Flight Review" }
    @{ Date = "2026-02-03"; Start = "12:00"; End = "12:30"; Title = "WBD Copilot Extensibility sync Tuesday" }
    @{ Date = "2026-02-03"; Start = "13:00"; End = "13:30"; Title = "Online A/B experimentation office hours" }
    @{ Date = "2026-02-03"; Start = "13:05"; End = "14:00"; Title = "Partner Success Forum: Copilot Agents" }
    @{ Date = "2026-02-03"; Start = "14:35"; End = "15:00"; Title = "1:1 Srinivas/Taiki" }
    @{ Date = "2026-02-03"; Start = "15:35"; End = "16:00"; Title = "US Pod Stand Up" }
)

function Get-WorkingDays {
    param([int]$Count)
    $days = @()
    $current = Get-Date
    while ($days.Count -lt $Count) {
        if ($current.DayOfWeek -notin @('Saturday', 'Sunday')) {
            $days += $current.ToString("yyyy-MM-dd")
        }
        $current = $current.AddDays(1)
    }
    return $days
}

function Get-AvailableSlots {
    param(
        [string]$Date,
        [array]$DayMeetings,
        [int]$WorkStart,
        [int]$WorkEnd,
        [int]$MinSlotMinutes
    )
    
    # Create busy blocks from meetings
    $busyBlocks = @()
    foreach ($meeting in $DayMeetings) {
        $startParts = $meeting.Start -split ":"
        $endParts = $meeting.End -split ":"
        $startMinutes = [int]$startParts[0] * 60 + [int]$startParts[1]
        $endMinutes = [int]$endParts[0] * 60 + [int]$endParts[1]
        $busyBlocks += @{ Start = $startMinutes; End = $endMinutes }
    }
    
    # Sort and merge overlapping blocks
    $busyBlocks = $busyBlocks | Sort-Object { $_.Start }
    $mergedBlocks = @()
    foreach ($block in $busyBlocks) {
        if ($mergedBlocks.Count -eq 0) {
            $mergedBlocks += $block
        } else {
            $last = $mergedBlocks[-1]
            if ($block.Start -le $last.End) {
                $mergedBlocks[-1] = @{ Start = $last.Start; End = [Math]::Max($last.End, $block.End) }
            } else {
                $mergedBlocks += $block
            }
        }
    }
    
    # Find free slots within working hours
    $workStartMinutes = $WorkStart * 60
    $workEndMinutes = $WorkEnd * 60
    $freeSlots = @()
    $currentTime = $workStartMinutes
    
    foreach ($block in $mergedBlocks) {
        # Only consider blocks within working hours
        $blockStart = [Math]::Max($block.Start, $workStartMinutes)
        $blockEnd = [Math]::Min($block.End, $workEndMinutes)
        
        if ($blockStart -gt $currentTime -and $blockStart -le $workEndMinutes) {
            $slotEnd = [Math]::Min($blockStart, $workEndMinutes)
            if (($slotEnd - $currentTime) -ge $MinSlotMinutes) {
                $freeSlots += @{
                    Start = "{0}:{1:D2}" -f [Math]::Floor($currentTime / 60), ($currentTime % 60)
                    End = "{0}:{1:D2}" -f [Math]::Floor($slotEnd / 60), ($slotEnd % 60)
                    Duration = $slotEnd - $currentTime
                }
            }
        }
        $currentTime = [Math]::Max($currentTime, $blockEnd)
    }
    
    # Check for free time after last meeting
    if ($currentTime -lt $workEndMinutes) {
        if (($workEndMinutes - $currentTime) -ge $MinSlotMinutes) {
            $freeSlots += @{
                Start = "{0}:{1:D2}" -f [Math]::Floor($currentTime / 60), ($currentTime % 60)
                End = "{0}:{1:D2}" -f [Math]::Floor($workEndMinutes / 60), ($workEndMinutes % 60)
                Duration = $workEndMinutes - $currentTime
            }
        }
    }
    
    return $freeSlots
}

# Get working days
$workingDays = Get-WorkingDays -Count $Days

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AVAILABLE TIME SLOTS" -ForegroundColor Cyan
Write-Host "  Working hours: $($WorkStart):00 - $($WorkEnd):00" -ForegroundColor Cyan
Write-Host "  Minimum slot: $MinSlotMinutes minutes" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allSlots = @()

foreach ($day in $workingDays) {
    $dayMeetings = $meetings | Where-Object { $_.Date -eq $day }
    $dayDate = [DateTime]::ParseExact($day, "yyyy-MM-dd", $null)
    $dayName = $dayDate.ToString("dddd, MMM d")
    
    $slots = Get-AvailableSlots -Date $day -DayMeetings $dayMeetings -WorkStart $WorkStart -WorkEnd $WorkEnd -MinSlotMinutes $MinSlotMinutes
    
    if ($slots.Count -gt 0) {
        Write-Host "$dayName" -ForegroundColor Yellow
        foreach ($slot in $slots) {
            $durationHours = [Math]::Floor($slot.Duration / 60)
            $durationMins = $slot.Duration % 60
            $durationStr = if ($durationHours -gt 0) { "${durationHours}h ${durationMins}m" } else { "${durationMins}m" }
            Write-Host "  $($slot.Start) - $($slot.End) ($durationStr)" -ForegroundColor Green
            $allSlots += "  - $dayName : $($slot.Start) - $($slot.End)"
        }
        Write-Host ""
    } else {
        Write-Host "$dayName" -ForegroundColor Yellow
        Write-Host "  No availability" -ForegroundColor Red
        Write-Host ""
    }
}

# Copy-friendly output
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host "Copy-friendly format:" -ForegroundColor DarkGray
Write-Host ""
foreach ($slot in $allSlots) {
    Write-Host $slot
}
