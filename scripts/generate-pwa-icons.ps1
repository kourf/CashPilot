Add-Type -AssemblyName System.Drawing

function Generate-Icon([int]$size, [string]$path, [bool]$maskable) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Dark background #020617 (slate-950)
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 2, 6, 23))
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    # Gradient emblem
    $margin = if ($maskable) { [int]($size * 0.16) } else { [int]($size * 0.08) }
    $emblemSize = $size - (2 * $margin)
    $rect = New-Object System.Drawing.Rectangle $margin, $margin, $emblemSize, $emblemSize

    # Rounded rectangle path
    $c1 = [System.Drawing.Color]::FromArgb(255, 6, 182, 212) # cyan-500
    $c2 = [System.Drawing.Color]::FromArgb(255, 99, 102, 241) # indigo-500
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45.0)

    $radius = [int]($emblemSize * 0.22)
    $pathObj = New-Object System.Drawing.Drawing2D.GraphicsPath
    $pathObj.AddArc($rect.X, $rect.Y, $radius * 2, $radius * 2, 180, 90)
    $pathObj.AddArc($rect.Right - ($radius * 2), $rect.Y, $radius * 2, $radius * 2, 270, 90)
    $pathObj.AddArc($rect.Right - ($radius * 2), $rect.Bottom - ($radius * 2), $radius * 2, $radius * 2, 0, 90)
    $pathObj.AddArc($rect.X, $rect.Bottom - ($radius * 2), $radius * 2, $radius * 2, 90, 90)
    $pathObj.CloseFigure()

    $g.FillPath($gradBrush, $pathObj)

    # Clean text symbol
    $fontFamily = New-Object System.Drawing.FontFamily('Arial')
    $font = New-Object System.Drawing.Font($fontFamily, [float]($emblemSize * 0.40), [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center

    $g.DrawString('CP', $font, $textBrush, [System.Drawing.RectangleF]::new($rect.X, $rect.Y, $rect.Width, $rect.Height), $format)

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated $path"
}

Generate-Icon 192 "public/pwa-192x192.png" $false
Generate-Icon 512 "public/pwa-512x512.png" $false
Generate-Icon 512 "public/maskable-icon-512x512.png" $true
Generate-Icon 180 "public/apple-touch-icon.png" $false
