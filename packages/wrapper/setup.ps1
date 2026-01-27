try {
    Push-Location $PSScriptRoot

    uv sync
    bun scripts/download
} finally {
    Pop-Location
}
