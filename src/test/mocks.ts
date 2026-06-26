export interface SentMessage {
    type?: string;
    address?: string;
    correlationId?: string;
    body?: Record<string, unknown>;
    [key: string]: unknown;
}

export class MockWebSocket {
    static instances: MockWebSocket[] = [];
    static lastInstance(): MockWebSocket | undefined {
        return this.instances[this.instances.length - 1];
    }
    static clearInstances() {
        this.instances = [];
    }

    url: string;
    protocols: string[];
    readyState: number = 0; // CONNECTING
    sentMessages: string[] = [];

    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;

    constructor(url: string, protocols: string[] = []) {
        this.url = url;
        this.protocols = protocols;
        MockWebSocket.instances.push(this);

        // Simulate async connection open
        setTimeout(() => {
            this.readyState = 1; // OPEN
            if (this.onopen) {
                this.onopen();
            }
        }, 0);
    }

    send(data: string) {
        this.sentMessages.push(data);
    }

    close() {
        this.readyState = 3; // CLOSED
        if (this.onclose) {
            this.onclose();
        }
    }

    // Helper for tests to simulate incoming server message
    simulateMessageFromServer(data: unknown) {
        if (this.onmessage) {
            this.onmessage({ data: JSON.stringify(data) });
        }
    }

    // Helper to parse sent messages
    getSentJSON(): SentMessage[] {
        return this.sentMessages.map((msg) => JSON.parse(msg) as SentMessage);
    }
}
