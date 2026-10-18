# v4 build tools (not part of the website)

`v4-tools.tar.gz` holds the scripts that generate or test parts of the site. Extract it into a working folder that sits NEXT TO a copy of v4 named `w4`:

    work/
      w4/            <- a copy of this v4 folder
      gen/ ...       <- from the tarball
      (json + *.py)  <- from the tarball

- `gen/i18n.py ../w4/i18n-th.js`  regenerates the Thai dictionary (i18n-th.js) from gen/th2a..th2k.py. Add a new module letter in the loop at line ~137 when you add th2l.py.
- `gen/build_demo.py ../w4/demo-backend.js`  rebuilds demo-backend.js from backend/Code.gs + backend/Portal.gs. Run it after ANY change to those two files.
- `thleft.py`  lists strings still in English on a page in Thai mode (needs a local server on :8765 serving w4).
- `e2e_portal.py` (demo mode), `e2e_live.py` (real backend code behind a mock), `e2e_forms.py`  Playwright tests. Test photos: any JPG named testph0..2.jpg in the work folder.
- `demo_node_test.js`  checks the browser demo environment's crypto against Node.
