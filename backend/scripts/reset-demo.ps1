# Stop the Nexus demo server before resetting the default local demo database and uploaded demo documents.
$ErrorActionPreference = 'Stop'
$project = Join-Path (Split-Path -Parent $PSScriptRoot) 'Nexus.Api'
foreach ($filename in @('demo.db', 'demo.db-wal', 'demo.db-shm')) {
    $target = Join-Path $project $filename
    if (Test-Path -LiteralPath $target -PathType Leaf) {
        $resolved = (Resolve-Path -LiteralPath $target).ProviderPath
        if ((Split-Path -Parent $resolved) -ne $project) {
            throw "Demo database path is outside the project."
        }
        Remove-Item -LiteralPath $resolved
    }
}

# Remove uploaded document files while explicitly preserving data\demo-keys.
$docsDir = Join-Path $project 'data\documents'
if (Test-Path -LiteralPath $docsDir -PathType Container) {
    $resolvedDocs = (Resolve-Path -LiteralPath $docsDir).ProviderPath
    $resolvedProject = (Resolve-Path -LiteralPath $project).ProviderPath
    if (-not $resolvedDocs.StartsWith($resolvedProject, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Documents directory path is outside the project."
    }
    Get-ChildItem -LiteralPath $resolvedDocs -Force | ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Recurse -Force
    }
}

# Clean up any leftover smoke-* isolated test folders under backend\data.
$backendDataDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'data'
if (Test-Path -LiteralPath $backendDataDir -PathType Container) {
    $resolvedData = (Resolve-Path -LiteralPath $backendDataDir).ProviderPath
    Get-ChildItem -LiteralPath $resolvedData -Filter 'smoke-*' -Directory -Force | ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Recurse -Force
    }
}

Write-Host 'Demo reset. Start the app with --demo to recreate and seed the database.'
