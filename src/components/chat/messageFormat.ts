export const getSenderName = (sender: string) => {
    switch (sender) {
        case "human":
            return "You";
        case "ai":
            return "Agent";
        default:
            return "System";
    }
};

export const getSenderAvatar = (sender: string) => {
    switch (sender) {
        case "human":
            return "👤";
        case "ai":
            return "🤖";
        default:
            return "⚙️";
    }
};

export const formatTime = (isoString: string) => {
    if (!isoString) return "";
    try {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
};
