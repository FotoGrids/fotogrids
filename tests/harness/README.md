# tests/harness

Boots a WordPress with the built plugin active, so the E2E suite has something
to run against. One script, two real modes.

```
./tests/harness/boot.sh --doctor     report what this machine has
./tests/harness/boot.sh              auto-detect a mode and boot
./tests/harness/boot.sh --stop       stop a ci-mode server
```

It writes `tests/harness/.env` with `WP_BASE_URL`, the wp-cli invocation and the
install path. The Playwright config and the fixture seeder both read that file,
so nothing else needs to know which mode you used.

## Modes

| Mode | Where it runs | Database | Server |
|---|---|---|---|
| `local` | your Mac, through LocalWP | LocalWP's MySQL | LocalWP's nginx |
| `ci` | GitHub Actions | a MySQL service container | `php -S` + `router.php` |

Both are real MySQL. The plugin creates seven custom tables using `ENUM`
columns, `dbDelta` and `ON DUPLICATE KEY UPDATE`; on SQLite those go through a
translation layer, so a suite running there would be testing the translation
layer rather than the plugin.

There is no Docker in either mode. `wp-env` still exists for one nightly job
that re-runs the same specs against Apache and the official images, as a check
that the harness is not papering over anything.

## local mode

Needs a LocalWP site named `fotogrids-tests`. Create an empty one in LocalWP,
then run the script from that site's shell — right-click the site in LocalWP and
choose **Open site shell**, which puts LocalWP's own `php`, `wp` and `mysql` on
your `PATH`.

**Use a site you do not develop in.** The fixture seeder truncates the seven
FotoGrids tables and deletes every gallery and album post. `boot.sh` refuses any
site other than `fotogrids-tests` unless you pass `--force-site`, which is the
only thing standing between the seeder and your working data.

`FG_LOCAL_SITE` changes the expected name; `FG_LOCAL_SITES_DIR` changes where
LocalWP keeps its sites.

LocalWP serves over HTTPS with a self-signed certificate, so the Playwright
config sets `ignoreHTTPSErrors` for this mode.

## ci mode

Downloads WordPress and wp-cli into `tests/harness/.state/`, creates a database,
installs, links `dist/fotogrids` in, activates it, and serves the result with
PHP's built-in server.

Measured on `ubuntu-latest`: **7s cold**, **3s warm**. `wp-env` is 69s.

Configured entirely by environment, so CI passes service-container details
straight through:

| Variable | Default |
|---|---|
| `FG_DB_HOST` / `FG_DB_PORT` | `127.0.0.1` / `3306` |
| `FG_DB_SOCKET` | unset — takes precedence over host/port |
| `FG_DB_NAME` / `FG_DB_USER` / `FG_DB_PASS` | `fotogrids_test` / `root` / empty |
| `FG_PORT` | `8899` |
| `FG_WP_VERSION` | `latest` |
| `FG_PHP_WORKERS` | `8` |

`--fresh` throws away `.state/` and reinstalls from nothing.

## Things that already cost time once

- **`php -S` is single-threaded.** Without `PHP_CLI_SERVER_WORKERS`, parallel
  requests from Playwright get `ERR_CONNECTION_RESET` instead of a response. The
  script sets it to 8.
- **`router.php` must resolve against `DOCUMENT_ROOT`, not `__DIR__`.** The
  router lives in this directory while the docroot is the WordPress install, so
  `__DIR__` sends every request to a file that does not exist.
- **`wp core install` does not always honour `--url`** — it can set `siteurl`
  from the docroot directory name instead. The script sets `siteurl` and `home`
  explicitly afterwards. Get this wrong and auth cookies are issued for the
  wrong host, so every login silently bounces back to `wp-login.php`.
- **Pretty permalinks matter.** With plain permalinks the REST API answers on
  `?rest_route=`, which is a different code path from the one production uses,
  and the plugin's standalone view pages 404. The script sets `/%postname%/`.
- **This script runs on macOS as often as on Linux.** It stays inside POSIX tool
  behaviour: no `sed -i` without an argument, no `readlink -f`, no `grep -P`, no
  GNU-only flags. Check any addition against BSD userland.

## What is not here yet

The fixture seeder, the Playwright project structure and the page objects are
separate deliverables. This script's only job is to hand back a running
WordPress with the plugin active.
