# Pack dist/site/ into dist/lerna-site-netlify.zip with forward-slash entry names.
#
# Why this exists:
# - Compress-Archive (PS 5.1) and [ZipFile]::CreateFromDirectory() on .NET
#   Framework 4.x write entry paths with backslashes on Windows.
# - Netlify's ZIP extractor treats backslashes as literal characters in
#   filenames, so assets end up at "assets\foo.js" instead of "assets/foo.js"
#   and the asset subdirectory never materializes — every /assets/* URL 404s.
# - This script uses ZipArchive directly and forces forward slashes in entry
#   names, matching the ZIP spec (APPNOTE.TXT 4.4.17.1).

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = Split-Path -Parent $PSScriptRoot
$srcDir = Join-Path $projectRoot 'dist\site'
$dstZip = Join-Path $projectRoot 'dist\lerna-site-netlify.zip'

if (-not (Test-Path $srcDir)) {
  throw "Source directory not found: $srcDir. Run 'npm run build:site' first."
}

if (Test-Path $dstZip) {
  Remove-Item $dstZip -Force
}

$srcFull = (Resolve-Path $srcDir).Path.TrimEnd('\')
$prefixLen = $srcFull.Length + 1

$stream = [System.IO.File]::Open($dstZip, [System.IO.FileMode]::CreateNew)
$archive = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)

try {
  $files = Get-ChildItem -Path $srcFull -Recurse -File
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($prefixLen) -replace '\\', '/'
    $entry = $archive.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal)
    $inStream = [System.IO.File]::OpenRead($file.FullName)
    $outStream = $entry.Open()
    try {
      $inStream.CopyTo($outStream)
    } finally {
      $outStream.Dispose()
      $inStream.Dispose()
    }
    Write-Host ("  added {0}" -f $relative)
  }
} finally {
  $archive.Dispose()
  $stream.Dispose()
}

$zipInfo = Get-Item $dstZip
Write-Host ("")
Write-Host ("Packed {0} file(s) -> {1} ({2:N0} bytes)" -f $files.Count, $dstZip, $zipInfo.Length)
