# Git Setup Instructions

The GitHub repository is already created and populated at:
**https://github.com/Timothy104005/ypt-plus-plus** (Private)

## To connect this local folder to the repo

Open PowerShell or Git Bash in this folder and run:

```powershell
# Remove the broken .git folder (the sandbox couldn't do this)
Remove-Item -Recurse -Force .git

# Clone the repo fresh into a temp folder, then move the .git back
cd ..
git clone https://github.com/Timothy104005/ypt-plus-plus.git ypt-plus-plus-temp
Move-Item ypt-plus-plus-temp\.git "Learning\.git"
Remove-Item -Recurse -Force ypt-plus-plus-temp
cd Learning

# Verify
git status
git log --oneline
```

## Or simply: clone fresh to a new location

```powershell
git clone https://github.com/Timothy104005/ypt-plus-plus.git
```

## Branch strategy
- `main` — stable snapshot (pushed)
- Future: `feat/learn-flashcards`, `feat/design-*`, `fix/*`
