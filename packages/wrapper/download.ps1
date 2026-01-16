try {
    Push-Location $PSScriptRoot

    $repo = 'voidtools/ES'
    $rootCache = '.cache/es'

    $archName = (Get-CimInstance Win32_operatingsystem).OSArchitecture
    if ($archName -eq '64-bit') {
        $arch = 'x64'
    } elseif ($archName -eq '32-bit') {
        $arch = 'x86'
    } else {
        throw "Unsupported architecture: $archName"
    }

    function _withGh() {
        $root = git rev-parse --show-toplevel
    
        $fieldsRelease = 'createdAt,isDraft,isImmutable,isLatest,isPrerelease,name,publishedAt,tagName'
        
        $latestVersion = Get-Content "$root/Changes.txt" | Select-String -Pattern 'Version (.*)' | Select-Object -First 1 | ForEach-Object {
            $_.Matches[0].Groups[1].Value
        }
    
        $releases = gh release -R $repo list --json $fieldsRelease | ConvertFrom-Json
        $release = $releases | Where-Object { $_.tagName -eq $latestVersion }
    
        $fieldsReleaseInfo = 'apiUrl,assets,author,body,createdAt,databaseId,id,isDraft,isImmutable,isPrerelease,name,publishedAt,tagName,tarballUrl,targetCommitish,uploadUrl,url,zipballUrl'
        $info = gh release view $release.tagName -R $repo --json $fieldsReleaseInfo | ConvertFrom-Json
    
        $expectedAssetName = "ES-$($release.tagName).$arch.zip"
    
        $asset = $info.assets | Where-Object { $_.name -eq $expectedAssetName }
        $targetPath = "$rootCache/$($asset.name)"
        if (Test-Path $targetPath) {
            Write-Host "ES for $arch already downloaded."
        } else {
            gh release download $release.tagName -R $repo --pattern $asset.name --output $targetPath
        }
    
        Expand-Archive -Path $targetPath -DestinationPath "$rootCache" -Force
    }

    function _withUbi() {
        ubi --project $repo --matching-regex ".*$arch.*" --rename-exe 'es.exe' --in "$rootCache"
    }

    # _withGh
    _withUbi
} finally {
    Pop-Location
}
