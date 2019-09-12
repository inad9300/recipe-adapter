{

// Reusable utilities.

const {body} = document

const on = (elem, evt, fn) => {
    elem.addEventListener(evt, fn, true)
    return () => elem.removeEventListener(evt, fn, true)
}

const select_content = editable_elem => {
    const range = document.createRange()
    range.selectNodeContents(editable_elem)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
}

/**
 * Examples of strings matched by these regular expressions:
 *   1. "½", "1½", "1 ½"
 *   2. "1/2", "1 / 2", "1 1/2", "1 1 / 2"
 *   3. "1", "1.2", "1,000", "1,000.2"
 *   4. "1", "1,2", "1.000", "1.000,2"
 *   5. "Half", "half"
 *
 * The decimal separator ("." or ",") is guessed automatically, assuming at most 2 decimal places.
 *
 * IDEA Deal with more textual quantities, e.g. "one", "pair", "couple", "dozen"...
 * "two halves"? "two pairs"? "half a dozen"? "half a pair"!?
 */
const qty_regexps = [
    /([1-9]\d*\s?)?(½|⅓|⅔|¼|¾|⅕|⅖|⅗|⅘|⅙|⅚|⅐|⅛|⅜|⅝|⅞|⅑|⅒)/,
    /([1-9]\d*\s)?[1-9]\d*\s?\/\s?[1-9]\d*/,
    /[1-9](\d|,\d{3})*(\.\d{1,2})?/,
    /[1-9](\d|\.\d{3})*(,\d{1,2})?/,
    /[Hh]alf/
]

const qty_match = str => qty_regexps
    .map(regexp => regexp.exec(str))
    .filter(match => !!match)
    .map(match => Object.assign(match[0], {index: match.index}))
    .reduce((a, b) => a.length > b.length ? a : b, '')

const parse_num = str => {
    // Deal with textual quantities, then remove trailing non-digits, to cover the case when the user is still typing.
    str = str
        .replace(/[Hh]alf/, '1/2')
        .replace(/[.,/a-zA-Z\s]+$/, '')

    if (!str || !qty_match(str))
        return

    // A plus sign is prepended to fractions in case there is a number in front of them.
    str = str
        .replace('½', '+1/2')
        .replace('⅓', '+1/3')
        .replace('⅔', '+2/3')
        .replace('¼', '+1/4')
        .replace('¾', '+3/4')
        .replace('⅕', '+1/5')
        .replace('⅖', '+2/5')
        .replace('⅗', '+3/5')
        .replace('⅘', '+4/5')
        .replace('⅙', '+1/6')
        .replace('⅚', '+5/6')
        .replace('⅐', '+1/7')
        .replace('⅛', '+1/8')
        .replace('⅜', '+3/8')
        .replace('⅝', '+5/8')
        .replace('⅞', '+7/8')
        .replace('⅑', '+1/9')
        .replace('⅒', '+1/10')
        .replace(/(\d+)\s+(\d+)\s*\/\s*(\d+)/, '$1+$2/$3')
        .replace(/[.,]([0-9]{3})/g, '$1')
        .replace(',', '.')

    // Only what fits one of the restricted regular expressions is evaluated.
    return eval(str)
}


// Create selection overlay.

const overlay = document.createElement('div')
overlay.style.pointerEvents = 'none'
overlay.style.position = 'fixed'
overlay.style.borderRadius = '1px'
overlay.style.zIndex = '10000'
overlay.style.backgroundColor = 'rgba(231, 76, 60, .5)'
overlay.style.transition = 'top .1s, left .1s, width .1s, height .1s'
body.appendChild(overlay)


// Update overlay in function of effective mouse moves relative to the content.

let prior_target

const off_mouseover = on(body, 'mousemove', ({target}) => {
    if (target === prior_target)
        return

    prior_target = target

    const {top, left, width, height} = target.getBoundingClientRect()
    overlay.style.top = top + 'px'
    overlay.style.left = left + 'px'
    overlay.style.width = width + 'px'
    overlay.style.height = height + 'px'
})

const hide_overlay = () => overlay.style.width = overlay.style.height = '0px'

const off_scroll = on(window, 'scroll', hide_overlay)


// Let the user pick a DOM element, inside which all quantities will become editable.

const make_all_quantities_editable = elem => {
    elem.normalize()

    const walker = document.createTreeWalker(elem, NodeFilter.SHOW_TEXT)
    let first = true

    while (walker.nextNode()) {
        let match
        while ((match = qty_match(walker.currentNode.nodeValue))) {
            const val_num = parse_num(match)
            if (isNaN(val_num) || !isFinite(val_num))
                return

            const span = document.createElement('span')
            span.textContent = match
            span.style.borderBottom = '2px solid rgba(231, 76, 60, .5)'
            span.classList.add('ra-ingredient-input')
            span.setAttribute('contenteditable', 'true')
            span.setAttribute('title', 'Original value: ' + match)
            span.setAttribute('data-ra-original-val-num', val_num)
            span.setAttribute('data-ra-original-val-was-fraction', '' + /½|⅓|⅔|¼|¾|⅕|⅖|⅗|⅘|⅙|⅚|⅐|⅛|⅜|⅝|⅞|⅑|⅒|\/|[Hh]alf/.test(match))

            // Remove the original string and insert the new editable element.
            const second_node = walker.currentNode.splitText(match.index)
            second_node.nodeValue = second_node.nodeValue.substr(match.length)
            walker.currentNode.parentNode.insertBefore(span, second_node)

            if (first) {
                first = false
                select_content(span)
            }

            // Advance the walker to the node after the newly inserted element.
            walker.nextNode()
            walker.nextNode()
        }
    }
}

const off_click = on(body, 'click', evt => {
    evt.preventDefault()
    evt.stopPropagation()

    hide_overlay()

    make_all_quantities_editable(prior_target)

    off_mouseover()
    off_scroll()
    off_click()
})


// Listen to changes on the editable quantities and propagate them proportionally.

if (document.body.getAttribute('data-ra-listening') !== 'true') {
    const get_original_val_num = input => parseFloat(input.getAttribute('data-ra-original-val-num'))

    const unit_is_measuring_spoon = input => {
        const parent = input.parentNode
        const parentText = parent.textContent.trim().length === input.textContent.length
            ? parent.parentNode.textContent
            : parent.textContent

        const measuring_spoon_regexps = ['teaspoon', 'tsp', 'tablespoon', 'tbsp', 'cup'].map(spoon => new RegExp('\\b' + spoon + 's?\\b', 'i'))

        for (const regexp of measuring_spoon_regexps) {
            if (regexp.test(parentText))
                return true
        }
        return false
    }

    const ish = (n, m) => Math.abs(n - m) <= 0.00000000000001

    const get_fraction = num => {
        const sensible_fractions = {
            '1/2': 1/2,
            '1/3': 1/3,
            '2/3': 2/3,
            '1/4': 1/4,
            '3/4': 3/4,
            '1/5': 1/5,
            '2/5': 2/5,
            '1/8': 1/8,
            '1/10': 1/10
        }

        for (const fr in sensible_fractions) {
            if (ish(num, sensible_fractions[fr]))
                return fr
        }
    }

    const pretty_num = (num, as_fraction) => {
        if (as_fraction) {
            const fr = get_fraction(num)
            if (fr)
                return fr
        }

        const str = num.toFixed(1)
        return str.endsWith('.0') ? str.slice(0, -2) : str
    }

    on(body, 'keyup', evt => {
        if (!evt.target.classList.contains('ra-ingredient-input'))
            return

        const current_val = parse_num(evt.target.textContent)
        const original_val = get_original_val_num(evt.target)
        const ratio = current_val / original_val
        if (isNaN(ratio) || !isFinite(ratio))
            return

        for (const input of document.getElementsByClassName('ra-ingredient-input')) {
            if (input === evt.target)
                continue

            const new_val = get_original_val_num(input) * ratio
            const as_fraction = input.getAttribute('data-ra-original-val-was-fraction') === 'true' || unit_is_measuring_spoon(input)
            input.textContent = pretty_num(new_val, as_fraction)
        }
    })
}

document.body.setAttribute('data-ra-listening', 'true')

}
