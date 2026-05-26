/**
 * View Collections module - view page copy-link behaviour.
 *
 * Copies the view page URL to the clipboard when the shell's copy button is
 * clicked. Scoped to the standalone view page; not part of the global frontend
 * bundle.
 */
(function () {
    function bindCopyButtons() {
        var buttons = document.querySelectorAll('.fotogrids-view__share-copy');

        buttons.forEach(function (button) {
            button.addEventListener('click', function () {
                var url = button.dataset.url || window.location.href;
                var original = button.textContent;

                var done = function () {
                    button.textContent = button.dataset.copiedLabel || 'Copied!';
                    setTimeout(function () {
                        button.textContent = original;
                    }, 2000);
                };

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url).then(done).catch(done);
                } else {
                    var field = document.createElement('textarea');
                    field.value = url;
                    document.body.appendChild(field);
                    field.select();
                    document.execCommand('copy');
                    document.body.removeChild(field);
                    done();
                }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindCopyButtons);
    } else {
        bindCopyButtons();
    }
})();
