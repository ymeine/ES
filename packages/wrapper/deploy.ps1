try {
    Push-Location $PSScriptRoot

    # XXX 2026-01-19T09:52:44+01:00@Europe/Paris
    # Bun has YET another compatibility issue. It will always discard the explicit Content-Length
    # header when passing a stream for the body. That does not make sense, and fails with GitHub
    # API.
    # bun scripts/deploy

    bun tsx scripts/deploy
    # bun tsx --inspect-brk scripts/deploy
} finally {
    Pop-Location
}
