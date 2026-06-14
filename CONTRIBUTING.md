# Contributing

Thanks for helping build Space Invaders 3D.

## Clone The Repo

```bash
git clone https://github.com/darkness22s/space-invaders-3d.git
cd space-invaders-3d
```

## Create A Branch

Start from the `dev` branch:

```bash
git checkout dev
git pull origin dev
git checkout -b feature/your-feature-name
```

Use short, descriptive branch names, such as:

```bash
feature/player-movement
feature/test-scene
docs/multiplayer-notes
```

## Commit Changes

Check your work before committing:

```bash
git status
git add .
git commit -m "Describe the change"
```

## Push Your Branch

```bash
git push -u origin feature/your-feature-name
```

## Open A Pull Request

Open a pull request from your feature branch into `dev`.

Do not work directly on `main`. Use `dev` for integration and feature branches for individual changes.
