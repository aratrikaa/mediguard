#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "Installing lightweight CPU-only PyTorch..."
pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo "Installing project dependencies..."
pip install --no-cache-dir -r requirements.txt

echo "Build completed successfully!"
