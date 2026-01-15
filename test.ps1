try {
    Push-Location $PSScriptRoot

    ################################################################################################
    # 
    ################################################################################################

    $query = 'folder:endwith:Studios/DOOM/saves'
    $query = 'folder:endwith:"Saved Games/Nightdive Studios/DOOM/saves"'

    # function _runEs { es.exe @args }
    function _runEs { & (xmake lua .\get-exe-path.lua) @args }

    # Not working, xmake may escape args itself.
    # function _runEs { xmake run es @args }
    
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

    es $query
} finally {
    Pop-Location
}
