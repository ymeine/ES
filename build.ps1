try {
    Push-Location $PSScriptRoot

    # WARNING 2026-01-14T10:48:54+01:00@Europe/Paris
    # Entering dev shell, multiple times, will lead to duplicated paths in env vars.
    # This can lead to extremely hard to sport bugs, like xmake not being able to detect Visual
    # Studio anymore for some architectures. Indeed, it runs a generated batch file with statements
    # like `PATH = %PATH%`, and the variable substitution would fail since too long.
    # Error "The input line is too long. The syntax of the command is incorrect."
    # See https://stackoverflow.com/a/64329870/1590196
    function _msbuild {
        Enter-VsDevShell x64
        try {
            Push-Location vs2019
            msbuild
        } finally {
            Pop-Location
        }
    }

    function _xmake {
        xmake build
    }

    # _msbuild
    _xmake
} finally {
    Pop-Location
}
