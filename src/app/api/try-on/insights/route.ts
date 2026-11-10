// Compatibility alias for the first profile setup UI. Analysis never saves;
// callers must use /api/try-on/profile with { action: "save", insights }.
export { POST } from "../profile/route";
