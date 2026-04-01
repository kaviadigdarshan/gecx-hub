# App Scaffolder Rules
- Output: AppSnapshot ZIP format (CX Agent Studio native)
- Populates ScaffoldContext after generation
- Uses ces.googleapis.com v1beta for any API calls
- ZIP download is client-side via jszip in demo mode
- Backend ZIP generation uses Python zipfile module
