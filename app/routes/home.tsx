import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
	return [{ title: "Home | Chalkup" }, { name: "description", content: "Welcome to Chalkup" }];
}

export default function Home() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4">
			<h1 className="text-5xl font-extrabold">Welcome to React Router!</h1>
			<p className="text-2xl">This is a new React Router app.</p>
		</div>
	);
}
