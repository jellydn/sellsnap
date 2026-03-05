import { createConsola } from "consola";

export const logger = createConsola({
	level:
		Number(process.env.LOG_LEVEL) ||
		(process.env.NODE_ENV === "production" ? 3 : 4),
});

export const createLogger = (prefix?: string) => {
	if (prefix) {
		return logger.withTag(prefix);
	}
	return logger;
};
