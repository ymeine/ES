try {
    Push-Location $PSScriptRoot

    uv sync
} finally {
    Pop-Location
}
