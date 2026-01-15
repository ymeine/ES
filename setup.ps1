param(
	[switch] $SkipSetupScripts
)

try {
	Push-Location $PSScriptRoot

	mise trust --all
	mise install --yes

	bun install
	if (-not $SkipSetupScripts) {
		bun --filter '*' setup
	}
} finally {
	Pop-Location
}
