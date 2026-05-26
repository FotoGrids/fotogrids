/**
 * SMIL → WAAPI converter.
 *
 * Reads loading-icons.yaml, converts all SMIL-animated icons to WAAPI
 * animate() calls, and writes two outputs:
 *
 *   src/assets/frontend/src/loading-icons-waapi.js
 *     A plain JS module exporting `window.fotogridsWaapi`, an object keyed
 *     by icon name. Each value is a function animate(svgEl) that starts all
 *     animations on the given SVG element using the Web Animations API.
 *     CSS-@keyframes icons are omitted - they animate without any JS.
 *
 *   scripts/waapi-compare.html
 *     Side-by-side comparison viewer. Left column = original SVG running in
 *     a <object> tag (separate document, SMIL animates freely). Right column
 *     = stripped SVG with WAAPI. Open in Chrome to verify parity visually.
 *
 * Usage:
 *   node scripts/smil-to-waapi.js
 *
 * The converter handles:
 *   - animateTransform type="rotate"  → CSS transform rotate() keyframes
 *   - animate attributeName="opacity" / "fill-opacity" / "stroke-opacity"
 *   - animate attributeName="r" / "cx" / "cy" / "x" / "y" / "width" / "height"
 *     (SVG presentation attributes - animated via setAttribute in a custom
 *     effect wrapper, since WAAPI CSS keyframes don't reach SVG geometry attrs)
 *   - calcMode="spline" + keySplines → cubic-bezier() easing per keyframe
 *   - calcMode="discrete" → step(1, end) easing
 *   - Negative begin= offsets (e.g. begin="-0.9s") → negative WAAPI delay
 *   - Simple numeric begin= (e.g. begin="0.5s") → positive WAAPI delay
 *   - ID-chained begin= (e.g. begin="fg_ia_3bounce_1.begin+0.1s") →
 *     resolved to an absolute ms delay by topological sort of the dep graph
 *   - Compound begin= with semicolons (first value used; repeat handled by
 *     iterations:Infinity)
 *
 * All icons are now converted and confirmed. Manually-authored LOCKED_ICONS
 * entries exist for icons that required hand-tuned keyframes:
 *   - blocks-shuffle-2/3  sequential x/y swaps
 *   - 3-dots-move         sequential state machine with cx teleports
 *   - fotogrids           sequential reveal with cross-boundary overlap on r5
 *   - square-loader       additive="sum" animateTransform
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT      = path.join(__dirname, '..');
const YAML_PATH = path.join(ROOT, 'src/config/loading-icons.yaml');
const OUT_JS    = path.join(ROOT, 'src/assets/frontend/src/loading-icons-waapi.js');
const OUT_JSON  = path.join(ROOT, 'src/config/loading-icons-waapi.json');
const OUT_HTML  = path.join(__dirname, 'waapi-compare.html');

// These icons already use CSS @keyframes - no conversion needed.
// Note: 'square' is in this set but had a viewbox→viewBox bug in the YAML (now fixed).
const CSS_KEYFRAME_ICONS = new Set([
    '4-dots-swing',
    'blocks-shuffle-4',
    'blocks-shuffle-5',
    'jump',
    'square',
    'wifi',
]);

// Icons that need a human eye after conversion due to complexity.
const MANUAL_REVIEW = new Set([]);

// Icons that loop but are missing the inter-cycle pause - now fixed.
const LOOPS_WRONG_ICONS = new Set([]);

// ---------------------------------------------------------------------------
// Locked icon bodies - verbatim function bodies for confirmed-working icons.
// When a name appears here, convertIcon() emits this body verbatim instead
// of recomputing from SMIL, so converter changes never regress a fixed icon.
// To re-convert an icon: delete its entry here.
// ---------------------------------------------------------------------------
const LOCKED_ICONS = {
    "90-ring": "    var anims = [];\n        var circle = svg.querySelector('circle');\n        if (circle) {\n          anims.push(circle.animate([{\"transform\":\"rotate(0deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(360deg)\",\"transformOrigin\":\"12px 12px\"}], {\"duration\":750,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "180-ring": "    var anims = [];\n        var path = svg.querySelector('path');\n        if (path) {\n          anims.push(path.animate([{\"transform\":\"rotate(0deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(360deg)\",\"transformOrigin\":\"12px 12px\"}], {\"duration\":750,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "3-dots-fade": "    var anims = [];\n        var circle = svg.querySelector('circle');\n        if (circle) {\n          anims.push(circle.animate([{\"opacity\":1},{\"opacity\":0.2,\"offset\":0.9375},{\"opacity\":0.2,\"offset\":1}], {\"duration\":800,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var circle_nth_of_type_2_ = svg.querySelector('circle:nth-of-type(2)');\n        if (circle_nth_of_type_2_) {\n          anims.push(circle_nth_of_type_2_.animate([{\"opacity\":1},{\"opacity\":0.2,\"offset\":0.9375},{\"opacity\":0.2,\"offset\":1}], {\"duration\":800,\"delay\":150,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var circle_nth_of_type_3_ = svg.querySelector('circle:nth-of-type(3)');\n        if (circle_nth_of_type_3_) {\n          anims.push(circle_nth_of_type_3_.animate([{\"opacity\":1},{\"opacity\":0.2,\"offset\":0.9375},{\"opacity\":0.2,\"offset\":1}], {\"duration\":800,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "3-dots-rotate": "    var anims = [];\n        var g = svg.querySelector('g');\n        if (g) {\n          anims.push(g.animate([{\"transform\":\"rotate(0deg)\",\"transformOrigin\":\"12px 12px\",\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"transform\":\"rotate(180deg)\",\"transformOrigin\":\"12px 12px\",\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"transform\":\"rotate(360deg)\",\"transformOrigin\":\"12px 12px\"}], {\"duration\":1000,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "3-dots-scale": "    var anims = [];\n        var circle = svg.querySelector('circle');\n        if (circle) {\n          anims.push(fgAnimAttr(circle, 'r', [{\"--fg-r\":\"3\"},{\"--fg-r\":\".2\"},{\"--fg-r\":\"3\"}], {\"duration\":750,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":800}));\n        }\n        var circle_nth_of_type_2_ = svg.querySelector('circle:nth-of-type(2)');\n        if (circle_nth_of_type_2_) {\n          anims.push(fgAnimAttr(circle_nth_of_type_2_, 'r', [{\"--fg-r\":\"3\"},{\"--fg-r\":\".2\"},{\"--fg-r\":\"3\"}], {\"duration\":750,\"delay\":150,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":800}));\n        }\n        var circle_nth_of_type_3_ = svg.querySelector('circle:nth-of-type(3)');\n        if (circle_nth_of_type_3_) {\n          anims.push(fgAnimAttr(circle_nth_of_type_3_, 'r', [{\"--fg-r\":\"3\"},{\"--fg-r\":\".2\"},{\"--fg-r\":\"3\"}], {\"duration\":750,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":800}));\n        }\n        return anims;\n",
    "4-dots-swing": "    /* CSS @keyframes - no WAAPI needed */\n    return [];\n",
    "6-dots-rotate": "    var anims = [];\n        var g = svg.querySelector('g');\n        if (g) {\n          anims.push(g.animate([{\"transform\":\"rotate(0deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(30deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(60deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(90deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(120deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(150deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(180deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(210deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(240deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(270deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(300deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(330deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(360deg)\",\"transformOrigin\":\"12px 12px\"}], {\"duration\":750,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"steps(12, end)\"}));\n        }\n        return anims;\n",
    "8-dots": "    var anims = [];\n        var g = svg.querySelector('g');\n        if (g) {\n          anims.push(g.animate([{\"transform\":\"rotate(0deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(360deg)\",\"transformOrigin\":\"12px 12px\"}], {\"duration\":1500,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "dot-revolve": "    var anims = [];\n        var circle = svg.querySelector('circle');\n        if (circle) {\n          anims.push(circle.animate([{\"transform\":\"rotate(0deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(360deg)\",\"transformOrigin\":\"12px 12px\"}], {\"duration\":750,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "bars-rotate-fade": "    var anims = [];\n        var g = svg.querySelector('g');\n        if (g) {\n          anims.push(g.animate([{\"transform\":\"rotate(0deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(30deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(60deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(90deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(120deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(150deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(180deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(210deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(240deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(270deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(300deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(330deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(360deg)\",\"transformOrigin\":\"12px 12px\"}], {\"duration\":750,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"steps(12, end)\"}));\n        }\n        return anims;\n",
    "spinner": "    var anims = [];\n        var g = svg.querySelector('g');\n        if (g) {\n          anims.push(g.animate([{\"transform\":\"rotate(0deg)\",\"transformOrigin\":\"1199px 1199px\",\"offset\":0},{\"transform\":\"rotate(30deg)\",\"transformOrigin\":\"1199px 1199px\",\"offset\":0.08333},{\"transform\":\"rotate(60deg)\",\"transformOrigin\":\"1199px 1199px\",\"offset\":0.16667},{\"transform\":\"rotate(90deg)\",\"transformOrigin\":\"1199px 1199px\",\"offset\":0.25},{\"transform\":\"rotate(120deg)\",\"transformOrigin\":\"1199px 1199px\",\"offset\":0.33333},{\"transform\":\"rotate(150deg)\",\"transformOrigin\":\"1199px 1199px\",\"offset\":0.41667},{\"transform\":\"rotate(180deg)\",\"transformOrigin\":\"1199px 1199px\",\"offset\":0.5},{\"transform\":\"rotate(210deg)\",\"transformOrigin\":\"1199px 1199px\",\"offset\":0.58333},{\"transform\":\"rotate(240deg)\",\"transformOrigin\":\"1199px 1199px\",\"offset\":0.66667},{\"transform\":\"rotate(270deg)\",\"transformOrigin\":\"1199px 1199px\",\"offset\":0.75},{\"transform\":\"rotate(300deg)\",\"transformOrigin\":\"1199px 1199px\",\"offset\":0.83333},{\"transform\":\"rotate(330deg)\",\"transformOrigin\":\"1199px 1199px\",\"offset\":0.91667}], {\"duration\":833,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"steps(11, end)\"}));\n        }\n        return anims;\n",
    "pulse": "    var anims = [];\n        var circle = svg.querySelector('circle');\n        if (circle) {\n          anims.push(fgAnimAttr(circle, 'r', [{\"--fg-r\":\"0\",\"easing\":\"cubic-bezier(.52,.6,.25,.99)\"},{\"--fg-r\":\"11\"}], {\"duration\":1200,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1600}));\n          anims.push(circle.animate([{\"opacity\":1,\"easing\":\"cubic-bezier(.52,.6,.25,.99)\"},{\"opacity\":0,\"offset\":0.75},{\"opacity\":0,\"offset\":1}], {\"duration\":1600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var circle_nth_of_type_2_ = svg.querySelector('circle:nth-of-type(2)');\n        if (circle_nth_of_type_2_) {\n          anims.push(fgAnimAttr(circle_nth_of_type_2_, 'r', [{\"--fg-r\":\"0\",\"easing\":\"cubic-bezier(.52,.6,.25,.99)\"},{\"--fg-r\":\"11\"}], {\"duration\":1200,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1600}));\n          anims.push(circle_nth_of_type_2_.animate([{\"opacity\":1,\"easing\":\"cubic-bezier(.52,.6,.25,.99)\"},{\"opacity\":0,\"offset\":0.75},{\"opacity\":0,\"offset\":1}], {\"duration\":1600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var circle_nth_of_type_3_ = svg.querySelector('circle:nth-of-type(3)');\n        if (circle_nth_of_type_3_) {\n          anims.push(fgAnimAttr(circle_nth_of_type_3_, 'r', [{\"--fg-r\":\"0\",\"easing\":\"cubic-bezier(.52,.6,.25,.99)\"},{\"--fg-r\":\"11\"}], {\"duration\":1200,\"delay\":400,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1600}));\n          anims.push(circle_nth_of_type_3_.animate([{\"opacity\":1,\"easing\":\"cubic-bezier(.52,.6,.25,.99)\"},{\"opacity\":0,\"offset\":0.75},{\"opacity\":0,\"offset\":1}], {\"duration\":1600,\"delay\":400,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "blocks-shuffle-5": "    /* CSS @keyframes - no WAAPI needed */\n    return [];\n",
    "grid": "    var anims = [];\n        var circle = svg.querySelector('circle');\n        if (circle) {\n          anims.push(circle.animate([{\"fillOpacity\":1},{\"fillOpacity\":0.2},{\"fillOpacity\":1}], {\"duration\":1000,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var circle_nth_of_type_2_ = svg.querySelector('circle:nth-of-type(2)');\n        if (circle_nth_of_type_2_) {\n          anims.push(circle_nth_of_type_2_.animate([{\"fillOpacity\":1},{\"fillOpacity\":0.2},{\"fillOpacity\":1}], {\"duration\":1000,\"delay\":100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var circle_nth_of_type_3_ = svg.querySelector('circle:nth-of-type(3)');\n        if (circle_nth_of_type_3_) {\n          anims.push(circle_nth_of_type_3_.animate([{\"fillOpacity\":1},{\"fillOpacity\":0.2},{\"fillOpacity\":1}], {\"duration\":1000,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var circle_nth_of_type_4_ = svg.querySelector('circle:nth-of-type(4)');\n        if (circle_nth_of_type_4_) {\n          anims.push(circle_nth_of_type_4_.animate([{\"fillOpacity\":1},{\"fillOpacity\":0.2},{\"fillOpacity\":1}], {\"duration\":1000,\"delay\":600,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var circle_nth_of_type_5_ = svg.querySelector('circle:nth-of-type(5)');\n        if (circle_nth_of_type_5_) {\n          anims.push(circle_nth_of_type_5_.animate([{\"fillOpacity\":1},{\"fillOpacity\":0.2},{\"fillOpacity\":1}], {\"duration\":1000,\"delay\":800,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var circle_nth_of_type_6_ = svg.querySelector('circle:nth-of-type(6)');\n        if (circle_nth_of_type_6_) {\n          anims.push(circle_nth_of_type_6_.animate([{\"fillOpacity\":1},{\"fillOpacity\":0.2},{\"fillOpacity\":1}], {\"duration\":1000,\"delay\":400,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var circle_nth_of_type_7_ = svg.querySelector('circle:nth-of-type(7)');\n        if (circle_nth_of_type_7_) {\n          anims.push(circle_nth_of_type_7_.animate([{\"fillOpacity\":1},{\"fillOpacity\":0.2},{\"fillOpacity\":1}], {\"duration\":1000,\"delay\":700,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var circle_nth_of_type_8_ = svg.querySelector('circle:nth-of-type(8)');\n        if (circle_nth_of_type_8_) {\n          anims.push(circle_nth_of_type_8_.animate([{\"fillOpacity\":1},{\"fillOpacity\":0.2},{\"fillOpacity\":1}], {\"duration\":1000,\"delay\":500,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var circle_nth_of_type_9_ = svg.querySelector('circle:nth-of-type(9)');\n        if (circle_nth_of_type_9_) {\n          anims.push(circle_nth_of_type_9_.animate([{\"fillOpacity\":1},{\"fillOpacity\":0.2},{\"fillOpacity\":1}], {\"duration\":1000,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "blocks-shuffle-4": "    /* CSS @keyframes - no WAAPI needed */\n    return [];\n",
    "blocks-scale": "    var anims = [];\n        var rect = svg.querySelector('rect');\n        if (rect) {\n          anims.push(fgAnimAttr(rect, 'x', [{\"--fg-x\":\"1.5\",\"offset\":0},{\"--fg-x\":\".5\",\"offset\":0.2},{\"--fg-x\":\"1.5\",\"offset\":1}], {\"duration\":600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect, 'y', [{\"--fg-y\":\"1.5\",\"offset\":0},{\"--fg-y\":\".5\",\"offset\":0.2},{\"--fg-y\":\"1.5\",\"offset\":1}], {\"duration\":600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect, 'width', [{\"--fg-width\":\"9\",\"offset\":0},{\"--fg-width\":\"11\",\"offset\":0.2},{\"--fg-width\":\"9\",\"offset\":1}], {\"duration\":600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect, 'height', [{\"--fg-height\":\"9\",\"offset\":0},{\"--fg-height\":\"11\",\"offset\":0.2},{\"--fg-height\":\"9\",\"offset\":1}], {\"duration\":600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var rect_nth_of_type_2_ = svg.querySelector('rect:nth-of-type(2)');\n        if (rect_nth_of_type_2_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_2_, 'x', [{\"--fg-x\":\"13.5\",\"offset\":0},{\"--fg-x\":\"12.5\",\"offset\":0.2},{\"--fg-x\":\"13.5\",\"offset\":1}], {\"duration\":600,\"delay\":150,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_2_, 'y', [{\"--fg-y\":\"1.5\",\"offset\":0},{\"--fg-y\":\".5\",\"offset\":0.2},{\"--fg-y\":\"1.5\",\"offset\":1}], {\"duration\":600,\"delay\":150,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_2_, 'width', [{\"--fg-width\":\"9\",\"offset\":0},{\"--fg-width\":\"11\",\"offset\":0.2},{\"--fg-width\":\"9\",\"offset\":1}], {\"duration\":600,\"delay\":150,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_2_, 'height', [{\"--fg-height\":\"9\",\"offset\":0},{\"--fg-height\":\"11\",\"offset\":0.2},{\"--fg-height\":\"9\",\"offset\":1}], {\"duration\":600,\"delay\":150,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var rect_nth_of_type_3_ = svg.querySelector('rect:nth-of-type(3)');\n        if (rect_nth_of_type_3_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_3_, 'x', [{\"--fg-x\":\"13.5\",\"offset\":0},{\"--fg-x\":\"12.5\",\"offset\":0.2},{\"--fg-x\":\"13.5\",\"offset\":1}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_3_, 'y', [{\"--fg-y\":\"13.5\",\"offset\":0},{\"--fg-y\":\"12.5\",\"offset\":0.2},{\"--fg-y\":\"13.5\",\"offset\":1}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_3_, 'width', [{\"--fg-width\":\"9\",\"offset\":0},{\"--fg-width\":\"11\",\"offset\":0.2},{\"--fg-width\":\"9\",\"offset\":1}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_3_, 'height', [{\"--fg-height\":\"9\",\"offset\":0},{\"--fg-height\":\"11\",\"offset\":0.2},{\"--fg-height\":\"9\",\"offset\":1}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var rect_nth_of_type_4_ = svg.querySelector('rect:nth-of-type(4)');\n        if (rect_nth_of_type_4_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_4_, 'x', [{\"--fg-x\":\"1.5\",\"offset\":0},{\"--fg-x\":\".5\",\"offset\":0.2},{\"--fg-x\":\"1.5\",\"offset\":1}], {\"duration\":600,\"delay\":450,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_4_, 'y', [{\"--fg-y\":\"13.5\",\"offset\":0},{\"--fg-y\":\"12.5\",\"offset\":0.2},{\"--fg-y\":\"13.5\",\"offset\":1}], {\"duration\":600,\"delay\":450,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_4_, 'width', [{\"--fg-width\":\"9\",\"offset\":0},{\"--fg-width\":\"11\",\"offset\":0.2},{\"--fg-width\":\"9\",\"offset\":1}], {\"duration\":600,\"delay\":450,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_4_, 'height', [{\"--fg-height\":\"9\",\"offset\":0},{\"--fg-height\":\"11\",\"offset\":0.2},{\"--fg-height\":\"9\",\"offset\":1}], {\"duration\":600,\"delay\":450,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        return anims;\n",
    "blocks-wave": "    var anims = [];\n        var rect = svg.querySelector('rect');\n        if (rect) {\n          anims.push(fgAnimAttr(rect, 'x', [{\"--fg-x\":\"0\"},{\"--fg-x\":\"3\"},{\"--fg-x\":\"0\"}], {\"duration\":600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect, 'y', [{\"--fg-y\":\"0\"},{\"--fg-y\":\"3\"},{\"--fg-y\":\"0\"}], {\"duration\":600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect, 'width', [{\"--fg-width\":\"8\"},{\"--fg-width\":\"2\"},{\"--fg-width\":\"8\"}], {\"duration\":600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect, 'height', [{\"--fg-height\":\"8\"},{\"--fg-height\":\"2\"},{\"--fg-height\":\"8\"}], {\"duration\":600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var rect_nth_of_type_2_ = svg.querySelector('rect:nth-of-type(2)');\n        if (rect_nth_of_type_2_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_2_, 'x', [{\"--fg-x\":\"8\"},{\"--fg-x\":\"11\"},{\"--fg-x\":\"8\"}], {\"duration\":600,\"delay\":100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_2_, 'y', [{\"--fg-y\":\"0\"},{\"--fg-y\":\"3\"},{\"--fg-y\":\"0\"}], {\"duration\":600,\"delay\":100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_2_, 'width', [{\"--fg-width\":\"8\"},{\"--fg-width\":\"2\"},{\"--fg-width\":\"8\"}], {\"duration\":600,\"delay\":100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_2_, 'height', [{\"--fg-height\":\"8\"},{\"--fg-height\":\"2\"},{\"--fg-height\":\"8\"}], {\"duration\":600,\"delay\":100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var rect_nth_of_type_3_ = svg.querySelector('rect:nth-of-type(3)');\n        if (rect_nth_of_type_3_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_3_, 'x', [{\"--fg-x\":\"0\"},{\"--fg-x\":\"3\"},{\"--fg-x\":\"0\"}], {\"duration\":600,\"delay\":100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_3_, 'y', [{\"--fg-y\":\"8\"},{\"--fg-y\":\"11\"},{\"--fg-y\":\"8\"}], {\"duration\":600,\"delay\":100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_3_, 'width', [{\"--fg-width\":\"8\"},{\"--fg-width\":\"2\"},{\"--fg-width\":\"8\"}], {\"duration\":600,\"delay\":100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_3_, 'height', [{\"--fg-height\":\"8\"},{\"--fg-height\":\"2\"},{\"--fg-height\":\"8\"}], {\"duration\":600,\"delay\":100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var rect_nth_of_type_4_ = svg.querySelector('rect:nth-of-type(4)');\n        if (rect_nth_of_type_4_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_4_, 'x', [{\"--fg-x\":\"16\"},{\"--fg-x\":\"19\"},{\"--fg-x\":\"16\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_4_, 'y', [{\"--fg-y\":\"0\"},{\"--fg-y\":\"3\"},{\"--fg-y\":\"0\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_4_, 'width', [{\"--fg-width\":\"8\"},{\"--fg-width\":\"2\"},{\"--fg-width\":\"8\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_4_, 'height', [{\"--fg-height\":\"8\"},{\"--fg-height\":\"2\"},{\"--fg-height\":\"8\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var rect_nth_of_type_5_ = svg.querySelector('rect:nth-of-type(5)');\n        if (rect_nth_of_type_5_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_5_, 'x', [{\"--fg-x\":\"8\"},{\"--fg-x\":\"11\"},{\"--fg-x\":\"8\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_5_, 'y', [{\"--fg-y\":\"8\"},{\"--fg-y\":\"11\"},{\"--fg-y\":\"8\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_5_, 'width', [{\"--fg-width\":\"8\"},{\"--fg-width\":\"2\"},{\"--fg-width\":\"8\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_5_, 'height', [{\"--fg-height\":\"8\"},{\"--fg-height\":\"2\"},{\"--fg-height\":\"8\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var rect_nth_of_type_6_ = svg.querySelector('rect:nth-of-type(6)');\n        if (rect_nth_of_type_6_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_6_, 'x', [{\"--fg-x\":\"0\"},{\"--fg-x\":\"3\"},{\"--fg-x\":\"0\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_6_, 'y', [{\"--fg-y\":\"16\"},{\"--fg-y\":\"19\"},{\"--fg-y\":\"16\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_6_, 'width', [{\"--fg-width\":\"8\"},{\"--fg-width\":\"2\"},{\"--fg-width\":\"8\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_6_, 'height', [{\"--fg-height\":\"8\"},{\"--fg-height\":\"2\"},{\"--fg-height\":\"8\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var rect_nth_of_type_7_ = svg.querySelector('rect:nth-of-type(7)');\n        if (rect_nth_of_type_7_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_7_, 'x', [{\"--fg-x\":\"16\"},{\"--fg-x\":\"19\"},{\"--fg-x\":\"16\"}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_7_, 'y', [{\"--fg-y\":\"8\"},{\"--fg-y\":\"11\"},{\"--fg-y\":\"8\"}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_7_, 'width', [{\"--fg-width\":\"8\"},{\"--fg-width\":\"2\"},{\"--fg-width\":\"8\"}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_7_, 'height', [{\"--fg-height\":\"8\"},{\"--fg-height\":\"2\"},{\"--fg-height\":\"8\"}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var rect_nth_of_type_8_ = svg.querySelector('rect:nth-of-type(8)');\n        if (rect_nth_of_type_8_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_8_, 'x', [{\"--fg-x\":\"8\"},{\"--fg-x\":\"11\"},{\"--fg-x\":\"8\"}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_8_, 'y', [{\"--fg-y\":\"16\"},{\"--fg-y\":\"19\"},{\"--fg-y\":\"16\"}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_8_, 'width', [{\"--fg-width\":\"8\"},{\"--fg-width\":\"2\"},{\"--fg-width\":\"8\"}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_8_, 'height', [{\"--fg-height\":\"8\"},{\"--fg-height\":\"2\"},{\"--fg-height\":\"8\"}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var rect_nth_of_type_9_ = svg.querySelector('rect:nth-of-type(9)');\n        if (rect_nth_of_type_9_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_9_, 'x', [{\"--fg-x\":\"16\"},{\"--fg-x\":\"19\"},{\"--fg-x\":\"16\"}], {\"duration\":600,\"delay\":400,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_9_, 'y', [{\"--fg-y\":\"16\"},{\"--fg-y\":\"19\"},{\"--fg-y\":\"16\"}], {\"duration\":600,\"delay\":400,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_9_, 'width', [{\"--fg-width\":\"8\"},{\"--fg-width\":\"2\"},{\"--fg-width\":\"8\"}], {\"duration\":600,\"delay\":400,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n          anims.push(fgAnimAttr(rect_nth_of_type_9_, 'height', [{\"--fg-height\":\"8\"},{\"--fg-height\":\"2\"},{\"--fg-height\":\"8\"}], {\"duration\":600,\"delay\":400,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        return anims;\n",
    "square": "    /* CSS @keyframes - no WAAPI needed */\n    return [];\n",
    "bars-scale-fade": "    var anims = [];\n        var rect = svg.querySelector('rect');\n        if (rect) {\n          anims.push(fgAnimAttr(rect, 'y', [{\"--fg-y\":\"1\"},{\"--fg-y\":\"5\"}], {\"duration\":750,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":800}));\n          anims.push(fgAnimAttr(rect, 'height', [{\"--fg-height\":\"22\"},{\"--fg-height\":\"14\"}], {\"duration\":750,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":800}));\n          anims.push(rect.animate([{\"opacity\":1},{\"opacity\":0.2,\"offset\":0.9375},{\"opacity\":0.2,\"offset\":1}], {\"duration\":800,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var rect_nth_of_type_2_ = svg.querySelector('rect:nth-of-type(2)');\n        if (rect_nth_of_type_2_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_2_, 'y', [{\"--fg-y\":\"1\"},{\"--fg-y\":\"5\"}], {\"duration\":750,\"delay\":150,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":800}));\n          anims.push(fgAnimAttr(rect_nth_of_type_2_, 'height', [{\"--fg-height\":\"22\"},{\"--fg-height\":\"14\"}], {\"duration\":750,\"delay\":150,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":800}));\n          anims.push(rect_nth_of_type_2_.animate([{\"opacity\":1},{\"opacity\":0.2,\"offset\":0.9375},{\"opacity\":0.2,\"offset\":1}], {\"duration\":800,\"delay\":150,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var rect_nth_of_type_3_ = svg.querySelector('rect:nth-of-type(3)');\n        if (rect_nth_of_type_3_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_3_, 'y', [{\"--fg-y\":\"1\"},{\"--fg-y\":\"5\"}], {\"duration\":750,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":800}));\n          anims.push(fgAnimAttr(rect_nth_of_type_3_, 'height', [{\"--fg-height\":\"22\"},{\"--fg-height\":\"14\"}], {\"duration\":750,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":800}));\n          anims.push(rect_nth_of_type_3_.animate([{\"opacity\":1},{\"opacity\":0.2,\"offset\":0.9375},{\"opacity\":0.2,\"offset\":1}], {\"duration\":800,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "bars-fade": "    var anims = [];\n        var rect = svg.querySelector('rect');\n        if (rect) {\n          anims.push(rect.animate([{\"opacity\":1},{\"opacity\":0.2,\"offset\":0.9375},{\"opacity\":0.2,\"offset\":1}], {\"duration\":800,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var rect_nth_of_type_2_ = svg.querySelector('rect:nth-of-type(2)');\n        if (rect_nth_of_type_2_) {\n          anims.push(rect_nth_of_type_2_.animate([{\"opacity\":1},{\"opacity\":0.2,\"offset\":0.9375},{\"opacity\":0.2,\"offset\":1}], {\"duration\":800,\"delay\":150,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var rect_nth_of_type_3_ = svg.querySelector('rect:nth-of-type(3)');\n        if (rect_nth_of_type_3_) {\n          anims.push(rect_nth_of_type_3_.animate([{\"opacity\":1},{\"opacity\":0.2,\"offset\":0.9375},{\"opacity\":0.2,\"offset\":1}], {\"duration\":800,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "bars-scale": "    var anims = [];\n        var rect = svg.querySelector('rect');\n        if (rect) {\n          anims.push(fgAnimAttr(rect, 'y', [{\"--fg-y\":\"6\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-y\":\"1\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-y\":\"6\"}], {\"duration\":600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":900}));\n          anims.push(fgAnimAttr(rect, 'height', [{\"--fg-height\":\"12\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-height\":\"22\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-height\":\"12\"}], {\"duration\":600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":900}));\n        }\n        var rect_nth_of_type_2_ = svg.querySelector('rect:nth-of-type(2)');\n        if (rect_nth_of_type_2_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_2_, 'y', [{\"--fg-y\":\"6\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-y\":\"1\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-y\":\"6\"}], {\"duration\":600,\"delay\":100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":900}));\n          anims.push(fgAnimAttr(rect_nth_of_type_2_, 'height', [{\"--fg-height\":\"12\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-height\":\"22\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-height\":\"12\"}], {\"duration\":600,\"delay\":100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":900}));\n        }\n        var rect_nth_of_type_3_ = svg.querySelector('rect:nth-of-type(3)');\n        if (rect_nth_of_type_3_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_3_, 'y', [{\"--fg-y\":\"6\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-y\":\"1\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-y\":\"6\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":900}));\n          anims.push(fgAnimAttr(rect_nth_of_type_3_, 'height', [{\"--fg-height\":\"12\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-height\":\"22\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-height\":\"12\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":900}));\n        }\n        var rect_nth_of_type_4_ = svg.querySelector('rect:nth-of-type(4)');\n        if (rect_nth_of_type_4_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_4_, 'y', [{\"--fg-y\":\"6\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-y\":\"1\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-y\":\"6\"}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":900}));\n          anims.push(fgAnimAttr(rect_nth_of_type_4_, 'height', [{\"--fg-height\":\"12\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-height\":\"22\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-height\":\"12\"}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":900}));\n        }\n        var rect_nth_of_type_5_ = svg.querySelector('rect:nth-of-type(5)');\n        if (rect_nth_of_type_5_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_5_, 'y', [{\"--fg-y\":\"6\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-y\":\"1\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-y\":\"6\"}], {\"duration\":600,\"delay\":400,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":900}));\n          anims.push(fgAnimAttr(rect_nth_of_type_5_, 'height', [{\"--fg-height\":\"12\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-height\":\"22\",\"easing\":\"cubic-bezier(.36,.61,.3,.98)\"},{\"--fg-height\":\"12\"}], {\"duration\":600,\"delay\":400,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":900}));\n        }\n        return anims;\n",
    "bars": "    var anims = [];\n        var rect = svg.querySelector('rect');\n        if (rect) {\n          anims.push(fgAnimAttr(rect, 'height', [{\"--fg-height\":\"120\"},{\"--fg-height\":\"110\"},{\"--fg-height\":\"100\"},{\"--fg-height\":\"90\"},{\"--fg-height\":\"80\"},{\"--fg-height\":\"70\"},{\"--fg-height\":\"60\"},{\"--fg-height\":\"50\"},{\"--fg-height\":\"40\"},{\"--fg-height\":\"140\"},{\"--fg-height\":\"120\"}], {\"duration\":1000,\"delay\":500,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n          anims.push(fgAnimAttr(rect, 'y', [{\"--fg-y\":\"10\"},{\"--fg-y\":\"15\"},{\"--fg-y\":\"20\"},{\"--fg-y\":\"25\"},{\"--fg-y\":\"30\"},{\"--fg-y\":\"35\"},{\"--fg-y\":\"40\"},{\"--fg-y\":\"45\"},{\"--fg-y\":\"50\"},{\"--fg-y\":\"0\"},{\"--fg-y\":\"10\"}], {\"duration\":1000,\"delay\":500,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var rect_nth_of_type_2_ = svg.querySelector('rect:nth-of-type(2)');\n        if (rect_nth_of_type_2_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_2_, 'height', [{\"--fg-height\":\"120\"},{\"--fg-height\":\"110\"},{\"--fg-height\":\"100\"},{\"--fg-height\":\"90\"},{\"--fg-height\":\"80\"},{\"--fg-height\":\"70\"},{\"--fg-height\":\"60\"},{\"--fg-height\":\"50\"},{\"--fg-height\":\"40\"},{\"--fg-height\":\"140\"},{\"--fg-height\":\"120\"}], {\"duration\":1000,\"delay\":250,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n          anims.push(fgAnimAttr(rect_nth_of_type_2_, 'y', [{\"--fg-y\":\"10\"},{\"--fg-y\":\"15\"},{\"--fg-y\":\"20\"},{\"--fg-y\":\"25\"},{\"--fg-y\":\"30\"},{\"--fg-y\":\"35\"},{\"--fg-y\":\"40\"},{\"--fg-y\":\"45\"},{\"--fg-y\":\"50\"},{\"--fg-y\":\"0\"},{\"--fg-y\":\"10\"}], {\"duration\":1000,\"delay\":250,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var rect_nth_of_type_3_ = svg.querySelector('rect:nth-of-type(3)');\n        if (rect_nth_of_type_3_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_3_, 'height', [{\"--fg-height\":\"120\"},{\"--fg-height\":\"110\"},{\"--fg-height\":\"100\"},{\"--fg-height\":\"90\"},{\"--fg-height\":\"80\"},{\"--fg-height\":\"70\"},{\"--fg-height\":\"60\"},{\"--fg-height\":\"50\"},{\"--fg-height\":\"40\"},{\"--fg-height\":\"140\"},{\"--fg-height\":\"120\"}], {\"duration\":1000,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n          anims.push(fgAnimAttr(rect_nth_of_type_3_, 'y', [{\"--fg-y\":\"10\"},{\"--fg-y\":\"15\"},{\"--fg-y\":\"20\"},{\"--fg-y\":\"25\"},{\"--fg-y\":\"30\"},{\"--fg-y\":\"35\"},{\"--fg-y\":\"40\"},{\"--fg-y\":\"45\"},{\"--fg-y\":\"50\"},{\"--fg-y\":\"0\"},{\"--fg-y\":\"10\"}], {\"duration\":1000,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var rect_nth_of_type_4_ = svg.querySelector('rect:nth-of-type(4)');\n        if (rect_nth_of_type_4_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_4_, 'height', [{\"--fg-height\":\"120\"},{\"--fg-height\":\"110\"},{\"--fg-height\":\"100\"},{\"--fg-height\":\"90\"},{\"--fg-height\":\"80\"},{\"--fg-height\":\"70\"},{\"--fg-height\":\"60\"},{\"--fg-height\":\"50\"},{\"--fg-height\":\"40\"},{\"--fg-height\":\"140\"},{\"--fg-height\":\"120\"}], {\"duration\":1000,\"delay\":250,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n          anims.push(fgAnimAttr(rect_nth_of_type_4_, 'y', [{\"--fg-y\":\"10\"},{\"--fg-y\":\"15\"},{\"--fg-y\":\"20\"},{\"--fg-y\":\"25\"},{\"--fg-y\":\"30\"},{\"--fg-y\":\"35\"},{\"--fg-y\":\"40\"},{\"--fg-y\":\"45\"},{\"--fg-y\":\"50\"},{\"--fg-y\":\"0\"},{\"--fg-y\":\"10\"}], {\"duration\":1000,\"delay\":250,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var rect_nth_of_type_5_ = svg.querySelector('rect:nth-of-type(5)');\n        if (rect_nth_of_type_5_) {\n          anims.push(fgAnimAttr(rect_nth_of_type_5_, 'height', [{\"--fg-height\":\"120\"},{\"--fg-height\":\"110\"},{\"--fg-height\":\"100\"},{\"--fg-height\":\"90\"},{\"--fg-height\":\"80\"},{\"--fg-height\":\"70\"},{\"--fg-height\":\"60\"},{\"--fg-height\":\"50\"},{\"--fg-height\":\"40\"},{\"--fg-height\":\"140\"},{\"--fg-height\":\"120\"}], {\"duration\":1000,\"delay\":500,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n          anims.push(fgAnimAttr(rect_nth_of_type_5_, 'y', [{\"--fg-y\":\"10\"},{\"--fg-y\":\"15\"},{\"--fg-y\":\"20\"},{\"--fg-y\":\"25\"},{\"--fg-y\":\"30\"},{\"--fg-y\":\"35\"},{\"--fg-y\":\"40\"},{\"--fg-y\":\"45\"},{\"--fg-y\":\"50\"},{\"--fg-y\":\"0\"},{\"--fg-y\":\"10\"}], {\"duration\":1000,\"delay\":500,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "hearts": "    var anims = [];\n        var path = svg.querySelector('path');\n        if (path) {\n          anims.push(path.animate([{\"fillOpacity\":0.3},{\"fillOpacity\":0.7},{\"fillOpacity\":0.3}], {\"duration\":1400,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var path_nth_of_type_2_ = svg.querySelector('path:nth-of-type(2)');\n        if (path_nth_of_type_2_) {\n          anims.push(path_nth_of_type_2_.animate([{\"fillOpacity\":0.3},{\"fillOpacity\":0.7},{\"fillOpacity\":0.3}], {\"duration\":1400,\"delay\":700,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "jump": "    /* CSS @keyframes - no WAAPI needed */\n    return [];\n",
    "wifi": "    /* CSS @keyframes - no WAAPI needed */\n    return [];\n",
    "3-dots-bounce": "    var anims = [];\n        var circle = svg.querySelector('circle');\n        if (circle) {\n          anims.push(fgAnimAttr(circle, 'cy', [{\"--fg-cy\":\"12\",\"easing\":\"cubic-bezier(.33,.66,.66,1)\"},{\"--fg-cy\":\"6\",\"easing\":\"cubic-bezier(.33,0,.66,.33)\"},{\"--fg-cy\":\"12\"}], {\"duration\":600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1050}));\n        }\n        var circle_nth_of_type_2_ = svg.querySelector('circle:nth-of-type(2)');\n        if (circle_nth_of_type_2_) {\n          anims.push(fgAnimAttr(circle_nth_of_type_2_, 'cy', [{\"--fg-cy\":\"12\",\"easing\":\"cubic-bezier(.33,.66,.66,1)\"},{\"--fg-cy\":\"6\",\"easing\":\"cubic-bezier(.33,0,.66,.33)\"},{\"--fg-cy\":\"12\"}], {\"duration\":600,\"delay\":100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1050}));\n        }\n        var circle_nth_of_type_3_ = svg.querySelector('circle:nth-of-type(3)');\n        if (circle_nth_of_type_3_) {\n          anims.push(fgAnimAttr(circle_nth_of_type_3_, 'cy', [{\"--fg-cy\":\"12\",\"easing\":\"cubic-bezier(.33,.66,.66,1)\"},{\"--fg-cy\":\"6\",\"easing\":\"cubic-bezier(.33,0,.66,.33)\"},{\"--fg-cy\":\"12\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1050}));\n        }\n        return anims;\n",
    "180-ring-with-bg": "    var anims = [];\n        var path2 = svg.querySelector('path:nth-of-type(2)');\n        if (path2) {\n          anims.push(path2.animate([{\"transform\":\"rotate(0deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(360deg)\",\"transformOrigin\":\"12px 12px\"}], {\"duration\":750,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "spinning-circles": "    var anims = [];\n        var c1 = svg.querySelector('circle');\n        if (c1) {\n          anims.push(c1.animate([{\"fillOpacity\":1,\"offset\":0},{\"fillOpacity\":0,\"offset\":0.125},{\"fillOpacity\":0,\"offset\":0.25},{\"fillOpacity\":0,\"offset\":0.375},{\"fillOpacity\":0,\"offset\":0.5},{\"fillOpacity\":0,\"offset\":0.625},{\"fillOpacity\":0,\"offset\":0.75},{\"fillOpacity\":0,\"offset\":0.875},{\"fillOpacity\":1,\"offset\":1}], {\"duration\":1300,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var c2 = svg.querySelector('circle:nth-of-type(2)');\n        if (c2) {\n          anims.push(c2.animate([{\"fillOpacity\":0,\"offset\":0},{\"fillOpacity\":1,\"offset\":0.125},{\"fillOpacity\":0,\"offset\":0.25},{\"fillOpacity\":0,\"offset\":0.375},{\"fillOpacity\":0,\"offset\":0.5},{\"fillOpacity\":0,\"offset\":0.625},{\"fillOpacity\":0,\"offset\":0.75},{\"fillOpacity\":0,\"offset\":0.875},{\"fillOpacity\":0,\"offset\":1}], {\"duration\":1300,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var c3 = svg.querySelector('circle:nth-of-type(3)');\n        if (c3) {\n          anims.push(c3.animate([{\"fillOpacity\":0,\"offset\":0},{\"fillOpacity\":0,\"offset\":0.125},{\"fillOpacity\":1,\"offset\":0.25},{\"fillOpacity\":0,\"offset\":0.375},{\"fillOpacity\":0,\"offset\":0.5},{\"fillOpacity\":0,\"offset\":0.625},{\"fillOpacity\":0,\"offset\":0.75},{\"fillOpacity\":0,\"offset\":0.875},{\"fillOpacity\":0,\"offset\":1}], {\"duration\":1300,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var c4 = svg.querySelector('circle:nth-of-type(4)');\n        if (c4) {\n          anims.push(c4.animate([{\"fillOpacity\":0,\"offset\":0},{\"fillOpacity\":0,\"offset\":0.125},{\"fillOpacity\":0,\"offset\":0.25},{\"fillOpacity\":1,\"offset\":0.375},{\"fillOpacity\":0,\"offset\":0.5},{\"fillOpacity\":0,\"offset\":0.625},{\"fillOpacity\":0,\"offset\":0.75},{\"fillOpacity\":0,\"offset\":0.875},{\"fillOpacity\":0,\"offset\":1}], {\"duration\":1300,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var c5 = svg.querySelector('circle:nth-of-type(5)');\n        if (c5) {\n          anims.push(c5.animate([{\"fillOpacity\":0,\"offset\":0},{\"fillOpacity\":0,\"offset\":0.125},{\"fillOpacity\":0,\"offset\":0.25},{\"fillOpacity\":0,\"offset\":0.375},{\"fillOpacity\":1,\"offset\":0.5},{\"fillOpacity\":0,\"offset\":0.625},{\"fillOpacity\":0,\"offset\":0.75},{\"fillOpacity\":0,\"offset\":0.875},{\"fillOpacity\":0,\"offset\":1}], {\"duration\":1300,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var c6 = svg.querySelector('circle:nth-of-type(6)');\n        if (c6) {\n          anims.push(c6.animate([{\"fillOpacity\":0,\"offset\":0},{\"fillOpacity\":0,\"offset\":0.125},{\"fillOpacity\":0,\"offset\":0.25},{\"fillOpacity\":0,\"offset\":0.375},{\"fillOpacity\":0,\"offset\":0.5},{\"fillOpacity\":1,\"offset\":0.625},{\"fillOpacity\":0,\"offset\":0.75},{\"fillOpacity\":0,\"offset\":0.875},{\"fillOpacity\":0,\"offset\":1}], {\"duration\":1300,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var c7 = svg.querySelector('circle:nth-of-type(7)');\n        if (c7) {\n          anims.push(c7.animate([{\"fillOpacity\":0,\"offset\":0},{\"fillOpacity\":0,\"offset\":0.125},{\"fillOpacity\":0,\"offset\":0.25},{\"fillOpacity\":0,\"offset\":0.375},{\"fillOpacity\":0,\"offset\":0.5},{\"fillOpacity\":0,\"offset\":0.625},{\"fillOpacity\":1,\"offset\":0.75},{\"fillOpacity\":0,\"offset\":0.875},{\"fillOpacity\":0,\"offset\":1}], {\"duration\":1300,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var c8 = svg.querySelector('circle:nth-of-type(8)');\n        if (c8) {\n          anims.push(c8.animate([{\"fillOpacity\":0,\"offset\":0},{\"fillOpacity\":0,\"offset\":0.125},{\"fillOpacity\":0,\"offset\":0.25},{\"fillOpacity\":0,\"offset\":0.375},{\"fillOpacity\":0,\"offset\":0.5},{\"fillOpacity\":0,\"offset\":0.625},{\"fillOpacity\":0,\"offset\":0.75},{\"fillOpacity\":1,\"offset\":0.875},{\"fillOpacity\":0,\"offset\":1}], {\"duration\":1300,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "puff": "    var anims = [];\n        var c1 = svg.querySelector('circle');\n        if (c1) {\n          anims.push(fgAnimAttr(c1, 'r', [{\"--fg-r\":\"1\",\"easing\":\"cubic-bezier(0.165,0.84,0.44,1)\"},{\"--fg-r\":\"20\"}], {\"duration\":1800,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n          anims.push(c1.animate([{\"strokeOpacity\":1,\"easing\":\"cubic-bezier(0.3,0.61,0.355,1)\"},{\"strokeOpacity\":0}], {\"duration\":1800,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var c2 = svg.querySelector('circle:nth-of-type(2)');\n        if (c2) {\n          anims.push(fgAnimAttr(c2, 'r', [{\"--fg-r\":\"1\",\"easing\":\"cubic-bezier(0.165,0.84,0.44,1)\"},{\"--fg-r\":\"20\"}], {\"duration\":1800,\"delay\":-900,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n          anims.push(c2.animate([{\"strokeOpacity\":1,\"easing\":\"cubic-bezier(0.3,0.61,0.355,1)\"},{\"strokeOpacity\":0}], {\"duration\":1800,\"delay\":-900,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "ring-resize": "    var anims = [];\n        var circle = svg.querySelector('circle');\n        if (circle) {\n          anims.push(circle.animate([{\"strokeDasharray\":\"0 150\",\"easing\":\"cubic-bezier(0.42,0,0.58,1)\",\"offset\":0},{\"strokeDasharray\":\"42 150\",\"easing\":\"cubic-bezier(0.42,0,0.58,1)\",\"offset\":0.475},{\"strokeDasharray\":\"42 150\",\"easing\":\"cubic-bezier(0.42,0,0.58,1)\",\"offset\":0.95},{\"strokeDasharray\":\"42 150\",\"offset\":1}], {\"duration\":1500,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n          anims.push(circle.animate([{\"strokeDashoffset\":0,\"easing\":\"cubic-bezier(0.42,0,0.58,1)\",\"offset\":0},{\"strokeDashoffset\":-16,\"easing\":\"cubic-bezier(0.42,0,0.58,1)\",\"offset\":0.475},{\"strokeDashoffset\":-59,\"easing\":\"cubic-bezier(0.42,0,0.58,1)\",\"offset\":0.95},{\"strokeDashoffset\":-59,\"offset\":1}], {\"duration\":1500,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var g = svg.querySelector('g');\n        if (g) {\n          anims.push(g.animate([{\"transform\":\"rotate(0deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(360deg)\",\"transformOrigin\":\"12px 12px\"}], {\"duration\":2000,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "gooey-balls": "    var anims = [];\n        var c1 = svg.querySelector('circle');\n        if (c1) {\n          anims.push(fgAnimAttr(c1, 'cx', [{\"--fg-cx\":\"5\",\"easing\":\"cubic-bezier(.36,.62,.43,.99)\"},{\"--fg-cx\":\"8\",\"easing\":\"cubic-bezier(.79,0,.58,.57)\"},{\"--fg-cx\":\"5\"}], {\"duration\":2000,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var c2 = svg.querySelector('circle:nth-of-type(2)');\n        if (c2) {\n          anims.push(fgAnimAttr(c2, 'cx', [{\"--fg-cx\":\"19\",\"easing\":\"cubic-bezier(.36,.62,.43,.99)\"},{\"--fg-cx\":\"16\",\"easing\":\"cubic-bezier(.79,0,.58,.57)\"},{\"--fg-cx\":\"19\"}], {\"duration\":2000,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var g = svg.querySelector('g');\n        if (g) {\n          anims.push(g.animate([{\"transform\":\"rotate(0deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(360deg)\",\"transformOrigin\":\"12px 12px\"}], {\"duration\":750,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "6-dots-scale": "    var anims = [];\n        var v1 = svg.querySelector('circle');\n        if (v1) {\n          anims.push(fgAnimAttr(v1, 'r', [{\"--fg-r\":\"0\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"0\"}], {\"duration\":600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v2 = svg.querySelector('circle:nth-of-type(2)');\n        if (v2) {\n          anims.push(fgAnimAttr(v2, 'r', [{\"--fg-r\":\"0\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"0\"}], {\"duration\":600,\"delay\":100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v3 = svg.querySelector('circle:nth-of-type(3)');\n        if (v3) {\n          anims.push(fgAnimAttr(v3, 'r', [{\"--fg-r\":\"0\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"0\"}], {\"duration\":600,\"delay\":1100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v4 = svg.querySelector('circle:nth-of-type(4)');\n        if (v4) {\n          anims.push(fgAnimAttr(v4, 'r', [{\"--fg-r\":\"0\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"0\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v5 = svg.querySelector('circle:nth-of-type(5)');\n        if (v5) {\n          anims.push(fgAnimAttr(v5, 'r', [{\"--fg-r\":\"0\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"0\"}], {\"duration\":600,\"delay\":1000,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v6 = svg.querySelector('circle:nth-of-type(6)');\n        if (v6) {\n          anims.push(fgAnimAttr(v6, 'r', [{\"--fg-r\":\"0\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"0\"}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v7 = svg.querySelector('circle:nth-of-type(7)');\n        if (v7) {\n          anims.push(fgAnimAttr(v7, 'r', [{\"--fg-r\":\"0\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"0\"}], {\"duration\":600,\"delay\":900,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v8 = svg.querySelector('circle:nth-of-type(8)');\n        if (v8) {\n          anims.push(fgAnimAttr(v8, 'r', [{\"--fg-r\":\"0\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"0\"}], {\"duration\":600,\"delay\":400,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v9 = svg.querySelector('circle:nth-of-type(9)');\n        if (v9) {\n          anims.push(fgAnimAttr(v9, 'r', [{\"--fg-r\":\"0\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"0\"}], {\"duration\":600,\"delay\":800,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v10 = svg.querySelector('circle:nth-of-type(10)');\n        if (v10) {\n          anims.push(fgAnimAttr(v10, 'r', [{\"--fg-r\":\"0\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"0\"}], {\"duration\":600,\"delay\":500,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v11 = svg.querySelector('circle:nth-of-type(11)');\n        if (v11) {\n          anims.push(fgAnimAttr(v11, 'r', [{\"--fg-r\":\"0\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"0\"}], {\"duration\":600,\"delay\":700,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v12 = svg.querySelector('circle:nth-of-type(12)');\n        if (v12) {\n          anims.push(fgAnimAttr(v12, 'r', [{\"--fg-r\":\"0\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"0\"}], {\"duration\":600,\"delay\":600,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        return anims;\n",
    "12-dots": "    var anims = [];\n        var v1 = svg.querySelector('circle');\n        if (v1) {\n          anims.push(fgAnimAttr(v1, 'r', [{\"--fg-r\":\"1\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"1\"}], {\"duration\":600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v2 = svg.querySelector('circle:nth-of-type(2)');\n        if (v2) {\n          anims.push(fgAnimAttr(v2, 'r', [{\"--fg-r\":\"1\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"1\"}], {\"duration\":600,\"delay\":100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v3 = svg.querySelector('circle:nth-of-type(3)');\n        if (v3) {\n          anims.push(fgAnimAttr(v3, 'r', [{\"--fg-r\":\"1\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"1\"}], {\"duration\":600,\"delay\":1100,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v4 = svg.querySelector('circle:nth-of-type(4)');\n        if (v4) {\n          anims.push(fgAnimAttr(v4, 'r', [{\"--fg-r\":\"1\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"1\"}], {\"duration\":600,\"delay\":200,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v5 = svg.querySelector('circle:nth-of-type(5)');\n        if (v5) {\n          anims.push(fgAnimAttr(v5, 'r', [{\"--fg-r\":\"1\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"1\"}], {\"duration\":600,\"delay\":1000,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v6 = svg.querySelector('circle:nth-of-type(6)');\n        if (v6) {\n          anims.push(fgAnimAttr(v6, 'r', [{\"--fg-r\":\"1\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"1\"}], {\"duration\":600,\"delay\":300,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v7 = svg.querySelector('circle:nth-of-type(7)');\n        if (v7) {\n          anims.push(fgAnimAttr(v7, 'r', [{\"--fg-r\":\"1\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"1\"}], {\"duration\":600,\"delay\":900,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v8 = svg.querySelector('circle:nth-of-type(8)');\n        if (v8) {\n          anims.push(fgAnimAttr(v8, 'r', [{\"--fg-r\":\"1\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"1\"}], {\"duration\":600,\"delay\":400,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v9 = svg.querySelector('circle:nth-of-type(9)');\n        if (v9) {\n          anims.push(fgAnimAttr(v9, 'r', [{\"--fg-r\":\"1\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"1\"}], {\"duration\":600,\"delay\":800,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v10 = svg.querySelector('circle:nth-of-type(10)');\n        if (v10) {\n          anims.push(fgAnimAttr(v10, 'r', [{\"--fg-r\":\"1\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"1\"}], {\"duration\":600,\"delay\":500,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v11 = svg.querySelector('circle:nth-of-type(11)');\n        if (v11) {\n          anims.push(fgAnimAttr(v11, 'r', [{\"--fg-r\":\"1\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"1\"}], {\"duration\":600,\"delay\":700,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var v12 = svg.querySelector('circle:nth-of-type(12)');\n        if (v12) {\n          anims.push(fgAnimAttr(v12, 'r', [{\"--fg-r\":\"1\",\"easing\":\"cubic-bezier(.27,.42,.37,.99)\"},{\"--fg-r\":\"2\",\"easing\":\"cubic-bezier(.53,0,.61,.73)\"},{\"--fg-r\":\"1\"}], {\"duration\":600,\"delay\":600,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1200}));\n        }\n        var g = svg.querySelector('g');\n        if (g) {\n          anims.push(g.animate([{\"transform\":\"rotate(360deg)\",\"transformOrigin\":\"12px 12px\"},{\"transform\":\"rotate(0deg)\",\"transformOrigin\":\"12px 12px\"}], {\"duration\":6000,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "bouncing-ball": "    var anims = [];\n        var el = svg.querySelector('ellipse');\n        if (el) {\n          anims.push(fgAnimAttr(el, 'cy', [{\"--fg-cy\":\"5\",\"offset\":0,\"easing\":\"cubic-bezier(.33,0,.66,.33)\"},{\"--fg-cy\":\"20\",\"offset\":0.46875,\"easing\":\"cubic-bezier(.33,0,.66,.33)\"},{\"--fg-cy\":\"20.5\",\"offset\":0.5,\"easing\":\"cubic-bezier(.33,.66,.66,1)\"},{\"--fg-cy\":\"5\",\"offset\":1}], {\"duration\":800,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n          anims.push(fgAnimAttr(el, 'rx', [{\"--fg-rx\":\"4\",\"offset\":0},{\"--fg-rx\":\"4\",\"offset\":0.46875,\"easing\":\"cubic-bezier(.33,0,.66,.33)\"},{\"--fg-rx\":\"4.8\",\"offset\":0.5,\"easing\":\"cubic-bezier(.33,.66,.66,1)\"},{\"--fg-rx\":\"4\",\"offset\":0.53125},{\"--fg-rx\":\"4\",\"offset\":1}], {\"duration\":800,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n          anims.push(fgAnimAttr(el, 'ry', [{\"--fg-ry\":\"4\",\"offset\":0},{\"--fg-ry\":\"4\",\"offset\":0.46875,\"easing\":\"cubic-bezier(.33,0,.66,.33)\"},{\"--fg-ry\":\"3\",\"offset\":0.5,\"easing\":\"cubic-bezier(.33,.66,.66,1)\"},{\"--fg-ry\":\"4\",\"offset\":0.53125},{\"--fg-ry\":\"4\",\"offset\":1}], {\"duration\":800,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
    "blocks-shuffle-2": "    var anims = [];\n        var r1 = svg.querySelector('rect');\n        if (r1) {\n          anims.push(fgAnimAttr(r1, 'x', [{\"--fg-x\":\"1\",\"offset\":0},{\"--fg-x\":\"13\",\"offset\":0.125},{\"--fg-x\":\"13\",\"offset\":0.5},{\"--fg-x\":\"1\",\"offset\":0.625},{\"--fg-x\":\"1\",\"offset\":1}], {\"duration\":1600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1600}));\n          anims.push(fgAnimAttr(r1, 'y', [{\"--fg-y\":\"1\",\"offset\":0},{\"--fg-y\":\"1\",\"offset\":0.25},{\"--fg-y\":\"13\",\"offset\":0.375},{\"--fg-y\":\"13\",\"offset\":0.75},{\"--fg-y\":\"1\",\"offset\":0.875},{\"--fg-y\":\"1\",\"offset\":1}], {\"duration\":1600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1600}));\n        }\n        var r2 = svg.querySelector('rect:nth-of-type(2)');\n        if (r2) {\n          anims.push(fgAnimAttr(r2, 'x', [{\"--fg-x\":\"1\",\"offset\":0},{\"--fg-x\":\"1\",\"offset\":0.375},{\"--fg-x\":\"13\",\"offset\":0.5},{\"--fg-x\":\"13\",\"offset\":0.875},{\"--fg-x\":\"1\",\"offset\":1}], {\"duration\":1600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1600}));\n          anims.push(fgAnimAttr(r2, 'y', [{\"--fg-y\":\"13\",\"offset\":0},{\"--fg-y\":\"13\",\"offset\":0.125},{\"--fg-y\":\"1\",\"offset\":0.25},{\"--fg-y\":\"1\",\"offset\":0.625},{\"--fg-y\":\"13\",\"offset\":0.75},{\"--fg-y\":\"13\",\"offset\":1}], {\"duration\":1600,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":1600}));\n        }\n        return anims;\n",
    "blocks-shuffle-3": "    var anims = [];\n        var r1 = svg.querySelector('rect');\n        if (r1) {\n          anims.push(fgAnimAttr(r1, 'x', [{\"--fg-x\":\"1\",\"offset\":0},{\"--fg-x\":\"13\",\"offset\":0.083333},{\"--fg-x\":\"13\",\"offset\":0.5},{\"--fg-x\":\"1\",\"offset\":0.583333},{\"--fg-x\":\"1\",\"offset\":1}], {\"duration\":2400,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":2400}));\n          anims.push(fgAnimAttr(r1, 'y', [{\"--fg-y\":\"1\",\"offset\":0},{\"--fg-y\":\"1\",\"offset\":0.25},{\"--fg-y\":\"13\",\"offset\":0.333333},{\"--fg-y\":\"13\",\"offset\":0.75},{\"--fg-y\":\"1\",\"offset\":0.833333},{\"--fg-y\":\"1\",\"offset\":1}], {\"duration\":2400,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":2400}));\n        }\n        var r2 = svg.querySelector('rect:nth-of-type(2)');\n        if (r2) {\n          anims.push(fgAnimAttr(r2, 'x', [{\"--fg-x\":\"1\",\"offset\":0},{\"--fg-x\":\"1\",\"offset\":0.333333},{\"--fg-x\":\"13\",\"offset\":0.416667},{\"--fg-x\":\"13\",\"offset\":0.833333},{\"--fg-x\":\"1\",\"offset\":0.916667},{\"--fg-x\":\"1\",\"offset\":1}], {\"duration\":2400,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":2400}));\n          anims.push(fgAnimAttr(r2, 'y', [{\"--fg-y\":\"13\",\"offset\":0},{\"--fg-y\":\"13\",\"offset\":0.083333},{\"--fg-y\":\"1\",\"offset\":0.166667},{\"--fg-y\":\"1\",\"offset\":0.583333},{\"--fg-y\":\"13\",\"offset\":0.666667},{\"--fg-y\":\"13\",\"offset\":1}], {\"duration\":2400,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":2400}));\n        }\n        var r3 = svg.querySelector('rect:nth-of-type(3)');\n        if (r3) {\n          anims.push(fgAnimAttr(r3, 'x', [{\"--fg-x\":\"13\",\"offset\":0},{\"--fg-x\":\"13\",\"offset\":0.166667},{\"--fg-x\":\"1\",\"offset\":0.25},{\"--fg-x\":\"1\",\"offset\":0.666667},{\"--fg-x\":\"13\",\"offset\":0.75},{\"--fg-x\":\"13\",\"offset\":1}], {\"duration\":2400,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":2400}));\n          anims.push(fgAnimAttr(r3, 'y', [{\"--fg-y\":\"13\",\"offset\":0},{\"--fg-y\":\"13\",\"offset\":0.416667},{\"--fg-y\":\"1\",\"offset\":0.5},{\"--fg-y\":\"1\",\"offset\":0.916667},{\"--fg-y\":\"13\",\"offset\":1}], {\"duration\":2400,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":2400}));\n        }\n        return anims;\n",
    "3-dots-move": "    var anims = [];\n        var clk = {v: null};\n        var opts = function(d) { return {\"duration\":d,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":d,\"sharedClock\":clk}; };\n        var c1 = svg.querySelector('circle');\n        if (c1) {\n          anims.push(fgAnimAttr(c1, 'r',  [{\"--fg-r\":\"0\",\"offset\":0,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-r\":\"3\",\"offset\":0.249501},{\"--fg-r\":\"3\",\"offset\":0.75,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-r\":\"0\",\"offset\":0.999501},{\"--fg-r\":\"0\",\"offset\":1}],  opts(2004)));\n          anims.push(fgAnimAttr(c1, 'cx', [{\"--fg-cx\":\"4\",\"offset\":0},{\"--fg-cx\":\"4\",\"offset\":0.25,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-cx\":\"12\",\"offset\":0.499501},{\"--fg-cx\":\"12\",\"offset\":0.5,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-cx\":\"20\",\"offset\":0.749501},{\"--fg-cx\":\"20\",\"offset\":0.999501},{\"--fg-cx\":\"4\",\"offset\":1}], opts(2004)));\n        }\n        var c2 = svg.querySelector('circle:nth-of-type(2)');\n        if (c2) {\n          anims.push(fgAnimAttr(c2, 'r',  [{\"--fg-r\":\"3\",\"offset\":0},{\"--fg-r\":\"3\",\"offset\":0.5,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-r\":\"0\",\"offset\":0.749501},{\"--fg-r\":\"0\",\"offset\":0.75,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-r\":\"3\",\"offset\":0.999501},{\"--fg-r\":\"3\",\"offset\":1}],  opts(2004)));\n          anims.push(fgAnimAttr(c2, 'cx', [{\"--fg-cx\":\"4\",\"offset\":0,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-cx\":\"12\",\"offset\":0.249501},{\"--fg-cx\":\"12\",\"offset\":0.25,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-cx\":\"20\",\"offset\":0.499501},{\"--fg-cx\":\"20\",\"offset\":0.749501},{\"--fg-cx\":\"4\",\"offset\":0.75},{\"--fg-cx\":\"4\",\"offset\":1}], opts(2004)));\n        }\n        var c3 = svg.querySelector('circle:nth-of-type(3)');\n        if (c3) {\n          anims.push(fgAnimAttr(c3, 'r',  [{\"--fg-r\":\"3\",\"offset\":0},{\"--fg-r\":\"3\",\"offset\":0.25,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-r\":\"0\",\"offset\":0.499501},{\"--fg-r\":\"0\",\"offset\":0.5,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-r\":\"3\",\"offset\":0.749501},{\"--fg-r\":\"3\",\"offset\":1}],  opts(2004)));\n          anims.push(fgAnimAttr(c3, 'cx', [{\"--fg-cx\":\"12\",\"offset\":0,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-cx\":\"20\",\"offset\":0.249501},{\"--fg-cx\":\"20\",\"offset\":0.499501},{\"--fg-cx\":\"4\",\"offset\":0.5},{\"--fg-cx\":\"4\",\"offset\":0.75,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-cx\":\"12\",\"offset\":0.999501},{\"--fg-cx\":\"12\",\"offset\":1}], opts(2004)));\n        }\n        var c4 = svg.querySelector('circle:nth-of-type(4)');\n        if (c4) {\n          anims.push(fgAnimAttr(c4, 'r',  [{\"--fg-r\":\"3\",\"offset\":0,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-r\":\"0\",\"offset\":0.249501},{\"--fg-r\":\"0\",\"offset\":0.25,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-r\":\"3\",\"offset\":0.499501},{\"--fg-r\":\"3\",\"offset\":1}],  opts(2004)));\n          anims.push(fgAnimAttr(c4, 'cx', [{\"--fg-cx\":\"20\",\"offset\":0},{\"--fg-cx\":\"20\",\"offset\":0.249501},{\"--fg-cx\":\"4\",\"offset\":0.25},{\"--fg-cx\":\"4\",\"offset\":0.5,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-cx\":\"12\",\"offset\":0.749501},{\"--fg-cx\":\"12\",\"offset\":0.75,\"easing\":\"cubic-bezier(.36,.6,.31,1)\"},{\"--fg-cx\":\"20\",\"offset\":0.999501},{\"--fg-cx\":\"20\",\"offset\":1}], opts(2004)));\n        }\n        return anims;\n",
    "fotogrids": "    var anims = [];\n        var clk = {v: null};\n        var opts = function() { return {\"duration\":2200,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":2200,\"sharedClock\":clk}; };\n        var r1 = svg.querySelector('rect');\n        if (r1) {\n          anims.push(fgAnimAttr(r1, 'width',  [{\"--fg-width\":\"0\",\"offset\":0},{\"--fg-width\":\"24\",\"offset\":0.181818},{\"--fg-width\":\"24\",\"offset\":0.545455},{\"--fg-width\":\"0\",\"offset\":0.727273},{\"--fg-width\":\"0\",\"offset\":1}], opts()));\n          anims.push(fgAnimAttr(r1, 'x',     [{\"--fg-x\":\"0\",\"offset\":0},{\"--fg-x\":\"0\",\"offset\":0.545455},{\"--fg-x\":\"24\",\"offset\":0.727273},{\"--fg-x\":\"24\",\"offset\":1}], opts()));\n        }\n        var r2 = svg.querySelector('rect:nth-of-type(2)');\n        if (r2) {\n          anims.push(fgAnimAttr(r2, 'width',  [{\"--fg-width\":\"0\",\"offset\":0},{\"--fg-width\":\"0\",\"offset\":0.090909},{\"--fg-width\":\"15\",\"offset\":0.272727},{\"--fg-width\":\"15\",\"offset\":0.636364},{\"--fg-width\":\"0\",\"offset\":0.818182},{\"--fg-width\":\"0\",\"offset\":1}], opts()));\n          anims.push(fgAnimAttr(r2, 'x',     [{\"--fg-x\":\"0\",\"offset\":0},{\"--fg-x\":\"0\",\"offset\":0.636364},{\"--fg-x\":\"15\",\"offset\":0.818182},{\"--fg-x\":\"15\",\"offset\":1}], opts()));\n        }\n        var r3 = svg.querySelector('rect:nth-of-type(3)');\n        if (r3) {\n          anims.push(fgAnimAttr(r3, 'width',  [{\"--fg-width\":\"0\",\"offset\":0},{\"--fg-width\":\"0\",\"offset\":0.181818},{\"--fg-width\":\"6\",\"offset\":0.272727},{\"--fg-width\":\"6\",\"offset\":0.772727},{\"--fg-width\":\"0\",\"offset\":0.863636},{\"--fg-width\":\"0\",\"offset\":1}], opts()));\n          anims.push(fgAnimAttr(r3, 'x',     [{\"--fg-x\":\"0\",\"offset\":0},{\"--fg-x\":\"0\",\"offset\":0.772727},{\"--fg-x\":\"6\",\"offset\":0.863636},{\"--fg-x\":\"6\",\"offset\":1}], opts()));\n        }\n        var r4 = svg.querySelector('rect:nth-of-type(4)');\n        if (r4) {\n          anims.push(fgAnimAttr(r4, 'height', [{\"--fg-height\":\"0\",\"offset\":0},{\"--fg-height\":\"0\",\"offset\":0.318182},{\"--fg-height\":\"6\",\"offset\":0.409091},{\"--fg-height\":\"6\",\"offset\":0.909091},{\"--fg-height\":\"0\",\"offset\":1}], opts()));\n          anims.push(fgAnimAttr(r4, 'y',     [{\"--fg-y\":\"24\",\"offset\":0},{\"--fg-y\":\"24\",\"offset\":0.318182},{\"--fg-y\":\"18\",\"offset\":0.409091},{\"--fg-y\":\"18\",\"offset\":0.999999},{\"--fg-y\":\"24\",\"offset\":1}], opts()));\n        }\n        var r5 = svg.querySelector('rect:nth-of-type(5)');\n        if (r5) {\n          // r5 shrink crosses the 2200ms cycle boundary (runs 2100-2500ms; tail 0-300ms in next cycle).\n          // Steady-state keyframes start mid-shrink (height=11.25) so the loop is seamless.\n          // On cycle 1 we want r5 hidden (height=0, y=24) for the first 300ms, then in sync.\n          // We achieve this by setting the SVG attributes directly and starting the looping\n          // animation with a 300ms delay - but using the same sharedClock so that from cycle 2\n          // onward r5 is phase-locked with r1-r4 (both have period 2200ms and the same origin).\n          r5.setAttribute('height', '0');\n          r5.setAttribute('y', '24');\n          setTimeout(function() {\n            anims.push(fgAnimAttr(r5, 'height', [{\"--fg-height\":\"11.25\",\"offset\":0},{\"--fg-height\":\"0\",\"offset\":0.136364},{\"--fg-height\":\"0\",\"offset\":0.454545},{\"--fg-height\":\"15\",\"offset\":0.636364},{\"--fg-height\":\"15\",\"offset\":0.954545},{\"--fg-height\":\"11.25\",\"offset\":1}], {\"duration\":2200,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":2200,\"sharedClock\":clk}));\n            anims.push(fgAnimAttr(r5, 'y',     [{\"--fg-y\":\"9\",\"offset\":0},{\"--fg-y\":\"9\",\"offset\":0.136364},{\"--fg-y\":\"24\",\"offset\":0.136365},{\"--fg-y\":\"24\",\"offset\":0.454545},{\"--fg-y\":\"9\",\"offset\":0.636364},{\"--fg-y\":\"9\",\"offset\":1}], {\"duration\":2200,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":2200,\"sharedClock\":clk}));\n          }, 300);\n        }\n        return anims;\n",
    "square-loader": "    var anims = [];\n        var g = svg.querySelector('g');\n        if (g) {\n          anims.push(g.animate([{\"transform\":\"rotate(0deg)\",\"transformOrigin\":\"50px 50px\",\"offset\":0},{\"transform\":\"rotate(0deg)\",\"transformOrigin\":\"50px 50px\",\"offset\":0.333333},{\"transform\":\"rotate(180deg)\",\"transformOrigin\":\"50px 50px\",\"offset\":0.5},{\"transform\":\"rotate(180deg)\",\"transformOrigin\":\"50px 50px\",\"offset\":0.833333},{\"transform\":\"rotate(360deg)\",\"transformOrigin\":\"50px 50px\",\"offset\":1}], {\"duration\":3000,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var rect = svg.querySelector('rect:nth-of-type(2)');\n        if (rect) {\n          anims.push(fgAnimAttr(rect, 'height', [{\"--fg-height\":\"56\",\"offset\":0},{\"--fg-height\":\"0\",\"offset\":0.333333},{\"--fg-height\":\"0\",\"offset\":0.5},{\"--fg-height\":\"56\",\"offset\":0.833333},{\"--fg-height\":\"56\",\"offset\":1}], {\"duration\":3000,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\",\"cyclePeriod\":3000}));\n        }\n        return anims;\n",
    "ball-triangle": "    var anims = [];\n        var c1 = svg.querySelector('circle');\n        if (c1) {\n          anims.push(fgAnimAttr(c1, 'cy', [{\"--fg-cy\":\"50\"},{\"--fg-cy\":\"5\"},{\"--fg-cy\":\"50\"},{\"--fg-cy\":\"50\"}], {\"duration\":2200,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n          anims.push(fgAnimAttr(c1, 'cx', [{\"--fg-cx\":\"5\"},{\"--fg-cx\":\"27\"},{\"--fg-cx\":\"49\"},{\"--fg-cx\":\"5\"}], {\"duration\":2200,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var c2 = svg.querySelector('circle:nth-of-type(2)');\n        if (c2) {\n          anims.push(fgAnimAttr(c2, 'cy', [{\"--fg-cy\":\"5\"},{\"--fg-cy\":\"50\"},{\"--fg-cy\":\"50\"},{\"--fg-cy\":\"5\"}], {\"duration\":2200,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n          anims.push(fgAnimAttr(c2, 'cx', [{\"--fg-cx\":\"27\"},{\"--fg-cx\":\"49\"},{\"--fg-cx\":\"5\"},{\"--fg-cx\":\"27\"}], {\"duration\":2200,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        var c3 = svg.querySelector('circle:nth-of-type(3)');\n        if (c3) {\n          anims.push(fgAnimAttr(c3, 'cy', [{\"--fg-cy\":\"50\"},{\"--fg-cy\":\"50\"},{\"--fg-cy\":\"5\"},{\"--fg-cy\":\"50\"}], {\"duration\":2200,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n          anims.push(fgAnimAttr(c3, 'cx', [{\"--fg-cx\":\"49\"},{\"--fg-cx\":\"5\"},{\"--fg-cx\":\"27\"},{\"--fg-cx\":\"49\"}], {\"duration\":2200,\"delay\":0,\"iterations\":Infinity,\"fill\":\"none\",\"easing\":\"linear\"}));\n        }\n        return anims;\n",
};

// ---------------------------------------------------------------------------
// XML parsing helpers (no external XML library - regex is sufficient for
// the well-structured SVGs in loading-icons.yaml)
// ---------------------------------------------------------------------------

/**
 * Parses attribute value from an SVG/XML tag string.
 * @param {string} tag
 * @param {string} attr
 * @returns {string|null}
 */
function getAttr(tag, attr) {
    const re = new RegExp(`\\b${attr}=['"](.*?)['"]`, 'i');
    const m  = tag.match(re);
    return m ? m[1] : null;
}

/**
 * Returns all <animate .../> and <animateTransform .../> tags from an SVG
 * string, each with their parent element index.
 *
 * @param {string} svg
 * @returns {Array<{tag:string, parentIndex:number, animIndex:number}>}
 */
function extractAnimations(svg) {
    const result = [];
    // Match each element including its children
    const elemRe = /<(circle|rect|path|ellipse|g|line|polygon|polyline)[^>]*(?:\/>|>[\s\S]*?<\/\1>)/gi;
    let elemIndex = 0;
    let m;
    while ((m = elemRe.exec(svg)) !== null) {
        const elem     = m[0];
        const animRe   = /<animate(?:Transform)?\s[^/]*\/>/g;
        let animMatch;
        while ((animMatch = animRe.exec(elem)) !== null) {
            result.push({
                tag:         animMatch[0],
                parentIndex: elemIndex,
                animIndex:   result.length,
            });
        }
        elemIndex++;
    }
    return result;
}

/**
 * Strips __FG_ID__ placeholder from an ID string.
 * @param {string} id
 * @returns {string}
 */
function cleanId(id) {
    return id ? id.replace(/___FG_ID__$/, '').replace(/-__FG_ID__$/, '') : id;
}

// ---------------------------------------------------------------------------
// Easing conversion
// ---------------------------------------------------------------------------

/**
 * Converts SMIL keySplines + keyTimes to a WAAPI easing array.
 * keySplines is a semicolon-separated list of cubic-bezier control points,
 * one per interval. WAAPI accepts an easing per keyframe (applied going INTO
 * the next keyframe).
 *
 * @param {string|null} keySplines  e.g. ".36,.6,.31,1;.36,.6,.31,1"
 * @param {string|null} calcMode
 * @param {number}      valueCount  number of values
 * @returns {string|string[]}       single string or per-keyframe array
 */
function buildEasing(keySplines, calcMode, valueCount) {
    if (calcMode === 'discrete') {
        return `steps(${valueCount - 1}, end)`;
    }
    if (calcMode === 'spline' && keySplines) {
        const splines = keySplines.trim().split(';').map(s => {
            const pts = s.trim().split(/[\s,]+/);
            if (pts.length !== 4) return 'ease';
            return `cubic-bezier(${pts.join(',')})`;
        });
        // WAAPI: easing on keyframe N applies from N to N+1.
        // We have one spline per interval, so attach to all but the last keyframe.
        return splines;
    }
    if (calcMode === 'linear') return 'linear';
    return 'ease'; // SMIL default
}

// ---------------------------------------------------------------------------
// Duration parsing
// ---------------------------------------------------------------------------

/**
 * Parses an SMIL duration string to milliseconds.
 * @param {string} dur  e.g. "0.75s" or "750ms"
 * @returns {number}
 */
function parseDur(dur) {
    if (!dur) return 1000;
    const s  = dur.match(/^([\d.]+)s$/);
    const ms = dur.match(/^([\d.]+)ms$/);
    const bare = dur.match(/^([\d.]+)$/);  // bare number with no unit = seconds
    if (s)    return Math.round(parseFloat(s[1])  * 1000);
    if (ms)   return Math.round(parseFloat(ms[1]));
    if (bare) return Math.round(parseFloat(bare[1]) * 1000);
    return 1000;
}

// ---------------------------------------------------------------------------
// Begin offset resolution
// ---------------------------------------------------------------------------

/**
 * Parses the offset component from a SMIL event-reference string.
 * e.g. "fg_ia_3bounce_2___FG_ID__.end+0.25s" → 250
 *      "fg_ia_barsscale_2___FG_ID__.end-0.1s" → -100
 *      "0"                                    → 0
 * @param {string} val  single begin value (no semicolons)
 * @returns {number}  ms offset, or 0 if not parseable
 */
function parseBeginOffset(val) {
    if (!val) return 0;
    val = val.trim();
    const timeRe = /^-?[\d.]+(?:m?s)?$/;
    if (timeRe.test(val)) {
        const sign = val.startsWith('-') ? -1 : 1;
        return sign * parseDur(val.replace(/^-/, ''));
    }
    const eventRe = /^[\w-]+(?:___FG_ID__|(?:-__FG_ID__))?\.\w+([+-][\d.]+(?:m?s)?)?$/;
    const em = val.match(eventRe);
    if (em && em[1]) {
        const sign = em[1].startsWith('-') ? -1 : 1;
        return sign * parseDur(em[1].replace(/^[+-]/, ''));
    }
    return 0;
}

/**
 * Parses a single SMIL begin value and returns:
 *   { type, refId, event, offset, isLooping, loopGap }
 *
 *   type:      'offset' | 'event'
 *   refId:     cleaned ID string (for event-based)
 *   event:     'begin' | 'end'
 *   offset:    ms offset (may be negative)
 *   isLooping: true when begin has a semicolon list - the SMIL way of
 *              encoding "restart after the chain completes". The caller
 *              should set iterations:Infinity on stagger patterns, or use
 *              fgLoopChain() for strictly sequential ones.
 *   loopGap:   ms added to cyclePeriod to get the true inter-cycle pause.
 *              Extracted from the second value of the semicolon list.
 *              e.g. "0;fg_ia_3bounce_2.end+0.25s" → loopGap = 250
 *              Only set on the anchor animation (the one with begin='0;...')
 *
 * @param {string} begin
 * @returns {{type:string, refId?:string, event?:string, offset:number, isLooping:boolean, loopGap:number}}
 */
function parseBegin(begin) {
    if (!begin) return { type: 'offset', offset: 0, isLooping: false, loopGap: 0 };

    const isLooping = begin.includes(';');

    // Extract loop gap from second value (e.g. "fg_ia_3bounce_2.end+0.25s" → 250ms)
    let loopGap = 0;
    if (isLooping) {
        const parts = begin.split(';');
        if (parts.length >= 2) {
            loopGap = Math.max(0, parseBeginOffset(parts[1].trim()));
        }
    }

    // Take first value if semicolon list
    const first = begin.split(';')[0].trim();

    // Pure time offset: "0", "0.5s", "-0.9s"
    const timeRe = /^-?[\d.]+(?:m?s)?$/;
    if (timeRe.test(first)) {
        const sign   = first.startsWith('-') ? -1 : 1;
        const abs    = first.replace(/^-/, '');
        return { type: 'offset', offset: sign * parseDur(abs), isLooping, loopGap };
    }

    // Event reference: "fg_ia_3bounce_1___FG_ID__.begin+0.1s"
    const eventRe = /^([\w-]+(?:___FG_ID__|(?:-__FG_ID__))?)\.(\w+)([+-][\d.]+(?:m?s)?)?$/;
    const em = first.match(eventRe);
    if (em) {
        const refId  = cleanId(em[1]);
        const event  = em[2]; // 'begin' or 'end'
        let   offset = 0;
        if (em[3]) {
            const sign = em[3].startsWith('-') ? -1 : 1;
            const abs  = em[3].replace(/^[+-]/, '');
            offset = sign * parseDur(abs);
        }
        return { type: 'event', refId, event, offset, isLooping, loopGap };
    }

    return { type: 'offset', offset: 0, isLooping, loopGap };
}

/**
 * Resolves all SMIL begin references to absolute ms delays using
 * topological sort + BFS over the dependency graph.
 *
 * For event-based begins, the absolute start time is computed as:
 *   refAnim.absoluteStart + (event==='end' ? refAnim.dur : 0) + offset
 *
 * Also detects two looping patterns:
 *
 *   'stagger' - at least one animation has isLooping=true and all animations
 *               share the same dur. Each element loops independently with
 *               iterations:Infinity; the delay staggers each one. The cycle
 *               period = max(delay + dur) across all animations.
 *               endDelay per animation = cyclePeriod - delay - dur.
 *
 *   'chain'   - animations fire sequentially (each triggers when the previous
 *               ends). At least one has isLooping:true. These can't use
 *               iterations:Infinity individually - the runtime must re-trigger
 *               the whole chain after it completes. We emit a fgLoopChain()
 *               call in this case.
 *
 * @param {Array<{tag:string}>} anims   parsed animation tags
 * @returns {{ delays: number[], isLooping: boolean[], loopType: string, cyclePeriod: number }}
 */
function resolveDelays(anims) {
    const parsed = anims.map(a => {
        const id    = cleanId(getAttr(a.tag, 'id'));
        const begin = parseBegin(getAttr(a.tag, 'begin'));
        const dur   = parseDur(getAttr(a.tag, 'dur'));
        return { id, begin, dur };
    });

    // Build ID → index map
    const idMap = {};
    parsed.forEach((p, i) => { if (p.id) idMap[p.id] = i; });

    const resolved = new Array(parsed.length).fill(null);

    function resolve(i, depth = 0) {
        if (depth > 50) return 0; // cycle guard
        if (resolved[i] !== null) return resolved[i];

        const p = parsed[i];
        if (p.begin.type === 'offset') {
            resolved[i] = p.begin.offset;
            return resolved[i];
        }

        // Event-based
        const refIdx = idMap[p.begin.refId];
        if (refIdx === undefined) {
            resolved[i] = p.begin.offset;
            return resolved[i];
        }

        const refStart = resolve(refIdx, depth + 1);
        const refDur   = parsed[refIdx].dur;
        const base     = p.begin.event === 'end' ? refStart + refDur : refStart;
        resolved[i]    = base + p.begin.offset;
        return resolved[i];
    }

    parsed.forEach((_, i) => resolve(i));

    // Shift so minimum delay is 0
    const minDelay = Math.min(...resolved);
    const delays = resolved.map(d => d - minDelay);

    // Determine looping type
    const anyLooping    = parsed.some(p => p.begin.isLooping);
    const isLooping     = parsed.map(p => p.begin.isLooping);

    // Cycle period = the absolute time at which the looping anchor restarts.
    // The anchor animation has begin='0;<ref>.end±offset' (or '0;<ref>.begin±offset').
    // We resolve the second value against the already-resolved absolute start times
    // to get the exact restart moment. This correctly handles both:
    //   begin='0;fg_ia_3bounce_2.end+0.25s'  → restart after last ends + gap
    //   begin='0;fg_ia_3scale_2.end-0.25s'   → restart before last ends (overlap)
    let cyclePeriod = Math.max(...delays.map((d, i) => d + parsed[i].dur)); // fallback

    // Find the looping anchor: the one with isLooping=true whose first value is '0'
    const anchorIdx = parsed.findIndex(p => p.begin.isLooping && p.begin.type === 'offset' && p.begin.offset === 0);
    if (anchorIdx !== -1) {
        // Re-parse the second begin value from the raw tag
        const anchorTag   = anims[anchorIdx].tag;
        const rawBegin    = getAttr(anchorTag, 'begin') || '';
        const parts       = rawBegin.split(';');
        if (parts.length >= 2) {
            const second = parts[1].trim();
            // Parse: '<id>.<event>[±offset]'
            const eventRe2 = /^([\w-]+(?:___FG_ID__|(?:-__FG_ID__))?)\.(\w+)([+-][\d.]+(?:m?s)?)?$/;
            const em2 = second.match(eventRe2);
            if (em2) {
                const refId2  = cleanId(em2[1]);
                const event2  = em2[2];
                let   off2    = 0;
                if (em2[3]) {
                    const sign = em2[3].startsWith('-') ? -1 : 1;
                    off2 = sign * parseDur(em2[3].replace(/^[+-]/, ''));
                }
                const refIdx2 = idMap[refId2];
                if (refIdx2 !== undefined) {
                    const refAbsStart = delays[refIdx2]; // already shifted
                    const refDur2     = parsed[refIdx2].dur;
                    const base2       = event2 === 'end' ? refAbsStart + refDur2 : refAbsStart;
                    cyclePeriod       = Math.max(0, base2 + off2);
                }
            } else if (/^-?[\d.]+(?:m?s)?$/.test(second)) {
                // Pure time: e.g. '1s'
                cyclePeriod = parseDur(second);
            }
        }
    }

    // Stagger pattern: delays are NOT strictly sequential (multiple start near t=0),
    // and all animations have the same duration. In this case each can loop
    // independently with iterations:Infinity + endDelay padding.
    // Chain pattern: animations fire strictly one-after-another (each delay > 0
    // equals a previous delay+dur). Need fgLoopChain().
    const uniqueDelays  = new Set(delays);
    const allSameDur    = parsed.every(p => p.dur === parsed[0].dur);
    // A chain has many unique delays and each one equals a previous end time.
    // A stagger has few unique delays clustering near 0 with fixed offsets.
    // Heuristic: if max delay < 2 * min(dur), it's a stagger; otherwise chain.
    const minDur        = Math.min(...parsed.map(p => p.dur));
    const maxDelay      = Math.max(...delays);
    const loopType      = anyLooping
        ? (maxDelay <= minDur * 1.5 ? 'stagger' : 'chain')
        : 'none';

    return { delays, isLooping, loopType, cyclePeriod };
}

// ---------------------------------------------------------------------------
// Values parsing
// ---------------------------------------------------------------------------

/**
 * Parses SMIL values string to array of numbers or strings.
 * @param {string} values  e.g. "0;11" or "1;2;1"
 * @returns {string[]}
 */
function parseValues(values) {
    return values ? values.split(';').map(v => v.trim()) : [];
}

// ---------------------------------------------------------------------------
// Per-animation WAAPI call builder
// ---------------------------------------------------------------------------

/**
 * Converts one SMIL <animate> or <animateTransform> tag to a WAAPI call
 * descriptor.
 *
 * @param {string} tag
 * @param {number} delay   resolved absolute delay in ms
 * @param {string} selector  CSS selector or nth-child description for the target element
 * @returns {object|null}   descriptor or null if unsupported
 */
function convertAnim(tag, delay, selector) {
    const isTransform = tag.includes('<animateTransform');
    const attrName    = getAttr(tag, 'attributeName');
    const type        = getAttr(tag, 'type');
    const dur         = parseDur(getAttr(tag, 'dur'));
    const valuesStr   = getAttr(tag, 'values');
    const fromStr     = getAttr(tag, 'from');
    const toStr       = getAttr(tag, 'to');
    const calcMode    = getAttr(tag, 'calcMode') || 'linear';
    const keySplines  = getAttr(tag, 'keySplines');
    const keyTimes    = getAttr(tag, 'keyTimes');
    const repeatCount = getAttr(tag, 'repeatCount') || '1';
    const fillAttr    = getAttr(tag, 'fill') || 'remove';

    // Build values array
    let values = valuesStr ? parseValues(valuesStr) : null;
    if (!values && fromStr !== null && toStr !== null) {
        values = [fromStr, toStr];
    }
    if (!values || values.length < 2) return null;

    const iterations = repeatCount === 'indefinite' ? Infinity : parseFloat(repeatCount) || 1;
    const fill       = fillAttr === 'freeze' ? 'forwards' : 'none';
    const easing     = buildEasing(keySplines, calcMode, values.length);

    // animateTransform type="rotate"
    if (isTransform && attrName === 'transform' && type === 'rotate') {
        const keyframes = values.map((v, i) => {
            const parts = v.trim().split(/\s+/);
            const deg   = parseFloat(parts[0]);
            const cx    = parts[1] || '12';
            const cy    = parts[2] || '12';
            const frame = {
                transform:       `rotate(${deg}deg)`,
                transformOrigin: `${cx}px ${cy}px`,
            };
            if (Array.isArray(easing) && i < easing.length) {
                frame.easing = easing[i];
            }
            return frame;
        });
        if (keyTimes) {
            const kt = keyTimes.split(';').map(Number);
            keyframes.forEach((f, i) => { f.offset = kt[i]; });
        }
        return {
            selector,
            property: 'transform',
            keyframes,
            timing: {
                duration:   dur,
                delay,
                iterations,
                fill,
                easing:     Array.isArray(easing) ? 'linear' : easing,
            },
        };
    }

    // CSS-animatable properties: opacity, fill-opacity, stroke-opacity
    const cssProps = { opacity: true, 'fill-opacity': true, 'stroke-opacity': true };
    if (!isTransform && cssProps[attrName]) {
        const cssProp  = attrName === 'fill-opacity' ? 'fillOpacity'
                       : attrName === 'stroke-opacity' ? 'strokeOpacity'
                       : 'opacity';
        const keyframes = values.map((v, i) => {
            const frame = { [cssProp]: parseFloat(v) };
            if (Array.isArray(easing) && i < easing.length) {
                frame.easing = easing[i];
            }
            return frame;
        });
        if (keyTimes) {
            const kt = keyTimes.split(';').map(Number);
            keyframes.forEach((f, i) => { f.offset = kt[i]; });
        }
        return {
            selector,
            property: cssProp,
            keyframes,
            timing: {
                duration:   dur,
                delay,
                iterations,
                fill,
                easing: Array.isArray(easing) ? 'linear' : easing,
            },
        };
    }

    // SVG presentation attributes: r, cx, cy, x, y, width, height, rx, ry,
    // stroke-dasharray, stroke-dashoffset.
    // These are not CSS-animatable - use a KeyframeEffect with a custom
    // attribute-setter approach via a tiny helper.
    const svgAttrs = new Set([
        'r','cx','cy','x','y','width','height','rx','ry',
        'stroke-dasharray','stroke-dashoffset',
    ]);
    if (!isTransform && svgAttrs.has(attrName)) {
        const keyframes = values.map((v, i) => {
            const frame = { [`--fg-${attrName}`]: v };
            if (Array.isArray(easing) && i < easing.length) {
                frame.easing = easing[i];
            }
            return frame;
        });
        if (keyTimes) {
            const kt = keyTimes.split(';').map(Number);
            keyframes.forEach((f, i) => { f.offset = kt[i]; });
        }
        return {
            selector,
            property: attrName,   // raw SVG attribute name
            isSvgAttr: true,      // signals the runtime to use setAttribute
            keyframes,
            timing: {
                duration:   dur,
                delay,
                iterations,
                fill,
                easing: Array.isArray(easing) ? 'linear' : easing,
            },
        };
    }

    return null; // unsupported - will be flagged
}

// ---------------------------------------------------------------------------
// Per-icon converter
// ---------------------------------------------------------------------------

/**
 * Strips all <animate> and <animateTransform> tags from an SVG string.
 * Used to produce the "shapes only" SVG for the WAAPI version.
 *
 * @param {string} svg
 * @returns {string}
 */
function stripSmil(svg) {
    return svg
        .replace(/<animate(?:Transform)?\s[^>]*\/>/g, '')
        .replace(/\s+>/g, '>')
        .replace(/>\s{2,}</g, '>\n<');
}

/**
 * Builds a selector string for an element at a given index within the SVG.
 * Uses nth-of-type where possible for robustness.
 *
 * @param {string} svg
 * @param {number} elemIndex
 * @returns {string}
 */
function buildSelector(svg, elemIndex) {
    // Find the element tag names in order
    const elemRe = /<(circle|rect|path|ellipse|g|line|polygon|polyline)\b/gi;
    const tags = [];
    let m;
    while ((m = elemRe.exec(svg)) !== null) {
        tags.push(m[1].toLowerCase());
    }
    const tagName = tags[elemIndex] || '*';

    // Count how many of this tag have appeared up to elemIndex
    let count = 0;
    for (let i = 0; i <= elemIndex; i++) {
        if (tags[i] === tagName) count++;
    }
    return count === 1 ? tagName : `${tagName}:nth-of-type(${count})`;
}

/**
 * Converts one icon's SVG to a WAAPI animate function body string.
 *
 * @param {string} name  icon name
 * @param {string} svg   raw SVG markup from YAML
 * @returns {{funcBody:string, strippedSvg:string, warnings:string[]}}
 */
function convertIcon(name, svg) {
    const warnings = [];
    const anims    = extractAnimations(svg);

    if (anims.length === 0) {
        return {
            funcBody:   '/* no SMIL animations found */',
            strippedSvg: svg,
            warnings,
        };
    }

    // Resolve all delays + looping metadata
    const { delays, loopType, cyclePeriod } = resolveDelays(anims);

    // Build descriptors
    const descriptors = [];
    anims.forEach((a, i) => {
        const selector = buildSelector(svg, a.parentIndex);
        const d = convertAnim(a.tag, delays[i], selector);
        if (!d) {
            warnings.push(`Unsupported anim on ${selector}: ${a.tag.substring(0, 80)}`);
        } else {
            // For stagger-loop icons: each animation loops independently with
            // iterations:Infinity.
            //
            // fgAnimAttr (SVG attrs like r, cx, cy, x, width…) uses cyclePeriod
            // as the loop period directly - it handles the inter-cycle hold itself.
            //
            // element.animate() (CSS props like opacity, transform…) supports
            // endDelay natively: the animation holds its end value for endDelay ms
            // before the next iteration, giving the same pause behaviour.
            if (loopType === 'stagger') {
                d.timing.iterations = Infinity;
                d.timing.fill       = 'none';
                if (d.isSvgAttr) {
                    // fgAnimAttr handles the hold via cyclePeriod directly.
                    d.timing.cyclePeriod = cyclePeriod;
                } else {
                    // element.animate() - bake the hold into the keyframes.
                    //
                    // In SMIL stagger patterns, every animation restarts once per
                    // cyclePeriod ms measured from its own start.  The first
                    // iteration of circle k starts at t = delay[k].  Its next
                    // start is at t = delay[k] + cyclePeriod.  Therefore the
                    // correct iteration duration for element.animate() is simply
                    // cyclePeriod - NOT (cyclePeriod - delay), which is wrong and
                    // causes r (fgAnimAttr, period=cyclePeriod) and opacity
                    // (element.animate) to drift out of sync for circles with
                    // delay > 0.
                    //
                    // Example - pulse circle 2 (delay=200, dur=1200, cp=1600):
                    //   iterDur = 1600, endFrac = 1200/1600 = 0.75
                    //   element.animate restarts at 200+1600 = 1800ms  ✓
                    //   fgAnimAttr also resets at 200+1600 = 1800ms    ✓
                    const iterDur = cyclePeriod;
                    const endFrac = d.timing.duration / iterDur;
                    if (endFrac < 1) {
                        const lastKf = { ...d.keyframes[d.keyframes.length - 1], offset: endFrac };
                        const holdKf = { ...d.keyframes[d.keyframes.length - 1], offset: 1 };
                        d.keyframes = [...d.keyframes.slice(0, -1), lastKf, holdKf];
                    }
                    d.timing.duration = iterDur;
                }
            }
            descriptors.push(d);
        }
    });

    if (MANUAL_REVIEW.has(name)) {
        warnings.push(`⚠️  ${name} flagged for manual visual review (complex animation pattern)`);
    }

    // Generate the function body
    const lines = [];
    lines.push(`var anims = [];`);

    if (loopType === 'chain') {
        // Sequential chain: emit a fgLoopChain() call that re-fires all
        // animations in order after the last one completes.
        lines.push(`anims = fgLoopChain(svg, [`);
        descriptors.forEach(d => {
            const kf  = JSON.stringify(d.keyframes);
            const t   = d.timing;
            const iterStr = t.iterations === Infinity ? 'Infinity' : String(t.iterations);
            const endDelayStr = t.endDelay ? `,"endDelay":${t.endDelay}` : '';
            const timing = `{"duration":${t.duration},"delay":${t.delay},"iterations":${iterStr},"fill":"${t.fill}","easing":"${t.easing}"${endDelayStr}}`;
            if (d.isSvgAttr) {
                lines.push(`  {selector:'${d.selector}',attr:'${d.property}',keyframes:${kf},timing:${timing},isSvgAttr:true},`);
            } else {
                lines.push(`  {selector:'${d.selector}',keyframes:${kf},timing:${timing}},`);
            }
        });
        lines.push(`]);`);
    } else {
        // Group by selector to avoid repeated querySelector calls
        const bySelector = {};
        descriptors.forEach(d => {
            if (!bySelector[d.selector]) bySelector[d.selector] = [];
            bySelector[d.selector].push(d);
        });

        Object.entries(bySelector).forEach(([sel, descs]) => {
            const varName = sel.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+/, 'el');
            lines.push(`var ${varName} = svg.querySelector('${sel}');`);
            lines.push(`if (${varName}) {`);

            descs.forEach(d => {
                const kf  = JSON.stringify(d.keyframes);
                // JSON.stringify converts Infinity to null - serialize manually.
                const t   = d.timing;
                const iterStr    = t.iterations === Infinity ? 'Infinity' : String(t.iterations);
                const extraStr   = t.cyclePeriod ? `,"cyclePeriod":${t.cyclePeriod}` : '';
                const timing = `{"duration":${t.duration},"delay":${t.delay},"iterations":${iterStr},"fill":"${t.fill}","easing":"${t.easing}"${extraStr}}`;

                if (d.isSvgAttr) {
                    lines.push(`  anims.push(fgAnimAttr(${varName}, '${d.property}', ${kf}, ${timing}));`);
                } else {
                    lines.push(`  anims.push(${varName}.animate(${kf}, ${timing}));`);
                }
            });

            lines.push(`}`);
        });
    }

    lines.push(`return anims;`);

    return {
        funcBody:    lines.join('\n    '),
        strippedSvg: stripSmil(svg),
        warnings,
    };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
    // Load YAML
    const yamlContent = fs.readFileSync(YAML_PATH, 'utf8');
    const icons       = yaml.load(yamlContent);

    const jsFunctions = {};
    const compareRows  = [];
    const allWarnings  = {};

    for (const [name, rawValue] of Object.entries(icons)) {
        const svg = typeof rawValue === 'string' ? rawValue.trim() : String(rawValue).trim();

        if (LOCKED_ICONS[name]) {
            // Confirmed-working body - emit verbatim, skip recomputation.
            // The strippedSvg is derived fresh so the HTML comparison panel
            // always reflects the current SVG source.
            jsFunctions[name] = {
                funcBody:    LOCKED_ICONS[name],
                strippedSvg: stripSmil(svg),
                isLocked:    true,
                isCss:       CSS_KEYFRAME_ICONS.has(name),
            };
        } else if (CSS_KEYFRAME_ICONS.has(name)) {
            // Already works - include a passthrough note, no animate() needed
            jsFunctions[name] = {
                funcBody:    `/* CSS @keyframes - no WAAPI needed */\nreturn [];`,
                strippedSvg: svg,
                isCss:       true,
            };
        } else {
            const result = convertIcon(name, svg);
            jsFunctions[name] = result;
            if (result.warnings.length) {
                allWarnings[name] = result.warnings;
            }
        }

        compareRows.push({ name, svg, strippedSvg: jsFunctions[name].strippedSvg });
    }

    // ----- Write JS output -----
    const jsLines = [];
    jsLines.push(`/**`);
    jsLines.push(` * FotoGrids - Loading Icons WAAPI`);
    jsLines.push(` *`);
    jsLines.push(` * Auto-generated by scripts/smil-to-waapi.js - do not edit by hand.`);
    jsLines.push(` * Each exported function animate(svgEl) starts all animations on the`);
    jsLines.push(` * given inline SVG element using the Web Animations API.`);
    jsLines.push(` *`);
    jsLines.push(` * SVG geometry attributes (r, cx, cy, x, y, width, height, etc.) are`);
    jsLines.push(` * not CSS-animatable. The fgAnimAttr() helper below interpolates them`);
    jsLines.push(` * via requestAnimationFrame + setAttribute, returning a minimal object`);
    jsLines.push(` * with a cancel() method so the caller can clean up.`);
    jsLines.push(` */`);
    jsLines.push(``);
    jsLines.push(`( function ( window ) {`);
    jsLines.push(`    'use strict';`);
    jsLines.push(``);

    // helperLines captures the shared runtime functions (fgCubicBezier, fgParseCB,
    // fgAnimAttr, fgLoopChain) so we can embed them in each standalone JSON entry.
    const helperLines = [];
    const pushBoth = (line) => { jsLines.push(line); helperLines.push(line); };

    // Cubic-bezier solver (shared by fgAnimAttr)
    pushBoth(`    /**`);
    pushBoth(`     * Solves cubic-bezier(p1x,p1y,p2x,p2y) for a given input x in [0,1].`);
    pushBoth(`     * Uses Newton's method to find parametric t, then evaluates y(t).`);
    pushBoth(`     * Falls back to linear when control points are linear (or on error).`);
    pushBoth(`     */`);
    pushBoth(`    function fgCubicBezier( p1x, p1y, p2x, p2y, x ) {`);
    pushBoth(`        if ( p1x === p1y && p2x === p2y ) return x; // linear shortcut`);
    pushBoth(`        function cx( t ) { return 3*p1x*t*(1-t)*(1-t) + 3*p2x*t*t*(1-t) + t*t*t; }`);
    pushBoth(`        function cy( t ) { return 3*p1y*t*(1-t)*(1-t) + 3*p2y*t*t*(1-t) + t*t*t; }`);
    pushBoth(`        function dcx( t ) { return 3*p1x*(1-t)*(1-3*t) + 3*p2x*t*(2-3*t) + 3*t*t; }`);
    pushBoth(`        var t = x, i = 0;`);
    pushBoth(`        for ( ; i < 8; i++ ) {`);
    pushBoth(`            var d = dcx( t );`);
    pushBoth(`            if ( Math.abs( d ) < 1e-6 ) break;`);
    pushBoth(`            t -= ( cx( t ) - x ) / d;`);
    pushBoth(`            if ( t < 0 ) { t = 0; break; }`);
    pushBoth(`            if ( t > 1 ) { t = 1; break; }`);
    pushBoth(`        }`);
    pushBoth(`        return cy( t );`);
    pushBoth(`    }`);
    pushBoth(``);
    pushBoth(`    /** Parses "cubic-bezier(a,b,c,d)" → [a,b,c,d] or null. */`);
    pushBoth(`    function fgParseCB( s ) {`);
    pushBoth(`        if ( !s || s === 'linear' || s === 'ease' ) return null;`);
    pushBoth(`        var m = s.match( /cubic-bezier\\(([^)]+)\\)/ );`);
    pushBoth(`        if ( !m ) return null;`);
    pushBoth(`        var p = m[1].split( ',' ).map( Number );`);
    pushBoth(`        return p.length === 4 ? p : null;`);
    pushBoth(`    }`);
    pushBoth(``);

    // SVG attribute animation helper
    pushBoth(`    /**`);
    pushBoth(`     * Animates an SVG presentation attribute (r, cx, x, width, etc.)`);
    pushBoth(`     * that WAAPI CSS keyframes cannot reach. Interpolates via rAF.`);
    pushBoth(`     * Respects per-keyframe cubic-bezier easing strings.`);
    pushBoth(`     *`);
    pushBoth(`     * @param {Element}  el       Target SVG element`);
    pushBoth(`     * @param {string}   attr     SVG attribute name`);
    pushBoth(`     * @param {Array}    keyframes  [{--fg-<attr>: value, easing?, offset?}, ...]`);
    pushBoth(`     * @param {object}   timing   {duration, delay, iterations, fill, cyclePeriod?, sharedClock?}`);
    pushBoth(`     * @returns {{cancel:function}}`);
    pushBoth(`     */`);
    pushBoth(`    function fgAnimAttr( el, attr, keyframes, timing ) {`);
    pushBoth(`        var key        = '--fg-' + attr;`);
    pushBoth(`        var values     = keyframes.map( function(f) { return parseFloat( f[key] ); } );`);
    pushBoth(`        var offsets    = keyframes.map( function(f, i) {`);
    pushBoth(`            return f.offset !== undefined ? f.offset : i / ( keyframes.length - 1 );`);
    pushBoth(`        } );`);
    pushBoth(`        var easings    = keyframes.map( function(f) { return fgParseCB( f.easing ); } );`);
    pushBoth(`        var dur        = timing.duration    || 1000;`);
    pushBoth(`        var delay      = timing.delay       || 0;`);
    pushBoth(`        var period     = timing.cyclePeriod || dur;`);
    pushBoth(`        var iterations = timing.iterations === Infinity ? Infinity : ( timing.iterations || 1 );`);
    pushBoth(`        var fill       = timing.fill || 'none';`);
    pushBoth(`        var startTime  = null;`);
    pushBoth(`        var cancelled  = false;`);
    pushBoth(`        var rafId      = null;`);
    pushBoth(``);
    pushBoth(`        function lerp( a, b, t ) { return a + ( b - a ) * t; }`);
    pushBoth(`        function sampleValue( progress ) {`);
    pushBoth(`            for ( var i = 1; i < offsets.length; i++ ) {`);
    pushBoth(`                if ( progress <= offsets[i] ) {`);
    pushBoth(`                    var span = offsets[i] - offsets[i-1];`);
    pushBoth(`                    // Snap segment: adjacent keyframes model a SMIL dur='0.001s'`);
    pushBoth(`                    // teleport. Treat as a discrete step - return the destination`);
    pushBoth(`                    // value as soon as we cross the start offset, so no lerped`);
    pushBoth(`                    // intermediate value is ever rendered.`);
    pushBoth(`                    if ( span < 0.002 ) { return values[i]; }`);
    pushBoth(`                    var tLin = ( progress - offsets[i-1] ) / span;`);
    pushBoth(`                    // Apply per-keyframe easing (easing on keyframe i-1 governs`);
    pushBoth(`                    // the segment from i-1 to i, matching WAAPI/CSS convention).`);
    pushBoth(`                    var cb = easings[i-1];`);
    pushBoth(`                    var t  = cb ? fgCubicBezier( cb[0], cb[1], cb[2], cb[3], tLin ) : tLin;`);
    pushBoth(`                    return lerp( values[i-1], values[i], t );`);
    pushBoth(`                }`);
    pushBoth(`            }`);
    pushBoth(`            return values[values.length - 1];`);
    pushBoth(`        }`);
    pushBoth(`        var sharedClock = timing.sharedClock || null;`);
    pushBoth(`        function tick( now ) {`);
    pushBoth(`            if ( cancelled ) return;`);
    pushBoth(`            if ( startTime === null ) {`);
    pushBoth(`                if ( sharedClock ) {`);
    pushBoth(`                    if ( sharedClock.v === null ) sharedClock.v = now;`);
    pushBoth(`                    startTime = sharedClock.v;`);
    pushBoth(`                } else {`);
    pushBoth(`                    startTime = now;`);
    pushBoth(`                }`);
    pushBoth(`            }`);
    pushBoth(`            var elapsed = now - startTime - delay;`);
    pushBoth(`            if ( elapsed < 0 ) { rafId = requestAnimationFrame( tick ); return; }`);
    pushBoth(`            var iteration = Math.floor( elapsed / period );`);
    pushBoth(`            if ( iterations !== Infinity && iteration >= iterations ) {`);
    pushBoth(`                var finalVal = fill === 'forwards' ? values[values.length - 1] : values[0];`);
    pushBoth(`                el.setAttribute( attr, finalVal );`);
    pushBoth(`                return;`);
    pushBoth(`            }`);
    pushBoth(`            var withinCycle = elapsed - iteration * period;`);
    pushBoth(`            if ( withinCycle >= dur ) {`);
    pushBoth(`                // In inter-cycle pause - hold at end value then wait`);
    pushBoth(`                el.setAttribute( attr, values[values.length - 1] );`);
    pushBoth(`                rafId = requestAnimationFrame( tick );`);
    pushBoth(`                return;`);
    pushBoth(`            }`);
    pushBoth(`            var progress = withinCycle / dur;`);
    pushBoth(`            el.setAttribute( attr, sampleValue( progress ) );`);
    pushBoth(`            rafId = requestAnimationFrame( tick );`);
    pushBoth(`        }`);
    pushBoth(`        rafId = requestAnimationFrame( tick );`);
    pushBoth(`        return {`);
    pushBoth(`            cancel: function() {`);
    pushBoth(`                cancelled = true;`);
    pushBoth(`                if ( rafId ) cancelAnimationFrame( rafId );`);
    pushBoth(`            },`);
    pushBoth(`        };`);
    pushBoth(`    }`);
    pushBoth(``);

    // Chain loop helper
    pushBoth(`    /**`);
    pushBoth(`     * Runs a sequence of animations one after another, looping forever.`);
    pushBoth(`     * Used for icons where looping is expressed by SMIL begin ID chains`);
    pushBoth(`     * rather than repeatCount="indefinite".`);
    pushBoth(`     *`);
    pushBoth(`     * Each step descriptor: { selector, keyframes, timing, attr?, isSvgAttr? }`);
    pushBoth(`     * Steps fire in delay order. After the last step finishes, the whole`);
    pushBoth(`     * sequence restarts from the beginning.`);
    pushBoth(`     *`);
    pushBoth(`     * @param {Element} svg    Root SVG element`);
    pushBoth(`     * @param {Array}   steps  Descriptor array`);
    pushBoth(`     * @returns {Array}         Array of cancel handles`);
    pushBoth(`     */`);
    pushBoth(`    function fgLoopChain( svg, steps ) {`);
    pushBoth(`        var handles = [];`);
    pushBoth(`        var cancelled = false;`);
    pushBoth(``);
    pushBoth(`        function runStep( index ) {`);
    pushBoth(`            if ( cancelled || index >= steps.length ) {`);
    pushBoth(`                if ( !cancelled ) runStep( 0 );`);
    pushBoth(`                return;`);
    pushBoth(`            }`);
    pushBoth(`            var step = steps[index];`);
    pushBoth(`            var el   = svg.querySelector( step.selector );`);
    pushBoth(`            if ( !el ) { runStep( index + 1 ); return; }`);
    pushBoth(``);
    pushBoth(`            var anim;`);
    pushBoth(`            if ( step.isSvgAttr ) {`);
    pushBoth(`                anim = fgAnimAttr( el, step.attr, step.keyframes, step.timing );`);
    pushBoth(`                // fgAnimAttr doesn't return a promise - approximate with setTimeout`);
    pushBoth(`                var totalMs = ( step.timing.delay || 0 ) + step.timing.duration + ( step.timing.endDelay || 0 );`);
    pushBoth(`                setTimeout( function() { runStep( index + 1 ); }, totalMs );`);
    pushBoth(`            } else {`);
    pushBoth(`                anim = el.animate( step.keyframes, step.timing );`);
    pushBoth(`                anim.finished.then( function() { runStep( index + 1 ); } );`);
    pushBoth(`            }`);
    pushBoth(`            handles.push( anim );`);
    pushBoth(`        }`);
    pushBoth(``);
    pushBoth(`        // Sort steps by delay so they fire in the right order`);
    pushBoth(`        var sorted = steps.slice().sort( function(a,b) { return (a.timing.delay||0) - (b.timing.delay||0); } );`);
    pushBoth(`        runStep( 0 );`);
    pushBoth(`        return handles;`);
    pushBoth(`    }`);
    pushBoth(``);

    // Icon functions
    jsLines.push(`    var icons = {`);
    for (const [name, result] of Object.entries(jsFunctions)) {
        const escaped = name.replace(/-/g, '_');
        jsLines.push(`        '${ name }': function animate( svg ) {`);
        jsLines.push(`    ` + result.funcBody.split('\n').join('\n    '));
        jsLines.push(`        },`);
    }
    jsLines.push(`    };`);
    jsLines.push(``);
    jsLines.push(`    window.fotogridsWaapi = icons;`);
    jsLines.push(``);
    jsLines.push(`} )( window );`);

    fs.writeFileSync(OUT_JS, jsLines.join('\n'), 'utf8');
    console.log('smil-to-waapi: wrote', OUT_JS);

    // ----- Write WAAPI JSON -----
    // Each entry is a fully self-contained function string:
    //   function animate(svg) { <helpers> <icon body> }
    // PHP reads this, picks the selected icon by name, and emits the raw
    // function source verbatim into the inline script global - no eval, no
    // new Function, no runtime generation. Only one entry is ever shipped
    // per page so inlining the helpers per-entry is fine.
    const helperBlock = helperLines
        .map(l => l.replace(/^    /, ''))  // dedent one level (strip leading 4 spaces)
        .join('\n');

    const waapiJson = {};
    for (const [name, result] of Object.entries(jsFunctions)) {
        const body = result.funcBody
            .split('\n')
            .map(l => l.replace(/^    /, ''))  // dedent one level
            .join('\n');
        waapiJson[name] = `function animate(svg) {\n${helperBlock}\n${body}\n}`;
    }

    fs.writeFileSync(OUT_JSON, JSON.stringify(waapiJson, null, 2), 'utf8');
    console.log('smil-to-waapi: wrote', OUT_JSON);

    // ----- Write comparison HTML -----
    const htmlRows = compareRows.map(({ name, svg, strippedSvg }) => {
        const isCss       = CSS_KEYFRAME_ICONS.has(name);
        const needsReview = MANUAL_REVIEW.has(name);
        const loopsWrong  = LOOPS_WRONG_ICONS.has(name);

        // For SMIL side: inline SVG (keeps SMIL tags) so DevTools CSS applies to both sides
        const smilSvg   = svg
            .replace(/^<svg/, `<svg data-icon="${name}-smil"`)
            .replace(/'/g, '"');

        // For WAAPI side: stripped SVG with data-icon attribute
        const waapiSvg  = strippedSvg
            .replace(/^<svg/, `<svg data-icon="${name}"`)
            .replace(/'/g, '"');

        const badge = needsReview
            ? `<span class="badge review">⚠ review</span>`
            : loopsWrong
            ? `<span class="badge wrong">⚠ no pause</span>`
            : isCss
            ? `<span class="badge css">CSS</span>`
            : `<span class="badge ok">✓</span>`;

        const rowClass = needsReview ? ' needs-review' : loopsWrong ? ' loops-wrong' : '';

        return `
    <tr class="icon-row${rowClass}">
      <td class="name">${name} ${badge}</td>
      <td class="cell smil-cell">
        <div class="icon-wrap">
          ${smilSvg}
        </div>
        <span class="label">SMIL</span>
      </td>
      <td class="cell waapi-cell">
        <div class="icon-wrap">
          ${waapiSvg}
        </div>
        <span class="label">WAAPI</span>
      </td>
    </tr>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>FotoGrids - Loading Icons WAAPI Comparison</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font: 13px/1.4 system-ui, sans-serif; background: #f5f5f5; color: #222; padding: 24px; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  p.sub { color: #666; margin-bottom: 20px; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; max-width: 600px; background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,.1); border-radius: 6px; overflow: hidden; }
  th { background: #222; color: #fff; padding: 8px 12px; text-align: left; font-size: 12px; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; vertical-align: middle; }
  td.name { font-family: monospace; font-size: 12px; width: 220px; }
  td.cell { width: 120px; text-align: center; }
  .icon-wrap { width: 48px; height: 48px; display: inline-flex; align-items: center;
               justify-content: center; color: #000; }
  .icon-wrap svg { width: 32px; height: 32px; color: inherit; }
  .label { display: block; font-size: 10px; color: #999; margin-top: 4px; }
  .badge { font-size: 10px; padding: 1px 5px; border-radius: 3px; font-weight: 600; }
  .badge.ok     { background: #d4edda; color: #155724; }
  .badge.css    { background: #cce5ff; color: #004085; }
  .badge.warn   { background: #fff3cd; color: #856404; }
  .badge.review { background: #f8d7da; color: #721c24; }
  .badge.wrong  { background: #fff3cd; color: #856404; }
  tr.needs-review td { background: #fff8f8; }
  tr.loops-wrong td { background: #fffef0; }
  tr:last-child td { border-bottom: none; }
  .controls { margin-bottom: 16px; display: flex; gap: 12px; align-items: center; }
  button { padding: 6px 14px; border: 1px solid #ccc; border-radius: 4px; background: #fff;
           cursor: pointer; font-size: 12px; }
  button:hover { background: #f0f0f0; }
  #bg-toggle { font-size: 12px; }
</style>
</head>
<body>
<h1>FotoGrids - Loading Icons WAAPI Comparison</h1>
<p class="sub">Left = SMIL original (ground truth). Right = WAAPI converted. They should look identical.<br>
⚠ review = complex animation, needs careful visual check. CSS = @keyframes, no conversion needed.</p>
<div class="controls">
  <button onclick="document.body.style.background = document.body.style.background === 'rgb(30, 30, 30)' ? '#f5f5f5' : '#1e1e1e'; document.querySelectorAll('.icon-wrap').forEach(el => el.style.color = document.body.style.background === 'rgb(30, 30, 30)' ? '#fff' : '#000')">Toggle dark bg</button>
  <button onclick="document.querySelectorAll('.needs-review').forEach(el => el.style.display = el.style.display === 'none' ? '' : 'none')">Toggle ⚠ rows</button>
</div>
<table>
  <thead>
    <tr>
      <th>Icon</th>
      <th>SMIL</th>
      <th>WAAPI</th>
    </tr>
  </thead>
  <tbody>
${htmlRows}
  </tbody>
</table>
<script>
// Run WAAPI animations on all stripped SVGs
(function() {
    function init() {
        if (!window.fotogridsWaapi) {
            console.warn('fotogridsWaapi not loaded');
            return;
        }
        document.querySelectorAll('[data-icon]').forEach(function(svg) {
            var name = svg.getAttribute('data-icon');
            var fn   = window.fotogridsWaapi[name];
            if (fn) fn(svg);
        });
    }

    // Load the generated waapi JS relative to this file
    var s = document.createElement('script');
    s.src = '../src/assets/frontend/src/loading-icons-waapi.js';
    s.onload  = init;
    s.onerror = function() {
        console.error('Could not load loading-icons-waapi.js - run: node scripts/smil-to-waapi.js first');
    };
    document.head.appendChild(s);
})();
</script>
</body>
</html>`;

    fs.writeFileSync(OUT_HTML, html, 'utf8');
    console.log('smil-to-waapi: wrote', OUT_HTML);

    // ----- Summary -----
    const warnCount = Object.keys(allWarnings).length;
    console.log(`\nDone. ${Object.keys(icons).length} icons processed.`);
    console.log(`  ${CSS_KEYFRAME_ICONS.size} CSS-only (no conversion)`);
    console.log(`  ${Object.keys(icons).length - CSS_KEYFRAME_ICONS.size} SMIL converted`);
    if (warnCount) {
        console.log(`\n⚠  ${warnCount} icons with warnings:`);
        for (const [name, warns] of Object.entries(allWarnings)) {
            console.log(`\n  ${name}:`);
            warns.forEach(w => console.log(`    - ${w}`));
        }
    }
    console.log(`\nOpen scripts/waapi-compare.html in Chrome to review.`);
}

main();
