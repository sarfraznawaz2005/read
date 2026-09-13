// A plain Chrome UA (no "Electron/..." or app-name token) so embedded pages,
// popup windows, and article extraction all look like an ordinary browser
// instead of announcing themselves as an automated/Electron client. Chrome's
// version is read from the running build so it stays in step with whatever
// Chromium this Electron version actually ships (avoids UA/engine mismatch).
export const DESKTOP_USER_AGENT = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`
