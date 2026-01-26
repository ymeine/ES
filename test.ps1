try {
    Push-Location $PSScriptRoot

    ################################################################################################
    # 
    ################################################################################################

    function _runEs() { xmake run es @args }
    
    function _runOriginalEs($query, [switch] $Fixed) {
        try {
            # xmake build | Out-Null
            # if (!$?) { throw "xmake build failed." }
            
            $path = xmake lua .\get-exe-path.lua es-original
            
            $previous = $PSNativeCommandArgumentPassing
            if ($Fixed) { $PSNativeCommandArgumentPassing = 'Legacy' }
            & $path $query
        } finally {
            $PSNativeCommandArgumentPassing = $previous
        }
        $output
    }
    
    
    ################################################################################################
    # 
    ################################################################################################

    $query = 'folder:endwith:Studios/DOOM/saves'
    $query = 'folder:endwith:"Saved Games/Nightdive Studios/DOOM/saves"'
    $query = 'folder:"folder/with some/spaces"'

    $sep = '-' * 40

    Write-Host $sep
    Write-Host "Fixed"
    _runEs $query
    
    Write-Host $sep
    Write-Host "Original with fix ahead"
    _runOriginalEs $query -Fixed
    
    Write-Host $sep
    Write-Host "Original (not fixed)"
    _runOriginalEs $query
} finally {
    Pop-Location
}
