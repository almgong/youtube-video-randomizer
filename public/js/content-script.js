/**
 * Configuration defaults for the driver
 */
const RANDOMIZER_CONFIG = {
  pollIntervalMs: 1200,
  ytContainerSelectors: ['ytd-watch-flexy[role="main"]', 'ytd-browse[role="main"]'],
  ytThumbnailSelector: 'ytd-thumbnail',
  ytThumbnailLinkSelector: 'a#thumbnail',
  ytThumbnailTitleSelector: '#video-title-link, #video-title',
  ytThumbnailImgSelector: 'yt-img-shadow > img'
};

/**
 * Handles messages from other extension scripts
 *
 * The supported messages - responses are:
 * retrieveCandidates - an array of plain JS objects with video candidate data
 */
class MessageHandler {
  constructor(callbacks) {
    const supportedCallbacks = {
      onCandidatesRetrieveRequest: () => {}
    };
    this.callbacks = { ...supportedCallbacks, ...callbacks };

    this.attachListeners();
  }

  attachListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'retrieveCandidates') {
        this.callbacks.onCandidatesRetrieveRequest(sendResponse);
      } else {
        console.error('Received unexpected message', request, 'from', sender);
      }
    });
  }
}

/**
 * Exposes static methods for accessing the DOM
 */
class DomQuery {
  /**
   * Returns a nodelist for a given selector
   *
   * @param {string} selector A valid HTML element selector
   * @returns a NodeList of matching elements
   */
  static selectAll(selector) {
    return document.querySelectorAll(selector);
  }

  /**
   * Returns a nodelist for a given selector, rooted at the specified node
   *
   * @param {Element} node The root element to base search on
   * @param {string} selector A valid HTML selector
   * @returns a NodeList of matching elements
   */
  static selectAllFromNode(node, selector) {
    return node.querySelectorAll(selector);
  }
}

/**
 * Data object for video candidates
 */
class VideoCandidate {
  constructor(ytThumbnailNode) {
    this.node = ytThumbnailNode;
    this.query = DomQuery;
    this.data = this.parseData();
  }

  /**
   * Parses data from the specified node during initialization
   *
   * @returns a JS object in form { link: string, title: string, imgUrl: string }
   */
  parseData() {
    const linkNode = this.query.selectAllFromNode(this.node, RANDOMIZER_CONFIG.ytThumbnailLinkSelector)[0];
    const link = linkNode ? linkNode.href : null;

    const titleNode = this.query.selectAllFromNode(this.node.parentNode, RANDOMIZER_CONFIG.ytThumbnailTitleSelector)[0];
    const title = titleNode ? titleNode.innerText : null;

    const imgNode = this.query.selectAllFromNode(linkNode, RANDOMIZER_CONFIG.ytThumbnailImgSelector)[0];
    const imgUrl = imgNode ? imgNode.src : null;

    return {
      link,
      title,
      imgUrl
    };
  }

  /**
   * Checks whether "enough" data can be parsed from the specified node in order
   * to recommend this video node
   *
   * @returns true if there is sufficient data, false otherwise
   */
  hasSuficentData() {
    return !!(this.data.link && this.data.title);
  }
}

/**
 * Primary driver class for the content script
 */
class Driver {
  constructor() {
    this.state = {
      intervalId: null,
      candidates: [],
      url: window.location.href
    };

    this.query = DomQuery;
    this.messageHandler = new MessageHandler(
      {
        onCandidatesRetrieveRequest: (replyWith) => { replyWith(this.state.candidates.map((c) => c.data)) }
      }
    );
  }

  /**
   * Begin watching page for videos
   *
   * The current implementation is to periodically poll page for
   * video thumbnails
   *
   * @returns undefined
   */
  start() {
    if (this.isStarted()) return;

    const poll = () => {
      const fullThumbnailSelector = this.generateFullThumbnailSelector();

      let candidates = Array
        .from(
          this.query.selectAll(fullThumbnailSelector)
        )
        .map((node) => new VideoCandidate(node));

      candidates = candidates.filter((c) => c.hasSuficentData());

      this.setState({ candidates });
    };

    // immediately poll once
    // TODO: consider DOM observers for better resolution and potentially better performance
    poll();

    const intervalId = setInterval(
      poll,
      RANDOMIZER_CONFIG.pollIntervalMs
    );

    this.setState({ intervalId });
  }

  /**
   * Stop watching page for videos and reset state of
   * randomizer
   *
   * @returns undefined
   */
  stop() {
    if (!this.isStarted()) return;

    clearInterval(this.state.intervalId);
    this.reset();
  }

  /**
   * Checks whether the driver has started
   *
   * @returns true if Randomizer has started looking for videos, false otherwise
   */
  isStarted() {
    return !!this.state.intervalId;
  }

  // private

  generateFullThumbnailSelector() {
    let mainContainterSelector = null;
    for (let i = 0; i < RANDOMIZER_CONFIG.ytContainerSelectors.length; i++) {
      if (this.query.selectAll(RANDOMIZER_CONFIG.ytContainerSelectors[i]).length) {
        mainContainterSelector = RANDOMIZER_CONFIG.ytContainerSelectors[i];
        break;
      }
    }

    return mainContainterSelector + ' ' + RANDOMIZER_CONFIG.ytThumbnailSelector;
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
  }

  reset() {
    this.state = {
      intervalId: null,
      candidates: []
    };
  }
}

const instance = new Driver();
instance.start();
