Add-Type -AssemblyName System.Drawing
$root = $PSScriptRoot
$srcPath = Join-Path $root "..\public\maskable-icon-512x512.png"
$destPath = Join-Path $root "..\public\maskable-icon-192x192.png"

$src = [System.Drawing.Image]::FromFile($srcPath)
$bmp = New-Object System.Drawing.Bitmap(192, 192)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($src, 0, 0, 192, 192)
$bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
$src.Dispose()
Write-Output "Successfully generated maskable-icon-192x192.png"
