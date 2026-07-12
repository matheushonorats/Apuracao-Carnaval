$path = "c:\Users\mathe\Desktop\Apuracao\scripts\admin.js"
if (Test-Path $path) {
    $content = Get-Content $path -Raw
    Write-Output "=== DISK FILE CHECK ==="
    Write-Output "Size: $($content.Length)"
    Write-Output "Has setupMediaHandlers: $($content.Contains('setupMediaHandlers'))"
}
else {
    Write-Output "FILE NOT FOUND ON DISK!"
}

Write-Output "`n=== SERVER CHECK (WebClient) ==="
try {
    $wc = New-Object System.Net.WebClient
    $url = "http://localhost:3000/scripts/admin.js?v=2"
    $serverContent = $wc.DownloadString($url)
    Write-Output "Size: $($serverContent.Length)"
    Write-Output "Has setupMediaHandlers: $($serverContent.Contains('setupMediaHandlers'))"
    Write-Output "Has removeImage: $($serverContent.Contains('removeImage'))"
}
catch {
    Write-Output "WebClient Error: $_"
}
