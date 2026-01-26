try {
    Push-Location $PSScriptRoot

    xmake build
} finally {
    Pop-Location
}
