/**
 * Optional per-story reader analytics (see workers/story-views/README.md).
 *
 * When ingestUrl is set to your Worker URL + /v1/hit, each time the story
 * reader opens we POST { storyId }. Leave empty to disable (default).
 */
window.DATA_ANALYTICS = {
  ingestUrl: "",
};
