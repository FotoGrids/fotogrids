(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', function() {
        const dismissButtons = document.querySelectorAll('.fotogrids-dismiss-button');
        dismissButtons.forEach(function(button) {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                const container = button.closest('.fotogrids-dismiss-container');
                const section = button.getAttribute('data-section');
                
                const formData = new FormData();
                formData.append('action', 'fotogrids_dismiss_notice');
                formData.append('nonce', fotogridsAdminHeader.nonce);
                formData.append('section', section);
                
                button.disabled = true;
                
                fetch(fotogridsAdminHeader.ajaxUrl, {
                    method: 'POST',
                    body: formData
                })
                .then(function() {
                    container.style.transition = 'opacity 0.3s ease';
                    container.style.opacity = '0';
                    setTimeout(function() {
                        container.remove();
                    }, 300);
                })
                .catch(function() {
                    button.disabled = false;
                });
            });
        });
    });

})();
