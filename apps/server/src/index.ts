import cors from "@fastify/cors";
import Fastify from "fastify";

const server = Fastify();

async function start() {
	await server.register(cors, {
		origin: true,
	});

	server.get("/api/health", async () => {
		return { status: "ok" };
	});

	try {
		await server.listen({ port: 3000 });
		console.log("Server running at http://localhost:3000");
	} catch (err) {
		server.log.error(err);
		process.exit(1);
	}
}

start();
