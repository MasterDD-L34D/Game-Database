$ErrorActionPreference = 'Stop'

$testFiles = @(
  'health.test.js',
  'dashboard.test.js',
  'permissions.test.js',
  'records.test.js',
  'taxonomyRouters.test.js',
  'speciesTraits.test.js',
  'speciesBiomes.test.js',
  'ecosystemBiomes.test.js',
  'ecosystemSpecies.test.js'
)

foreach ($testFile in $testFiles) {
  Write-Host "Running $testFile"
  & node -e "require('./test/$testFile')"
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
