chrome.browserAction.onClicked.addListener(tab => {
    chrome.tabs.insertCSS({file: 'main.css'}, () =>
        chrome.tabs.executeScript({file: 'main.js'}))
})
