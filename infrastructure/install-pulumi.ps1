# Install Pulumi on Windows
# Download and install Pulumi CLI

Write-Host "Installing Pulumi CLI..." -ForegroundColor Green

# Download Pulumi installer
$pulumiInstaller = "$env:TEMP\pulumi-installer.exe"
$pulumiUrl = "https://get.pulumi.com/installer.exe"

Write-Host "Downloading Pulumi installer..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $pulumiUrl -OutFile $pulumiInstaller

Write-Host "Running installer..." -ForegroundColor Yellow
Start-Process -FilePath $pulumiInstaller -ArgumentList "/S" -Wait

Write-Host "Cleaning up..." -ForegroundColor Yellow
Remove-Item $pulumiInstaller -ErrorAction SilentlyContinue

Write-Host "Pulumi installed! Please restart your terminal or run:" -ForegroundColor Green
Write-Host '$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")' -ForegroundColor Cyan

