import { createMemo, Show } from "solid-js";
import { useAb } from "../../store";

export default function CritReviewControls() {
    const { state, selectedTopic, startCritReview, dismissCritReview } = useAb();

    const critReview = createMemo(() => {
        const topicId = state.selectedTopicId;
        return topicId ? state.critReviews[topicId] : undefined;
    });

    const critReviewUrl = createMemo(() => {
        const review = critReview();
        return review?.status === "ready" ? review.url : null;
    });

    const critReviewError = createMemo(() => {
        const review = critReview();
        return review?.status === "failed" ? review.reason : null;
    });

    const dismissSelectedCritReview = () => {
        const topicId = state.selectedTopicId;
        if (topicId) dismissCritReview(topicId);
    };

    return (
        <Show when={selectedTopic()?.critReviewAvailable}>
            <div class="flex items-center gap-1 shrink-0 min-w-0">
                <Show
                    when={critReviewUrl()}
                    fallback={
                        <button
                            class="btn btn-xs btn-ghost rounded-lg shrink-0 gap-1 opacity-80"
                            onClick={() => {
                                const topicId = state.selectedTopicId;
                                if (topicId) startCritReview(topicId);
                            }}
                            disabled={
                                selectedTopic()?.status === "initial" ||
                                critReview()?.status === "starting"
                            }
                            title="Review changes with crit"
                        >
                            <Show
                                when={critReview()?.status === "starting"}
                                fallback={
                                    <svg
                                        aria-hidden="true"
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-3.5 w-3.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                                        />
                                    </svg>
                                }
                            >
                                <span class="loading loading-spinner loading-xs" />
                            </Show>
                            <span class="hidden sm:inline">Review</span>
                        </button>
                    }
                >
                    {(url) => (
                        <a
                            class="btn btn-xs btn-primary rounded-lg shrink-0 gap-1"
                            href={url()}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={url()}
                        >
                            Open review ↗
                        </a>
                    )}
                </Show>
                <Show when={critReviewError()}>
                    {(reason) => (
                        <span
                            class="badge badge-error badge-sm max-w-[16rem] truncate"
                            title={reason()}
                        >
                            {reason()}
                        </span>
                    )}
                </Show>
                <Show when={critReviewUrl() || critReviewError()}>
                    <button
                        class="btn btn-ghost btn-xs btn-circle shrink-0"
                        onClick={dismissSelectedCritReview}
                        aria-label="Dismiss crit review status"
                        title="Dismiss"
                    >
                        ✕
                    </button>
                </Show>
            </div>
        </Show>
    );
}
