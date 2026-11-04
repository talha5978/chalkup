import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("api/transcribe", "./routes/api.transcribe.ts"),
	route("api/parse-entry", "./routes/api.parse-entry.ts"),
] satisfies RouteConfig;
