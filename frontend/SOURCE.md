# Source

The files in this directory (other than this file and `Dockerfile`) are a one-time
import of Devias Kit Free (Material Kit React).

| Item        | Value                                              |
| ----------- | -------------------------------------------------- |
| Source URL  | <https://github.com/devias-io/material-kit-react>  |
| Branch      | `main`                                             |
| Commit SHA  | `6423e1a2f092c50d7e1e22f3e43344df02af41de`         |
| Commit date | 2025-06-10T22:19:18+03:00                          |
| Version     | 4.1.0                                              |
| Licence     | MIT (see `LICENSE.md`; copyright notice preserved) |

This is a one-time scaffold. It is not tracked as an upstream dependency and is not
synchronised with upstream: we maintain this copy ourselves.

The upstream `.git` directory was removed so the code is part of this repository's history.
The only file added or replaced is `Dockerfile`, which builds the kit from its pnpm lockfile
and serves it with `next start` (the kit has no `output: "standalone"`).
