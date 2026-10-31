Add-Type -AssemblyName System.Drawing

# 1. Screenshot Mobile (540 x 960)
$bmpMobile = New-Object System.Drawing.Bitmap 540, 960
$gM = [System.Drawing.Graphics]::FromImage($bmpMobile)
$gM.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# Background dark slate-950
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 2, 6, 23))
$gM.FillRectangle($bgBrush, 0, 0, 540, 960)

# Header Bar
$headerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
$gM.FillRectangle($headerBrush, 0, 0, 540, 70)
$cyanPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 6, 182, 212), 2)
$gM.DrawLine($cyanPen, 0, 70, 540, 70)

# Title
$titleFont = New-Object System.Drawing.Font('Arial', 18, [System.Drawing.FontStyle]::Bold)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$gM.DrawString("CashPilot PRO", $titleFont, $textBrush, 24, 22)

# Card Solde
$cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
$gM.FillRectangle($cardBrush, 24, 95, 492, 170)
$cardBorderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 56, 189, 248), 1.5)
$gM.DrawRectangle($cardBorderPen, 24, 95, 492, 170)

$labelFont = New-Object System.Drawing.Font('Arial', 11, [System.Drawing.FontStyle]::Regular)
$grayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 148, 163, 184))
$gM.DrawString("RESTE A VIVRE AUDITE", $labelFont, $grayBrush, 45, 115)

$amountFont = New-Object System.Drawing.Font('Arial', 32, [System.Drawing.FontStyle]::Bold)
$emeraldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 52, 211, 153))
$gM.DrawString("4 850,20 EUR", $amountFont, $emeraldBrush, 45, 145)

$badgeFont = New-Object System.Drawing.Font('Arial', 11, [System.Drawing.FontStyle]::Bold)
$gM.DrawString("Rapprochement bancaire certifie 0 EUR", $badgeFont, $grayBrush, 45, 215)

# Card Comparateur Tickets
$gM.FillRectangle($cardBrush, 24, 285, 492, 200)
$gM.DrawRectangle($cardBorderPen, 24, 285, 492, 200)
$gM.DrawString("COMPARATEUR MULTI-ENSEIGNES", $labelFont, $grayBrush, 45, 305)

$ticketFont = New-Object System.Drawing.Font('Arial', 16, [System.Drawing.FontStyle]::Bold)
$cyanBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 56, 189, 248))
$gM.DrawString("Economie Panier : -28% d'ecart", $ticketFont, $cyanBrush, 45, 335)

$descFont = New-Object System.Drawing.Font('Arial', 13, [System.Drawing.FontStyle]::Regular)
$gM.DrawString("E.Leclerc vs Super U : -14,80 EUR optimises", $descFont, $textBrush, 45, 380)
$gM.DrawString("Detection doublons & promotions validee", $descFont, $grayBrush, 45, 420)

# Card Coach IA
$gM.FillRectangle($cardBrush, 24, 505, 492, 200)
$gM.DrawRectangle($cardBorderPen, 24, 505, 492, 200)
$gM.DrawString("COACH IA BUDGET 24/7", $labelFont, $grayBrush, 45, 525)
$gM.DrawString("Rapport d'audit intelligent", $ticketFont, $textBrush, 45, 555)
$gM.DrawString("Regle 50/30/20 respectee a 100%", $descFont, $emeraldBrush, 45, 600)
$gM.DrawString("Capacite d'epargne projetee : 950 EUR", $descFont, $grayBrush, 45, 640)

# Footer CTA
$ctaGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle 24, 820, 492, 65),
    [System.Drawing.Color]::FromArgb(255, 6, 182, 212),
    [System.Drawing.Color]::FromArgb(255, 99, 102, 241),
    0.0
)
$gM.FillRectangle($ctaGrad, 24, 820, 492, 65)
$ctaFont = New-Object System.Drawing.Font('Arial', 16, [System.Drawing.FontStyle]::Bold)
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$gM.DrawString("Ouvrir mon Cockpit Financier", $ctaFont, $textBrush, (New-Object System.Drawing.RectangleF 24, 820, 492, 65), $sf)

$bmpMobile.Save("public/screenshot-mobile.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gM.Dispose()
$bmpMobile.Dispose()
Write-Host "Generated public/screenshot-mobile.png"

# 2. Screenshot Desktop (1280 x 720)
$bmpDesk = New-Object System.Drawing.Bitmap 1280, 720
$gD = [System.Drawing.Graphics]::FromImage($bmpDesk)
$gD.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# Background dark
$gD.FillRectangle($bgBrush, 0, 0, 1280, 720)

# Sidebar
$sidebarBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 10, 15, 30))
$gD.FillRectangle($sidebarBrush, 0, 0, 260, 720)
$gD.DrawLine($cyanPen, 260, 0, 260, 720)
$gD.DrawString("CashPilot PRO", $titleFont, $textBrush, 30, 30)

$navFont = New-Object System.Drawing.Font('Arial', 13, [System.Drawing.FontStyle]::Bold)
$gD.DrawString("Cockpit", $navFont, $cyanBrush, 40, 100)
$gD.DrawString("Releves Bancaires", $navFont, $grayBrush, 40, 150)
$gD.DrawString("Tickets de Caisse", $navFont, $grayBrush, 40, 200)
$gD.DrawString("Coach IA", $navFont, $grayBrush, 40, 250)
$gD.DrawString("Parametres", $navFont, $grayBrush, 40, 300)

# Main Content
$gD.DrawString("Tableau de Bord Financier & Audit 2026", (New-Object System.Drawing.Font('Arial', 24, [System.Drawing.FontStyle]::Bold)), $textBrush, 300, 30)

# Metric 1
$gD.FillRectangle($cardBrush, 300, 90, 290, 140)
$gD.DrawRectangle($cardBorderPen, 300, 90, 290, 140)
$gD.DrawString("SOLDE RAPPROCHE", $labelFont, $grayBrush, 320, 110)
$gD.DrawString("4 850,20 EUR", (New-Object System.Drawing.Font('Arial', 24, [System.Drawing.FontStyle]::Bold)), $emeraldBrush, 320, 140)

# Metric 2
$gD.FillRectangle($cardBrush, 620, 90, 290, 140)
$gD.DrawRectangle($cardBorderPen, 620, 90, 290, 140)
$gD.DrawString("ECONOMIES COURSES", $labelFont, $grayBrush, 640, 110)
$gD.DrawString("-148,50 EUR", (New-Object System.Drawing.Font('Arial', 24, [System.Drawing.FontStyle]::Bold)), $cyanBrush, 640, 140)

# Metric 3
$gD.FillRectangle($cardBrush, 940, 90, 290, 140)
$gD.DrawRectangle($cardBorderPen, 940, 90, 290, 140)
$gD.DrawString("TAUX D'EPARGNE", $labelFont, $grayBrush, 960, 110)
$gD.DrawString("28.4 %", (New-Object System.Drawing.Font('Arial', 24, [System.Drawing.FontStyle]::Bold)), $textBrush, 960, 140)

# Big chart card
$gD.FillRectangle($cardBrush, 300, 260, 930, 420)
$gD.DrawRectangle($cardBorderPen, 300, 260, 930, 420)
$gD.DrawString("Frise Chronologique des Flux & Comparateur Multi-Enseignes", (New-Object System.Drawing.Font('Arial', 16, [System.Drawing.FontStyle]::Bold)), $textBrush, 330, 290)

$bmpDesk.Save("public/screenshot-desktop.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gD.Dispose()
$bmpDesk.Dispose()
Write-Host "Generated public/screenshot-desktop.png"
