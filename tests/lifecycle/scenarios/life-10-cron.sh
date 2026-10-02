# LIFE-15 and LIFE-16. The recurring events schedule themselves, and
# deactivation clears them.
#
# `weekly` is a core recurrence, so the statistics cleanup does schedule - the
# interval is read back rather than assumed, because a recurrence core does not
# know would schedule an event that never fires.
#
# The uninstaller clears the same events before it checks whether data may be
# deleted, but a delete reaches that code only after a deactivation that already
# cleared them, so there is nothing left to assert there. Why a delete can run
# no plugin code at all is life-09's subject.

scratch_install life10

fg_events() {
	$WP cron event list --fields=hook,recurrence --format=csv 2>/dev/null \
		| grep fotogrids | sort || true
}

fg_event_count() {
	fg_events | grep -c . || true
}

assert_eq 0 "$( fg_event_count )" "nothing is scheduled before activation"

scratch_activate

# A load, so the init hooks that schedule have run.
$WP option get fotogrids_version >/dev/null

assert_contains "$( fg_events )" 'fotogrids/cron/stats_cleanup,"1 week"' \
	"the statistics cleanup is scheduled, and weekly means a week"
assert_contains "$( fg_events )" 'fotogrids/cron/cache_purge,"1 day"' \
	"the render-cache purge is scheduled daily"

scheduled=$( fg_event_count )

# --- deactivation clears them ----------------------------------------------

$WP --user=admin plugin deactivate fotogrids --quiet
assert_eq 0 "$( fg_event_count )" "deactivation cleared all $scheduled events"

scratch_teardown
