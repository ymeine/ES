try {
    Push-Location $PSScriptRoot

    ################################################################################################
    # 
    ################################################################################################

    $query = 'folder:endwith:Studios/DOOM/saves'
    $query = 'folder:endwith:"Saved Games/Nightdive Studios/DOOM/saves"'

    function _runEsGlobal { es.exe @args }

    function _runEsLocal {
        xmake build | Out-Null
        if (!$?) { throw "xmake build failed." }
        & (xmake lua .\get-exe-path.lua) @args
    }

    # Not working, xmake may escape args itself.
    function _runEsXmake { xmake run es @args }

    function _runEs {
        # _runEsGlobal @args
        # _runEsLocal @args
        _runEsXmake @args
    }
    
    function es {
        try {
            $previous = $PSNativeCommandArgumentPassing
            $PSNativeCommandArgumentPassing = 'Legacy'
            $output = _runEs @args
        } finally {
            $PSNativeCommandArgumentPassing = $previous
        }
        $output
    }



    ################################################################################################
    # 
    ################################################################################################

    # es $query
    _runEs $query
} finally {
    Pop-Location
}
