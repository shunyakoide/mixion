# Task queue settings

The values the task-queue skill leaves to each project, for this one. Each section is named as the skill refers to it, as *settings: Section*.

## Tracker

The queue lives in Linear: team `SHU`, project **mixion**. Linear's statuses carry the same names as the statuses in the task-queue skill, and its priorities are Urgent, High, Medium, Low and no priority.

An issue reaches Done when its pull request is merged: Linear's GitHub integration moves it there, as long as the pull request's title or branch carries the issue id (see "Branches and titles"). Nobody moves it by hand.

Linear cannot require the sections of an issue.

## Labels

| role | label |
|---|---|
| the owner-review label | `Owner review` |
| labels only a person sets | the `Size` labels: `Small`, `Medium`, `Large` |

## Branches and titles

- The default branch is `main`.
- A branch is named after its issue, as in `shu-123-short-description`.
- A pull request's title is in English and ends with the issue id, as in `… (SHU-123)`. One with no issue behind it, such as a dependency update, ends its title with `(no issue)` instead. No check enforces this.
- The pull request body is written in English, since the repository is public.
- The files a pull request changes: `gh pr diff <number> --name-only`.

## Checks

- The check that always runs: `npm run lint && npm test && npm run build`, the same steps as the `check` job in `.github/workflows/ci.yml`, which `main` requires. It need not be listed in an issue.
- Editing a pull request's title or body runs no check.
- Extra checks an issue may list: a check in the running app with `npm run dev`, starting from **Try the sample** on the first screen, or from **Preview the flow before printing** on the Scan step; a simulated scan through `window.__dev.simulateScan` in the dev server's console (see "Working without a printer" in `CONTRIBUTING.md`).

## Output

This project has no reference output: no snapshot files or golden output that the tests compare against. An issue's "Output" section says "No reference output". The pull request body adds no line about it.

## Owner review

A pull request needs the owner when, after it, either of these is true:

- a screen shows something it did not show before, or shows it differently: text, a value, a status or message, the layout, or how a control answers a key or the pointer
- the same video gives a different printed page or export: the pages of the print PDF, or the MP4, GIF or PNG that is written out

## One-way doors

A pull request is always a one-way door ("Merge Danger" in the task-queue skill) when it changes any of these:

- the printed page: its format, `QR_VERSION` and the QR payload (`src/domain/settings.ts`), and where the markers, cells and QR sit (`src/domain/layout.ts`, `src/domain/markers.ts`, `src/domain/pagePainter.ts`). Pages people printed before the merge stay as they were printed after a revert.
- what the browser keeps: the storage keys and the stored shape of the locale preference (`src/i18n/index.ts`) and the export options (`src/app/exportStore.ts`).
- what is published: the site on GitHub Pages, its custom domain, and the `pages` job in `.github/workflows/ci.yml`.
- the rules the agent works by: the CI checks and workflows (`.github/`), the branch protection of `main`, and this file.
- the removal of a file or a feature.

## Preview

This project publishes no preview for a pull request: GitHub Pages serves `main` only. The live site, the "before" of the body, is `https://mixion.shunyakoide.com/`. For "now", the owner's steps in the body say to check out the branch, run `npm install` and `npm run dev`, and what to open there.

## Screenshots

This project publishes no screenshots: there is nowhere to host them for a pull request. When a screen looks different, the body says in words what changes on which screen, and the owner's steps say how to see it in the dev server.
