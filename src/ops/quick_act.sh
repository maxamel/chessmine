#!/usr/bin/env bash

set -e  # Exit immediately if a command fails

echo "=== Chessmine environment setup ==="

START_DIR="$(pwd)"
SECRETS_SOURCE="$START_DIR/.secrets"

########################################
# 0. Verify secrets file presence
########################################

if [ ! -f "$SECRETS_SOURCE" ]; then
  echo ".secrets file not found in the current directory."
  echo "Please add a .secrets file to the current directory and run this script again."
  exit 1
fi

########################################
# 1. Clone the repository
########################################

REPO_URL="https://github.com/maxamel/chessmine.git"
REPO_DIR="chessmine"

if [ -d "$REPO_DIR" ]; then
  echo "Repository already exists. Skipping clone."
else
  echo "Cloning repository..."
  git clone "$REPO_URL"
fi

cd "$REPO_DIR"

########################################
# 2. Install Docker (if not installed)
########################################

if command -v docker >/dev/null 2>&1; then
  echo "Docker already installed."
else
  echo "Installing Docker..."

  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg

  # Add Docker’s official GPG key
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

  sudo chmod a+r /etc/apt/keyrings/docker.gpg

  # Add Docker repository
  echo \
    "deb [arch=$(dpkg --print-architecture) \
    signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

  sudo apt-get update

  # Install Docker
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  # Allow current user to run docker without sudo
  sudo usermod -aG docker "$USER"

  echo "Docker installed. You may need to log out/in for docker group to take effect."
fi

########################################
# 3. Install act (GitHub Actions runner)
########################################

if command -v act >/dev/null 2>&1; then
  echo "act already installed."
else
  echo "Installing act..."

  curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
  export PATH=$PATH:/root/bin
fi

########################################
# 4. Copy secrets file into repository
########################################

cp "$SECRETS_SOURCE" .secrets
echo "Copied .secrets into the repository."

########################################
# 5. Run the workflow job locally
########################################

echo "Running GitHub workflow job..."

# act push -j prepare-images --secret-file .secrets
act workflow_dispatch -W .github/workflows/e2e_test.yaml --secret-file .secrets

echo "=== Setup complete ==="