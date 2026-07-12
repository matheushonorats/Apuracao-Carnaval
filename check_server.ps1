$r = Invoke-WebRequest -Uri 'http://localhost:3000/scripts/admin.js?v=2' -UseBasicParsing -TimeoutSec 5
$c = $r.Content
Write-Output "=== Admin.js check ==="
Write-Output "File length: $($c.Length)"
Write-Output "Has _renderImagePreview: $($c.Contains('_renderImagePreview'))"
Write-Output "Has removeImage: $($c.Contains('removeImage'))"
Write-Output "Has logoLeft: $($c.Contains('logoLeft'))"
Write-Output "Has setupMediaHandlers: $($c.Contains('setupMediaHandlers'))"
Write-Output "Has window.adminPanel: $($c.Contains('window.adminPanel'))"

$idx = $c.IndexOf('setupMediaHandlers')
if ($idx -ge 0) {
    $end = [Math]::Min($idx + 300, $c.Length)
    Write-Output "`n=== setupMediaHandlers content ==="
    Write-Output $c.Substring($idx, $end - $idx)
}
