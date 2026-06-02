Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$Public = Join-Path $Root 'public'

function New-Color([string] $hex) {
  return [System.Drawing.ColorTranslator]::FromHtml($hex)
}

function New-Bitmap([int] $width, [int] $height) {
  $bitmap = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bitmap.SetResolution(96, 96)
  return $bitmap
}

function New-Pen([string] $color, [float] $width) {
  $pen = New-Object System.Drawing.Pen (New-Color $color), $width
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Flat
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Flat
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Miter
  return $pen
}

function Draw-BrandIcon([System.Drawing.Graphics] $g, [int] $size, [bool] $compact) {
  $g.Clear((New-Color '#020713'))
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

  $stroke = if ($compact) { [Math]::Max(3, [Math]::Round($size * 0.14)) } else { [Math]::Max(8, [Math]::Round($size * 0.105)) }
  $pen = New-Pen '#ffffff' $stroke

  try {
    $left = [Math]::Round($size * 0.15)
    $right1 = [Math]::Round($size * 0.63)
    $right2 = [Math]::Round($size * 0.56)
    $right3 = [Math]::Round($size * 0.48)
    $y1 = [Math]::Round($size * 0.24)
    $y2 = [Math]::Round($size * 0.37)
    $y3 = [Math]::Round($size * 0.50)
    $bottom = [Math]::Round($size * 0.82)

    $g.DrawLine($pen, $left, $y1, $right1, $y1)
    $g.DrawLine($pen, $left, $y2, $right2, $y2)
    if (-not $compact) {
      $g.DrawLine($pen, $left, $y3, $right3, $y3)
    }

    $g.DrawLine($pen, [Math]::Round($size * 0.30), $y3, [Math]::Round($size * 0.30), $bottom)
    if (-not $compact) {
      $g.DrawLine($pen, [Math]::Round($size * 0.43), $y3, [Math]::Round($size * 0.43), $bottom)
    }

    $cx = [Math]::Round($size * 0.80)
    $cy = [Math]::Round($size * 0.52)
    $outerRadius = [Math]::Round($size * 0.31)
    $innerRadius = [Math]::Round($size * 0.19)

    $g.DrawArc($pen, $cx - $outerRadius, $cy - $outerRadius, $outerRadius * 2, $outerRadius * 2, 88, 184)
    if (-not $compact) {
      $g.DrawArc($pen, $cx - $innerRadius, $cy - $innerRadius, $innerRadius * 2, $innerRadius * 2, 88, 184)
    }
  } finally {
    $pen.Dispose()
  }
}

function Save-IconPng([string] $relativePath, [int] $size) {
  $bitmap = New-Bitmap $size $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    Draw-BrandIcon $graphics $size ($size -le 32)
    $bitmap.Save((Join-Path $Public $relativePath), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Save-OgImage {
  $bitmap = New-Bitmap 1200 630
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $background = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
      [System.Drawing.RectangleF]::new(0, 0, 1200, 630),
      (New-Color '#020713'),
      (New-Color '#081d2f'),
      [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
    )
    $graphics.FillRectangle($background, 0, 0, 1200, 630)
    $background.Dispose()

    $gridPen = New-Pen '#123652' 1
    try {
      for ($x = 80; $x -lt 1200; $x += 80) { $graphics.DrawLine($gridPen, $x, 0, $x, 630) }
      for ($y = 70; $y -lt 630; $y += 70) { $graphics.DrawLine($gridPen, 0, $y, 1200, $y) }
    } finally {
      $gridPen.Dispose()
    }

    $logoBitmap = New-Bitmap 260 260
    $logoGraphics = [System.Drawing.Graphics]::FromImage($logoBitmap)
    try {
      Draw-BrandIcon $logoGraphics 260 $false
    } finally {
      $logoGraphics.Dispose()
    }
    $graphics.DrawImage($logoBitmap, 105, 165, 260, 260)
    $logoBitmap.Dispose()

    $white = New-Object System.Drawing.SolidBrush (New-Color '#ffffff')
    $muted = New-Object System.Drawing.SolidBrush (New-Color '#a9bed0')
    $accent = New-Object System.Drawing.SolidBrush (New-Color '#2dd4bf')
    $pixelUnit = [System.Drawing.GraphicsUnit]::Pixel
    $titleFont = New-Object System.Drawing.Font 'Arial', 86, ([System.Drawing.FontStyle]::Bold), $pixelUnit
    $bodyFont = New-Object System.Drawing.Font 'Arial', 34, ([System.Drawing.FontStyle]::Regular), $pixelUnit
    $tagFont = New-Object System.Drawing.Font 'Arial', 28, ([System.Drawing.FontStyle]::Bold), $pixelUnit
    try {
      $graphics.DrawString('TradingCore', $titleFont, $white, 420, 205)
      $graphics.DrawString('TC Chart Signal Operations', $bodyFont, $muted, 426, 310)
      $graphics.FillRectangle($accent, 426, 380, 230, 6)
      $graphics.DrawString('Real-time algorithmic trading signals', $tagFont, $white, 426, 414)
    } finally {
      $white.Dispose()
      $muted.Dispose()
      $accent.Dispose()
      $titleFont.Dispose()
      $bodyFont.Dispose()
      $tagFont.Dispose()
    }

    $bitmap.Save((Join-Path $Public 'og-image.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Save-Ico([string] $relativePath, [string[]] $pngPaths) {
  $streams = @()
  try {
    foreach ($path in $pngPaths) {
      $streams += ,[System.IO.File]::ReadAllBytes((Join-Path $Public $path))
    }

    $output = New-Object System.IO.MemoryStream
    $writer = New-Object System.IO.BinaryWriter $output
    try {
      $writer.Write([UInt16]0)
      $writer.Write([UInt16]1)
      $writer.Write([UInt16]$streams.Count)

      $offset = 6 + (16 * $streams.Count)
      foreach ($bytes in $streams) {
        $width = [System.Net.IPAddress]::NetworkToHostOrder([System.BitConverter]::ToInt32($bytes, 16))
        $height = [System.Net.IPAddress]::NetworkToHostOrder([System.BitConverter]::ToInt32($bytes, 20))
        $icoWidth = $width
        $icoHeight = $height
        if ($icoWidth -ge 256) { $icoWidth = 0 }
        if ($icoHeight -ge 256) { $icoHeight = 0 }
        $writer.Write([Byte]$icoWidth)
        $writer.Write([Byte]$icoHeight)
        $writer.Write([Byte]0)
        $writer.Write([Byte]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]32)
        $writer.Write([UInt32]$bytes.Length)
        $writer.Write([UInt32]$offset)
        $offset += $bytes.Length
      }

      foreach ($bytes in $streams) {
        $writer.Write($bytes)
      }
      [System.IO.File]::WriteAllBytes((Join-Path $Public $relativePath), $output.ToArray())
    } finally {
      $writer.Dispose()
      $output.Dispose()
    }
  } finally {
    $streams = @()
  }
}

Save-IconPng 'favicon-16x16.png' 16
Save-IconPng 'favicon-32x32.png' 32
Save-IconPng 'apple-touch-icon.png' 180
Save-IconPng 'android-chrome-192x192.png' 192
Save-IconPng 'android-chrome-512x512.png' 512
Save-OgImage
Save-Ico 'favicon.ico' @('favicon-16x16.png', 'favicon-32x32.png')

Write-Host 'Generated TradingCore brand image assets.'
