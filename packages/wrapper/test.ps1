try {
    Push-Location $PSScriptRoot

    bun tsx scripts/run
} finally {
    Pop-Location
}
