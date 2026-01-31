import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const defaultSystemPrompt = "You are a concise terminal assistant. Keep responses short and helpful.";
const configDir = path.join(os.homedir(), ".cell");
const constitutionPath = path.join(configDir, "constitution.md");

function loadConstitutionPrompt(constitutionFilePath: string): string | null {
	try {
		const content = fs.readFileSync(constitutionFilePath, "utf8").trim();
		return content ? content : null;
	} catch {
		return null;
	}
}

export function buildSystemPrompt(): string {
	const constitutionPrompt = loadConstitutionPrompt(constitutionPath);
	return constitutionPrompt ? `${constitutionPrompt}\n\n${defaultSystemPrompt}` : defaultSystemPrompt;
}
