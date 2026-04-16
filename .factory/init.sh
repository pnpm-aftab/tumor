#!/bin/bash
# Mission init script - runs at the start of each worker session
set -e

echo "=== Math Tutor Backend Init ==="

# Install dependencies
cd /Users/aftab/Documents/bob-the/codex-proj/backend
npm install

# Create .env template if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env template..."
  cat > .env << 'EOF'
OPENROUTER_API_KEY=your_key_here
LLM_MODEL=openai/gpt-4o
PORT=3000
EOF
  echo "NOTE: .env created with placeholder. Set OPENROUTER_API_KEY for real LLM calls."
fi

# Ensure .env is in .gitignore
if [ ! -f .gitignore ]; then
  echo "Creating .gitignore..."
  echo "node_modules/" > .gitignore
  echo ".env" >> .gitignore
elif ! grep -q "^\.env$" .gitignore 2>/dev/null; then
  echo ".env" >> .gitignore
fi

echo "=== Init complete ==="
