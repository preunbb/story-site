// Assembles site data from data/*.js (connections.js + infopanel.js are lazy-loaded on the Connections tab)
window.DATA_SOURCE = {
  characters: window.DATA_CHARACTERS || [],
  stories: window.DATA_STORIES || [],
  otherAuthors: window.DATA_OTHER_AUTHORS || [],
  captions: window.DATA_CAPTIONS || [],
  fanart: window.DATA_FANART || [],
};
