
# Bazaarche Project Exporter
# Exports source code and project structure into one Markdown file.
# Run this script from your project root.

$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$OutputName = "bazaarche-project-context.md"
$OutputPath = Join-Path $Root $OutputName

# Directories that should not be exported
$ExcludedDirectories = @(
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    ".next",
    ".nuxt",
    "dist",
    "build",
    "coverage",
    ".cache",
    ".turbo",
    "vendor",
    "tmp",
    "temp",
    "logs",
    "__pycache__"
)

# Sensitive filenames and patterns
$ExcludedFiles = @(
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    ".npmrc",
    ".pypirc",
    "id_rsa",
    "id_ed25519",
    "credentials",
    "secrets.json",
    "service-account.json",
    "config.local.json"
)

# Binary / generated files that are not useful as source text
$ExcludedExtensions = @(
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
    ".mp4", ".mp3", ".wav", ".avi", ".mov",
    ".pdf", ".zip", ".rar", ".7z", ".tar", ".gz",
    ".exe", ".dll", ".so", ".bin", ".dat",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".sqlite", ".db", ".class", ".jar", ".pyc",
    ".lock"
)

# Maximum size per text file: 300 KB
$MaxFileBytes = 300KB

$Utf8 = New-Object System.Text.UTF8Encoding($false)
$Builder = New-Object System.Text.StringBuilder

$IncludedCount = 0
$SkippedCount = 0
$TotalBytes = 0

Write-Host ""
Write-Host "Scanning project: $Root" -ForegroundColor Cyan
Write-Host "Preparing AI context file..." -ForegroundColor Cyan

# Collect files, excluding unwanted directories.
$Files = @(
    Get-ChildItem -LiteralPath $Root -File -Recurse -Force |
    Where-Object {
        $File = $_
        $Relative = $File.FullName.Substring($Root.Length).
            TrimStart([char[]]@('\', '/'))
        $Parts = $Relative -split '[\\/]'

        $BadDirectory = $false
        foreach ($Part in $Parts[0..([Math]::Max(0, $Parts.Length - 2))]) {
            if ($ExcludedDirectories -contains $Part) {
                $BadDirectory = $true
                break
            }
        }

        $IsOutput = ($File.FullName -eq $OutputPath)
        $BadDirectory -eq $false -and -not $IsOutput
    } |
    Sort-Object FullName
)

# Build the folder tree from discovered files.
[void]$Builder.AppendLine("# Bazaarche Project Context")
[void]$Builder.AppendLine("")
[void]$Builder.AppendLine("> Generated automatically. Review this file before sharing.")
[void]$Builder.AppendLine("")
[void]$Builder.AppendLine("## Project information")
[void]$Builder.AppendLine("")
[void]$Builder.AppendLine("- Root directory: ``$Root``")
[void]$Builder.AppendLine("- Files discovered: $($Files.Count)")
[void]$Builder.AppendLine("")
[void]$Builder.AppendLine("## Project file tree")
[void]$Builder.AppendLine("")
[void]$Builder.AppendLine('```text')
[void]$Builder.AppendLine((Split-Path $Root -Leaf) + "/")

$TreePaths = @(
    $Files | ForEach-Object {
        $_.FullName.Substring($Root.Length).
            TrimStart([char[]]@('\', '/')).Replace('\', '/')
    }
)

foreach ($Path in $TreePaths) {
    [void]$Builder.AppendLine("  $Path")
}

[void]$Builder.AppendLine('```')
[void]$Builder.AppendLine("")
[void]$Builder.AppendLine("## Source files")
[void]$Builder.AppendLine("")

foreach ($File in $Files) {
    $Relative = $File.FullName.Substring($Root.Length).
        TrimStart([char[]]@('\', '/')).Replace('\', '/')

    $Name = $File.Name
    $Extension = $File.Extension.ToLowerInvariant()

    # Skip credentials and environment files.
    if ($ExcludedFiles -contains $Name -or
        $Name -match '(?i)(secret|credential|private[-_]?key|token)' -or
        $Name -match '(?i)^\.env($|\.)') {
        $SkippedCount++
        continue
    }

    # Skip binary and generated files.
    if ($ExcludedExtensions -contains $Extension) {
        $SkippedCount++
        continue
    }

    # Skip oversized files.
    if ($File.Length -gt $MaxFileBytes) {
        [void]$Builder.AppendLine("### $Relative")
        [void]$Builder.AppendLine("")
        [void]$Builder.AppendLine(
            "> Skipped: file exceeds 300 KB ($($File.Length) bytes)."
        )
        [void]$Builder.AppendLine("")
        $SkippedCount++
        continue
    }

    try {
        $Content = [System.IO.File]::ReadAllText(
            $File.FullName,
            [System.Text.Encoding]::UTF8
        )

        # Avoid accidentally embedding binary content.
        if ($Content.IndexOf([char]0) -ge 0) {
            $SkippedCount++
            continue
        }

        # Select a Markdown code fence that does not collide with content.
        $Fence = '```'
        while ($Content.Contains($Fence)) {
            $Fence += '`'
        }

        [void]$Builder.AppendLine("### File: $Relative")
        [void]$Builder.AppendLine("")
        [void]$Builder.AppendLine($Fence + $Extension)
        [void]$Builder.AppendLine($Content)
        [void]$Builder.AppendLine($Fence)
        [void]$Builder.AppendLine("")

        $IncludedCount++
        $TotalBytes += $File.Length
        Write-Host "Included: $Relative" -ForegroundColor DarkGray
    }
    catch {
        $SkippedCount++
        Write-Warning "Could not read: $Relative"
    }
}

# Add an index of important files when present.
[void]$Builder.AppendLine("## Export summary")
[void]$Builder.AppendLine("")
[void]$Builder.AppendLine("- Included text files: $IncludedCount")
[void]$Builder.AppendLine("- Skipped files: $SkippedCount")
[void]$Builder.AppendLine("- Included source size: $TotalBytes bytes")
[void]$Builder.AppendLine("")
[void]$Builder.AppendLine(
    "Note: excluded files may be required to run the project. " +
    "This document is for source-code review, not a runnable backup."
)

[System.IO.File]::WriteAllText(
    $OutputPath,
    $Builder.ToString(),
    $Utf8
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Export completed!" -ForegroundColor Green
Write-Host "Output: $OutputPath" -ForegroundColor Yellow
Write-Host "Included: $IncludedCount files" -ForegroundColor Green
Write-Host "Skipped: $SkippedCount files" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
