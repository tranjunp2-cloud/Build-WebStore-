# F-mascot-3d — 3D mascot on pages (QA)

The R3F mascot on auth, dashboard status pages, empty states, the toolbar avatar and toasts. The AI chat dock mascot is out of scope here (it ships with the AI layer, PR #1993).

| TC-ID | Scenario | Expected |
|-------|----------|----------|
| TC-MASCOT-01 | A layout with no mascot on the page (e.g. dashboard home without empty state, editor) | three / R3F / `webstore-bot.glb` are never requested (Network tab) |
| TC-MASCOT-02 | A mascot outside the viewport, or hidden by CSS (login on a phone, `< lg`) | runtime not downloaded; it loads once a mascot scrolls into view |
| TC-MASCOT-03 | Success / error toast on a page with no other robot | the check / alert icon stays; no 3D download is triggered by the toast |
| TC-MASCOT-04 | Success / error toast on a page whose robot is already loaded | the robot icon shows with a green (success) or red (error) ring |
| TC-MASCOT-05 | No robot on screen (all scrolled away / unmounted) | the shared canvas stops drawing (`window.__mascot.stats.fps` = 0 with `localStorage['mascot:debug']=1`) |
| TC-MASCOT-06 | Dual-GPU laptop, dashboard open | WebGL context asks for `low-power`; discrete GPU not switched on by the mascot |
| TC-MASCOT-07 | Device without WebGL or with Save-Data | fallbacks (lucide icon / SVG) show, no 3D download |
