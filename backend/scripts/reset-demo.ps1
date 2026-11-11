# Stop the Nexus demo server before resetting the default local demo database.
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
Write-Host 'Demo reset. Start the app with --demo to recreate and seed the database.'
