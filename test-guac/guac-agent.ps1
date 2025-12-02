# Guacamole Windows Agent
# Monitors Shared Drive (\\tsclient\GuacamoleShare) for commands from the browser client

$watchDir = "\\tsclient\GuacamoleShare"
$downloadDir = "\\tsclient\GuacamoleShare\Download"
$desktopDir = [Environment]::GetFolderPath("Desktop")
$logPrefix = "[GUAC-AGENT]"

Write-Host "$logPrefix Starting agent..."
Write-Host "$logPrefix Watch Dir: $watchDir"
Write-Host "$logPrefix Desktop Dir: $desktopDir"

# Ensure Download directory exists
if (!(Test-Path -Path $downloadDir)) {
    New-Item -ItemType Directory -Path $downloadDir | Out-Null
}

while ($true) {
    # Check for CMD_LIST.txt (Request File List)
    if (Test-Path "$watchDir\CMD_LIST.txt") {
        Write-Host "$logPrefix Received LIST command"
        
        try {
            # Get files from Desktop
            $files = Get-ChildItem -Path $desktopDir -File | Select-Object Name, Length, LastWriteTime
            
            # Convert to JSON
            $json = $files | ConvertTo-Json -Compress
            
            # Write to Download folder (triggers client download)
            $json | Set-Content -Path "$downloadDir\file-list.json"
            
            Write-Host "$logPrefix Sent file list"
            
            # Clean up command file
            Remove-Item "$watchDir\CMD_LIST.txt" -Force
        }
        catch {
            Write-Error "$logPrefix Error processing LIST command: $_"
        }
    }

    # Check for CMD_DOWNLOAD.txt (Request File Download)
    if (Test-Path "$watchDir\CMD_DOWNLOAD.txt") {
        Write-Host "$logPrefix Received DOWNLOAD command"
        
        try {
            # Read filename from command file
            $filename = Get-Content "$watchDir\CMD_DOWNLOAD.txt" -Raw
            $filename = $filename.Trim()
            
            $sourcePath = Join-Path $desktopDir $filename
            
            if (Test-Path $sourcePath) {
                # Copy to Download folder
                Copy-Item -Path $sourcePath -Destination $downloadDir -Force
                Write-Host "$logPrefix Sent file: $filename"
            }
            else {
                Write-Warning "$logPrefix File not found: $filename"
            }
            
            # Clean up command file
            Remove-Item "$watchDir\CMD_DOWNLOAD.txt" -Force
        }
        catch {
            Write-Error "$logPrefix Error processing DOWNLOAD command: $_"
        }
    }

    Start-Sleep -Milliseconds 500
}
