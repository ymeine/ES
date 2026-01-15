try {
    Push-Location $PSScriptRoot

    bun tsx scripts/build
} finally {
    Pop-Location
}
