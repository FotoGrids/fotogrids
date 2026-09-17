# tests/harness

Boots a WordPress with the built plugin active, so the E2E suite has something
to run against. One script, two modes, no Docker.

```
./tests/harness/boot.sh --doctor     report what this machine has
./tests/harness/boot.sh              detect a mode and boot
./tests/harness/boot.sh --stop       stop a ci-mode server
./tests/harness/boot.sh --fresh      ci mode: discard .state/ and reinstall
```

Then:

```
set -a; . ./tests/harness/.env; set +a
npm run test:e2e
```

| Mode | Where | Database | Server |
|---|---|---|---|
| `local` | a LocalWP site | LocalWP's MySQL | LocalWP's nginx |
| `ci` | GitHub Actions | a MySQL service container | `php -S` + `router.php` |

Both are real MySQL. The plugin's seven custom tables use `ENUM` columns,
`dbDelta` and `ON DUPLICATE KEY UPDATE`, which SQLite reaches only through a
translation layer.

## What it writes

`tests/harness/.env`, which the specs read:

| Key | What it is |
|---|---|
| `WP_BASE_URL` | where the site answers |
| `WP_CLI` | path to `.state/wp-shim` — execute it, do not parse it |
| `WP_PATH` | the install path |
| `WP_ADMIN_USER` / `WP_ADMIN_PASS` | the login the specs use — `admin` / `password` |
| `FG_MODE` | which mode produced them |

`.state/wp-shim` is generated on each boot. It pins the php, the install path
and the working directory, so wp-cli behaves identically wherever it is called
from.

## local mode

Needs a LocalWP site named `fotogrids-tests`. Any terminal will do: the harness
reads LocalWP's `sites.json` for that site's php build and mysql socket, so it
uses the php that serves the site whatever `PATH` says.

**Use a site you do not develop in.** The seeder truncates the seven FotoGrids
tables and deletes every gallery and album post, and each boot resets the
administrator's password — WordPress stores only a hash, so the existing one
cannot be read back. `boot.sh` refuses any site but `fotogrids-tests` unless
given `--force-site`.

| Variable | Effect |
|---|---|
| `FG_LOCAL_SITE` | expect a different site name |
| `FG_LOCAL_SITES_DIR` | look somewhere other than `~/Local Sites` |
| `FG_ADMIN_USER` / `FG_ADMIN_PASS` | choose the account, set a different password |

A LocalWP site serves plain HTTP unless its SSL is switched on; `boot.sh` takes
the URL from WordPress either way. With SSL on, add `ignoreHTTPSErrors: true` to
`use` in `playwright.config.ts` — the certificate is self-signed.

## ci mode

Downloads WordPress and wp-cli into `.state/`, installs against a MySQL that
already exists, links the plugin in and serves it with PHP's built-in server.
8s, against 69s for `wp-env`.

| Variable | Default |
|---|---|
| `FG_DB_HOST` / `FG_DB_PORT` | `127.0.0.1` / `3306` |
| `FG_DB_SOCKET` | unset — takes precedence over host/port |
| `FG_DB_NAME` / `FG_DB_USER` / `FG_DB_PASS` | `fotogrids_test` / `root` / empty |
| `FG_PORT` | `8899` |
| `FG_ADMIN_USER` / `FG_ADMIN_PASS` | `admin` / `password` |
| `FG_WP_VERSION` | `latest` |
| `FG_PHP_WORKERS` | `8` |

## Fixtures

`seed.sh` builds the test data sets into whichever site `boot.sh` last booted.

```
./tests/harness/seed.sh                 build anything missing or out of date
./tests/harness/seed.sh reset           truncate the plugin's tables first
./tests/harness/seed.sh only=F-exif     one set
./tests/harness/seed.sh force           rebuild even if current
```

It is idempotent: a set already built by the current definition is left alone,
so a second run is a no-op. `FG_SEED_VERSION` in `seed.php` is what makes a
changed definition rebuild rather than persist.

The ids land in `.state/fixtures.json`, keyed by set, and are also printed after
an `FGFIXTURES` marker for a caller reading stdout.

| Set | What it is |
|---|---|
| `F-empty` `F-single` `F-small` `F-large` | 0, 1, 5 and 60 items |
| `F-mixed` | images, an uploaded video, a YouTube embed, a Vimeo embed |
| `F-tagged` | tags, people and locations, with two items left untagged |
| `F-exif` | camera metadata and an XMP credit, above the `-scaled` threshold |
| `F-noalt` | no alt, title or caption |
| `F-album` `F-album-multi` | an album with four children, one coverless; a gallery in two albums |
| `F-pw` `F-reg` | password protected (`open-sesame`); registered users only |
| `F-draft` | draft, private and trashed galleries |
| `F-orphan` | an embed belonging to no gallery |
| `F-cjk` | Japanese and Hebrew titles, captions and filenames |
| `F-huge` | 8000x6000 JPEG and a 40MB PNG — `FG_SEED_HUGE_MB` changes the second |
| `F-alpha` | transparent PNG, animated GIF, WebP |

All media is generated at seed time, so nothing binary is committed. The MP4 in
`F-mixed` is a container with no stream: enough for the render path, which reads
the mime type and the URL, and not enough to play.

## Portability

`boot.sh` runs on macOS as often as on Linux, so it stays inside POSIX tool
behaviour: no `sed -i` without an argument, no `readlink -f`, no `grep -P`, no
GNU-only flags. Check any addition against BSD userland.
