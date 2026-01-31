import "dotenv/config";
import chalk from "chalk";
import { Agent } from "@mariozechner/pi-agent-core";
import { getModels, getProviders, type KnownProvider } from "@mariozechner/pi-ai";
import { Container, Editor, ProcessTerminal, Text, TUI, matchesKey } from "@mariozechner/pi-tui";
import { buildSystemPrompt } from "./system-prompt.js";

const providerName = process.env.CELL_PROVIDER ?? "openrouter";
const modelName = process.env.CELL_MODEL ?? "openrouter/auto";
const systemPrompt = buildSystemPrompt();

const availableProviders = getProviders();
const providerNameTyped = providerName as KnownProvider;
if (!availableProviders.includes(providerNameTyped)) {
	console.error(`Unknown provider "${providerName}". Available providers: ${availableProviders.join(", ")}`);
	process.exit(1);
}

const models = getModels(providerNameTyped);
const model = models.find((modelEntry) => modelEntry.id === modelName);
if (!model) {
	const availableModels = models.map((modelEntry) => modelEntry.id);
	const previewText = availableModels.slice(0, 10).join(", ");
	const remainderText =
		availableModels.length > 10 ? ` (and ${availableModels.length - 10} more)` : "";
	console.error(
		`Unknown model "${modelName}" for provider "${providerName}". Available models: ${previewText}${remainderText}`,
	);
	process.exit(1);
}
const agent = new Agent({
	initialState: {
		systemPrompt,
		model,
	},
});

const terminal = new ProcessTerminal();
const terminalUserInterface = new TUI(terminal);
const rootContainer = new Container();

const editorTheme = {
	borderColor: chalk.gray,
	selectList: {
		selectedPrefix: chalk.green,
		selectedText: chalk.whiteBright,
		description: chalk.gray,
		scrollInfo: chalk.gray,
		noMatch: chalk.gray,
	},
};

const conversationText = new Text("Cell ready. Enter a prompt below.\n", 1, 1);
const inputEditor = new Editor(terminalUserInterface, editorTheme, { paddingX: 1 });
terminalUserInterface.setFocus(inputEditor);

const handleExit = () => {
	terminalUserInterface.stop();
	process.exit(0);
};

const originalHandleInput = inputEditor.handleInput.bind(inputEditor);
inputEditor.handleInput = (data: string) => {
	if (matchesKey(data, "ctrl+c") || data === "\x03") {
		handleExit();
		return;
	}
	if (matchesKey(data, "ctrl+d") || data === "\x04") {
		handleExit();
		return;
	}
	originalHandleInput(data);
};

rootContainer.addChild(conversationText);
rootContainer.addChild(inputEditor);
terminalUserInterface.addChild(rootContainer);

const transcriptLines: string[] = [];
let assistantBuffer = "";
let assistantActive = false;

function renderTranscript() {
	const baseTranscript = transcriptLines.join("\n");
	const fullTranscript = assistantActive
		? `${baseTranscript}${baseTranscript ? "\n" : ""}Assistant: ${assistantBuffer}`
		: baseTranscript;
	conversationText.setText(fullTranscript);
	terminalUserInterface.requestRender();
}

function finalizeAssistantResponse() {
	if (!assistantActive) return;
	transcriptLines.push(`Assistant: ${assistantBuffer || "(no output)"}`);
	assistantBuffer = "";
	assistantActive = false;
	renderTranscript();
}

agent.subscribe((agentEvent) => {
	if (agentEvent.type === "message_update" && agentEvent.message.role === "assistant") {
		const update = agentEvent.assistantMessageEvent;
		if (update.type === "text_delta") {
			assistantBuffer += update.delta;
			renderTranscript();
		}
		return;
	}
	if (agentEvent.type === "message_end" && agentEvent.message.role === "assistant") {
		finalizeAssistantResponse();
		return;
	}
	if (agentEvent.type === "agent_end") {
		inputEditor.disableSubmit = false;
		terminalUserInterface.requestRender();
	}
});

inputEditor.onSubmit = async (text) => {
	const userText = text.trim();
	if (!userText) return;

	inputEditor.addToHistory(userText);
	transcriptLines.push(`You: ${userText}`);
	assistantBuffer = "";
	assistantActive = true;
	renderTranscript();

	inputEditor.disableSubmit = true;
	terminalUserInterface.requestRender();

	try {
		await agent.prompt(userText);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		transcriptLines.push(`Error: ${message}`);
		assistantActive = false;
		assistantBuffer = "";
		renderTranscript();
	} finally {
		inputEditor.disableSubmit = false;
		terminalUserInterface.requestRender();
	}
};

process.on("SIGINT", handleExit);

terminalUserInterface.start();
