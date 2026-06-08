// External dependencies.
import React, { ReactElement, useEffect, useRef } from 'react';

// WordPress dependencies.
import { __ } from '@wordpress/i18n';

// Divi dependencies.
import { ModuleContainer } from '@divi/module';

// Local dependencies.
import { FotoGridsGalleryEditProps } from './types';
import { ModuleStyles } from './styles';
import { ModuleScriptData } from './module-script-data';
import { moduleClassnames } from './module-classnames';
// Shared preview asset wiring — the SAME helper the Gutenberg LivePreview
// and admin metabox preview use. Wires CSS handles + sequences JS +
// merges localize into window.fotogrids + injects HTML (running inline
// kickoff scripts), all into the container's owner document/window.
// @ts-ignore — plain JS module, no types.
import { applyPreviewResponse } from '../../lib/preview-asset-wiring';

declare global {
  interface Window {
    fotogridsPbDivi?: {
      restUrl: string;
      restNonce: string;
      [k: string]: any;
    };
  }
}

const FotoGridsGalleryEdit = (props: FotoGridsGalleryEditProps): ReactElement => {
  const {
    attrs,
    id,
    name,
    elements,
  } = props;

  const galleryId = attrs?.gallery?.innerContent?.desktop?.value?.galleryId ?? '';
  const clickOn   = (attrs?.previewClickBehavior?.innerContent?.desktop?.value?.enabled ?? 'off') === 'on';
  const pagOn     = (attrs?.previewPagination?.innerContent?.desktop?.value?.enabled ?? 'off') === 'on';

  const previewRef = useRef<HTMLDivElement>(null);
  const emptyRef   = useRef<HTMLDivElement>(null);
  const abortRef   = useRef<AbortController>();

  useEffect(() => {
    const container = previewRef.current;
    if (!container) {
      return;
    }
    if (!galleryId) {
      container.innerHTML = '';
      if (emptyRef.current) {
        emptyRef.current.textContent = __('Select a gallery to display.', 'fotogrids');
        emptyRef.current.style.display = '';
      }
      return;
    }

    if (emptyRef.current) {
      emptyRef.current.textContent = __('Loading preview…', 'fotogrids');
      emptyRef.current.style.display = '';
    }

    const cfg     = window.fotogridsPbDivi || ({} as any);
    const restUrl = cfg.restUrl || '/wp-json/fotogrids/v1/';
    const nonce   = cfg.restNonce || '';
    const url     = `${restUrl}preview/gallery/${encodeURIComponent(galleryId)}`;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': nonce,
      },
      body: JSON.stringify({
        version: 2,
        preview_options: { click_behavior: clickOn, pagination: pagOn },
      }),
      signal: abortRef.current.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(async (data: any) => {
        const html = typeof data?.html === 'string' ? data.html : '';
        if (!html) {
          container.innerHTML = '';
          if (emptyRef.current) {
            emptyRef.current.textContent = __('This gallery has nothing to preview yet.', 'fotogrids');
            emptyRef.current.style.display = '';
          }
          return;
        }
        if (emptyRef.current) {
          emptyRef.current.style.display = 'none';
        }
        // Wire CSS/JS/localize + inject HTML into THIS document (the VB
        // app-window iframe), so the gallery is styled and interactive.
        await applyPreviewResponse(container, data, {
          ownerWindow: container.ownerDocument?.defaultView || window,
        });
      })
      .catch((error: any) => {
        if (error?.name !== 'AbortError') {
          container.innerHTML = '';
          if (emptyRef.current) {
            emptyRef.current.textContent = __('This gallery has nothing to preview yet.', 'fotogrids');
            emptyRef.current.style.display = '';
          }
        }
      });

    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [galleryId, clickOn, pagOn]);

  // Capture-phase pagination guard: when the pagination toggle is OFF,
  // the preview wrapper carries `is-fg-pb-pagination-frozen` and we
  // swallow clicks on `.fg-pagination` chrome so users see the buttons
  // in their final styling without actually paginating while editing.
  // Mirrors LivePreview.jsx (Gutenberg) and the Elementor editor guard.
  useEffect(() => {
    const container = previewRef.current;
    if (!container) {
      return;
    }
    const onClickCapture = (e: Event) => {
      if (!container.classList.contains('is-fg-pb-pagination-frozen')) {
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t && t.closest && t.closest('.fg-pagination, .fg-pagination__btn')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    container.addEventListener('click', onClickCapture, true);
    return () => {
      container.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  return (
    <ModuleContainer
      attrs={attrs}
      elements={elements}
      id={id}
      name={name}
      stylesComponent={ModuleStyles}
      classnamesFunction={moduleClassnames}
      scriptDataComponent={ModuleScriptData}
    >
      {elements.styleComponents({ attrName: 'module' })}
      <div className="fotogrids_divi_gallery__inner">
        <div ref={emptyRef} className="fotogrids_divi_gallery__empty">
          {__('Select a gallery to display.', 'fotogrids')}
        </div>
        <div
          ref={previewRef}
          className={`fotogrids_divi_gallery__preview${pagOn ? '' : ' is-fg-pb-pagination-frozen'}`}
        />
      </div>
    </ModuleContainer>
  );
};

export { FotoGridsGalleryEdit };
