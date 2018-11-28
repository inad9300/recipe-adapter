{

/**
 * Main program.
 */
setup_elem_picker()
setup_change_propagation()

/**
 * Let the user pick a DOM element and make all quantities inside it editable.
 */
function setup_elem_picker() {
    let last_hovered_elem

    const off_mouseover = on(document.body, 'mouseover', on_mouseover)
    const off_mouseout = on(document.body, 'mouseout', on_mouseout)
    const off_click = on(document.body, 'click', on_click)

    function on_mouseover(evt) {
        last_hovered_elem = evt.target
        add_bg(last_hovered_elem)
    }

    function on_mouseout(evt) {
        remove_bg(evt.target)
    }

    function on_click() {
        remove_bg(last_hovered_elem)
        make_all_quantities_editable(last_hovered_elem)

        off_mouseover()
        off_mouseout()
        off_click()
    }
}

function add_bg(elem) {
    elem.classList.add('ra-ingredient-list-selector')
}

function remove_bg(elem) {
    elem.classList.remove('ra-ingredient-list-selector')
}

function make_all_quantities_editable(elem) {
    elem.normalize()

    const walker = document.createTreeWalker(elem, NodeFilter.SHOW_TEXT)
    let first = true

    while (walker.nextNode()) {
        let match
        while ((match = best_qty_match(walker.currentNode.nodeValue))) {
            const original_val = match[0]
            const val_num = str_to_num(original_val)
            if (isNaN(val_num) || !isFinite(val_num)) {
                return
            }

            const span = document.createElement('span')
            span.textContent = original_val
            span.classList.add('ra-ingredient-input')
            span.setAttribute('contenteditable', 'true')
            span.setAttribute('title', 'Original value: ' + original_val)
            span.setAttribute('data-ra-original-val-num', val_num)
            span.setAttribute('data-ra-original-val-was-fraction', '' + /½|⅓|⅔|¼|¾|⅕|⅖|⅗|⅘|⅙|⅚|⅐|⅛|⅜|⅝|⅞|⅑|⅒|\//.test(original_val))

            // Remove the original string and insert the new editable element.
            const second_node = walker.currentNode.splitText(match.index)
            second_node.nodeValue = second_node.nodeValue.substr(original_val.length)
            walker.currentNode.parentNode.insertBefore(span, second_node)

            if (first) {
                first = false
                select_or_focus(span)
            }

            // Advance the walker to the node after the newly inserted element.
            walker.nextNode()
            walker.nextNode()
        }
    }
}

/**
 * Listen to changes on the editable quantities and propagate them proportionally.
 */
function setup_change_propagation() {
    if (document.body.getAttribute('data-ra-listening') === 'true') {
        return
    }

    on(document.body, 'keyup', evt => {
        if (!evt.target.classList.contains('ra-ingredient-input')) {
            return
        }

        const current_val = str_to_num(evt.target.textContent)
        const original_val = get_original_val_num(evt.target)
        const ratio = current_val / original_val
        if (isNaN(ratio) || !isFinite(ratio)) {
            return
        }

        for (const input of document.getElementsByClassName('ra-ingredient-input')) {
            if (input === evt.target) {
                continue
            }

            const new_val = get_original_val_num(input) * ratio
            const as_fraction = input.getAttribute('data-ra-original-val-was-fraction') === 'true'
                || unit_is_measuring_spoon(input)
            input.textContent = num_to_str(new_val, as_fraction)
        }
    })

    document.body.setAttribute('data-ra-listening', 'true')
}

function unit_is_measuring_spoon(input) {
    const parent = input.parentNode
    const parentText = parent.textContent.trim().length === input.textContent.length
        ? parent.parentNode.textContent
        : parent.textContent

    const measuring_spoon_regexps = ['tablespoon', 'tbsp', 'cup', 'teaspoon', 'tsp']
        .map(spoon => new RegExp('\\b' + spoon + 's?\\b', 'i'))

    for (const regexp of measuring_spoon_regexps) {
        if (regexp.test(parentText)) {
            return true
        }
    }
    return false
}

function get_original_val_num(input) {
    return parseFloat(input.getAttribute('data-ra-original-val-num'))
}

/**
 * Examples of strings matched by these regular expressions:
 *   1. "½", "1½", "1 ½"
 *   2. "1/2", "1 / 2", "1 1/2", "1 1 / 2"
 *   3. "1", "1.2", "1,000"
 *   4. "1", "1,2", "1.000"
 *   5. "Half", "half"
 *
 * The meanings of "." and "," are guessed automatically with the assumption
 * that at most 2 decimal places are used.
 */
const qty_regexps = [
    /([1-9]\d*\s?)?(½|⅓|⅔|¼|¾|⅕|⅖|⅗|⅘|⅙|⅚|⅐|⅛|⅜|⅝|⅞|⅑|⅒)/,
    /([1-9]\d*\s)?[1-9]\d*\s?\/\s?[1-9]\d*/,
    /[1-9](\d|,\d{3})*(\.\d{1,2})?/,
    /[1-9](\d|\.\d{3})*(,\d{1,2})?/,
    /[Hh]alf/
]

function best_qty_match(str) {
    let best
    for (const r of qty_regexps) {
        const match = r.exec(str)
        if (match && match[0].length > best.length) {
            best = match
        }
    }
    return best
}

/**
 * Get a numeric value usable in computations out of the given string.
 */
function str_to_num(str) {
    // Remove trailing non-digits, to cover the case when the user is still typing.
    str = str.replace(/[.,/a-zA-Z\s]+$/, '')

    if (!str || !best_qty_match(str)) {
        return
    }

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
        .replace(/[Hh]alf/, '1/2')

    // Only what fits one of the restricted regular expressions is evaluated.
    return eval(str)
}

/**
 * Get a nice string representation of the given number.
 */
function num_to_str(num, as_fraction) {
    if (as_fraction) {
        const fr = get_fraction(num)
        if (fr) {
            return fr
        }
    }

    const str = num.toFixed(1)
    return str.endsWith('.0') ? str.slice(0, -2) : str

    function get_fraction(num) {
        const sensible_fractions = {
            '1/2': 1/2,
            '1/3': 1/3,
            '2/3': 2/3,
            '1/4': 1/4,
            '3/4': 3/4,
            '1/5': 1/5,
            '2/5': 2/5,
            '1/10': 1/10
        }

        for (const fr in sensible_fractions) {
            if (ish(num, sensible_fractions[fr])) {
                return fr
            }
        }
    }
}

/**
 * Check if two numbers are approximately the same, avoiding precission problems.
 */
function ish(n, m) {
    return +n.toFixed(16) === +m.toFixed(16)
}

/**
 * Shortcut for listening to events on DOM elements.
 */
function on(elem, evt, fn) {
    elem.addEventListener(evt, fn)

    return function off() {
        elem.removeEventListener(evt, fn)
    }
}

/**
 * Try to select the contents of the given element, falling back to simply focusing the element.
 */
function select_or_focus(elem) {
    try {
        const range = document.createRange()
        range.selectNodeContents(elem)
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
    } catch (e) {
        elem.focus()
    }
}

}
