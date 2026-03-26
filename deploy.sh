#!/bin/bash

echo "🚀 Unified Brand Deployment Script"
echo "=================================="

# Get brand from command line argument
BRAND=${1:-"both"}

echo "📦 Deploying brand: $BRAND"

if [ "$BRAND" = "dbs" ] || [ "$BRAND" = "both" ]; then
    echo ""
    echo "🔵 Building DBS Support Desk..."
    
    # Configure to DBS
    node build-brand.js dbs
    
    # Build DBS version
    npm run build:win
    
    echo "✅ DBS Support Desk built successfully"
    
    if [ "$BRAND" = "dbs" ]; then
        echo "📤 Pushing to DBS repository..."
        git add .
        git commit -m "Update: DBS Support Desk - $(date)" || echo "No changes to commit"
        git push origin main
        echo "✅ Pushed to DBS repository"
    fi
fi

if [ "$BRAND" = "fns" ] || [ "$BRAND" = "both" ]; then
    echo ""
    echo "🟢 Building FNS Support Desk..."
    
    # Configure to FNS
    node build-brand.js fns
    
    # Build FNS version
    npm run build:win
    
    echo "✅ FNS Support Desk built successfully"
    
    if [ "$BRAND" = "fns" ]; then
        echo "📤 Pushing to FNS repository..."
        git add .
        git commit -m "Update: FNS Support Desk - $(date)" || echo "No changes to commit"
        git push fns-origin main
        echo "✅ Pushed to FNS repository"
    fi
fi

if [ "$BRAND" = "both" ]; then
    echo ""
    echo "📤 Pushing to both repositories..."
    git add .
    git commit -m "Update: Both brands - $(date)" || echo "No changes to commit"
    git push origin main
    git push fns-origin main
    echo "✅ Pushed to both repositories"
fi

echo ""
echo "🎉 Deployment complete!"
echo "======================="
