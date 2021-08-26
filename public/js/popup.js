const state = {
  currentSuggestionIndex: null,
  candidates: []
};

const sendMessageToActiveTab = (message, callback) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, message, callback)
  });
}

const shuffleArray = (array) => {
  if (array.length === 0) {
    return array;
  }

  let index = array.length - 1;
  let otherIndex = null;

  while (index !== 0) {
    otherIndex = Math.floor(Math.random() * (index));

    const valueAtOtherIndex = array[otherIndex];
    array[otherIndex] = array[index];
    array[index] = valueAtOtherIndex;

    index--;
  }
};

const resetPopupHtml = () => {
  const suggestionContainerNode = document.querySelector('#suggestion_container');

  while (suggestionContainerNode.firstChild) {
    suggestionContainerNode.removeChild(suggestionContainerNode.firstChild);
  }

  const suggestionLinkNode = document.createElement('a');
  suggestionLinkNode.id = 'suggestion_link';
  suggestionLinkNode.href = '#';

  const suggestionTitleNode = document.createElement('h1');
  suggestionTitleNode.id = 'suggestion_title';

  const suggestionImgContainerNode = document.createElement('div');
  suggestionImgContainerNode.id = 'suggestion_image_container';

  suggestionLinkNode.append(suggestionTitleNode);
  suggestionLinkNode.append(suggestionImgContainerNode);
  suggestionContainerNode.append(suggestionLinkNode);
};

const renderCandidateAtIndex = (index) => {
  resetPopupHtml();

  const candidates = state.candidates;

  if (candidates.length === 0) {
    const suggestionContainerNode = document.querySelector('#suggestion_container');
    suggestionContainerNode.innerText = 'No videos found, please wait a few seconds and click on the icon again.';
    return;
  }

  if (candidates[index] === undefined) {
    console.error('Cannot render candidate at index', index);
    return;
  }

  state.currentSuggestionIndex = index;

  const candidate = candidates[state.currentSuggestionIndex];

  const suggestionLinkNode = document.querySelector('#suggestion_link');
  const suggestionTitleNode = document.querySelector('#suggestion_title');
  const suggestionImgContainerNode = document.querySelector('#suggestion_image_container');

  suggestionLinkNode.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.update({ url: candidate.link });
  });
  suggestionTitleNode.innerText = candidate.title;

  if (candidate.imgUrl) {
    const imgNode = document.createElement('img');
    imgNode.classList.add('yt-video-randomizer__suggestion__img');
    imgNode.src = candidate.imgUrl;
    suggestionImgContainerNode.append(imgNode);
  }
};

const renderPaginationFromState = () => {
  const controlsNode = document.querySelector('#controls');
  const paginationNode = controlsNode.querySelector('.pagination');
  const candidates = state.candidates;

  if (candidates.length) {
    paginationNode.innerText = (state.currentSuggestionIndex + 1) + ' of ' + candidates.length;
  }
};

const renderControls = () => {
  // render header controls

  const refreshButtonNode = document.querySelector('#refresh_button');
  refreshButtonNode.addEventListener('click', () => {
    sendMessageToActiveTab({ type: 'retrieveCandidates' }, (candidates) => {
      state.candidates = candidates;
      shuffleArray(candidates);
      renderCandidateAtIndex(0);
      renderPaginationFromState();
    });
  });

  // render footer controls (+ pagination)

  const controlsNode = document.querySelector('#controls');
  const prevButton = controlsNode.querySelector('#previous_button');
  const nextButton = controlsNode.querySelector('#next_button');

  const goBack = () => {
    if (state.currentSuggestionIndex > 0) {
      state.currentSuggestionIndex--;

      renderCandidateAtIndex(state.currentSuggestionIndex);
      renderPaginationFromState();
    }
  };

  const goNext = () => {
    if (state.currentSuggestionIndex < state.candidates.length - 1) {
      state.currentSuggestionIndex++;

      renderCandidateAtIndex(state.currentSuggestionIndex);
      renderPaginationFromState();
    }
  };

  prevButton.addEventListener('click', goNext);
  nextButton.addEventListener('click', goBack);
  document.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;

    if (e.keyCode === 37) { // left
      goBack();
    } else if (e.keyCode === 39) { //right
      goNext();
    } else if (e.keyCode === 13) { // enter
      document.querySelector('#suggestion_link').click();
    }
  });

  renderPaginationFromState();
};

const render = () => {
  renderCandidateAtIndex(0);
  renderControls();
};

sendMessageToActiveTab({ type: 'retrieveCandidates' }, (candidates) => {
  state.candidates = candidates;
  shuffleArray(candidates);
  render();
});
