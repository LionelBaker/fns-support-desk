param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("dbs", "fns", "both")]
    [string]$Brand = "both"
)

Write-Host "Unified Brand Deployment Script" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green

Write-Host "Deploying brand: $Brand" -ForegroundColor Cyan

# Store current branch
$originalBranch = git branch --show-current

if ($Brand -eq "dbs" -or $Brand -eq "both") {
    Write-Host ""
    Write-Host "Building DBS Support Desk..." -ForegroundColor Blue
    
    # Configure to DBS
    node build-brand.js dbs
    
    # Build DBS version
    npm run build:win
    
    Write-Host "DBS Support Desk built successfully" -ForegroundColor Green
}

if ($Brand -eq "fns" -or $Brand -eq "both") {
    Write-Host ""
    Write-Host "Building FNS Support Desk..." -ForegroundColor Green
    
    # Configure to FNS
    node build-brand.js fns
    
    # Build FNS version
    npm run build:win
    
    Write-Host "FNS Support Desk built successfully" -ForegroundColor Green
}

if ($Brand -eq "both") {
    Write-Host ""
    Write-Host "Pushing to both repositories..." -ForegroundColor Yellow
    
    # Try to pull latest changes first
    try {
        git pull origin main --no-edit
    } catch {
        Write-Host "Could not pull from origin, continuing..." -ForegroundColor Yellow
    }
    
    # Add and commit changes
    git add .
    $commitResult = git commit -m "Update: Both brands - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "No changes to commit" -ForegroundColor Yellow
    }
    
    # Push to DBS repository
    try {
        git push origin main
        Write-Host "Pushed to DBS repository" -ForegroundColor Green
    } catch {
        Write-Host "Failed to push to DBS repository" -ForegroundColor Red
    }
    
    # Try to push to FNS repository
    try {
        git push fns-origin main
        Write-Host "Pushed to FNS repository" -ForegroundColor Green
    } catch {
        Write-Host "FNS repository not found or access denied" -ForegroundColor Yellow
        Write-Host "You may need to create the FNS repository first" -ForegroundColor Yellow
    }
    
    Write-Host "Deployment process completed" -ForegroundColor Green
}
elseif ($Brand -eq "dbs") {
    Write-Host ""
    Write-Host "Pushing to DBS repository..." -ForegroundColor Yellow
    
    # Try to pull latest changes first
    try {
        git pull origin main --no-edit
    } catch {
        Write-Host "Could not pull from origin, continuing..." -ForegroundColor Yellow
    }
    
    git add .
    $commitResult = git commit -m "Update: DBS Support Desk - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "No changes to commit" -ForegroundColor Yellow
    }
    
    try {
        git push origin main
        Write-Host "Pushed to DBS repository" -ForegroundColor Green
    } catch {
        Write-Host "Failed to push to DBS repository" -ForegroundColor Red
    }
}
elseif ($Brand -eq "fns") {
    Write-Host ""
    Write-Host "Pushing to FNS repository..." -ForegroundColor Yellow
    
    git add .
    $commitResult = git commit -m "Update: FNS Support Desk - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "No changes to commit" -ForegroundColor Yellow
    }
    
    try {
        git push fns-origin main
        Write-Host "Pushed to FNS repository" -ForegroundColor Green
    } catch {
        Write-Host "FNS repository not found or access denied" -ForegroundColor Yellow
        Write-Host "You may need to create the FNS repository first" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "=======================" -ForegroundColor Green
