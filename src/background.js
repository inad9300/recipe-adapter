chrome.browserAction.onClicked.addListener(tab => chrome.tabs.executeScript({file: 'main.js'}))
